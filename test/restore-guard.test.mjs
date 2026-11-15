// test/restore-guard.test.mjs — 恢复守卫的分支回归（评审第 1 轮产物）。
// 覆盖：投影字节比较（plan.content 而非镜像原始字节）、活读失败兜底、跳过时
// 的状态跟踪/占位只读位/旧路径清理、generation-0 名、分叉时的 fork 留存与去重。
// 夹具形状沿用 test/cwdmap.test.mjs（真实宿主 header 布局、带 checksum 的 zstd 帧）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { constants, zstdCompressSync } from 'node:zlib'
import { restoreSessionRoot, pruneRestoredSessions, RESTORE_STATE_FILE } from '../lib/mirror.mjs'
import { normalizeCwdMap, projectKey } from '../lib/cwdmap.mjs'
import { readSessionHeader } from '../lib/sessionlog.mjs'
import { FORK_NAME_RE } from '../lib/constants.mjs'

const ZSTD_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }
const SESSION_ID = 'session-11111111-2222-3333-4444-555555555555'
const IS_WINDOWS = process.platform === 'win32'
const FOREIGN_PREFIX = IS_WINDOWS ? '/home/me' : 'C:\\Users\\me'
const FOREIGN_CWD = IS_WINDOWS ? '/home/me/proj' : 'C:\\Users\\me\\proj'
const CANONICAL_REL = `${projectKey(FOREIGN_CWD)}/${SESSION_ID}/session.v4.jsonl.zstd`

function headerLine(overrides = {}) {
  return `${JSON.stringify({
    type: 'session',
    version: 4,
    id: SESSION_ID,
    createdAt: 1_700_000_000_000,
    isSeeded: false,
    delegationDepth: 0,
    cwd: FOREIGN_CWD,
    ...overrides,
  })}\n`
}

function zstdFrame(text) {
  return zstdCompressSync(Buffer.from(text, 'utf8'), ZSTD_OPTIONS)
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function makeTemp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-guard-'))
  return { root, clean: () => fs.rm(root, { recursive: true, force: true }) }
}

/** 共享的映射投影夹具：镜像 v1 先恢复一次，活副本已存在（带投影后的 header）。 */
async function mappedFixture(t) {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const mirrorRoot = path.join(repoDir, 'sessions')
  const mappedRoot = path.join(root, 'local')
  const mappedCwd = path.join(mappedRoot, 'proj')
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  const mirrorPath = path.join(mirrorRoot, ...CANONICAL_REL.split('/'))
  await fs.mkdir(path.dirname(mirrorPath), { recursive: true })
  const event1 = zstdFrame('{"type":"user/message","seq":0}\n')
  const event2 = zstdFrame('{"type":"assistant/message","seq":1}\n')
  const v1 = Buffer.concat([zstdFrame(headerLine()), event1])
  await fs.writeFile(mirrorPath, v1)
  const deps = { repoDir, mirrorRoot, sessionRoot, cwdMap: normalizeCwdMap([{ from: FOREIGN_PREFIX, to: mappedRoot }]) }
  const first = await restoreSessionRoot(deps)
  assert.equal(first.cwdMapped, 1, 'fixture: first restore must map the projection')
  const projectedRel = `${projectKey(mappedCwd)}/${SESSION_ID}/session.v4.jsonl.zstd`
  const livePath = path.join(sessionRoot, ...projectedRel.split('/'))
  return { root, sessionRoot, repoDir, mirrorRoot, mirrorPath, deps, livePath, projectedRel, v1, event1, event2, mappedCwd }
}

test('a cold projected log fast-forwards against plan.content, not raw mirror bytes', async (t) => {
  const f = await mappedFixture(t)
  const liveV1 = await fs.readFile(f.livePath)
  // 镜像如合并那样前进：原设备 header + 多一帧事件。
  const v2 = Buffer.concat([zstdFrame(headerLine()), f.event1, f.event2])
  await fs.writeFile(f.mirrorPath, v2)
  const second = await restoreSessionRoot(f.deps)
  assert.equal(second.restored, 1, 'a projected cold log must fast-forward')
  assert.equal(second.liveAheadSkipped, 0)
  assert.equal(second.divergedSkipped, 0)
  const liveV2 = await fs.readFile(f.livePath)
  assert.deepEqual(liveV2, Buffer.concat([liveV1, f.event2]), 'the projected header stays, the new frame lands')
  assert.equal(readSessionHeader(liveV2, true)?.header.cwd, f.mappedCwd)
})

