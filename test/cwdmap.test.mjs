// test/cwdmap.test.mjs — 跨平台 cwd 投影（#28）与符号链接诊断/跟随（#30）。
//
// 关键判据不靠自证：投影后的会话由**真实宿主后端**
// （@deepseek-ai/dsh-session-persistence-jsonl）`stat()`/`list()` 读取。
// 宿主 `assertStoredIdentity` 要求文件路径等于
// `<root>/<projectKey(header.cwd)>/<sessionId>/<file>`，因此这条断言同时钉住
// 我们的 projectKey 复刻、目录布局与 header 改写。
//
// @module dsh-session-sync/test/cwdmap.test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { constants, zstdCompressSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import {
  matchCwdMap,
  normalizeCwdMap,
  projectCwd,
  projectKey,
  projectedRelOf,
} from '../lib/cwdmap.mjs'
import { planRestoreFile } from '../lib/projection.mjs'
import { readSessionHeader } from '../lib/sessionlog.mjs'
import { mirrorSessionRoot, pruneRestoredSessions, restoreSessionRoot } from '../lib/mirror.mjs'
import { makeSyncStatusTool, renderStatus, resolveConfig } from '../index.mjs'

const ZSTD_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }
const SESSION_ID = 'session-11111111-2222-3333-4444-555555555555'
const WINDOWS_CWD = 'C:\\Users\\me\\proj'
const CANONICAL_REL = `--C-Users-me-proj--/${SESSION_ID}/session.v4.jsonl.zstd`

/** 一段合法的 V4 header 行（宿主 readHeader 只接受这些键）。 */
function headerLine(overrides = {}) {
  return `${JSON.stringify({
    type: 'session',
    version: 4,
    id: SESSION_ID,
    createdAt: 1_700_000_000_000,
    isSeeded: false,
    delegationDepth: 0,
    cwd: WINDOWS_CWD,
    ...overrides,
  })}\n`
}

/** 一帧 zstd（与宿主 compressZstdFrame 同参数）。 */
function zstdFrame(text) {
  return zstdCompressSync(Buffer.from(text, 'utf8'), ZSTD_OPTIONS)
}

/** 一份会话日志：header 帧 + 可选事件帧。 */
function sessionLog(header, events = '') {
  return events.length === 0
    ? zstdFrame(header)
    : Buffer.concat([zstdFrame(header), zstdFrame(events)])
}

async function makeTemp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-cwdmap-'))
  return { root, clean: () => fs.rm(root, { recursive: true, force: true }) }
}

