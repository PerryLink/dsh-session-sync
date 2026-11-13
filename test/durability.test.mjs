// test/durability.test.mjs — turn/end 落盘等待（宿主 JSONL 的 200ms 批量写窗）。
//
// 缺陷复现（真实宿主后端，不是桩）：宿主把 live 事件交给 `enqueueLive` 缓冲，
// 200ms 定时器或 `session/flush` 才真正 `persistBatch`
// （session-persistence-jsonl/src/storage.ts:37、:275-282、:555-562）。所以在
// `turn/end` 上立刻镜像时，盘上**连会话日志都还没有**；跨设备恢复看到的就是
// 一个未闭合的轮次。
//
// 判据：
//   ① 真实宿主：turn/end 之后立刻镜像 → 镜像为空；经 waitForSessionDurability
//      （即 `ctx.sessions.flush(session)`）之后镜像 → 含 `turn/end`。旧实现
//      （不等就 push）在这条上必红。
//   ② 超时 / 屏障失败 / 旧宿主无 flush 三条降级路径只回报、不抛、不阻塞。
//   ③ 顺序契约：flush 必须晚于同一事件的同步监听器（持久化的 enqueueLive），
//      否则 drainLive 会漏掉刚 append 的 turn/end。
// @module dsh-session-sync/test/durability.test

import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { DURABILITY_TIMEOUT_MS, waitForSessionDurability } from '../lib/durability.mjs'
import { mirrorSessionRoot } from '../lib/mirror.mjs'
import * as plugin from '../index.mjs'

const { resolveConfig } = plugin

async function makeTemp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-durability-'))
  return { root, clean: () => fs.rm(root, { recursive: true, force: true }) }
}

/** 挂载真实的 SessionStore + 真实 JSONL 后端（`compression: none` → 纯 JSONL，可直接断言文本）。 */
async function mountHost(sessionRoot) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root: sessionRoot, compression: 'none' })
  const deadline = Date.now() + 10_000
  while (ctx.get('sessionPersistence') === undefined && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.ok(ctx.get('sessionPersistence'), 'host JSONL persistence must mount')
  return ctx
}

/** 递归拼接目录下所有常规文件的文本（镜像树断言用）。 */
async function readTreeText(root) {
  const texts = []
  const walk = async (dir) => {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else if (entry.isFile()) texts.push((await fs.readFile(absolute)).toString('utf8'))
    }
  }
  await walk(root)
  return texts.join('\n')
}

// ---------------------------------------------------------------------------
// ① 真实宿主：不等待 → 镜像缺 turn/end；等待后 → 镜像含 turn/end
// ---------------------------------------------------------------------------

