// test/lifecycle.test.mjs — HMR-safety（C1）与导出契约（C2）套件。
//
// C1：真实 Cordis + 真实 SessionStore/CommandRuntime/ToolRuntime + mock
// storageDomain/subprocess/systemPrompt 组装；保存贡献 fiber，释放后重查权威
// 注册表，断言 /sync 命令与 sync_status/sync_pull/sync_push 工具随 fiber 撤销消失。
// C2：模块命名空间无 default 导出，且 Loader.unwrapExports 往返返回同一命名空间。
// @module dsh-session-sync/test/lifecycle.test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SessionStore from '@deepseek-ai/dsh-session'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import * as plugin from '../index.mjs'

/** 极简 mock storageDomain：domain open 返回含 state 单表的 KvTable 形状领域。 */
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

/** 极简 mock subprocess：挂载期不会被调用，仅满足 inject。 */
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

function makeAgent(session) {
  return {
    id: session.id,
    options: { provider: 'deepseek', model: 'demo-model' },
    session,
    inbox: {},
    status: 'idle',
    ctx: new Context(),
    cancel: () => undefined,
    whenIdle: async () => undefined,
    runMaintenance: async (task) => task(new AbortController().signal),
    send: () => undefined,
    followup: () => undefined,
    steer: () => undefined,
    inject: () => undefined,
  }
}

/** 组装真实 Cordis 上下文（真实 sessions/commands/tools 注册表 + mock 存储/子进程）。 */
async function mountHarness(config = {}) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-session-sync-lifecycle-'))
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  const session = ctx.sessions.create()
  ctx.provide('systemPrompt', { tools: () => () => undefined, section: () => () => undefined })
  ctx.provide('storageDomain', makeStorageDomain())
  ctx.provide('subprocess', makeSubprocess())
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(CommandRuntime)
  const agent = /** @type {any} */ (makeAgent(session))
  const merged = {
    sessionRoot: join(root, 'sessions'),
    repoDir: join(root, 'repo'),
    ...config,
  }
  const pluginFiber = await ctx.plugin(plugin, merged)
  return { ctx, agent, pluginFiber, root }
}

// ---------------------------------------------------------------------------
// C2：函数插件命名空间必须经 Loader 解包往返
// ---------------------------------------------------------------------------

test('module carries no default export and Loader unwrap round-trips the namespace', () => {
  assert.equal('default' in plugin, false)
  const loader = Object.create(Loader.prototype)
  const unwrapped = loader.unwrapExports(plugin)
  assert.equal(unwrapped, plugin)
  assert.equal(unwrapped.name, 'session-sync')
  assert.deepEqual(unwrapped.inject, ['sessions', 'commands', 'storageDomain', 'subprocess'])
  assert.ok(unwrapped.Config !== undefined)
  assert.equal(typeof unwrapped.apply, 'function')
})

// ---------------------------------------------------------------------------
// C1：释放贡献 fiber 后，/sync 与 sync_* 工具从权威注册表消失
// ---------------------------------------------------------------------------

test('disposing the contributing fiber removes /sync and the sync_* tools', async () => {
  const harness = await mountHarness()
  try {
    const before = harness.ctx.commands.list(harness.agent).map((entry) => entry.name)
    assert.ok(before.includes('sync'))
    assert.ok(harness.ctx.tools.get('sync_status') !== undefined)
    assert.ok(harness.ctx.tools.get('sync_pull') !== undefined)
    assert.ok(harness.ctx.tools.get('sync_push') !== undefined)

    await harness.pluginFiber.dispose()

    const after = harness.ctx.commands.list(harness.agent).map((entry) => entry.name)
    assert.equal(after.includes('sync'), false, '/sync should disappear after fiber dispose')
    assert.equal(harness.ctx.tools.get('sync_status'), undefined, 'sync_status should disappear after fiber dispose')
    assert.equal(harness.ctx.tools.get('sync_pull'), undefined, 'sync_pull should disappear after fiber dispose')
    assert.equal(harness.ctx.tools.get('sync_push'), undefined, 'sync_push should disappear after fiber dispose')
  } finally {
    await harness.ctx.fiber.dispose()
  }
})
