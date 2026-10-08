// test/engine.test.mjs — 端到端同步引擎（真实 git + 真实临时目录）。
//
// 两个"设备"各自持有一个会话根与一个 git 工作树，指向同一个 bare remote。
// 覆盖：首推/首拉（unrelated histories 合并）、双边追加 → fork（两边保留）、
// 真实分歧 → fork + 响亮报告、push 被拒 → 拉取调和 → 重推、状态 ahead/behind、
// remote 缺失响亮失败、元数据回调。git 不可用时整文件跳过（附原因）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { GitBackend } from '../lib/git.mjs'
import { SyncEngine } from '../lib/engine.mjs'
import { sessionIdOfForkPath } from '../lib/paths.mjs'

const GIT_OK = (() => {
  try {
    const res = spawnSync('git', ['--version'], { stdio: 'ignore' })
    return res.status === 0
  } catch {
    return false
  }
})()

/** 测试专用真实 git runner（生产路径是 ctx.subprocess，lib 契约一致）。 */
function realRunner(args, opts = {}) {
  const res = spawnSync('git', args, {
    cwd: opts.cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    encoding: opts.binary === true ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  const stdout = opts.binary === true
    ? (res.stdout ?? Buffer.alloc(0))
    : String(res.stdout ?? '')
  return Promise.resolve({ code: res.status ?? 0, stdout, stderr: String(res.stderr ?? '') })
}

async function makeTemp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-engine-'))
  return { root, clean: () => fs.rm(root, { recursive: true, force: true }) }
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
  const engine = new SyncEngine({
    git,
    sessionRoot,
    repoDir,
    remote: remotePath,
    branch: 'main',
    deviceId,
    reportMeta: (patch) => { events.meta.push(patch) },
    reportError: (message) => { events.errors.push(message) },
    onForks: (forkPaths) => { events.forks.push(...forkPaths) },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  })
  return { sessionRoot, repoDir, engine, git }
}

async function writeSession(sessionRoot, rel, content) {
  const target = path.join(sessionRoot, ...rel.split('/'))
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
}

async function readWorktree(repoDir, rel) {
  return fs.readFile(path.join(repoDir, ...rel.split('/')), 'utf8')
}

test('engine end-to-end: push, adopt, append-both fork, diverged fork, rejected push', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const remotePath = path.join(root, 'remote.git')
  spawnSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' })

  const eventsA = { meta: [], errors: [], forks: [] }
  const eventsB = { meta: [], errors: [], forks: [] }
  const a = await setupDevice(root, 'A', 'aaaaaaaa', remotePath, eventsA)
  const b = await setupDevice(root, 'B', 'bbbbbbbb', remotePath, eventsB)

  // 1) A 首推：远端拿到分支。
  await writeSession(a.sessionRoot, 's1/log.jsonl', 'line1\n')
  const push1 = await a.engine.push()
  assert.equal(push1.ok, true, `A first push failed: ${push1.error}`)
  assert.equal(push1.pushed, true)
  assert.ok(eventsA.meta.some(patch => patch.lastPushHead !== undefined))

  // 2) B 首拉：unrelated histories 干净合并，内容到位。
  const pull2 = await b.engine.pull()
  assert.equal(pull2.ok, true, `B first pull failed: ${pull2.error}`)
  assert.equal(pull2.pulled, true)
  assert.equal(await readWorktree(b.repoDir, 'sessions/s1/log.jsonl'), 'line1\n')

  // 3) A 本地追加并推送。
  await writeSession(a.sessionRoot, 's1/log.jsonl', 'line1\nA-more\n')
  const push3 = await a.engine.push()
  assert.equal(push3.ok, true, `A second push failed: ${push3.error}`)

  // 4) B 本地也追加（内容不同）→ 拉取 = 双边追加 → 本地保留 + A 版本转 fork。
  await writeSession(b.sessionRoot, 's1/log.jsonl', 'line1\nB-more\n')
  const pull4 = await b.engine.pull()
  assert.equal(pull4.ok, true, `B append-both pull failed: ${pull4.error}`)
  assert.equal(pull4.appended, 1)
  assert.equal(pull4.diverged, 0)
  assert.equal(pull4.forks.length, 1)
  assert.equal(await readWorktree(b.repoDir, 'sessions/s1/log.jsonl'), 'line1\nB-more\n')
  const forkContent = await readWorktree(b.repoDir, pull4.forks[0])
  assert.equal(forkContent, 'line1\nA-more\n')
  assert.ok(eventsB.forks.includes(pull4.forks[0]))

  // 5) B 推送合并结果；A 拉取 → A 的 HEAD 是 B 合并提交的祖先（本地自上次
  //    push 后未变）→ fast-forward 干净采纳（无新 fork；A 的版本已在
  //    B 侧合并时留存为 fork 文件 + git 历史双保留）。
  const push5 = await b.engine.push()
  assert.equal(push5.ok, true, `B push failed: ${push5.error}`)
  const pull6 = await a.engine.pull()
  assert.equal(pull6.ok, true, `A pull failed: ${pull6.error}`)
  assert.equal(pull6.pulled, true)
  assert.equal(pull6.appended, 0)
  assert.equal(pull6.forks.length, 0)
  assert.equal(await readWorktree(a.repoDir, 'sessions/s1/log.jsonl'), 'line1\nB-more\n')
  const aStatus = await a.engine.status()
  assert.ok(aStatus.forks.some(fork => fork.includes('log.jsonl.remote-fork-')), 'A keeps the earlier fork file of its own version')

  // 6) 真实分歧：A 整段重写并推送；B 追加后拉取 → diverged + fork。
  await writeSession(a.sessionRoot, 's1/log.jsonl', 'rewritten-by-A\n')
  const push7 = await a.engine.push()
  assert.equal(push7.ok, true)
  await writeSession(b.sessionRoot, 's1/log.jsonl', 'line1\nB-more\nB-again\n')
  const pull8 = await b.engine.pull()
  assert.equal(pull8.ok, true, `diverged pull failed: ${pull8.error}`)
  assert.equal(pull8.diverged, 1)
  assert.equal(await readWorktree(b.repoDir, 'sessions/s1/log.jsonl'), 'line1\nB-more\nB-again\n')
  assert.equal(await readWorktree(b.repoDir, pull8.forks[0]), 'rewritten-by-A\n')

  // 7) push 被拒 → 拉取调和 → 重推成功（绝不强推）。
  //    A 先写 s3 并推送（远端领先）；B 写 s2（本地新提交）→ push 被拒 →
  //    引擎拉取 A 的新提交（干净合并）→ 重推一次成功。
  await writeSession(a.sessionRoot, 's3/a-new.jsonl', 'a-only\n')
  const push7b = await a.engine.push()
  assert.equal(push7b.ok, true, `A pre-rejection push failed: ${push7b.error}`)
  await writeSession(b.sessionRoot, 's2/other.jsonl', 'b-only\n')
  const push9 = await b.engine.push()
  assert.equal(push9.ok, true, `rejected-then-retried push failed: ${push9.error}`)
  assert.equal(await readWorktree(b.repoDir, 'sessions/s2/other.jsonl'), 'b-only\n')
  assert.equal(await readWorktree(b.repoDir, 'sessions/s3/a-new.jsonl'), 'a-only\n')

  // 8) 状态：ahead/behind 基于最近一次 fetch 的远端跟踪引用（status 只读不触网），
  //    先 fetch 再断言。
  await a.git.fetch()
  const status = await a.engine.status()
  assert.equal(status.ok, true, `A status failed: ${JSON.stringify(status.error)}`)
  assert.ok(status.behind >= 1, `A should be behind after B pushed (behind=${status.behind})`)
})

