// test/git.test.mjs — git 命令层（scripted runner：断言命令序列与安全边界）。
// 覆盖：动词/参数白名单（force push、reset、分支切换拒绝）、bootstrap 序列、
// 提交/push 拒绝分类、fetch 缺远端分支、merge --no-commit 三态、冲突路径解析、
// 索引阶段 blob 读取（二进制）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { GitBackend, assertSafe } from '../lib/git.mjs'
import { SyncError } from '../lib/errors.mjs'

/**
 * One scripted git step.
 * @typedef {{ assert?: unknown; error?: unknown; code?: number; stdout?: string | Buffer; stderr?: string }} ScriptedStep
 */

/** scripted runner：按命令序列返回；断言抛错带序列号。
 * @param {ScriptedStep[]} script
 * @returns {{ run: (args: string[], opts: unknown) => Promise<{code: number, stdout: string | Buffer, stderr: string}>, calls: Array<{args: string[], opts: unknown}> }}
 */
function makeScripted(script) {
  const calls = []
  const run = async (args, opts) => {
    calls.push({ args, opts })
    const step = script[calls.length - 1]
    if (step === undefined) {
      throw new Error(`unexpected git call #${calls.length}: ${args.join(' ')}`)
    }
    if (step.assert !== undefined) {
      assert.deepEqual(args, step.assert, `call #${calls.length}`)
    }
    if (step.error !== undefined) throw step.error
    return {
      code: step.code ?? 0,
      stdout: step.stdout ?? '',
      stderr: step.stderr ?? '',
    }
  }
  return { run, calls }
}

/** @param {ScriptedStep[]} script */
function makeGit(script) {
  const { run, calls } = makeScripted(script)
  const git = new GitBackend({
    repoDir: '/repo',
    remote: 'https://example.com/r.git',
    branch: 'main',
    commitName: 'sync',
    commitEmail: 'sync@local',
    run,
    timeoutMs: 30000,
  })
  return { git, calls }
}

test('whitelist rejects destructive verbs and force-push arguments', () => {
  assert.throws(() => assertSafe(['reset', '--hard', 'HEAD']), /forbidden/)
  assert.throws(() => assertSafe(['clean', '-f']), /forbidden/)
  assert.throws(() => assertSafe(['rebase', 'main']), /forbidden/)
  assert.throws(() => assertSafe(['push', '-f']), /force-push/)
  assert.throws(() => assertSafe(['push', '--force-with-lease']), /force-push/)
  assert.throws(() => assertSafe(['push', '+main:main']), /force-push/)
  assert.throws(() => assertSafe(['checkout', 'main']), /--ours\/--theirs/)
  assert.throws(() => assertSafe(['merge', 'origin/main']), /--no-commit/)
  assert.throws(() => assertSafe(['commit', '--amend', '-m', 'x']), /amend/)
  assert.doesNotThrow(() => assertSafe(['push', 'origin', 'HEAD:refs/heads/main']))
  assert.doesNotThrow(() => assertSafe(['checkout', '--ours', '--', 'a/b.jsonl']))
  assert.doesNotThrow(() => assertSafe(['merge', '--no-commit', 'abc123']))
  assert.doesNotThrow(() => assertSafe(['merge', '--no-commit', '--allow-unrelated-histories', 'abc123']))
  assert.doesNotThrow(() => assertSafe(['merge', '--abort']))
})

test('bootstrap sequence: init, identity, remote, initial commit', async () => {
  const { git, calls } = makeGit([
    { assert: ['rev-parse', '--is-inside-work-tree'], stdout: 'false\n' },
    { assert: ['init', '-b', 'main'] },
    { assert: ['config', 'core.autocrlf', 'false'] },
    { assert: ['config', 'user.name', 'sync'] },
    { assert: ['config', 'user.email', 'sync@local'] },
    { assert: ['remote', 'get-url', 'origin'], code: 2, stderr: 'no such remote' },
    { assert: ['remote', 'add', 'origin', 'https://example.com/r.git'] },
    { assert: ['rev-parse', '--verify', 'HEAD'], code: 128, stderr: 'Needed a single revision' },
    { assert: ['add', '-A'] },
    { assert: ['status', '--porcelain'], stdout: '' },
    { assert: ['commit', '-m', 'dsh-session-sync: initial commit', '--allow-empty'] },
    // commitAll 返回新 HEAD：落提交后再读一次 HEAD sha。
    { assert: ['rev-parse', '--verify', 'HEAD'], stdout: 'abc123\n' },
  ])
  await git.bootstrap()
  assert.equal(calls.length, 12)
})

