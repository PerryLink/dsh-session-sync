// scripts/loader-runner.mjs — real Loader composition runner (community
// five-layer model, layer 4). An independent process boots a real Context,
// mounts the vendored Loader with the Include builtin, reads the given
// cordis.yml (real storage stack + service rows + plugin row + config), then
// asserts the plugin's contributions through the authoritative registries and
// executes one real behavior. The `subprocess` capability seam has no concrete
// local provider in this repo's dependency tree, so it is provided as a mock on
// the root Context (the plugin itself is still loaded by the Loader).
//
// Usage: node scripts/loader-runner.mjs <cordis.yml> tool|no-tool
// Exit 0 prints DSH_LOADER_RESULT <json>; any assertion or load failure exits
// non-zero with the reason on stderr (used by the invalid-config and
// default-export regression cases).

import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const configArgument = process.argv[2]
const expected = process.argv[3]
if (configArgument === undefined || (expected !== 'tool' && expected !== 'no-tool')) {
  console.error('usage: loader-runner.mjs <cordis.yml> tool|no-tool')
  process.exit(2)
}

const configPath = resolve(configArgument)
const configRequire = createRequire(resolve(import.meta.dirname, '../package.json'))

const ctx = new Context()
try {
  // Mock subprocess seam (no concrete local provider in the dependency tree);
  // /sync help never touches it, but the plugin's inject must resolve it.
  ctx.provide('subprocess', {
    resolveExecutable: async () => 'git',
    spawn: () => ({
      stdout: (async function* () {})(),
      done: Promise.resolve({ exitCode: 0, signal: null }),
      collected: {
        stdout: { readFrom: () => ({ text: '' }) },
        stderr: { readFrom: () => ({ text: '' }) },
      },
    }),
  })

  ctx.baseUrl = `${pathToFileURL(dirname(configPath)).href}/`
  await ctx.plugin(Loader)
  ctx.loader.internal = /** @type {any} */ ({
    version: 'v2',
    async import(specifier) {
      if (specifier.startsWith('file:')) return import(specifier)
      if (specifier.startsWith('node:')) return import(specifier)
      const absolute = /^([a-zA-Z]:)?[\\/]/u.test(specifier)
      return import(pathToFileURL(absolute ? specifier : configRequire.resolve(specifier)).href)
    },
  })
  ctx.loader.builtins.include = Include
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()

  // Authoritative registries carry the plugin's contributions.
  const agent = /** @type {any} */ ({
    id: 'agent-1',
    options: { provider: 'deepseek', model: 'demo-model' },
    session: { id: 's1', append() {} },
    inbox: {},
    status: 'idle',
    ctx,
    cancel: () => undefined,
    whenIdle: async () => undefined,
    runMaintenance: async (task) => task(new AbortController().signal),
    send: () => undefined,
    followup: () => undefined,
    steer: () => undefined,
    inject: () => undefined,
  })
  const commands = ctx.commands.list(agent).map((entry) => entry.name)
  if (!commands.includes('sync')) {
    throw new Error('Loader composition: /sync command is missing from the commands registry')
  }

  const toolNames = ctx.tools.schemas().map((schema) => schema.name)
  const toolsPresent = ['sync_status', 'sync_pull', 'sync_push'].every((name) => toolNames.includes(name))
  if (expected === 'tool' && !toolsPresent) {
    throw new Error('Loader composition: sync_* tools are missing (expected registered)')
  }
  if (expected === 'no-tool' && toolsPresent) {
    throw new Error('Loader composition: sync_* tools are registered (registerTools: false was not applied)')
  }

  // Real behavior: /sync help through the real commands service (no git, no confirmation).
  const execution = await ctx.commands.execute(agent, '/sync help', [], new AbortController().signal)
  const text = execution?.result?.text ?? ''
  if (!text.includes('sync: usage')) {
    throw new Error(`Loader composition: /sync help returned ${JSON.stringify(execution?.result)}`)
  }

  const summary = {
    commands,
    syncTools: toolsPresent,
    helpText: text.split('\n')[0],
  }
  process.stdout.write(`DSH_LOADER_RESULT ${JSON.stringify(summary)}\n`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await ctx.fiber.dispose()
}
