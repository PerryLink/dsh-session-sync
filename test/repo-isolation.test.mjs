// test/repo-isolation.test.mjs — repoDir 必须是自身工作树的根（真实 git + 临时目录）。
// 回归：repoDir 位于无关外层仓库子目录时，bootstrap 不得把 config/origin/提交
// 写进外层仓库（劫持），而应在 repoDir 初始化独立镜像仓库。
// 隔离纪律：所有仓库建在 os.tmpdir() 下，且断言 --show-toplevel 与预期一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { GitBackend } from '../lib/git.mjs'

const GIT_OK = (() => {
  try {
    return spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0
  } catch {
    return false
  }
})()

function realRunner(args, opts = {}) {
  const res = spawnSync('git', args, {
    cwd: opts.cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    encoding: opts.binary === true ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  const stdout = opts.binary === true ? (res.stdout ?? Buffer.alloc(0)) : String(res.stdout ?? '')
  return Promise.resolve({ code: res.status ?? 0, stdout, stderr: String(res.stderr ?? '') })
}

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }, windowsHide: true })
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`)
  return String(res.stdout ?? '').trim()
}

async function makeTemp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-isolation-'))
  return { root, clean: () => fs.rm(root, { recursive: true, force: true }) }
}

function backend(repoDir, remote = 'https://example.com/sync.git') {
  return new GitBackend({
    repoDir,
    remote,
    branch: 'main',
    commitName: 'sync-identity',
    commitEmail: 'sync@local',
    run: realRunner,
    timeoutMs: 60000,
  })
}

/** 建一个带独特身份与 origin 的外层仓库，并断言其工作树根就是预期目录。 */
async function makeOuter(root) {
  const outer = path.join(root, 'outer')
  await fs.mkdir(outer, { recursive: true })
  git(outer, 'init', '-b', 'main')
  git(outer, 'config', 'user.name', 'OUTER-NAME')
  git(outer, 'config', 'user.email', 'outer@example.com')
  git(outer, 'remote', 'add', 'origin', 'https://example.com/outer.git')
  await fs.writeFile(path.join(outer, 'file.txt'), 'outer\n')
  git(outer, 'add', '.')
  git(outer, 'commit', '-m', 'outer commit')
  assert.equal(path.resolve(git(outer, 'rev-parse', '--show-toplevel')), path.resolve(outer), 'fixture isolation: outer toplevel')
  return outer
}

test('bootstrap inside an outer worktree initializes a dedicated repo and never touches the outer', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const outer = await makeOuter(root)
  const outerHead = git(outer, 'rev-parse', 'HEAD')
  const outerCount = git(outer, 'rev-list', '--count', 'HEAD')

  const repoDir = path.join(outer, 'mirror')
  await fs.mkdir(repoDir, { recursive: true })
  await backend(repoDir).bootstrap()

  // 外层仓库分毫不动：身份、origin、HEAD、提交数。
  assert.equal(git(outer, 'config', 'user.name'), 'OUTER-NAME')
  assert.equal(git(outer, 'config', 'user.email'), 'outer@example.com')
  assert.equal(git(outer, 'remote', 'get-url', 'origin'), 'https://example.com/outer.git')
  assert.equal(git(outer, 'rev-parse', 'HEAD'), outerHead)
  assert.equal(git(outer, 'rev-list', '--count', 'HEAD'), outerCount)

  // 内层独立仓库：自己的 .git、配置的身份与 origin。
  assert.equal((await fs.stat(path.join(repoDir, '.git'))).isDirectory(), true)
  assert.equal(path.resolve(git(repoDir, 'rev-parse', '--show-toplevel')), path.resolve(repoDir), 'fixture isolation: inner toplevel')
  assert.equal(git(repoDir, 'config', 'user.name'), 'sync-identity')
  assert.equal(git(repoDir, 'remote', 'get-url', 'origin'), 'https://example.com/sync.git')
})

test('isRepo is true only at the worktree root, not inside an outer worktree', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const outer = await makeOuter(root)

  const inner = path.join(outer, 'mirror')
  await fs.mkdir(inner, { recursive: true })
  assert.equal(await backend(inner).isRepo(), false, 'a bare subdirectory of an outer repo is not our repo')
  assert.equal(await backend(outer).isRepo(), true, 'the outer root is a repo root')

  const plain = path.join(root, 'plain')
  await fs.mkdir(plain, { recursive: true })
  assert.equal(await backend(plain).isRepo(), false, 'a non-repo directory is not a repo')

  await backend(inner).bootstrap()
  assert.equal(await backend(inner).isRepo(), true, 'after init the dedicated dir is its own root')
  assert.equal(await backend(outer).isRepo(), true, 'the outer root stays its own root')
})

test('a second bootstrap is idempotent and still leaves the outer untouched', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const outer = await makeOuter(root)
  const repoDir = path.join(outer, 'mirror')
  await fs.mkdir(repoDir, { recursive: true })
  const b = backend(repoDir)
  await b.bootstrap()
  const innerHead = git(repoDir, 'rev-parse', 'HEAD')
  const outerHead = git(outer, 'rev-parse', 'HEAD')
  await b.bootstrap()
  assert.equal(git(repoDir, 'rev-parse', 'HEAD'), innerHead, 'no empty commit on the second bootstrap')
  assert.equal(git(outer, 'rev-parse', 'HEAD'), outerHead)
  assert.equal(git(outer, 'config', 'user.name'), 'OUTER-NAME')
  assert.equal(git(outer, 'remote', 'get-url', 'origin'), 'https://example.com/outer.git')
})

test('a case-variant repoDir path at the true root is still the same repo (Windows)', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  if (process.platform !== 'win32') return t.skip('case-insensitive paths are Windows-specific; the symlink test pins realpath on POSIX')
  const { root, clean } = await makeTemp()
  t.after(clean)
  const repoDir = path.join(root, 'MirrorCase')
  await fs.mkdir(repoDir, { recursive: true })
  await backend(repoDir).bootstrap()
  const head = git(repoDir, 'rev-parse', 'HEAD')
  const variant = path.join(root, 'mirrorcase')
  assert.equal(await backend(variant).isRepo(), true, 'realpath must canonicalize case, not compare raw strings')
  await backend(variant).bootstrap()
  assert.equal(git(repoDir, 'rev-parse', 'HEAD'), head, 'no spurious re-init or commit')
})

test('a symlinked repoDir resolves to its target root', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const target = path.join(root, 'target')
  await fs.mkdir(target, { recursive: true })
  await backend(target).bootstrap()
  const head = git(target, 'rev-parse', 'HEAD')
  const link = path.join(root, 'link')
  try {
    await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') return t.skip('directory link creation not permitted here')
    throw error
  }
  assert.equal(await backend(link).isRepo(), true, 'realpath must resolve the link to the target root')
  await backend(link).bootstrap()
  assert.equal(git(target, 'rev-parse', 'HEAD'), head, 'bootstrap through the link touches only the target repo')
})
