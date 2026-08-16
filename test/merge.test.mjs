// test/merge.test.mjs — 三分支合并语义（append-only、两边保留 + fork）。
// 覆盖：相同/仅本地/仅远端/双边追加/真实分歧/单侧删除/双方新建/二进制内容。

import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyPath, planMerge } from '../lib/merge.mjs'

test('identical: ours equals theirs keeps ours without fork', () => {
  assert.deepEqual(classifyPath('a', 'a', 'a'), { kind: 'identical', keepOurs: true, forkTheirs: false })
  assert.deepEqual(classifyPath(undefined, undefined, undefined), { kind: 'identical', keepOurs: true, forkTheirs: false })
})

test('ours-only: remote unchanged keeps ours', () => {
  const verdict = classifyPath('base', 'base+local', 'base')
  assert.equal(verdict.kind, 'ours-only')
  assert.equal(verdict.keepOurs, true)
  assert.equal(verdict.forkTheirs, false)
})

test('theirs-only: local unchanged adopts remote append (not an overwrite)', () => {
  const verdict = classifyPath('base', 'base', 'base+remote')
  assert.equal(verdict.kind, 'theirs-only')
  assert.equal(verdict.keepOurs, false)
  assert.equal(verdict.forkTheirs, false)
})

test('append-both: base is a byte prefix of both sides → keep ours + fork theirs', () => {
  const verdict = classifyPath('base', 'base+local', 'base+remote')
  assert.equal(verdict.kind, 'append-both')
  assert.equal(verdict.keepOurs, true)
  assert.equal(verdict.forkTheirs, true)
})

test('diverged: non-append rewrite on one side → keep ours + fork theirs', () => {
  const verdict = classifyPath('base', 'rewritten-local', 'base+remote')
  assert.equal(verdict.kind, 'diverged')
  assert.equal(verdict.keepOurs, true)
  assert.equal(verdict.forkTheirs, true)
})

test('diverged: single-side delete of a shared file', () => {
  const verdict = classifyPath('base', undefined, 'base')
  assert.equal(verdict.kind, 'ours-only')
  assert.equal(verdict.keepOurs, true)
  assert.equal(verdict.forkTheirs, false)
})

test('diverged: both created different content (no base)', () => {
  const verdict = classifyPath(undefined, 'local-new', 'remote-new')
  assert.equal(verdict.kind, 'diverged')
  assert.equal(verdict.forkTheirs, true)
})

test('binary content compares on bytes (zstd-style), not UTF-8 text', () => {
  const base = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const ours = Buffer.concat([base, Buffer.from([0x01, 0x02])])
  const theirs = Buffer.concat([base, Buffer.from([0xaa, 0xbb])])
  const verdict = classifyPath(base, ours, theirs)
  assert.equal(verdict.kind, 'append-both')
  assert.equal(verdict.forkTheirs, true)
  // 文本形态等价（UTF-8 前缀关系成立）也走同一分支。
  assert.equal(classifyPath('base', 'base…local', 'base…remote').kind, 'append-both')
})

test('append-both requires BOTH sides to extend the base', () => {
  // 本地重写 + 远端追加 → diverged（不是双边追加）。
  const verdict = classifyPath('base', 'other-local', 'base+remote')
  assert.equal(verdict.kind, 'diverged')
})

test('planMerge aggregates counts and fork paths', () => {
  const { resolutions, summary } = planMerge([
    { path: 'sessions/a/x.jsonl', base: 'b', ours: 'b+l', theirs: 'b+r' },
    { path: 'sessions/b/y.jsonl', base: 'b', ours: 'b', theirs: 'b+r' },
    { path: 'sessions/c/z.jsonl', base: 'b', ours: 'b+l', theirs: 'b' },
    { path: 'sessions/d/w.jsonl', base: 'b', ours: 'x', theirs: 'y' },
    { path: 'sessions/e/v.jsonl', base: 'b', ours: 'b', theirs: 'b' },
  ])
  assert.equal(resolutions.length, 5)
  assert.equal(summary.appended, 1)
  assert.equal(summary.adopted, 1)
  assert.equal(summary.diverged, 1)
  assert.equal(summary.kept, 4)
  assert.deepEqual(summary.forkPaths, ['sessions/a/x.jsonl', 'sessions/d/w.jsonl'])
})

test('empty-string base: both appends are prefix-related', () => {
  const verdict = classifyPath('', 'local', 'remote')
  assert.equal(verdict.kind, 'append-both')
  assert.equal(verdict.forkTheirs, true)
})