test('bootstrap keeps existing repo and rewrites a changed remote url', async () => {
  const { git, calls } = makeGit([
    { stdout: 'true\n' }, // is-inside-work-tree
    { assert: ['config', 'core.autocrlf', 'false'] },
    {}, {}, // identity config
    { stdout: 'https://old.example.com/r.git\n' }, // remote get-url
    { assert: ['remote', 'set-url', 'origin', 'https://example.com/r.git'] },
    { stdout: 'abc123\n' }, // HEAD exists → no initial commit
  ])
  await git.bootstrap()
  assert.equal(calls.length, 7)
})

test('commitAll only commits when the worktree is dirty', async () => {
  const { git } = makeGit([
    { assert: ['add', '-A'] },
    { assert: ['status', '--porcelain'], stdout: '' }, // clean → no commit
  ])
  assert.equal(await git.commitAll('x'), null)
})

test('push wraps rejected pushes as PUSH_REJECTED (never retried with force)', async () => {
  const { git } = makeGit([
    { code: 1, stderr: '! [rejected] main -> main (fetch first)\nhint: Updates were rejected' },
  ])
  await assert.rejects(git.push(), (error) => {
    assert.ok(error instanceof SyncError)
    assert.equal(error.code, 'PUSH_REJECTED')
    return true
  })
})

test('fetch returns false when the remote has no such branch yet', async () => {
  const { git } = makeGit([
    { code: 1, stderr: "fatal: couldn't find remote ref main" },
  ])
  assert.equal(await git.fetch(), false)
})

test('fetch throws for real network failures (sanitized stderr)', async () => {
  const { git } = makeGit([
    { code: 128, stderr: 'fatal: unable to access \'https://u:p@example.com/r.git/\': 403' },
  ])
  await assert.rejects(git.fetch(), /unable to access/)
})

test('beginMerge reports the three merge states', async () => {
  const upToDate = makeGit([
    { code: 0, stdout: '', stderr: 'Already up to date.' },
  ])
  assert.deepEqual(await upToDate.git.beginMerge('abc'), { conflicted: false, inProgress: false })

  const clean = makeGit([
    { code: 0, stdout: 'Merge made by the \'ort\' strategy.' },
  ])
  assert.deepEqual(await clean.git.beginMerge('abc'), { conflicted: false, inProgress: true })

  const conflicted = makeGit([
    { code: 1, stderr: 'CONFLICT (content): Merge conflict in sessions/a/log.jsonl' },
    { assert: ['rev-parse', '--verify', 'MERGE_HEAD'], stdout: 'def456\n' },
  ])
  assert.deepEqual(await conflicted.git.beginMerge('abc'), { conflicted: true, inProgress: true })
})

test('conflictedPaths parses index stages per path', async () => {
  const { git } = makeGit([
    {
      stdout: [
        '100644 1111111111111111111111111111111111111111 1\tsessions/a/log.jsonl',
        '100644 2222222222222222222222222222222222222222 2\tsessions/a/log.jsonl',
        '100644 3333333333333333333333333333333333333333 3\tsessions/a/log.jsonl',
      ].join('\n'),
    },
  ])
  const paths = await git.conflictedPaths()
  assert.deepEqual(paths, [{
    path: 'sessions/a/log.jsonl',
    base: '1111111111111111111111111111111111111111',
    ours: '2222222222222222222222222222222222222222',
    theirs: '3333333333333333333333333333333333333333',
  }])
})

test('readStageBlob returns raw bytes in binary mode', async () => {
  const { git } = makeGit([
    { stdout: Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0x00, 0x01]) },
  ])
  const blob = await git.readStageBlob('3', 'sessions/a/log.jsonl')
  assert.deepEqual([...blob], [0x28, 0xb5, 0x2f, 0xfd, 0x00, 0x01])
})

test('readStageBlob returns undefined for a missing stage', async () => {
  const { git } = makeGit([
    { code: 128, stderr: 'pathspec did not match' },
  ])
  assert.equal(await git.readStageBlob('1', 'gone.jsonl'), undefined)
})

test('checkoutStage restricts to --ours/--theirs and passes explicit paths', async () => {
  const { git, calls } = makeGit([
    { assert: ['checkout', '--theirs', '--', 'sessions/a/log.jsonl'] },
    { assert: ['checkout', '--ours', '--', 'sessions/a/log.jsonl'] },
  ])
  await git.checkoutStage('theirs', 'sessions/a/log.jsonl')
  await git.checkoutStage('ours', 'sessions/a/log.jsonl')
  assert.equal(calls.length, 2)
})

test('commitMerge is a no-op without an in-progress merge', async () => {
  const { git } = makeGit([
    { code: 128, stderr: 'Needed a single revision' }, // no MERGE_HEAD
  ])
  assert.equal(await git.commitMerge(), null)
})
