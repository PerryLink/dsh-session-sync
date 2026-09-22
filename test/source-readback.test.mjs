// test/source-readback.test.mjs — 消息 source 的**真实宿主读回闸**。
//
// 为什么必须单独有一条读回闸：`injectForkNotice` 写的是一个**对象字面量里的
// 字符串**（`source: { kind: '…' }`）。类型门禁只在字面量恰好落在
// `MessageSourceMap` 联合内时才有牙（见 types.d.ts 的声明合并），而**运行期
// 写入根本不校验** —— `createUserMessage` 不做形状检查，宿主 Session 的
// `append` 也不做。于是"改错了"只会在**读回**那一刻爆：宿主 0.1.7 的
// `assertV4MessageSources` 拒收退役的 `kind === 'plugin'`
// （session-format-v3-to-v4/src/message-sources.ts）。
//
// 本闸用宿主自己的准入函数，三态各断言一次（写入形状来自插件真实导出函数，
// 不是手搓的假 payload）：
//   ① 升级后写法 `{ kind: 'dsh-session-sync' }`        → 准入
//   ② V3→V4 迁移后的历史写法 `plugin:dsh-session-sync`   → 准入
//   ③ 升级前写法 `{ kind: 'plugin', plugin: … }`        → **拒收**（灵敏度：谓词
//      改回旧值这条必然变红）
//
// 注意 `Session.fromRestore` **不足以**当这条闸：实测它对三种形态一律放行
// （核心 Session 不校验 source kind），只有 released codec 的
// `assertV4RowAdmission` / `restoreReleasedV4Artifact` 才是真正拒收的那一层。
// @module dsh-session-sync/test/source-readback

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Session, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session'
import {
  assertV4RowAdmission,
  releasedV4SessionFormatCodec,
  restoreReleasedV4Artifact,
} from '@deepseek-ai/dsh-session-format-v3-to-v4'
import { injectForkNotice } from '../index.mjs'

/** 本插件在 `MessageSourceMap` 里声明的 producer-owned kind（与 types.d.ts 同名）。 */
const PLUGIN_SOURCE_KIND = 'dsh-session-sync'

/** 写入点写的 notice 摘要；读回后必须逐字保留。 */
const NOTICE_SUMMARY = 'session-sync conflict fork'

/** 会话 id；`SessionHeader.id` 是品牌化的 `SessionId`，不是裸 string。 */
const SESSION_ID = 'readback-s1'

/**
 * 核心 `SessionHeader`（`Session.fromRestore` 用）：`id` 品牌化、`version` 是字面量 4。
 * @type {import('@deepseek-ai/dsh-session').SessionHeader}
 */
const SESSION_HEADER = { version: 4, id: SessionId(SESSION_ID), createdAt: 1, delegationDepth: 0, isSeeded: false }

/** 物理 V4 header（`restoreReleasedV4Artifact` 用）：`assertReleasedV4Header` 只接受 {version,id,createdAt,isSeeded,delegationDepth} + cwd/parentSession/origin/agentPreset。 */
const ARTIFACT_HEADER = { version: 4, id: SESSION_ID, createdAt: 1, delegationDepth: 0, isSeeded: false }

/** 读回器认识的会话事件类型（本行只有 user/message）。 */
const KNOWN_EVENT_TYPES = new Set(['user/message'])

const FORK_PATHS = ['sessions/proj/parent-session/s1.jsonl.remote-fork-20260101000000-abcdef12']

/**
 * 用桩子会话捕获 `injectForkNotice` **真实**写出的 payload。
 * @returns {{type: string, data: import('@deepseek-ai/dsh-llm').UserMessage, opts: {surfaceOp: string}}} 捕获到的 append 实参。
 */
function captureNoticeAppend() {
  /** @type {{type: string, data: any, opts: any}|undefined} */
  let appended
  const child = /** @type {any} */ ({
    id: 'readback-child',
    append(type, data, opts) {
      appended = { type, data, opts }
    },
  })
  injectForkNotice(child, FORK_PATHS, 'parent-session')
  assert.ok(appended !== undefined, 'injectForkNotice must append a user/message notice')
  return appended
}

/**
 * 把捕获到的 append 实参还原成宿主写盘的物理 JSONL 行（`{type,seq,time,surfaceOp,data}`）。
 * @param {{data: import('@deepseek-ai/dsh-llm').UserMessage, opts: {surfaceOp: string}}} appended - 捕获到的 append 实参。
 * @returns {any} 一条 V4 物理行。
 */