test('engine fork paths carry the host project/session layout and map to the session id', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const remotePath = path.join(root, 'remote.git')
  spawnSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' })
  const eventsA = { meta: [], errors: [], forks: [] }
  const eventsB = { meta: [], errors: [], forks: [] }
  const a = await setupDevice(root, 'A', 'aaaaaaaa', remotePath, eventsA)
  const b = await setupDevice(root, 'B', 'bbbbbbbb', remotePath, eventsB)

  // 真实宿主布局（$DSH_HOME/sessions/<projectKey>/<sessionId>/session.vN.jsonl.zstd）
  // 的相对路径：fork 路径必须原样保留三段结构，且能映射回会话 id（而非 projectKey）。
  const rel = '--D-proj--/s1/session.v3.jsonl.zstd'
  await writeSession(a.sessionRoot, rel, 'frame-1\n')
  const push1 = await a.engine.push()
  assert.equal(push1.ok, true, `A first push failed: ${push1.error}`)
  const pull2 = await b.engine.pull()
  assert.equal(pull2.ok, true, `B first pull failed: ${pull2.error}`)
  assert.equal(await readWorktree(b.repoDir, `sessions/${rel}`), 'frame-1\n')

  await writeSession(a.sessionRoot, rel, 'frame-1\nA-more\n')
  const push3 = await a.engine.push()
  assert.equal(push3.ok, true, `A second push failed: ${push3.error}`)
  await writeSession(b.sessionRoot, rel, 'frame-1\nB-more\n')
  const pull4 = await b.engine.pull()
  assert.equal(pull4.ok, true, `B append-both pull failed: ${pull4.error}`)
  assert.equal(pull4.appended, 1)
  assert.equal(pull4.forks.length, 1)
  const forkPath = pull4.forks[0]
  // 形态 = <原相对路径>.remote-fork-<14 位戳>-<8 位设备短 id>；戳必须是严格
  // 14 位数字的真实 UTC 时间（yyyyMMddHHmmss），绝不能是 forkFileName 的
  // 纪元回退值——engine.mjs 的 stamp 若残留 ISO 的 `T`，正则即失配。
  assert.match(
    forkPath,
    /^sessions\/--D-proj--\/s1\/session\.v3\.jsonl\.zstd\.remote-fork-\d{14}-bbbbbbbb$/u,
    `fork path lost the host layout: ${forkPath}`,
  )
  const forkStamp = /-(\d{14})-bbbbbbbb$/u.exec(forkPath)?.[1]
  assert.ok(forkStamp !== undefined, `fork path carries no 14-digit stamp: ${forkPath}`)
  assert.notEqual(forkStamp, '19700101000000', `fork stamp fell back to the epoch: ${forkPath}`)
  const stampMs = Date.UTC(
    Number(forkStamp.slice(0, 4)),
    Number(forkStamp.slice(4, 6)) - 1,
    Number(forkStamp.slice(6, 8)),
    Number(forkStamp.slice(8, 10)),
    Number(forkStamp.slice(10, 12)),
    Number(forkStamp.slice(12, 14)),
  )
  assert.ok(
    Math.abs(Date.now() - stampMs) < 5 * 60 * 1000,
    `fork stamp is not the pull time: ${forkStamp}`,
  )
  assert.equal(sessionIdOfForkPath(forkPath), 's1')
  assert.ok(eventsB.forks.includes(forkPath))
})