/** 真实宿主 JSONL 后端（只读面：stat/list）。 */
async function hostBackend(sessionRoot) {
  const ctx = new Context()
  ctx.plugin(JsonlSessionPersistence, { root: sessionRoot, compression: 'zstd' })
  const deadline = Date.now() + 5_000
  while (ctx.get('sessionPersistence') === undefined && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  const persistence = ctx.get('sessionPersistence')
  assert.ok(persistence !== undefined, 'the host JSONL backend must register its service')
  return {
    persistence,
    stop: async () => { await (/** @type {any} */ (ctx)).stop?.() },
  }
}

test('normalizeCwdMap: longest prefix first, segment boundaries, Windows is case-insensitive', () => {
  const maps = normalizeCwdMap([
    { from: 'C:\\Users\\me', to: '/home/me/win' },
    { from: 'C:\\Users\\me\\proj', to: '/home/me/win/proj' },
  ])
  assert.equal(maps.length, 2, 'both entries survive normalization')
  assert.equal(maps[0].from, 'C:\\Users\\me\\proj', 'the deeper prefix sorts first')

  const deep = matchCwdMap('C:\\Users\\me\\proj\\src', maps)
  assert.equal(deep?.remainder.join('/'), 'src')
  assert.equal(deep?.entry.to, '/home/me/win/proj')

  // 段边界：me2 不是 me 的前缀命中。
  assert.equal(matchCwdMap('C:\\Users\\me2\\proj', maps), undefined)
  assert.equal(matchCwdMap('C:\\Users\\me2', maps), undefined)
  // Windows 语义：大小写不敏感。
  assert.equal(matchCwdMap('c:\\users\\ME\\proj', maps)?.entry.to, '/home/me/win/proj')
  // 前缀本身（无剩余段）。
  assert.deepEqual(matchCwdMap('C:\\Users\\me', maps)?.remainder, [])
  // 映射按段拼接，不会把 `/home/me/win` 变成 `/home/me/winproj`。
  assert.equal(projectCwd('C:\\Users\\me\\proj', { map: maps, sessionRoot: '/root/sessions' }).cwd, '/home/me/win/proj')
  assert.equal(projectCwd('C:\\Users\\me\\other', { map: maps, sessionRoot: '/root/sessions' }).cwd, '/home/me/win/other')
})

test('normalizeCwdMap rejects malformed entries loudly', () => {
  assert.throws(() => normalizeCwdMap('nope'), /cwdMap must be an array/u)
  assert.throws(() => normalizeCwdMap([{ from: 'C:\\me', to: '/a' }, { from: 'c:\\ME', to: '/b' }]), /duplicate from/u)
  assert.throws(() => normalizeCwdMap([{ from: 'relative/path', to: '/a' }]), /from must be an absolute path/u)
  assert.throws(() => normalizeCwdMap([{ from: 'C:\\me', to: 'relative' }]), /to must be an absolute path/u)
  assert.throws(() => normalizeCwdMap([{ from: 'C:\\me', to: '/a', extra: 1 }]), /unknown key/u)
  assert.throws(() => normalizeCwdMap([{ from: '', to: '/a' }]), /from must be a non-empty string/u)
})

test('projectKey matches the host layout formula (golden values)', () => {
  assert.equal(projectKey('C:\\Users\\me\\proj'), '--C-Users-me-proj--')
  assert.equal(projectKey('/home/me/proj'), '--home-me-proj--')
  assert.equal(projectKey('C:\\'), '--C---')
  assert.equal(projectKey('/'), '--root--')
  assert.equal(
    projectedRelOf(CANONICAL_REL, '/home/me/win/proj'),
    `--home-me-win-proj--/${SESSION_ID}/session.v4.jsonl.zstd`,
  )
  // 旧扁平布局（没有 projectKey 段）不投影。
  assert.equal(projectedRelOf(`${SESSION_ID}/session.v4.jsonl.zstd`, '/home/me/proj'), undefined)
})

test('a Windows header becomes visible on Linux after restore (real host backend)', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const mirrorRoot = path.join(repoDir, 'sessions')
  const mappedRoot = path.join(root, 'linux')
  const mappedCwd = path.join(mappedRoot, 'proj') // from 'C:\Users\me' + remainder 'proj'
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, ...CANONICAL_REL.split('/').slice(0, -1)), { recursive: true })
  const canonical = sessionLog(headerLine(), `${JSON.stringify({ type: 'user/message', seq: 0 })}\n`)
  await fs.writeFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/')), canonical)

  const result = await restoreSessionRoot({
    repoDir,
    mirrorRoot,
    sessionRoot,
    cwdMap: normalizeCwdMap([{ from: 'C:\\Users\\me', to: mappedRoot }]),
  })
  assert.equal(result.restored, 1)
  assert.equal(result.cwdMapped, 1)
  assert.equal(result.cwdUnmapped, 0)

  // 投影落在宿主布局的 projectKey(mappedCwd) 目录，原目录不落盘（同一 id 不能重复）。
  const localPath = path.join(sessionRoot, ...`${projectKey(mappedCwd)}/${SESSION_ID}/session.v4.jsonl.zstd`.split('/'))
  assert.equal((await fs.stat(localPath)).isFile(), true)
  await assert.rejects(fs.stat(path.join(sessionRoot, ...CANONICAL_REL.split('/'))), { code: 'ENOENT' })

  const parsed = readSessionHeader(await fs.readFile(localPath), true)
  assert.equal(parsed?.header.cwd, mappedCwd, 'the local projection carries the local cwd')

  // 真实宿主：stat 会走 assertStoredIdentity（路径必须等于 projectKey(cwd) 公式）。
  const host = await hostBackend(sessionRoot)
  t.after(host.stop)
  const stat = await host.persistence.stat(SESSION_ID)
  assert.equal(stat?.header.cwd, mappedCwd)
  const listed = await host.persistence.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].header.cwd, mappedCwd)

  // 镜像字节保持原设备视角：推送时不改写、不新增投影路径。
  const mirrored = await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions' })
  assert.equal(mirrored.cwdMapped, 1)
  assert.deepEqual(await fs.readFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/'))), canonical)
  await assert.rejects(fs.stat(path.join(mirrorRoot, projectKey(mappedCwd))), { code: 'ENOENT' })
})

