// lib/durability.mjs — 等宿主把该会话的缓冲事件落盘再读（零 DSH 依赖）。
//
// 为什么不能"turn/end 一到就镜像"：宿主的 JSONL 持久化对 **live 事件**做有界
// 批量写窗 —— `LIVE_WRITE_BATCH_MAX_DELAY_MS = 200`
// （session-persistence-jsonl/src/storage.ts:37）；`session/event` 只是把事件
// 交给 `enqueueLive` 缓冲并起一个 200ms 定时器（同文件 :269-283），真正的
// `persistBatch` 发生在定时器或 `session/flush` 触发时（同文件 :286-341、:555-562）。
// 因此 `turn/end` 刚 append 时，磁盘上的会话日志通常**还没有这一行**（首次
// 追加时甚至整个会话文件都还没物化）。在 turn/end 上立刻做字节镜像，推给
// 别的设备的就是一个**未闭合的轮次**——这正是本插件要避免的跨设备状态不一致。
//
// 宿主 0.2.2 给出的公开落盘面是 `SessionStore.flush(session)`
// （@deepseek-ai/dsh-session 的 `ctx.sessions.flush`；core/session/src/index.ts:1410-1434，
// 注释明确写着 "THE flush entry point … consumers that flush themselves before
// reading storage"）。它派发 `session/flush`（core/session/src/types.ts:74），
// 持久化后端随即 `drainLive()` + `handle.flush()`（storage.ts:555-562），
// 因此 flush 决议时该会话已 append 的事件都已落盘。宿主自己的事件文档也把
// 这条责任写给了读存储的消费者："consumers that read storage after
// `whenIdle()` flush themselves"（core/session/src/types.ts:299-300）。
//
// 本模块只包这一件事：调用落盘屏障 + 超时兜底。**任何失败/超时只回报，绝不抛**
// ——调用方照常镜像（宁可镜像落后一拍，也不让一轮会话被卡死的后端拖住）。

import { messageOf } from './errors.mjs'

/** 未配置时的落盘等待上限（ms）：远大于宿主的 200ms 批量窗，又远小于一轮交互。 */
export const DURABILITY_TIMEOUT_MS = 2000

/**
 * @typedef {object} DurabilityOutcome
 * @property {boolean} ok - true = 屏障已决议（宿主无持久化监听器也算：没有待落盘的东西）。
 * @property {boolean} [timedOut] - 超时（调用方应继续镜像，只记日志）。
 * @property {boolean} [unsupported] - 该宿主没有公开的 `flush` 面（旧宿主），无法等待。
 * @property {boolean} [skipped] - 配置为 0，明确不等待。
 * @property {string} [error] - 屏障自身失败（脱敏后的消息）；不是抛出。
 */

/**
 * 等待 `session` 的缓冲事件落盘，最多 `timeoutMs`。
 *
 * 顺序契约：本函数**先让出一个微任务**再调用 `flush`。宿主的 `session/event`
 * 监听器是同步派发的（core/session/src/index.ts 的 `commit()` →
 * `invokeContainedSessionObservers`），持久化后端的 `enqueueLive` 与我们的
 * 处理器在同一个同步派发里；微任务只会在整个同步派发结束后运行，所以
 * `drainLive()` 一定看得见触发本次调用的那条 `turn/end`。
 *
 * @param {unknown} session - 宿主的 live `Session`（原样交给 `flush`）。
 * @param {object} [deps] - 依赖与上限。
 * @param {{flush?: (session: unknown) => unknown}} [deps.sessions] - `ctx.sessions`（能力探测：无 `flush` 即旧宿主）。
 * @param {number} [deps.timeoutMs] - 等待上限（ms，≤0 = 不等待）。
 * @returns {Promise<DurabilityOutcome>} 结果对象；永不 reject。
 */
export async function waitForSessionDurability(session, deps = {}) {
  const sessions = deps?.sessions
  const flush = sessions?.flush
  if (typeof flush !== 'function') return { ok: false, unsupported: true }
  const timeoutMs = Number.isFinite(deps?.timeoutMs) ? Number(deps.timeoutMs) : DURABILITY_TIMEOUT_MS
  if (timeoutMs <= 0) return { ok: false, skipped: true }
  // 见上方「顺序契约」：让同一事件的其余同步监听器先把事件交进持久化缓冲。
  await Promise.resolve()
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  // 同步抛出的 flush 也要落到 outcome 里（async 包装把 throw 变成 rejection）。
  const flushed = (async () => flush.call(sessions, session))().then(
    () => ({ kind: /** @type {const} */ ('flushed') }),
    (error) => ({ kind: /** @type {const} */ ('failed'), error }),
  )
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs)
  })
  try {
    /** @type {{kind: 'flushed'|'failed'|'timeout', error?: unknown}} */
    const outcome = await Promise.race([flushed, deadline])
    if (outcome.kind === 'flushed') return { ok: true }
    if (outcome.kind === 'timeout') return { ok: false, timedOut: true }
    return { ok: false, error: messageOf(outcome.error) }
  } finally {
    clearTimeout(timer)
  }
}