test('engine fails loudly without a configured remote', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const events = { meta: [], errors: [], forks: [] }
  const device = await setupDevice(root, 'X', 'cccccccc', '', events)
  await writeSession(device.sessionRoot, 's1/log.jsonl', 'x\n')
  const push = await device.engine.push()
  assert.equal(push.ok, false)
  assert.match(push.error, /no sync remote configured/)
  assert.ok(events.errors.length >= 1)
  // status 仍可用（本地只读）。
  const status = await device.engine.status()
  assert.equal(status.ok, true)
})

test('engine status reports dirty mirror and fork files', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const remotePath = path.join(root, 'remote.git')
  spawnSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' })
  const events = { meta: [], errors: [], forks: [] }
  const device = await setupDevice(root, 'Y', 'dddddddd', remotePath, events)
  await writeSession(device.sessionRoot, 's1/log.jsonl', 'a\n')
  await device.engine.push()
  // 工作树内手放 fork 文件（提交后 ls-files 可见）。
  const fork = path.join(device.repoDir, 'sessions', 's1', 'log.jsonl.remote-fork-20260815120000-eeeeeeee')
  await fs.mkdir(path.dirname(fork), { recursive: true })
  await fs.writeFile(fork, 'remote\n')
  await device.git.commitAll('test: add fork file')
  const status = await device.engine.status()
  assert.equal(status.ok, true)
  assert.ok(status.forks.includes('sessions/s1/log.jsonl.remote-fork-20260815120000-eeeeeeee'))
  // 本地未提交变更出现在 dirty。
  await writeSession(device.sessionRoot, 's2/new.jsonl', 'new\n')
  const dirty = await device.engine.status()
  assert.ok(dirty.dirty.includes('sessions/s2/new.jsonl'))
})