test('a turn/end push mirrors the session only after the durability barrier', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  await fs.mkdir(sessionRoot, { recursive: true })

  const ctx = await mountHost(sessionRoot)
  const session = ctx.sessions.create()
  const persistence = /** @type {any} */ (ctx.get('sessionPersistence'))
  const handle = await persistence.create(session.header)
  t.after(() => handle.close().catch(() => undefined))

  session.append('turn/start', { turn: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  const appendedAt = Date.now()

  // 旧行为：turn/end 一到就镜像 —— 宿主的 200ms 批量窗还没把日志写到盘上。
  const early = await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions' })
  if (Date.now() - appendedAt < 150) {
    assert.equal(early.mirrored, 0, 'the host batch window must not have written the log yet')
    assert.equal(await readTreeText(path.join(repoDir, 'sessions')), '')
  } else {
    // 慢机器上 200ms 窗可能在断言前就落到盘上；此时跳过"镜像为空"的前置断言，
    // 下面的落盘后断言仍然有效。
    t.diagnostic('host batch window elapsed before the pre-flush mirror; skipped the staleness assertion')
  }

  // 修复后的顺序：先等该会话落盘，再镜像。
  const outcome = await waitForSessionDurability(session, { sessions: ctx.sessions, timeoutMs: 2000 })
  assert.deepEqual(outcome, { ok: true })

  const late = await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions' })
  assert.ok(late.mirrored >= 1, 'the durable session log must be mirrored')
  assert.match(await readTreeText(path.join(repoDir, 'sessions')), /"turn\/end"/u)
})

// ---------------------------------------------------------------------------
// ② 降级路径：超时 / 失败 / 旧宿主 —— 只回报，不抛、不阻塞
// ---------------------------------------------------------------------------

test('a stalled barrier times out without throwing or blocking', async () => {
  const sessions = { flush: () => new Promise(() => {}) }
  const startedAt = Date.now()
  const outcome = await waitForSessionDurability({ id: 's1' }, { sessions, timeoutMs: 25 })
  assert.deepEqual(outcome, { ok: false, timedOut: true })
  assert.ok(Date.now() - startedAt >= 20, 'the timeout must actually be awaited')
  assert.ok(Date.now() - startedAt < 2000, 'a stalled barrier must not block the caller')
})

test('a rejecting barrier is reported, never thrown', async () => {
  const sessions = { flush: async () => { throw new Error('EIO: disk gone') } }
  const outcome = await waitForSessionDurability({ id: 's1' }, { sessions, timeoutMs: 500 })
  assert.equal(outcome.ok, false)
  assert.match(outcome.error, /EIO: disk gone/u)
})

test('a barrier that fails after the timeout leaks no unhandled rejection', async () => {
  const unhandled = []
  const onUnhandled = (reason) => unhandled.push(reason)
  process.on('unhandledRejection', onUnhandled)
  try {
    const sessions = {
      flush: () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('late failure')), 30)),
    }
    const outcome = await waitForSessionDurability({ id: 's1' }, { sessions, timeoutMs: 5 })
    assert.deepEqual(outcome, { ok: false, timedOut: true })
    await new Promise(resolve => setTimeout(resolve, 60))
    assert.deepEqual(unhandled, [])
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
})

test('a host without sessions.flush is reported as unsupported', async () => {
  assert.deepEqual(await waitForSessionDurability({ id: 's1' }, { sessions: {}, timeoutMs: 100 }), { ok: false, unsupported: true })
  assert.deepEqual(await waitForSessionDurability({ id: 's1' }, { timeoutMs: 100 }), { ok: false, unsupported: true })
})

test('timeoutMs 0 disables the wait entirely', async () => {
  let called = false
  const sessions = { flush: () => { called = true; return Promise.resolve(true) } }
  assert.deepEqual(await waitForSessionDurability({ id: 's1' }, { sessions, timeoutMs: 0 }), { ok: false, skipped: true })
  assert.equal(called, false)
})

// ---------------------------------------------------------------------------
// ③ 顺序契约与默认值
// ---------------------------------------------------------------------------

test('flush runs only after the same event’s synchronous listeners (microtask boundary)', async () => {
  let enqueued = false
  const sessions = {
    flush() {
      // 宿主在 `commit()` 里同步派发 session/event；持久化的 enqueueLive 是同一
      // 同步派发中的一个监听器。flush 若抢在它前面，drainLive 就看不见 turn/end。
      assert.equal(enqueued, true, 'the persistence listener must have enqueued the event before flush')
      return Promise.resolve(true)
    },
  }
  const pending = waitForSessionDurability({ id: 's1' }, { sessions, timeoutMs: 500 })
  // 模拟宿主在本次事件的同步派发里把 turn/end 交给持久化缓冲。
  enqueued = true
  assert.deepEqual(await pending, { ok: true })
})

test('the default durability timeout comfortably exceeds the host 200 ms batch window', () => {
  assert.ok(DURABILITY_TIMEOUT_MS > 200, 'must outlast one host batching window')
  assert.ok(DURABILITY_TIMEOUT_MS <= 5000, 'must not stretch a turn boundary noticeably')
})