test('a session with no matching mapping lands read-only in the --unmapped-- placeholder', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const mirrorRoot = path.join(repoDir, 'sessions')
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, ...CANONICAL_REL.split('/').slice(0, -1)), { recursive: true })
  const canonical = sessionLog(headerLine())
  await fs.writeFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/')), canonical)

  const result = await restoreSessionRoot({ repoDir, mirrorRoot, sessionRoot, cwdMap: normalizeCwdMap([]) })
  assert.equal(result.cwdUnmapped, 1)
  assert.equal(result.cwdMapped, 0)

  const placeholderCwd = path.join(sessionRoot, '--unmapped--')
  const localPath = path.join(sessionRoot, ...`${projectKey(placeholderCwd)}/${SESSION_ID}/session.v4.jsonl.zstd`.split('/'))
  const parsed = readSessionHeader(await fs.readFile(localPath), true)
  assert.equal(parsed?.header.cwd, placeholderCwd)
  assert.equal((await fs.stat(placeholderCwd)).isDirectory(), true, 'the placeholder directory is created for workspace grouping')
  if (process.platform !== 'win32') {
    assert.equal((await fs.stat(localPath)).mode & 0o222, 0, 'the unmapped copy is best-effort read-only on disk')
  }

  const host = await hostBackend(sessionRoot)
  t.after(host.stop)
  const stat = await host.persistence.stat(SESSION_ID)
  assert.equal(stat?.header.cwd, placeholderCwd)

  // 只读视图永不作为推送源，也永不删除镜像里的原始会话。
  const before = await fs.readFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/')))
  const mirrored = await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions' })
  assert.equal(mirrored.cwdUnmapped, 1)
  assert.deepEqual(await fs.readFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/'))), before)
  await assert.rejects(fs.stat(path.join(mirrorRoot, projectKey(placeholderCwd))), { code: 'ENOENT' })

  // 即便有人在占位副本上追加，推送端也不接管（只读视图语义）。
  if (process.platform !== 'win32') await fs.chmod(localPath, 0o644)
  const appended = Buffer.concat([await fs.readFile(localPath), zstdFrame('{"type":"user/message","seq":1}\n')])
  await fs.writeFile(localPath, appended)
  await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions' })
  assert.deepEqual(await fs.readFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/'))), before)
})

test('appends to a mapped projection push as byte-identical appends to the origin header', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const mirrorRoot = path.join(repoDir, 'sessions')
  const mappedRoot = path.join(root, 'linux')
  const mappedCwd = path.join(mappedRoot, 'proj') // from 'C:\Users\me' + remainder 'proj'
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, ...CANONICAL_REL.split('/').slice(0, -1)), { recursive: true })
  const firstEvent = zstdFrame('{"type":"user/message","seq":0}\n')
  const canonical = Buffer.concat([zstdFrame(headerLine()), firstEvent])
  await fs.writeFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/')), canonical)

  await restoreSessionRoot({
    repoDir,
    mirrorRoot,
    sessionRoot,
    cwdMap: normalizeCwdMap([{ from: 'C:\\Users\\me', to: mappedRoot }]),
  })
  const localPath = path.join(sessionRoot, ...`${projectKey(mappedCwd)}/${SESSION_ID}/session.v4.jsonl.zstd`.split('/'))
  const appendedFrame = zstdFrame('{"type":"assistant/message","seq":1}\n')
  await fs.writeFile(localPath, Buffer.concat([await fs.readFile(localPath), appendedFrame]))

  const mirrored = await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions' })
  assert.equal(mirrored.mirrored, 1)
  const pushed = await fs.readFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/')))
  assert.deepEqual(pushed.subarray(0, canonical.length), canonical, 'the origin header frame is preserved byte-for-byte')
  assert.deepEqual(pushed.subarray(canonical.length), appendedFrame, 'only the appended frames are added')
  // 宿主读回镜像里的原会话（对端视角）仍然一致：header 仍是 Windows cwd。
  const origin = readSessionHeader(pushed, true)
  assert.equal(origin?.header.cwd, WINDOWS_CWD)
})

test('projection is skipped when the directory does not encode the header id', () => {
  const content = sessionLog(headerLine({ id: 'session-other' }))
  const plan = planRestoreFile({
    content,
    mirrorRel: CANONICAL_REL,
    cwdMap: normalizeCwdMap([{ from: 'C:\\Users\\me', to: '/home/me/win' }]),
    sessionRoot: '/root/sessions',
  })
  assert.equal(plan.kind, 'skipped')
  assert.equal(plan.rel, CANONICAL_REL)
  assert.deepEqual(plan.content, content)
})