test('engine delete/modify conflicts stay keep-both instead of aborting the pull', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const remotePath = path.join(root, 'remote.git')
  spawnSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' })

  const eventsA = { meta: [], errors: [], forks: [] }
  const eventsB = { meta: [], errors: [], forks: [] }
  const a = await setupDevice(root, 'A', 'aaaaaaaa', remotePath, eventsA)
  const b = await setupDevice(root, 'B', 'bbbbbbbb', remotePath, eventsB)

  // 基线：两端各持有同一份会话树（pull 只写同步仓库的镜像，不回写会话根，
  // 所以真实设备的会话文件必须由测试自己摆好）。
  await writeSession(a.sessionRoot, 's1/log.jsonl', 'line1\n')
  await writeSession(a.sessionRoot, 's2/keep.jsonl', 'keep1\n')
  assert.equal((await a.engine.push()).ok, true)
  assert.equal((await b.engine.pull()).ok, true)
  await writeSession(b.sessionRoot, 's1/log.jsonl', 'line1\n')
  await writeSession(b.sessionRoot, 's2/keep.jsonl', 'keep1\n')

  // 情形一：远端删除、本地修改——git 的 modify/delete 冲突不登记 stage 3，
  // 旧实现对缺失的 stage 调 `checkout --theirs` 会失败并中止整次 pull。
  await fs.rm(path.join(a.sessionRoot, 's1', 'log.jsonl'))
  const pushDelete = await a.engine.push()
  assert.equal(pushDelete.ok, true, `A delete push failed: ${pushDelete.error}`)
  await writeSession(b.sessionRoot, 's1/log.jsonl', 'line1\nB-more\n')
  const pullRemoteDelete = await b.engine.pull()
  assert.equal(pullRemoteDelete.ok, true, `remote-delete pull must not abort: ${pullRemoteDelete.error}`)
  assert.equal(pullRemoteDelete.diverged, 1)
  assert.equal(pullRemoteDelete.forks.length, 0, 'a deletion carries no bytes to fork')
  assert.equal(await readWorktree(b.repoDir, 'sessions/s1/log.jsonl'), 'line1\nB-more\n', 'local edit kept')

  // 情形二：本地删除、远端修改——同一个冲突的镜像方向，不登记 stage 2。
  await writeSession(a.sessionRoot, 's2/keep.jsonl', 'keep1\nA-more\n')
  const pushEdit = await a.engine.push()
  assert.equal(pushEdit.ok, true, `A edit push failed: ${pushEdit.error}`)
  await fs.rm(path.join(b.sessionRoot, 's2', 'keep.jsonl'))
  const pullLocalDelete = await b.engine.pull()
  assert.equal(pullLocalDelete.ok, true, `local-delete pull must not abort: ${pullLocalDelete.error}`)
  assert.equal(pullLocalDelete.diverged, 1)
  assert.equal(pullLocalDelete.forks.length, 1)
  assert.match(pullLocalDelete.forks[0], /^sessions\/s2\/keep\.jsonl\.remote-fork-\d{14}-bbbbbbbb$/u)
  assert.equal(await readWorktree(b.repoDir, pullLocalDelete.forks[0]), 'keep1\nA-more\n', 'remote version preserved as fork file')
  await assert.rejects(readWorktree(b.repoDir, 'sessions/s2/keep.jsonl'), 'local deletion is kept')
  assert.ok(eventsB.forks.includes(pullLocalDelete.forks[0]))

  // 两侧冲突都已落地：仓库可继续提交与推送（残留的 unmerged stage 会在这里失败）。
  const pushResolved = await b.engine.push()
  assert.equal(pushResolved.ok, true, `push after delete/modify resolution failed: ${pushResolved.error}`)
  const status = await b.engine.status()
  assert.ok(!status.mergeInProgress, 'no merge left in progress after resolution')
})

