// test/backend.test.mjs — 传输后端 seam 与 age 层（scripted/mock runner；不依赖真实 age）。
// 覆盖：selectEncryptionMode 的 backend 选择与降级、detectAge 探测、age 加密
// 往返（mock 二进制做可逆文件变换）。真实 age 不可用时用假 runner 覆盖。

import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectEncryptionMode } from '../lib/backend.mjs'
import { detectAge, ageEncrypt, ageDecrypt } from '../lib/age.mjs'
import { SyncError } from '../lib/errors.mjs'

const AGE = 'age'
const HEADER = 'AGE-MOCK:'

/** mock age runner：--version 探测 + -r/-d 可逆文件变换（加/去头）。 */
function makeMockAge() {
  return async (args) => {
    if (args[1] === '--version') {
      return { code: 0, stdout: 'v1.0.0\n', stderr: '' }
    }
    const outIndex = args.indexOf('-o')
    const outPath = args[outIndex + 1]
    const inPath = args[outIndex + 2]
    const content = await fs.readFile(inPath)
    if (args.includes('-r')) {
      await fs.writeFile(outPath, Buffer.concat([Buffer.from(HEADER), content]))
    } else if (args.includes('-d')) {
      const text = content.toString('latin1')
      if (!text.startsWith(HEADER)) return { code: 1, stdout: '', stderr: 'not age-encrypted' }
      await fs.writeFile(outPath, content.subarray(HEADER.length))
    }
    return { code: 0, stdout: '', stderr: '' }
  }
}

test('selectEncryptionMode: git backend is plaintext with no warnings', () => {
  assert.deepEqual(selectEncryptionMode({ backend: 'git', ageAvailable: true, ageRecipient: 'r', ageIdentity: 'i' }), {
    mode: 'plaintext',
    warnings: [],
  })
})

test('selectEncryptionMode: encrypted backend requires age + recipient + identity', () => {
  assert.deepEqual(selectEncryptionMode({ backend: 'encrypted', ageAvailable: true, ageRecipient: 'age1...', ageIdentity: '/k/age.txt' }), {
    mode: 'encrypted',
    warnings: [],
  })
  const noAge = selectEncryptionMode({ backend: 'encrypted', ageAvailable: false, ageRecipient: 'r', ageIdentity: 'i' })
  assert.equal(noAge.mode, 'plaintext')
  assert.ok(noAge.warnings.some(w => /age binary not found/u.test(w)))
  const noRecipient = selectEncryptionMode({ backend: 'encrypted', ageAvailable: true, ageRecipient: '', ageIdentity: 'i' })
  assert.equal(noRecipient.mode, 'plaintext')
  assert.ok(noRecipient.warnings.some(w => /ageRecipient is empty/u.test(w)))
  const noIdentity = selectEncryptionMode({ backend: 'encrypted', ageAvailable: true, ageRecipient: 'r', ageIdentity: ' ' })
  assert.equal(noIdentity.mode, 'plaintext')
  assert.ok(noIdentity.warnings.some(w => /ageIdentity is empty/u.test(w)))
})

test('detectAge returns the binary path on success and null otherwise', async () => {
  const ok = async () => ({ code: 0, stdout: '', stderr: '' })
  const missing = async () => ({ code: 127, stdout: '', stderr: 'not found' })
  const throwing = async () => { throw new Error('spawn ENOENT') }
  assert.equal(await detectAge(ok, AGE), AGE)
  assert.equal(await detectAge(missing, AGE), null)
  assert.equal(await detectAge(throwing, AGE), null)
  assert.equal(await detectAge(ok, ''), null)
})

test('age encrypt/decrypt roundtrip preserves content bytes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-age-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const plain = path.join(root, 'plain.bin')
  const cipher = path.join(root, 'cipher.age')
  const roundtrip = path.join(root, 'roundtrip.bin')
  const secret = Buffer.from([0x00, 0xff, 0x28, 0xb5, 0x2f, 0xfd])
  await fs.writeFile(plain, secret)
  const run = makeMockAge()

  await ageEncrypt(run, { ageBin: AGE, recipient: 'age1x', inPath: plain, outPath: cipher })
  const encrypted = await fs.readFile(cipher)
  assert.ok(encrypted.subarray(0, HEADER.length).toString('latin1') === HEADER, 'ciphertext carries the transform header')
  assert.ok(!encrypted.equals(secret), 'ciphertext differs from plaintext')

  await ageDecrypt(run, { ageBin: AGE, identity: '/k/age.txt', inPath: cipher, outPath: roundtrip })
  assert.deepEqual([...(await fs.readFile(roundtrip))], [...secret])
})

test('age encrypt/decrypt fail closed (AGE_FAILED) on non-zero exit', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-age-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const plain = path.join(root, 'plain.bin')
  const out = path.join(root, 'out.age')
  await fs.writeFile(plain, 'x\n')
  const failing = async () => ({ code: 1, stdout: '', stderr: 'age: unknown recipient' })
  await assert.rejects(
    ageEncrypt(failing, { ageBin: AGE, recipient: 'bad', inPath: plain, outPath: out }),
    (error) => error instanceof SyncError && error.code === 'AGE_FAILED',
  )
})
