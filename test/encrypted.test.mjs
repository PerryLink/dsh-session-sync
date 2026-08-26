// test/encrypted.test.mjs — age 加密后端（mock age + 真实 git / 临时目录）。
// 覆盖：无 age 降级（probeMode → plaintext + 警告）、mergeTrees 三分支语义、
// encryptTree/decryptTree 往返、真实 git 上的加密 push/pull 端到端（远端只存密文）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { GitBackend } from '../lib/git.mjs'
import { EncryptedBackend, mergeTrees, encryptTree, decryptTree } from '../lib/encrypted.mjs'

const HEADER = 'AGE-MOCK:'
const GIT_OK = (() => {
  try {
    return spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0
  } catch {
    return false
  }
})()

/** mock age runner：--version 探测 + -r/-d 可逆文件变换（加/去头）。 */
function makeAgeRunner({ present = true } = {}) {
  return async (args) => {
    if (args[1] === '--version') {
      return present
        ? { code: 0, stdout: 'v1.0.0\n', stderr: '' }
        : { code: 127, stdout: '', stderr: 'age: command not found' }
    }
    const outIndex = args.indexOf('-o')
    const outPath = args[outIndex + 1]
    const inPath = args[outIndex + 2]
    const content = await fs.readFile(inPath)
    if (args.includes('-r')) {
      await fs.mkdir(path.dirname(outPath), { recursive: true })
      await fs.writeFile(outPath, Buffer.concat([Buffer.from(HEADER), content]))
    } else {
      const text = content.toString('latin1')
      if (!text.startsWith(HEADER)) return { code: 1, stdout: '', stderr: 'not age-encrypted' }
      await fs.writeFile(outPath, content.subarray(HEADER.length))
    }
    return { code: 0, stdout: '', stderr: '' }
  }
}

function stubLogger() {
  return { debug() {}, info() {}, warn() {}, error() {} }
}

test('encrypted backend degrades to plaintext with a warning when age is absent', async () => {
  const backend = new EncryptedBackend({
    git: {},
    sessionRoot: '/tmp/sessions',
    repoDir: '/tmp/repo',
    remote: '',
    branch: 'main',
    deviceId: 'aaaaaaaa',
    reportMeta() {},
    reportError() {},
    onForks() {},
    logger: stubLogger(),
    run: makeAgeRunner({ present: false }),
    ageBin: 'age',
    ageRecipient: 'age1mock',
    ageIdentity: 'identity.txt',
    timeoutMs: 5000,
  })
  const selection = await backend.probeMode()
  assert.equal(selection.mode, 'plaintext')
  assert.ok(selection.warnings.some(w => /age binary not found/u.test(w)))
})

test('encrypted backend resolves encrypted mode when age + keys are present', async () => {
  const backend = new EncryptedBackend({
    git: {},
    sessionRoot: '/tmp/sessions',
    repoDir: '/tmp/repo',
    remote: '',
    branch: 'main',
    deviceId: 'aaaaaaaa',
    reportMeta() {},
    reportError() {},
    onForks() {},
    logger: stubLogger(),
    run: makeAgeRunner({ present: true }),
    ageBin: 'age',
    ageRecipient: 'age1mock',
    ageIdentity: 'identity.txt',
    timeoutMs: 5000,
  })
  assert.deepEqual(await backend.probeMode(), { mode: 'encrypted', warnings: [] })
})

test('mergeTrees keeps ours + forks theirs on append-both and adopts theirs-only', () => {
  const base = new Map([['a/log.jsonl', Buffer.from('line1\n')]])
  const ours = new Map([['a/log.jsonl', Buffer.from('line1\nours\n')]])
  const theirs = new Map([
    ['a/log.jsonl', Buffer.from('line1\ntheirs\n')],
    ['b/new.jsonl', Buffer.from('theirs-only\n')],
  ])
  const { merged, forks, adopted, appended, diverged } = mergeTrees(base, ours, theirs, '20260815120000', 'aaaaaaaa')
  assert.equal(appended, 1)
  assert.equal(diverged, 0)
  assert.equal(adopted, 1)
  assert.equal(merged.get('a/log.jsonl').toString(), 'line1\nours\n', 'local version kept')
  assert.equal(merged.get('b/new.jsonl').toString(), 'theirs-only\n', 'remote-only file adopted')
  assert.equal(forks.length, 1)
  const forkRel = forks[0]
  assert.match(forkRel, /a\/log\.jsonl\.remote-fork-20260815120000-aaaaaaaa/u)
  assert.equal(merged.get(forkRel).toString(), 'line1\ntheirs\n', 'remote version preserved as fork file')
})

