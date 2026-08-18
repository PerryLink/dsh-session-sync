// test/adversarial.test.mjs — U6 对抗 fixture（fake git 多行为模式，密封无网络）。
//
// 覆盖两类 git 子进程病理行为：挂死超时（makeRunGit 的 commandTimeoutMs 响亮超时）
// 与认证失败（push 以 PUSH_REJECTED 分类 + 错误消息中的凭据被脱敏，绝不泄漏）。
// 冲突/分歧路径已由 engine.test.mjs（真实 git fork/diverged/rejected-push）与
// git.test.mjs（merge 冲突三态、PUSH_REJECTED）覆盖，此处不重复。
// @module dsh-session-sync/test/adversarial.test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeRunGit } from '../index.mjs'
import { GitBackend } from '../lib/git.mjs'
import { SyncError } from '../lib/errors.mjs'

test('makeRunGit times out a hung git subprocess with a loud error', async () => {
  const subprocess = {
    resolveExecutable: async () => 'git',
    spawn: ({ signal }) => ({
      stdout: (async function* () {})(),
      // 挂死：done 只在 signal abort 后才 settle（真实子进程被终止时）。
      done: new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true })
      }),
      collected: {
        stdout: { readFrom: () => ({ text: '' }) },
        stderr: { readFrom: () => ({ text: '' }) },
      },
    }),
  }
  const runGit = makeRunGit(/** @type {any} */ (subprocess), {
    gitBin: 'git',
    graceMs: 1000,
    commandTimeoutMs: 60,
    maxOutputBytes: 4096,
  })
  await assert.rejects(runGit(['status'], { cwd: 'C:/work' }), /timed out after 60ms/u)
})

test('push wraps an auth failure as PUSH_REJECTED with credentials redacted', async () => {
  const git = new GitBackend({
    repoDir: '/repo',
    remote: 'https://user:secret@host/r.git',
    branch: 'main',
    commitName: 'sync',
    commitEmail: 'sync@local',
    run: async () => ({ code: 128, stdout: '', stderr: 'fatal: Authentication failed for https://user:secret@host/r.git/' }),
    timeoutMs: 30000,
  })
  await assert.rejects(git.push(), (error) => {
    assert.ok(error instanceof SyncError)
    assert.equal(error.code, 'PUSH_REJECTED')
    assert.ok(!error.message.includes('user:secret'), 'userinfo credentials must be redacted')
    assert.ok(!error.message.includes('secret'), 'password must be redacted')
    assert.match(error.message, /Authentication failed/u, 'the failure reason is preserved')
    return true
  })
})
