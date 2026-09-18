// test/gate.test.mjs — 确认门与轮次投影取数（P0-3 回归锁）。
//
// 覆盖：
// - openTurnFromProjection 的四态（服务缺席 / 投影未注册 / 投影抛错 → undefined；
//   openTurnStartSeq 有值 → true；null → false），确保绝不回退读死属性；
// - confirmSync 的 approval 通道：投影报「开放轮次」时真的走到 approval 请求
//   （修复前该路径恒失败）；投影缺席/无开放轮次/无回答者分别失败关闭且原因可操作；
// - hasOpenTurn 纯函数语义（保留的公开辅助，只消费事件数组）。
// @module dsh-session-sync/test/gate.test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confirmSync, hasOpenTurn, openTurnFromProjection } from '../lib/gate.mjs'

/** 构造仅含可选服务查找的 ctx 假件。 */
function makeCtx(services = {}) {
  return { get: (name) => services[name] }
}

/** 构造 sessionProjections 假件：按 key 返回固定 state。 */
function makeProjections(states) {
  return {
    stateOf: (_session, key) => states[key],
  }
}

const session = { id: 's-1' }

test('hasOpenTurn stays a pure function over an event list', () => {
  assert.equal(hasOpenTurn([{ type: 'turn/start' }]), true)
  assert.equal(hasOpenTurn([{ type: 'turn/start' }, { type: 'turn/end' }]), false)
  assert.equal(hasOpenTurn([]), false)
  assert.equal(hasOpenTurn(undefined), false)
})

test('openTurnFromProjection returns undefined when the projection is unavailable', () => {
  assert.equal(openTurnFromProjection(makeCtx(), session), undefined)
  assert.equal(openTurnFromProjection(makeCtx({ sessionProjections: {} }), session), undefined)
  assert.equal(openTurnFromProjection(makeCtx({ sessionProjections: makeProjections({}) }), session), undefined)
  assert.equal(openTurnFromProjection(makeCtx({ sessionProjections: { stateOf: () => { throw new Error('boom') } } }), session), undefined)
  assert.equal(openTurnFromProjection(makeCtx({ sessionProjections: makeProjections({ turnBoundary: { openTurnStartSeq: 3 } }) }), null), undefined)
})

test('openTurnFromProjection reads openTurnStartSeq from the turnBoundary state', () => {
  const open = makeCtx({ sessionProjections: makeProjections({ turnBoundary: { openTurnStartSeq: 7 } }) })
  assert.equal(openTurnFromProjection(open, session), true)
  const closed = makeCtx({ sessionProjections: makeProjections({ turnBoundary: { openTurnStartSeq: null } }) })
  assert.equal(openTurnFromProjection(closed, session), false)
})

test('approval confirmation proceeds when the projection reports an open turn', async () => {
  // 修复前：approval 通道读已废弃的 session.events ⇒ 恒判「无开放轮次」⇒ /sync 恒失败。
  const asks = []
  const ctx = makeCtx({
    sessionProjections: makeProjections({ turnBoundary: { openTurnStartSeq: 12 } }),
    approval: { request: async (req) => { asks.push(req); return 'allowed-once' } },
  })
  const verdict = await confirmSync(
    { ctx, confirmVia: 'approval', action: 'push', summary: 'summary' },
    { session },
    undefined,
  )
  assert.deepEqual(verdict, { allowed: true, channel: 'approval' })
  assert.equal(asks.length, 1)
  assert.equal(asks[0].toolName, 'sync_push')
})

test('approval confirmation fails closed with an actionable reason when the projection is absent', async () => {
  const ctx = makeCtx({ approval: { request: async () => 'allowed-once' } })
  const verdict = await confirmSync({ ctx, confirmVia: 'approval', action: 'pull', summary: 's' }, { session }, undefined)
  assert.equal(verdict.allowed, false)
  assert.equal(verdict.channel, 'approval')
  assert.match(verdict.reason, /turnBoundary projection/u)
})

test('approval confirmation fails closed between turns and without an answerer', async () => {
  const betweenTurns = makeCtx({
    sessionProjections: makeProjections({ turnBoundary: { openTurnStartSeq: null } }),
    approval: { request: async () => 'allowed-once' },
  })
  const first = await confirmSync({ ctx: betweenTurns, confirmVia: 'approval', action: 'push', summary: 's' }, { session }, undefined)
  assert.equal(first.allowed, false)
  assert.match(first.reason, /open turn/u)

  const noAnswerer = makeCtx({ sessionProjections: makeProjections({ turnBoundary: { openTurnStartSeq: 1 } }) })
  const second = await confirmSync({ ctx: noAnswerer, confirmVia: 'approval', action: 'push', summary: 's' }, { session }, undefined)
  assert.equal(second.allowed, false)
  assert.match(second.reason, /no approval answerer/u)
})
