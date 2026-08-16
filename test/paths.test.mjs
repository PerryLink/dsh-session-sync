// test/paths.test.mjs — 路径解析、嵌套校验与 fork 命名。

import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  resolveSessionRoot,
  resolveRepoDir,
  assertNestingSafe,
  assertRelPath,
  mirrorPathOf,
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