test('followSessionSymlinks: inside-root links are opt-in, outside links never follow', async (t) => {
  if (process.platform === 'win32') return t.skip('symlink creation needs extra privileges on Windows')
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const outside = path.join(root, 'outside.jsonl')
  await fs.mkdir(path.join(sessionRoot, 'proj'), { recursive: true })
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  await fs.writeFile(path.join(sessionRoot, 'proj', 'real.jsonl'), 'real\n')
  await fs.writeFile(outside, 'outside\n')
  await fs.symlink(path.join(sessionRoot, 'proj', 'real.jsonl'), path.join(sessionRoot, 'proj', 'inside-link.jsonl'))
  await fs.symlink(outside, path.join(sessionRoot, 'proj', 'outside-link.jsonl'))

  const strict = await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions' })
  assert.equal(strict.skippedLinks.length, 2, 'the default never follows symlinks')
  await assert.rejects(fs.stat(path.join(repoDir, 'sessions', 'proj', 'inside-link.jsonl')), { code: 'ENOENT' })

  const followed = await mirrorSessionRoot({ sessionRoot, repoDir, mirrorDir: 'sessions', followSessionSymlinks: true })
  assert.equal(followed.skippedLinks.length, 1, 'the outside link stays skipped')
  assert.match(followed.skippedLinks[0], /outside-link\.jsonl$/u)
  assert.equal(await fs.readFile(path.join(repoDir, 'sessions', 'proj', 'inside-link.jsonl'), 'utf8'), 'real\n')
  assert.ok(followed.followedLinks.some(rel => rel.endsWith('inside-link.jsonl')))
})

test('sync_status exposes skipped symlinks and cwd projection diagnostics', async () => {
  const engine = {
    status: async () => ({
      ok: true,
      branch: 'main',
      remote: '',
      ahead: 0,
      behind: 0,
      dirty: [],
      forks: [],
      diffStat: '',
      mergeInProgress: false,
      lastCommits: [],
      skippedSymlinks: 3,
      skippedSymlinkPaths: ['/root/.dsh/sessions/x/session.v4.jsonl.zstd'],
      followedSymlinks: 0,
      cwdMapped: 1,
      cwdUnmapped: 2,
      cwdProjectionSkipped: 0,
      cwdPlaceholder: '/root/.dsh/sessions/--unmapped--',
      followSessionSymlinks: false,
      warnings: ['3 file(s) under sessionRoot were skipped as symbolic links'],
    }),
  }
  const tool = makeSyncStatusTool(engine, async () => ({}))
  const value = await tool.execute({}, /** @type {any} */ ({}))
  assert.equal(value.skippedSymlinks, 3)
  assert.equal(value.cwdUnmapped, 2)
  assert.equal(value.cwdPlaceholder, '/root/.dsh/sessions/--unmapped--')
  assert.equal(value.followSessionSymlinks, false)
  assert.ok(JSON.stringify(value).length > 0, 'the tool result stays lossless JSON')

  const text = renderStatus(value)
  assert.match(text, /skipped symbolic links/u)
  assert.match(text, /cwd projection: 1 mapped/u)
  assert.match(text, /warning: 3 file\(s\) under sessionRoot/u)
})

test('resolveConfig validates cwdMap and followSessionSymlinks', () => {
  const base = { sessionRoot: '/tmp/sessions', repoDir: '/tmp/repo' }
  const resolved = resolveConfig({ ...base, cwdMap: [{ from: 'C:\\Users\\me', to: '/home/me' }] })
  assert.equal(resolved.cwdMap.length, 1)
  assert.equal(resolved.followSessionSymlinks, false)
  assert.throws(() => resolveConfig({ ...base, cwdMap: [{ from: 'C:\\me', to: 'relative' }] }), /to must be an absolute path/u)
  assert.throws(() => resolveConfig(/** @type {any} */ ({ ...base, followSessionSymlinks: 'yes' })), /followSessionSymlinks must be a boolean/u)
})

test('prune maps a projected path back to the mirror and prunes remote deletions', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const sessionRoot = path.join(root, 'sessions')
  const repoDir = path.join(root, 'repo')
  const mirrorRoot = path.join(repoDir, 'sessions')
  const mappedRoot = path.join(root, 'linux')
  await fs.mkdir(path.join(repoDir, '.git'), { recursive: true })
  await fs.mkdir(path.join(mirrorRoot, ...CANONICAL_REL.split('/').slice(0, -1)), { recursive: true })
  await fs.writeFile(path.join(mirrorRoot, ...CANONICAL_REL.split('/')), sessionLog(headerLine()))
  await restoreSessionRoot({
    repoDir,
    mirrorRoot,
    sessionRoot,
    cwdMap: normalizeCwdMap([{ from: 'C:\\Users\\me', to: mappedRoot }]),
  })
  const projectedRel = `${projectKey(path.join(mappedRoot, 'proj'))}/${SESSION_ID}/session.v4.jsonl.zstd`
  const localPath = path.join(sessionRoot, ...projectedRel.split('/'))
  assert.equal((await fs.stat(localPath)).isFile(), true)

  // 远端删除了原会话（镜像里已无该文件）：本插件恢复出来的投影副本应被清理。
  await fs.unlink(path.join(mirrorRoot, ...CANONICAL_REL.split('/')))
  const pruned = await pruneRestoredSessions({ repoDir, mirrorRoot, sessionRoot })
  assert.deepEqual(pruned.pruned, [projectedRel])
  await assert.rejects(fs.stat(localPath), { code: 'ENOENT' })
})