function physicalRow(appended) {
  return {
    type: 'user/message',
    seq: 0,
    time: 1,
    surfaceOp: appended.opts.surfaceOp,
    data: JSON.parse(JSON.stringify(appended.data)),
  }
}

/**
 * 复制一行并替换其 source（用于形态 ②/③ 与灵敏度断言）。
 * @param {any} row - 基准物理行。
 * @param {Record<string, unknown>} source - 替换后的 source。
 * @returns {any} 替换 source 后的物理行。
 */
function withSource(row, source) {
  return { ...row, data: { ...row.data, source } }
}

/**
 * 一行对应的完整 V4 artifact（读回闸的入参）。
 * @param {any} row - 待读回的物理行。
 * @returns {any} 单事件 artifact。
 */
function artifactFor(row) {
  return { header: { ...ARTIFACT_HEADER }, events: [row], inheritedEventCount: 0 }
}

const captured = captureNoticeAppend()
const row = physicalRow(captured)

test('the fork notice is written with the plugin-owned source kind', () => {
  assert.equal(captured.type, 'user/message', 'the notice is a durable user message')
  assert.equal(captured.opts.surfaceOp, 'append', 'the notice is appended, never spliced')
  assert.equal(row.data.role, 'user')
  assert.equal(row.data.source.kind, PLUGIN_SOURCE_KIND)
  assert.equal(row.data.source.form, 'notice')
  assert.equal(row.data.source.summary, NOTICE_SUMMARY)
  assert.ok(
    !Object.hasOwn(row.data.source, 'plugin'),
    'the retired wrapper field must be gone, not merely shadowed',
  )
})

test('the host admits the notice at the V4 physical-row boundary', () => {
  assert.doesNotThrow(() => assertV4RowAdmission(row))
})

test('the host admits the notice when the V4 artifact is read back', () => {
  const restored = restoreReleasedV4Artifact(artifactFor(row), KNOWN_EVENT_TYPES)
  assert.equal(restored.events.length, 1)
  assert.equal(/** @type {any} */ (restored.events[0].data).source.kind, PLUGIN_SOURCE_KIND)
})

test('the host encodes the notice back to a physical row', () => {
  assert.doesNotThrow(() => releasedV4SessionFormatCodec.encodeEvent(row))
})

test('Session.fromRestore reads the notice back and derives it for the model', () => {
  const session = Session.fromRestore(
    SessionId(SESSION_ID),
    [row],
    { ...SESSION_HEADER },
    SessionLogOffset(0),
    'shared-frozen',
  )
  const messages = session.deriveMessages()
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'user')
  assert.equal(messages[0].source.kind, PLUGIN_SOURCE_KIND)
})

test('the host still admits a V3-migrated legacy notice (plugin:dsh-session-sync)', () => {
  // V3→V4 迁移给未知插件 source 盖的是 `plugin:<原名>`
  // （session-format-v3-to-v4/src/sources.ts 的 producerKind），不是 {kind:'plugin'}。
  const migrated = withSource(row, {
    kind: `plugin:${PLUGIN_SOURCE_KIND}`,
    form: 'notice',
    summary: NOTICE_SUMMARY,
  })
  assert.doesNotThrow(() => assertV4RowAdmission(migrated))
  assert.doesNotThrow(() => restoreReleasedV4Artifact(artifactFor(migrated), KNOWN_EVENT_TYPES))
})

test('the host refuses the retired {kind:"plugin"} source a pre-upgrade build wrote', () => {
  // 灵敏度锚点：这一条就是"谓词改回旧值"的运行期判据。宿主三层准入必须同时拒收。
  const retired = withSource(row, {
    kind: 'plugin',
    plugin: PLUGIN_SOURCE_KIND,
    form: 'notice',
    summary: NOTICE_SUMMARY,
  })
  assert.throws(() => assertV4RowAdmission(retired), /producer-owned source kind/u)
  assert.throws(
    () => restoreReleasedV4Artifact(artifactFor(retired), KNOWN_EVENT_TYPES),
    /producer-owned source kind/u,
  )
  assert.throws(
    () => releasedV4SessionFormatCodec.encodeEvent(retired),
    /producer-owned source kind/u,
  )
})
