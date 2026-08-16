// test/sanitize.test.mjs — 展示/日志脱敏（密钥、token、remote URL 凭据、路径越界）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeRemote, redactText, displayPath, relativeWithin } from '../lib/sanitize.mjs'

test('remote URL password is redacted, username kept', () => {
  const out = sanitizeRemote('https://alice:hunter2@github.com/you/dsh-sessions.git')
  assert.ok(out.includes('alice:***@github.com'))
  assert.ok(!out.includes('hunter2'))
})

test('remote URL credential query values are redacted', () => {
  const out = sanitizeRemote('https://host.example/repo.git?access_token=secret123&x=1')
  assert.ok(out.includes('access_token=%2A%2A%2A') || out.includes('access_token=***'))
  assert.ok(!out.includes('secret123'))
})

test('scp-style remote keeps username (not a secret) and is returned unchanged', () => {
  assert.equal(sanitizeRemote('git@github.com:you/repo.git'), 'git@github.com:you/repo.git')
})

test('unset/garbage remote renders conservatively', () => {
  assert.equal(sanitizeRemote(''), '<unset>')
  assert.equal(sanitizeRemote(undefined), '<unset>')
  assert.equal(sanitizeRemote(':::not a url'), ':::not a url')
})

test('tokens in free text are redacted (sk/ghp/gho/xox/AKIA/bearer)', () => {
  const text = 'err: sk-abcDEF1234567890 and ghp_0123456789abcdef0123 leaked; xoxb-1234567890-x; AKIAIOSFODNN7EXAMPLE; Bearer eyJhbGciOiJIUzI1NiJ9.abc'
  const out = redactText(text)
  assert.ok(!out.includes('sk-abcDEF1234567890'))
  assert.ok(!out.includes('ghp_0123456789abcdef0123'))
  assert.ok(!out.includes('xoxb-1234567890-x'))
  assert.ok(!out.includes('AKIAIOSFODNN7EXAMPLE'))
  assert.ok(!out.includes('eyJhbGciOiJIUzI1NiJ9.abc'))
})

test('key=value credentials are redacted regardless of case', () => {
  const out = redactText('remote failed: api_key=abc123&password=swordfish; API-KEY = zzz')
  assert.ok(!out.includes('abc123'))
  assert.ok(!out.includes('swordfish'))
  assert.ok(!out.includes('zzz'))
})

test('redactText never throws on non-string input', () => {
  assert.equal(redactText(42), '42')
  assert.equal(redactText(null), 'null')
  assert.equal(redactText({ secret: 'x' }), '[object Object]')
})

test('URL userinfo echoed by git stderr is redacted', () => {
  const out = redactText("fatal: unable to access 'https://alice:hunter2@example.com/r.git/': 403")
  assert.ok(!out.includes('hunter2'))
  assert.ok(out.includes('//***@example.com'))
})

test('displayPath keeps in-root paths relative and blurs outside paths', () => {
  assert.equal(displayPath('/root/sessions/a/x.jsonl', '/root'), 'sessions/a/x.jsonl')
  assert.equal(displayPath('/root', '/root'), '.')
  assert.equal(displayPath('/etc/passwd', '/root'), '<outside>')
  assert.equal(displayPath('/rootx/sessions/a', '/root'), '<outside>')
  assert.equal(displayPath('', '/root'), '<missing>')
})

test('relativeWithin is pure path arithmetic without I/O (traversal-safe)', () => {
  assert.equal(relativeWithin('/a/b/../b/c', '/a'), 'b/c'.replaceAll('/', '/'))
  assert.equal(relativeWithin('/a/b/c', '/a/b/c/d'), undefined)
  assert.equal(relativeWithin('C:\\work\\sessions\\s1\\log.jsonl', 'C:\\work\\sessions'), 's1/log.jsonl')
})

test('sanitize output embeds no remote credentials when wrapped twice', () => {
  const once = sanitizeRemote('https://u:p@host/x.git')
  const twice = redactText(`remote ${once}`)
  assert.ok(!twice.includes('p@host'))
})
