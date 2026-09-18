// lib/gate.mjs — 确认门 + 会话事件自适应门（零依赖）。

import { CONFIRM_CHANNELS, PLUGIN_NAME } from './constants.mjs'

/**
 * 回退确认结果。
 * @typedef {object} ConfirmVerdict
 * @property {boolean} allowed - 是否放行（false 一律失败关闭）。
 * @property {string} channel - 'userQuestions'|'approval'|'none'。
 * @property {string} [reason] - 拒绝/不可用原因。
 */

/** 确认问题 id 与默认选项文案。 */
export const CONFIRM_QUESTION_ID = 'session-sync-confirm'

/**
 * 会话当前是否有开放轮次（last turn/start 未被 turn/end 闭合）。
 * 纯函数：只消费调用方给出的**事件数组**。生产取数一律走宿主投影
 * （openTurnFromProjection），不要再用 session.events/snapshotEvents 取事件
 * ——那是对已废弃读路径的依赖。
 * @param {readonly {type: string}[]} [events] - 会话事件。
 * @returns {boolean} 有开放轮次。
 */
export function hasOpenTurn(events) {
  let open = false
  for (const event of events ?? []) {
    if (event.type === 'turn/start') open = true
    else if (event.type === 'turn/end') open = false
  }
  return open
}

/**
 * 从宿主 turnBoundary 投影读「是否有开放轮次」。
 * 取数来源：agent-loop 的 turnBoundaryProjectionDefinition（key 'turnBoundary'，
 * init.openTurnStartSeq=null，turn/start 置 seq、turn/end 置 null）。投影/服务缺席
 * 或读取抛错一律返回 undefined——**不得回退读死属性**（session.events 在
 * 0.1.6-alpha.2 已删：回退只会得到恒 undefined ⇒ 静默按「无开放轮次」处理）。
 * @param {{get: (name: string) => unknown}} ctx - Cordis ctx（可选服务查找）。
 * @param {object|null|undefined} session - Session。
 * @returns {boolean|undefined} true/false=投影裁决；undefined=投影不可用。
 */
export function openTurnFromProjection(ctx, session) {
  if (session === null || session === undefined) return undefined
  const service = ctx?.get?.('sessionProjections')
  if (service === undefined || service === null) return undefined
  const projections = /** @type {{stateOf?: (session: object, key: string) => unknown}} */ (service)
  if (typeof projections.stateOf !== 'function') return undefined
  try {
    const state = /** @type {{openTurnStartSeq?: number|null}|null|undefined} */ (projections.stateOf(session, 'turnBoundary'))
    if (state === undefined || state === null || !('openTurnStartSeq' in state)) return undefined
    return state.openTurnStartSeq !== null
  } catch {
    return undefined
  }
}

/**
 * 选择确认通道：Config.confirmVia 显式指定，'auto' 优先 userQuestions、
 * 其次 approval；两者皆无 → 'none'（失败关闭）。
 * @param {string} confirmVia - CONFIRM_CHANNELS 之一。
 * @param {{get: (name: string) => unknown}} ctx - Cordis ctx（可选服务查找）。
 * @returns {string} 通道名。
 */
export function pickChannel(confirmVia, ctx) {
  if (confirmVia === CONFIRM_CHANNELS.USER_QUESTIONS) return CONFIRM_CHANNELS.USER_QUESTIONS
  if (confirmVia === CONFIRM_CHANNELS.APPROVAL) return CONFIRM_CHANNELS.APPROVAL
  if (ctx.get('userQuestions') !== undefined) return CONFIRM_CHANNELS.USER_QUESTIONS
  if (ctx.get('approval') !== undefined) return CONFIRM_CHANNELS.APPROVAL
  return 'none'
}

/**
 * 向用户确认一次拉/推。任何回答者缺失/抛错/取消 → allowed=false（失败关闭）。
 * approval 通道要求会话有开放轮次：/sync 命令运行于轮次之间，无开放轮次时
 * 直接失败关闭并给出可操作原因；sync_* 工具运行于轮次内，approval 可用。
 * @param {object} deps - {ctx, confirmVia, action, summary}：action ∈ pull|push。
 * @param {object} [agent] - 命令/工具所属 agent（userQuestions 路由 + approval 审计归属）。
 * @param {AbortSignal} [signal] - 取消信号（用户关闭 UI = cancelled）。
 * @returns {Promise<ConfirmVerdict>} 裁决。
 */
