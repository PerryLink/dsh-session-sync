// test/age-runner.test.mjs — makeRunAge must always hand the host a real cwd.
//
// On DSH >= 0.2.2 @deepseek-ai/dsh-subprocess-local validates the required
// SubprocessSpawnSpec.cwd unconditionally (targetEnvironment -> value.includes('\0')),
// so an undefined cwd throws before spawn; that is what broke encrypted push/pull (#34).
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRunAge } from '../index.mjs'

/** @returns {any} */
function fakeSubprocess(records) {
  return {
    resolveExecutable: async (name) => name,
    spawn(spec) {
      records.push(spec)
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: '' }) },
          stderr: { readFrom: () => ({ text: '' }) },
        },
      }
    },
  }
}
const opts = { graceMs: 5000, commandTimeoutMs: 5000, maxOutputBytes: 4096 }

test('makeRunAge defaults cwd to a real directory when the caller omits it', async () => {
  const records = []
  const run = makeRunAge(fakeSubprocess(records), opts)
  await run(['/usr/bin/age', '--version'])
  assert.equal(records.length, 1)
  assert.equal(typeof records[0].cwd, 'string')
  assert.ok(records[0].cwd.length > 0, 'cwd must be a non-empty string')
})

test('makeRunAge forwards an explicit cwd unchanged', async () => {
  const records = []
  const run = makeRunAge(fakeSubprocess(records), opts)
  await run(['/usr/bin/age', '--version'], { cwd: '/tmp' })
  assert.equal(records[0].cwd, '/tmp')
})