test('a live-ahead projected log is classified liveAheadSkipped, not diverged', async (t) => {
  const f = await mappedFixture(t)
  const grown = Buffer.concat([await fs.readFile(f.livePath), f.event2])
  await fs.writeFile(f.livePath, grown)
  const second = await restoreSessionRoot(f.deps)
  assert.equal(second.liveAheadSkipped, 1)
  assert.equal(second.divergedSkipped, 0)
  assert.equal(second.restored, 0)
  assert.deepEqual(await fs.readFile(f.livePath), grown, 'the live tail must survive')
})

test('a live readFile rejection is treated as absent and the mirror still writes', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const mirrorRoot = path.join(root, 'repo', 'sessions')
  await fs.mkdir(path.join(sessionRoot, 's1'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
  const livePath = path.join(sessionRoot, 's1', 'session.v4.jsonl')
  await fs.writeFile(path.join(mirrorRoot, 's1', 'session.v4.jsonl'), 'frame-A\n')
  await fs.writeFile(livePath, 'frame-A\nframe-B\n')
  const origReadFile = fs.readFile
  fs.readFile = /** @type {typeof fs.readFile} */ (async (p, ...rest) => {
    if (typeof p === 'string' && path.resolve(p) === path.resolve(livePath)) {
      throw Object.assign(new Error('simulated read failure'), { code: 'EACCES' })
    }
    return origReadFile(p, ...rest)
  })
  let result
  try {
    result = await restoreSessionRoot({ mirrorRoot, sessionRoot })
  } finally {
    fs.readFile = origReadFile
  }
  assert.equal(result.restored, 1, 'read failure must fall through to the write')
  assert.equal(result.liveAheadSkipped, 0)
  assert.equal(result.divergedSkipped, 0)
  assert.deepEqual(await fs.readFile(livePath), Buffer.from('frame-A\n'))
})

test('placeholder chmod 0o444 is re-applied even when the guard skips the write', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const mirrorRoot = path.join(repoDir, 'sessions')
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  const mirrorPath = path.join(mirrorRoot, ...CANONICAL_REL.split('/'))
  await fs.mkdir(path.dirname(mirrorPath), { recursive: true })
  await fs.writeFile(mirrorPath, zstdFrame(headerLine()))
  const deps = { repoDir, mirrorRoot, sessionRoot, cwdMap: normalizeCwdMap([]) }
  const first = await restoreSessionRoot(deps)
  assert.equal(first.cwdUnmapped, 1, 'fixture: first restore must create the placeholder')
  const placeholderCwd = path.join(sessionRoot, '--unmapped--')
  const livePath = path.join(sessionRoot, ...`${projectKey(placeholderCwd)}/${SESSION_ID}/session.v4.jsonl.zstd`.split('/'))
  // 有人把视图改成可写并追加；下一次拉取必须保住字节并恢复只读标记。
  await fs.chmod(livePath, 0o644)
  const grown = Buffer.concat([await fs.readFile(livePath), zstdFrame('{"type":"user/message","seq":1}\n')])
  await fs.writeFile(livePath, grown)
  const second = await restoreSessionRoot(deps)
  assert.equal(second.liveAheadSkipped, 1)
  assert.equal(second.restored, 0)
  assert.deepEqual(await fs.readFile(livePath), grown, 'the live tail must survive')
  assert.equal((await fs.stat(livePath)).mode & 0o222, 0, 'the placeholder must be read-only again after the skip')
})