test('a pulled session survives every later sync, while real deletions still propagate', { skip: !GIT_OK && 'git binary not available' }, async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const remotePath = path.join(root, 'remote.git')
  spawnSync('git', ['init', '--bare', remotePath], { stdio: 'ignore' })

  const eventsA = { meta: [], errors: [], forks: [] }
  const eventsB = { meta: [], errors: [], forks: [] }
  const a = await setupDevice(root, 'A', 'aaaaaaaa', remotePath, eventsA)
  const b = await setupDevice(root, 'B', 'bbbbbbbb', remotePath, eventsB)
  const rel = 'sessions/p/remote/session.jsonl'

  // A 的会话推到远端，B 拉下来。它只进 B 的同步镜像——pull 从不回写活会话库，
  // 所以 B 的 sessionRoot 里始终没有这个文件。
  await writeSession(a.sessionRoot, 'p/remote/session.jsonl', 'from-A\n')
  assert.equal((await a.engine.push()).ok, true)
  assert.equal((await b.engine.pull()).ok, true)
  assert.equal(await readWorktree(b.repoDir, rel), 'from-A\n')

  // 关键回归：此后每一次同步都不得把它当成「本机删除了」而抹掉。旧实现在这里
  // 连只读的 status 都会删（镜像先跑，按「源里没有」判定），并把删除推回远端，
  // 造成两台设备互相删除的来回震荡。
  await b.engine.status()
  assert.equal(await readWorktree(b.repoDir, rel), 'from-A\n', 'status must not delete a pulled session')
  const pushB = await b.engine.push()
  assert.equal(pushB.ok, true, `B push failed: ${pushB.error}`)
  assert.equal(pushB.deleted, 0, 'B owns nothing here, so it deletes nothing')
  assert.equal(await readWorktree(b.repoDir, rel), 'from-A\n', 'push must not delete a pulled session')

  // 也不得把删除推回远端：A 再拉一次仍然有它。
  assert.equal((await a.engine.pull()).ok, true)
  assert.equal(await readWorktree(a.repoDir, rel), 'from-A\n', 'no ping-pong deletion back to A')

  // 真正的本地删除仍然传播（删除语义未被削弱）：A 删掉自己的会话。
  await fs.rm(path.join(a.sessionRoot, 'p', 'remote', 'session.jsonl'))
  const pushDelete = await a.engine.push()
  assert.equal(pushDelete.ok, true, `A delete push failed: ${pushDelete.error}`)
  assert.equal(pushDelete.deleted, 1, 'a genuine local deletion still propagates')
  assert.equal((await b.engine.pull()).ok, true)
  await assert.rejects(readWorktree(b.repoDir, rel), 'the deletion reaches the non-owner device')

  // 而且 B 不会把它复活推回去。
  const pushB2 = await b.engine.push()
  assert.equal(pushB2.ok, true)
  assert.equal((await a.engine.pull()).ok, true)
  await assert.rejects(readWorktree(a.repoDir, rel), 'a deleted session is not resurrected by B')
})
