// test/paths.test.mjs — 路径解析、嵌套校验与 fork 命名。

import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  resolveSessionRoot,
  resolveRepoDir,
  assertNestingSafe,
  assertRelPath,
  decodeSegment,
  mirrorPathOf,
  sessionIdOfForkPath,
  forkFileName,
} from '../lib/paths.mjs'

// 路径解析函数返回原生（平台相关）绝对路径：期望值用同一 node:path 原语
// 计算，保证测试在 Windows（反斜杠）与 POSIX（正斜杠）都成立。
test('sessionRoot resolves to $DSH_HOME/sessions when unset', () => {
  assert.equal(resolveSessionRoot('', '/home/u/.dsh'), path.join('/home/u/.dsh', 'sessions'))
  assert.equal(resolveSessionRoot('/custom/root', '/home/u/.dsh'), path.resolve('/custom/root'))
  assert.throws(() => resolveSessionRoot('', ''), /sessionRoot is empty/)
})

test('repoDir resolves to $DSH_HOME/dsh-session-sync/repo when unset', () => {
  assert.equal(resolveRepoDir('', '/home/u/.dsh'), path.join('/home/u/.dsh', 'dsh-session-sync', 'repo'))
  assert.equal(resolveRepoDir('/custom/repo', '/home/u/.dsh'), path.resolve('/custom/repo'))
  assert.throws(() => resolveRepoDir('', ''), /repoDir is empty/)
})

test('nesting safety rejects mirror recursion in both directions', () => {
  assert.throws(() => assertNestingSafe('/a/sessions', '/a/sessions/repo'), /inside sessionRoot/)
  assert.throws(() => assertNestingSafe('/a/repo/sessions', '/a/repo'), /inside repoDir/)
  assert.doesNotThrow(() => assertNestingSafe('/a/sessions', '/b/repo'))
})

test('relative path validation rejects traversal and absolute forms', () => {
  assert.equal(assertRelPath('sessions/s1/log.jsonl'), 'sessions/s1/log.jsonl')
  assert.throws(() => assertRelPath('../etc/passwd'), /traversal/)
  assert.throws(() => assertRelPath('sessions/../other'), /traversal/)
  assert.throws(() => assertRelPath('/etc/passwd'), /traversal/)
  assert.throws(() => assertRelPath('sessions//double'), /traversal/)
  assert.throws(() => assertRelPath(''), /non-empty/)
  assert.throws(() => assertRelPath('a\\b'), /reserved/)
  assert.throws(() => assertRelPath('a\0b'), /reserved/)
})

test('mirrorPathOf joins validated relative paths under the worktree mirror', () => {
  assert.equal(mirrorPathOf('/repo', 'sessions', 's1/log.jsonl'), path.join('/repo', 'sessions', 's1', 'log.jsonl'))
  assert.throws(() => mirrorPathOf('/repo', 'sessions', '../evil'), /traversal/)
})

test('fork file names are normalized and never collide on timestamp/device', () => {
  assert.equal(
    forkFileName('log.jsonl', '20260815120000', 'a1b2c3d4'),
    'log.jsonl.remote-fork-20260815120000-a1b2c3d4',
  )
  assert.equal(forkFileName('log', 'bad-stamp', 'SHORT'), 'log.remote-fork-19700101000000-short')
  assert.equal(forkFileName('log', '20260815120000', 'x'.repeat(20)), 'log.remote-fork-20260815120000-unknown')
})