test('a skipped restore never rewrites the tracked hash to bytes it did not write', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const mirrorRoot = path.join(repoDir, 'sessions')
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
  const rel = 's1/session.v4.jsonl'
  const mirrorPath = path.join(mirrorRoot, 's1', 'session.v4.jsonl')
  const livePath = path.join(sessionRoot, 's1', 'session.v4.jsonl')
  const x = Buffer.from('frame-A\n')
  const y = Buffer.from('frame-A\nframe-C\n')
  await fs.writeFile(mirrorPath, x)
  const deps = { repoDir, mirrorRoot, sessionRoot }
  const first = await restoreSessionRoot(deps)
  assert.equal(first.restored, 1)
  const statePath = path.join(repoDir, RESTORE_STATE_FILE)
  const readState = async () => JSON.parse(await fs.readFile(statePath, 'utf8')).files
  assert.equal((await readState())[rel], sha256(x), 'the plugin tracks the bytes it wrote')
  // 镜像前进到 y；活日志长过 x（与 y 分叉）。
  await fs.writeFile(mirrorPath, y)
  await fs.writeFile(livePath, Buffer.concat([x, Buffer.from('frame-B\n')]))
  const second = await restoreSessionRoot(deps)
  assert.equal(second.divergedSkipped, 1)
  assert.equal(second.restored, 0)
  assert.equal((await readState())[rel], sha256(x), 'a skipped write must not claim the mirror bytes')
  // 用户自己的编辑后来恰好等于镜像字节；远端删除仍不得剪掉这份副本。
  await fs.writeFile(livePath, y)
  await fs.unlink(mirrorPath)
  const pruned = await pruneRestoredSessions(deps)
  assert.deepEqual(pruned.pruned, [])
  assert.deepEqual(pruned.keptEdited, [rel], 'a user-edited copy is kept even when it matches the mirror')
  assert.deepEqual(await fs.readFile(livePath), y)
})

test('legacy canonical copy is cleaned up even when the guard skips the projected write', async (t) => {
  const f = await mappedFixture(t)
  const grown = Buffer.concat([await fs.readFile(f.livePath), f.event2])
  await fs.writeFile(f.livePath, grown)
  const legacyPath = path.join(f.sessionRoot, ...CANONICAL_REL.split('/'))
  await fs.mkdir(path.dirname(legacyPath), { recursive: true })
  await fs.writeFile(legacyPath, f.v1)
  const second = await restoreSessionRoot(f.deps)
  assert.equal(second.liveAheadSkipped, 1)
  assert.equal(second.restored, 0)
  assert.deepEqual(await fs.readFile(f.livePath), grown, 'the projected live tail survives')
  await assert.rejects(fs.stat(legacyPath), { code: 'ENOENT' }, 'the legacy duplicate must be removed despite the skip')
})

test('generation-0 log names are inside the guard scope', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const mirrorRoot = path.join(root, 'repo', 'sessions')
  for (const name of ['session.jsonl', 'session.jsonl.zstd']) {
    await fs.mkdir(path.join(sessionRoot, 's1'), { recursive: true })
    await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
    await fs.writeFile(path.join(mirrorRoot, 's1', name), 'frame-A\n')
    await fs.writeFile(path.join(sessionRoot, 's1', name), 'frame-A\nframe-B\n')
    const result = await restoreSessionRoot({ mirrorRoot, sessionRoot })
    assert.equal(result.liveAheadSkipped, 1, `${name} must be guarded`)
    assert.equal(result.restored, 0)
    assert.equal(await fs.readFile(path.join(sessionRoot, 's1', name), 'utf8'), 'frame-A\nframe-B\n', `${name} must not be truncated`)
    await fs.rm(path.join(sessionRoot, 's1'), { recursive: true, force: true })
    await fs.rm(path.join(mirrorRoot, 's1'), { recursive: true, force: true })
  }
})