test('encryptTree/decryptTree roundtrip preserves every file byte', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-enc-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const plain = path.join(root, 'plain')
  const enc = path.join(root, 'enc')
  const plain2 = path.join(root, 'plain2')
  await fs.mkdir(path.join(plain, 's1'), { recursive: true })
  await fs.writeFile(path.join(plain, 's1', 'log.jsonl'), 'line1\n')
  await fs.writeFile(path.join(plain, 's1', 'blob.bin'), Buffer.from([0x00, 0xff, 0x28]))
  const run = makeAgeRunner({ present: true })
  const deps = { run, ageBin: 'age', recipient: 'age1mock', identity: 'identity.txt', timeoutMs: 5000 }

  const count = await encryptTree(plain, enc, deps)
  assert.equal(count, 2)
  const decrypted = await decryptTree(enc, deps)
  assert.deepEqual([...decrypted.get('s1/log.jsonl')], [...Buffer.from('line1\n')])
  assert.deepEqual([...decrypted.get('s1/blob.bin')], [0x00, 0xff, 0x28])
  // 明文树里删除一个文件后重加密，密文里的对应文件也应清理。
  await fs.unlink(path.join(plain, 's1', 'log.jsonl'))
  await encryptTree(plain, enc, deps)
  const remaining = await decryptTree(enc, deps)
  assert.equal(remaining.has('s1/log.jsonl'), false)
  assert.equal(remaining.has('s1/blob.bin'), true)
})

test('encrypted end-to-end: push, pull, append-both fork over real git', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-e2e-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const remotePath = path.join(root, 'remote.git')
  spawnSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' })

  const eventsA = { meta: [], errors: [], forks: [] }
  const eventsB = { meta: [], errors: [], forks: [] }
  const a = await setupDevice(root, 'A', 'aaaaaaaa', remotePath, eventsA)
  const b = await setupDevice(root, 'B', 'bbbbbbbb', remotePath, eventsB)

  // 1) A 首推：远端只有密文，不出现明文会话字节。
  await writeSession(a.sessionRoot, 's1/log.jsonl', 'line1\n')
  const push1 = await a.backend.push()
  assert.equal(push1.ok, true, `A first push failed: ${push1.error}`)
  assert.deepEqual(push1.warnings, [])
  const cipher = await a.git.readFileAtRev('HEAD', 'encrypted/s1/log.jsonl.age')
  assert.ok(cipher !== undefined, 'encrypted mirror file is tracked')
  assert.ok(cipher.toString('latin1').startsWith(HEADER), 'committed blob is transformed (ciphertext)')
  assert.notEqual(cipher.toString('latin1'), 'line1\n')

  // 2) B 首拉：解密后明文到位（unrelated histories 无基点 → 全 adopt）。
  const pull2 = await b.backend.pull()
  assert.equal(pull2.ok, true, `B first pull failed: ${pull2.error}`)
  assert.equal(await readWorktree(b.repoDir, 'sessions/s1/log.jsonl'), 'line1\n')

  // 3) 双边追加 → 拉取 = append-both → 本地保留 + 远端转 fork。
  await writeSession(a.sessionRoot, 's1/log.jsonl', 'line1\nA-more\n')
  const push3 = await a.backend.push()
  assert.equal(push3.ok, true)
  await writeSession(b.sessionRoot, 's1/log.jsonl', 'line1\nB-more\n')
  const pull4 = await b.backend.pull()
  assert.equal(pull4.ok, true, `append-both pull failed: ${pull4.error}`)
  assert.equal(pull4.appended, 1)
  assert.equal(pull4.forks.length, 1)
  assert.equal(await readWorktree(b.repoDir, 'sessions/s1/log.jsonl'), 'line1\nB-more\n')
  assert.equal(await readWorktree(b.repoDir, pull4.forks[0]), 'line1\nA-more\n')
  assert.ok(eventsB.forks.includes(pull4.forks[0]))
})

/** 测试专用真实 git runner（生产路径是 ctx.subprocess，lib 契约一致）。 */
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

async function setupDevice(root, name, deviceId, remotePath, events) {
  const sessionRoot = path.join(root, name, 'sessions')
  const repoDir = path.join(root, name, 'repo')
  await fs.mkdir(sessionRoot, { recursive: true })
  const git = new GitBackend({
    repoDir,
    remote: remotePath,
    branch: 'main',
    commitName: 'test-sync',
    commitEmail: 'test@local',
    run: realRunner,
    timeoutMs: 60000,
  })
  const backend = new EncryptedBackend({
    git,
    sessionRoot,
    repoDir,
    remote: remotePath,
    branch: 'main',
    deviceId,
    reportMeta: (patch) => { events.meta.push(patch) },
    reportError: (message) => { events.errors.push(message) },
    onForks: (forkPaths) => { events.forks.push(...forkPaths) },
    logger: stubLogger(),
    run: makeAgeRunner({ present: true }),
    ageBin: 'age',
    ageRecipient: 'age1mock',
    ageIdentity: 'identity.txt',
    timeoutMs: 60000,
  })
  return { sessionRoot, repoDir, backend, git }
}

async function writeSession(sessionRoot, rel, content) {
  const target = path.join(sessionRoot, ...rel.split('/'))
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
}

async function readWorktree(repoDir, rel) {
  return fs.readFile(path.join(repoDir, ...rel.split('/')), 'utf8')
}