// 生成口径（engine.mjs / encrypted.mjs）= ISO 剔除 `-`/`:`/`T` 后截断 14 位。
// 该戳必须被 forkFileName 原样接受；残留 `T` 的旧口径必须仍被拒绝并回退纪元。
test('fork file names accept the generator-shaped 14-digit UTC stamp verbatim', () => {
  const iso = '2026-09-09T13:52:31.123Z'
  const generated = new Date(iso).toISOString().replace(/[-:T]/gu, '').slice(0, 14)
  assert.equal(generated, '20260909135231')
  assert.match(generated, /^\d{14}$/u)
  assert.notEqual(generated, '19700101000000')
  assert.equal(
    forkFileName('session.v3.jsonl.zstd', generated, 'deadbeef'),
    `session.v3.jsonl.zstd.remote-fork-${generated}-deadbeef`,
  )
  // 回归护栏：只去掉 `-`/`:` 会留下 `T`（13 位数字 + T），必须落回纪元而非被
  // 当成有效戳写进文件名。
  const legacy = new Date(iso).toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 14)
  assert.equal(legacy, '20260909T13523')
  assert.doesNotMatch(legacy, /^\d{14}$/u)
  assert.equal(forkFileName('log.jsonl', legacy, 'deadbeef'), 'log.jsonl.remote-fork-19700101000000-deadbeef')
})

// 宿主权威布局 = sessions/<projectKey>/<sessionId>/<file>（projectKey 由 cwd 计算，
// 缺省 _no-cwd；sessionId 经 encodeSegment 转义）。全部为合成字符串，不触碰
// 任何真实会话目录。
test('fork paths map to the session id under the host project/session layout', () => {
  assert.equal(
    sessionIdOfForkPath('sessions/--D-proj--/abc/session.v3.jsonl.zstd.remote-fork-20260909000000-deadbeef'),
    'abc',
  )
  assert.equal(sessionIdOfForkPath('sessions/_no-cwd/abc/session.jsonl.remote-fork-20260909000000-deadbeef'), 'abc')
  assert.equal(sessionIdOfForkPath('sessions/--p--/a~007Efoo/session.v3.jsonl.zstd'), 'a~foo')
  // 旧扁平布局 <mirrorDir>/<sessionId>/<file> 保留宽松回退（末段形如文件名）——
  // 人工批准项①：宽松兼容，不破坏既有 fixture/遗留镜像语义。
  assert.equal(sessionIdOfForkPath('sessions/abc/log.jsonl'), 'abc')
  assert.equal(sessionIdOfForkPath('sessions/stray.txt'), undefined)
  assert.equal(sessionIdOfForkPath('sessions/--p--/abc'), undefined)
  assert.equal(sessionIdOfForkPath('sessions//abc/x/session.jsonl'), undefined)
  assert.equal(sessionIdOfForkPath('other/--p--/abc/session.jsonl'), undefined)
})

test('fork path mapping stays strict about shape and round-trips host escaping', () => {
  // 会话目录内更深一层仍映射到同一会话 id；目录/空段/`..` 一律拒绝。
  assert.equal(sessionIdOfForkPath('sessions/--p--/abc/nested/session.jsonl'), 'abc')
  assert.equal(sessionIdOfForkPath('sessions/--p--/abc/'), undefined)
  assert.equal(sessionIdOfForkPath('sessions/--p--/abc/../evil.jsonl'), undefined)
  assert.equal(sessionIdOfForkPath('sessions/--p--//session.jsonl'), undefined)
  assert.equal(sessionIdOfForkPath(''), undefined)
  assert.equal(sessionIdOfForkPath(undefined), undefined)
  assert.equal(sessionIdOfForkPath('sessions/--p--/abc/session.jsonl', 'mirror'), undefined)
  assert.equal(sessionIdOfForkPath('mirror/--p--/abc/session.jsonl', 'mirror'), 'abc')
  // encodeSegment 逆运算：`.`/`..`/`~`/非 ASCII 全部还原（宿主 format.ts:198-213）。
  assert.equal(decodeSegment('~002E'), '.')
  assert.equal(decodeSegment('~002E~002E'), '..')
  assert.equal(decodeSegment('a~007Efoo'), 'a~foo')
  assert.equal(decodeSegment('~4F60~597D'), '你好')
  assert.equal(decodeSegment('plain-id'), 'plain-id')
})