test('a diverged skip preserves the mirror bytes as a fork file, deduplicated', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const mirrorRoot = path.join(root, 'repo', 'sessions')
  await fs.mkdir(path.join(sessionRoot, 's1'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
  const mirrorBytes = Buffer.from('frame-A\nframe-C\n')
  const liveBytes = Buffer.from('frame-A\nframe-B\n')
  await fs.writeFile(path.join(mirrorRoot, 's1', 'session.v4.jsonl.zstd'), mirrorBytes)
  await fs.writeFile(path.join(sessionRoot, 's1', 'session.v4.jsonl.zstd'), liveBytes)
  const deps = { mirrorRoot, sessionRoot, deviceShort: 'abcd1234' }
  const first = await restoreSessionRoot(deps)
  assert.equal(first.divergedSkipped, 1)
  assert.deepEqual(await fs.readFile(path.join(sessionRoot, 's1', 'session.v4.jsonl.zstd')), liveBytes)
  const forks = (await fs.readdir(path.join(mirrorRoot, 's1'))).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  assert.equal(forks.length, 1, 'the mirror bytes must be preserved as one fork file')
  assert.match(forks[0], /^session\.v4\.jsonl\.zstd\.remote-fork-\d{14}-abcd1234$/u)
  assert.deepEqual(await fs.readFile(path.join(mirrorRoot, 's1', forks[0])), mirrorBytes)
  // 再拉一次：同样分叉，但同内容 fork 不重复创建。
  const second = await restoreSessionRoot(deps)
  assert.equal(second.divergedSkipped, 1)
  const forksAgain = (await fs.readdir(path.join(mirrorRoot, 's1'))).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  assert.equal(forksAgain.length, 1, 'an identical fork must not be duplicated')
})

/** 当前秒 ±1s 的 fork 时间戳（覆盖秒边界）。 */
function forkStamps() {
  const now = Date.now()
  return [-1000, 0, 1000].map(d => new Date(now + d).toISOString().replace(/[-:T]/gu, '').slice(0, 14))
}

test('a projected diverged skip forks the raw mirror bytes, not the projected rewrite', async (t) => {
  const f = await mappedFixture(t)
  // 镜像前进到 v2（原设备 header）；活副本长出不同的帧 → 分叉。
  const v2 = Buffer.concat([zstdFrame(headerLine()), f.event1, f.event2])
  await fs.writeFile(f.mirrorPath, v2)
  const e3 = zstdFrame('{"type":"user/message","seq":2}\n')
  const grown = Buffer.concat([await fs.readFile(f.livePath), e3])
  await fs.writeFile(f.livePath, grown)
  const second = await restoreSessionRoot({ ...f.deps, deviceShort: 'abcd1234' })
  assert.equal(second.divergedSkipped, 1)
  assert.deepEqual(await fs.readFile(f.livePath), grown, 'the live tail survives')
  const dir = path.dirname(f.mirrorPath)
  const forks = (await fs.readdir(dir)).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  assert.equal(forks.length, 1)
  assert.deepEqual(await fs.readFile(path.join(dir, forks[0])), v2, 'the fork must carry the origin-device bytes, not the local cwd rewrite')
})

test('dedup recognizes an older fork with the same content (deterministic)', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const mirrorRoot = path.join(root, 'repo', 'sessions')
  await fs.mkdir(path.join(sessionRoot, 's1'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
  const mirrorBytes = Buffer.from('frame-A\nframe-C\n')
  await fs.writeFile(path.join(mirrorRoot, 's1', 'session.v4.jsonl.zstd'), mirrorBytes)
  await fs.writeFile(path.join(sessionRoot, 's1', 'session.v4.jsonl.zstd'), Buffer.from('frame-A\nframe-B\n'))
  // 预植一个旧时间戳的同内容 fork：去重必须认出它，与本次恢复的秒戳无关。
  await fs.writeFile(path.join(mirrorRoot, 's1', 'session.v4.jsonl.zstd.remote-fork-20260101000000-abcd1234'), mirrorBytes)
  const result = await restoreSessionRoot({ mirrorRoot, sessionRoot, deviceShort: 'abcd1234' })
  assert.equal(result.divergedSkipped, 1)
  const forks = (await fs.readdir(path.join(mirrorRoot, 's1'))).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  assert.equal(forks.length, 1, 'an identical older fork must not be duplicated')
})

test('a same-second fork collision keeps the existing fork and takes a suffix', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const mirrorRoot = path.join(root, 'repo', 'sessions')
  await fs.mkdir(path.join(sessionRoot, 's1'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
  const mirrorBytes = Buffer.from('frame-A\nframe-C\n')
  await fs.writeFile(path.join(mirrorRoot, 's1', 'session.v4.jsonl.zstd'), mirrorBytes)
  await fs.writeFile(path.join(sessionRoot, 's1', 'session.v4.jsonl.zstd'), Buffer.from('frame-A\nframe-B\n'))
  // 在预测的 fork 名（当前秒 ±1s）上预植不同内容的 fork：合并写者与恢复写者
  // 秒级相撞的形状。既有 fork 绝不被覆盖；新字节取后缀名。
  const planted = forkStamps().map(s => `session.v4.jsonl.zstd.remote-fork-${s}-abcd1234`)
  for (const name of planted) await fs.writeFile(path.join(mirrorRoot, 's1', name), 'OTHER\n')
  const result = await restoreSessionRoot({ mirrorRoot, sessionRoot, deviceShort: 'abcd1234' })
  assert.equal(result.divergedSkipped, 1)
  for (const name of planted) {
    assert.equal(await fs.readFile(path.join(mirrorRoot, 's1', name), 'utf8'), 'OTHER\n', `${name} must not be overwritten`)
  }
  const all = (await fs.readdir(path.join(mirrorRoot, 's1'))).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  const preserved = all.filter(n => !planted.includes(n))
  assert.equal(preserved.length, 1, 'the mirror bytes must land in a suffixed fork')
  assert.match(preserved[0], /\.remote-fork-\d{14}-abcd1234\.\d+$/u)
  assert.equal(FORK_NAME_RE.test(preserved[0]), true, 'the suffixed name must still be recognized as a fork')
  assert.deepEqual(await fs.readFile(path.join(mirrorRoot, 's1', preserved[0])), mirrorBytes)
})

test('the default device short id produces a recognized fork name and dedups', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const mirrorRoot = path.join(root, 'repo', 'sessions')
  await fs.mkdir(path.join(sessionRoot, 's1'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
  const mirrorBytes = Buffer.from('frame-A\nframe-C\n')
  await fs.writeFile(path.join(mirrorRoot, 's1', 'session.v4.jsonl.zstd'), mirrorBytes)
  await fs.writeFile(path.join(sessionRoot, 's1', 'session.v4.jsonl.zstd'), Buffer.from('frame-A\nframe-B\n'))
  const deps = { mirrorRoot, sessionRoot } // no deviceShort
  const first = await restoreSessionRoot(deps)
  assert.equal(first.divergedSkipped, 1)
  const forks = (await fs.readdir(path.join(mirrorRoot, 's1'))).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  assert.equal(forks.length, 1)
  assert.match(forks[0], /-unknown0$/u, 'the fallback must be 8 chars so FORK_NAME_RE recognizes it')
  assert.equal(FORK_NAME_RE.test(forks[0]), true)
  const second = await restoreSessionRoot(deps)
  assert.equal(second.divergedSkipped, 1)
  const again = (await fs.readdir(path.join(mirrorRoot, 's1'))).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  assert.equal(again.length, 1, 'default-device forks must dedup')
})

test('a link planted at the predicted fork name is neither followed nor overwritten', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const mirrorRoot = path.join(root, 'repo', 'sessions')
  await fs.mkdir(path.join(sessionRoot, 's1'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, 's1'), { recursive: true })
  const mirrorBytes = Buffer.from('frame-A\nframe-C\n')
  await fs.writeFile(path.join(mirrorRoot, 's1', 'session.v4.jsonl.zstd'), mirrorBytes)
  await fs.writeFile(path.join(sessionRoot, 's1', 'session.v4.jsonl.zstd'), Buffer.from('frame-A\nframe-B\n'))
  // 根外受害者文件 + 预植硬链接（Windows 无需特权；symlink 需要，故用硬链接）。
  const victim = path.join(root, 'victim.bin')
  await fs.writeFile(victim, 'VICTIM\n')
  const planted = forkStamps().map(s => `session.v4.jsonl.zstd.remote-fork-${s}-abcd1234`)
  try {
    for (const name of planted) await fs.link(victim, path.join(mirrorRoot, 's1', name))
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EXDEV' || error?.code === 'EACCES') return t.skip('hardlink creation not permitted here')
    throw error
  }
  const result = await restoreSessionRoot({ mirrorRoot, sessionRoot, deviceShort: 'abcd1234' })
  assert.equal(result.divergedSkipped, 1)
  assert.equal(await fs.readFile(victim, 'utf8'), 'VICTIM\n', 'the planted link must not be written through')
  const all = (await fs.readdir(path.join(mirrorRoot, 's1'))).filter(n => n.startsWith('session.v4.jsonl.zstd.remote-fork-'))
  const fresh = all.filter(n => !planted.includes(n))
  assert.equal(fresh.length, 1, 'the mirror bytes must land in a new suffixed fork')
  assert.deepEqual(await fs.readFile(path.join(mirrorRoot, 's1', fresh[0])), mirrorBytes)
})

test('absent mirrorRoot returns the full zero shape including guard counters', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const result = await restoreSessionRoot({
    mirrorRoot: path.join(root, 'does-not-exist'),
    sessionRoot: path.join(root, 'sessions'),
  })
  assert.deepEqual(result, {
    restored: 0, unchanged: 0, skipped: 0, tracked: 0,
    cwdMapped: 0, cwdUnmapped: 0, cwdProjectionSkipped: 0,
    liveAheadSkipped: 0, divergedSkipped: 0,
  })
})