test('resolveConfig validates durabilityTimeoutMs', () => {
  const base = { sessionRoot: path.resolve('sessions'), repoDir: path.resolve('repo') }
  assert.equal(resolveConfig(base).durabilityTimeoutMs, DURABILITY_TIMEOUT_MS)
  assert.equal(resolveConfig({ ...base, durabilityTimeoutMs: 0 }).durabilityTimeoutMs, 0)
  assert.equal(resolveConfig({ ...base, durabilityTimeoutMs: 5000 }).durabilityTimeoutMs, 5000)
  assert.throws(() => resolveConfig({ ...base, durabilityTimeoutMs: -1 }), /durabilityTimeoutMs must be an integer/u)
  assert.throws(() => resolveConfig({ ...base, durabilityTimeoutMs: 60_001 }), /durabilityTimeoutMs must be an integer/u)
  assert.throws(() => resolveConfig(/** @type {any} */ ({ ...base, durabilityTimeoutMs: 'soon' })), /durabilityTimeoutMs must be an integer/u)
})

// ---------------------------------------------------------------------------
// ④ 端到端接线：真实插件的 turn/end 监听器必须"先等落盘、再镜像"
// ---------------------------------------------------------------------------

/** 极简 mock storageDomain（与 test/lifecycle.test.mjs 同形）：插件只需一张 state 表。 */
function makeStorageDomain() {
  return {
    open(spec) {
      const store = new Map()
      return Promise.resolve({
        name: spec.name,
        table() {
          return {
            get: (key) => store.get(key),
            put: async (key, value) => { store.set(key, value) },
            delete: async (key) => { store.delete(key) },
            entries: () => [...store.entries()][Symbol.iterator](),
            keys: () => [...store.keys()][Symbol.iterator](),
            size: () => store.size,
          }
        },
        close: async () => {},
      })
    },
  }
}

/** 极简 mock subprocess：只保证 git 调用能返回，镜像在 git 之前完成。 */
function makeSubprocess() {
  return {
    resolveExecutable: async () => 'git',
    spawn: () => ({
      stdout: (async function* () {})(),
      done: Promise.resolve({ exitCode: 0, signal: null }),
      collected: {
        stdout: { readFrom: () => ({ text: '' }) },
        stderr: { readFrom: () => ({ text: '' }) },
      },
    }),
  }
}

test('the mounted plugin mirrors a turn/end only after the writer flushed it', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  await fs.mkdir(sessionRoot, { recursive: true })

  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(CommandRuntime)
  ctx.provide('storageDomain', makeStorageDomain())
  ctx.provide('subprocess', makeSubprocess())
  await ctx.plugin(plugin, {
    sessionRoot,
    repoDir,
    remote: 'origin',
    autoPushOnTurnEnd: true,
    durabilityTimeoutMs: 2000,
    registerCommand: false,
    registerTools: false,
  })

  // 模拟宿主的"批量写窗"：flush 被调用时先延迟 50ms，再把该会话的日志写到盘上。
  // 插件若在 turn/end 上直接镜像，镜像里就不会有这份日志。
  const realFlush = ctx.sessions.flush.bind(ctx.sessions)
  let flushCalls = 0
  ctx.sessions.flush = async (session) => {
    flushCalls += 1
    await new Promise(resolve => setTimeout(resolve, 50))
    const dir = path.join(sessionRoot, 's1')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'session.v4.jsonl'), '{"type":"turn/end","data":{"turn":1}}\n')
    return realFlush(session)
  }

  const session = ctx.sessions.create()
  session.append('turn/start', { turn: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

  const deadline = Date.now() + 5_000
  let mirroredText = ''
  while (Date.now() < deadline) {
    mirroredText = await readTreeText(path.join(repoDir, 'sessions'))
    if (mirroredText.includes('turn/end')) break
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.equal(flushCalls, 1, 'the turn/end listener must await exactly one durability barrier')
  assert.match(mirroredText, /"turn\/end"/u, 'the mirror must contain the flushed turn/end bytes')
})