export async function confirmSync(deps, agent, signal) {
  const channel = pickChannel(deps.confirmVia, deps.ctx)
  const question = deps.action === 'push'
    ? 'Push local session changes to the sync remote?'
    : 'Pull remote session changes into the sync mirror?'
  const approveLabel = deps.action === 'push' ? 'Push' : 'Pull'
  if (channel === CONFIRM_CHANNELS.USER_QUESTIONS) {
    const service = deps.ctx.get('userQuestions')
    if (service === undefined || typeof service.ask !== 'function') {
      return { allowed: false, channel, reason: 'no userQuestions answerer (fail closed)' }
    }
    try {
      const answer = await service.ask({
        questions: [{
          id: CONFIRM_QUESTION_ID,
          question,
          detail: deps.summary,
          options: [
            { label: approveLabel, description: deps.summary },
            { label: 'Cancel', description: 'Do nothing.' },
          ],
        }],
        agent,
        signal,
      })
      const item = answer?.answers?.find(entry => entry.id === CONFIRM_QUESTION_ID)
      const selected = Array.isArray(item?.selected) ? item.selected : []
      const custom = typeof item?.custom === 'string' && item.custom.length > 0 ? item.custom : undefined
      if (custom !== undefined) {
        return { allowed: false, channel, reason: 'free-text answer is not an approval' }
      }
      if (selected.includes(approveLabel)) return { allowed: true, channel }
      return { allowed: false, channel, reason: `user chose not to ${deps.action}` }
    } catch (error) {
      return { allowed: false, channel, reason: `userQuestions ask failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
  if (channel === CONFIRM_CHANNELS.APPROVAL) {
    // 宿主的 approval.request 无开放轮次即抛（审计对必须包在 turn 内）；
    // /sync 命令运行于轮次之间，这里前置检测并给出可操作文案。
    // 取数走宿主 turnBoundary 投影：投影缺席即失败关闭并写明原因，绝不
    // 回退读已删的 session.events（那会让 approval 通道恒失败且原因不可见）。
    const openTurn = openTurnFromProjection(deps.ctx, agent?.session)
    if (openTurn === undefined) {
      return {
        allowed: false,
        channel,
        reason: 'turn state unavailable: the sessionProjections.turnBoundary projection is not composed (mount @deepseek-ai/dsh-session-projection) — approval cannot be verified, set confirmVia: userQuestions',
      }
    }
    if (!openTurn) {
      return {
        allowed: false,
        channel,
        reason: 'approval requires an open turn; /sync commands run between turns — mount userQuestions or set confirmVia: userQuestions',
      }
    }
    const service = deps.ctx.get('approval')
    if (service === undefined || typeof service.request !== 'function') {
      return { allowed: false, channel, reason: 'no approval answerer (fail closed)' }
    }
    try {
      const outcome = await service.request({ agent, toolName: deps.action === 'push' ? 'sync_push' : 'sync_pull', reason: deps.summary, signal })
      if (outcome === 'allowed-once') return { allowed: true, channel }
      return { allowed: false, channel, reason: `approval outcome ${JSON.stringify(outcome)}` }
    } catch (error) {
      return { allowed: false, channel, reason: `approval ask failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
  return { allowed: false, channel: 'none', reason: 'no confirmation answerer available (fail closed)' }
}

/**
 * 会话事件自适应门：决策函数返回是否 append 以及是否带 ignorable 信封。
 * 宿主 KNOWN_SESSION_EVENT_TYPES 收录的类型直接 append；未收录但宿主 append
 * 支持 ignorable 信封（运行时探测）时以 { ignorable: true } append；其余
 * 拒绝（rc.6/rc.8/rc.2：未收录类型落盘会让会话下次加载被持久化层拒绝）。
 * @param {ReadonlySet<string>} knownTypes - KNOWN_SESSION_EVENT_TYPES。
 * @param {boolean} [ignorableAppend] - 宿主 append 是否盖章 ignorable 信封。
 * @returns {(type: string) => {append: boolean, ignorable: boolean}} 决策函数。
 */
export function makeEventGate(knownTypes, ignorableAppend = false) {
  return (type) => {
    if (knownTypes.has(type)) return { append: true, ignorable: false }
    if (ignorableAppend) return { append: true, ignorable: true }
    return { append: false, ignorable: false }
  }
}

/**
 * 自适应 append：门通过才写会话事件；append 本身失败只警告绝不破坏会话。
 * @param {object|null|undefined} session - Session（缺失即跳过）。
 * @param {string} type - 事件类型。
 * @param {object} data - 载荷。
 * @param {(type: string) => {append: boolean, ignorable: boolean}} gate - makeEventGate 产物。
 * @param {(message: string) => void} warn - 日志警告。
 * @returns {unknown} 已 append 事件或 undefined。
 */
export function maybeAppendSessionEvent(session, type, data, gate, warn) {
  if (session === null || session === undefined) return undefined
  const decision = gate(type)
  if (!decision.append) return undefined
  try {
    return session.append(type, data, decision.ignorable ? { ignorable: true } : undefined)
  } catch (error) {
    warn(`${PLUGIN_NAME} session event ${type} append failed: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}
