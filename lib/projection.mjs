// lib/projection.mjs — 恢复期 cwd 投影表（本地状态；镜像字节保持原样）。
//
// 恢复时，跨平台会话被写到宿主布局中的**投影位置**
// （`<projectKey(投影 cwd)>/<sessionId>/<file>`）并把首帧 cwd 换成本机路径。
// 同步仓库（镜像）里仍是原设备的 header——投影表只落在本地 `.git/` 下、不进
// 提交，记录 canonicalRel ↔ projectedRel、原始 cwd 与首帧字节，供推送时把本地
// 追加尾部接回原首帧（对端看到的仍是逐字节 append）。
//
// 不可解析的日志/状态一律"保持原样"：本模块绝不猜测字节，也绝不让一份看不懂的
// 会话变成一次写坏布局的操作。

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { decodeSegment } from './paths.mjs'
import { projectCwd, projectedRelOf } from './cwdmap.mjs'
import {
  SESSION_LOG_NAME_RE,
  encodeSessionHeader,
  isCompressedName,
  readSessionHeader,
} from './sessionlog.mjs'

/** 投影表状态文件（本地、不进提交）。 */
export const PROJECTION_STATE_FILE = path.join('.git', 'dsh-session-sync-projection.json')

const STATE_VERSION = 1
/** header 首帧的缓存上限：超过就不缓存（推送时退回重新压缩）。 */
const MAX_HEADER_FRAME_BYTES = 64 * 1024

/**
 * 空投影表。
 * @returns {{entries: object[], byCanonical: Map<string, object>, byProjected: Map<string, object>, error?: string}} 投影表。
 */
function emptyProjection() {
  return { entries: [], byCanonical: new Map(), byProjected: new Map() }
}

/**
 * 由条目数组建投影表（按 canonical/projected 双向索引）。
 * @param {object[]} entries - 投影条目。
 * @returns {{entries: object[], byCanonical: Map<string, object>, byProjected: Map<string, object>}} 投影表。
 */
function indexProjection(entries) {
  const byCanonical = new Map()
  const byProjected = new Map()
  for (const entry of entries) {
    byCanonical.set(entry.canonicalRel, entry)
    byProjected.set(entry.projectedRel, entry)
  }
  return { entries, byCanonical, byProjected }
}

/**
 * 读取投影表。缺失 = 空表（尚未投影过）；损坏 = 空表 + error（fail closed：
 * 不投影、不把本地视图当推送源）。
 * @param {string|undefined} repoDir - 同步仓库根。
 * @returns {Promise<{entries: object[], byCanonical: Map<string, object>, byProjected: Map<string, object>, error?: string}>} 投影表。
 */
export async function readProjectionState(repoDir) {
  if (typeof repoDir !== 'string' || repoDir.length === 0) return emptyProjection()
  let raw
  try {
    raw = await fs.readFile(path.join(repoDir, PROJECTION_STATE_FILE), 'utf8')
  } catch {
    return emptyProjection()
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...emptyProjection(), error: 'projection state is not valid JSON (run a pull to rebuild it)' }
  }
  if (parsed === null || typeof parsed !== 'object' || parsed.version !== STATE_VERSION || !Array.isArray(parsed.entries)) {
    return { ...emptyProjection(), error: 'projection state has an unsupported shape (run a pull to rebuild it)' }
  }
  const entries = []
  for (const entry of parsed.entries) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.canonicalRel !== 'string' || typeof entry.projectedRel !== 'string') continue
    if (typeof entry.originalCwd !== 'string' || typeof entry.projectedCwd !== 'string') continue
    if (typeof entry.id !== 'string' || typeof entry.readOnly !== 'boolean') continue
    entries.push({
      canonicalRel: entry.canonicalRel,
      projectedRel: entry.projectedRel,
      id: entry.id,
      originalCwd: entry.originalCwd,
      projectedCwd: entry.projectedCwd,
      readOnly: entry.readOnly,
      compressed: entry.compressed === true,
      headerFrame: typeof entry.headerFrame === 'string' ? entry.headerFrame : undefined,
    })
  }
  return indexProjection(entries)
}

/**
 * 写投影表（原子替换；`.git` 不存在时静默跳过——等价于不持久化）。
 * @param {string|undefined} repoDir - 同步仓库根。
 * @param {object[]} entries - 新投影条目。
 * @returns {Promise<void>}
 */
export async function writeProjectionState(repoDir, entries) {
  if (typeof repoDir !== 'string' || repoDir.length === 0) return
  const target = path.join(repoDir, PROJECTION_STATE_FILE)
  try {
    const st = await fs.stat(path.dirname(target))
    if (!st.isDirectory()) return
  } catch {
    return
  }
  const payload = Buffer.from(`${JSON.stringify({ version: STATE_VERSION, entries: [...entries].sort((a, b) => a.canonicalRel.localeCompare(b.canonicalRel)) })}
`)
  const temporary = `${target}.${process.pid}.tmp`
  await fs.writeFile(temporary, payload)
  await fs.rename(temporary, target)
}

/**
 * 规划一个镜像文件在恢复时的落盘形态。
 * @param {{content: Buffer, mirrorRel: string, cwdMap: ReadonlyArray<object>, sessionRoot: string, platform?: NodeJS.Platform}} deps - 文件与配置。
 * @returns {{rel: string, content: Buffer, kind: 'as-is'|'mapped'|'placeholder'|'skipped', entry?: object}} 落盘计划。
 */
export function planRestoreFile(deps) {
  const name = path.posix.basename(deps.mirrorRel)
  const asIs = { rel: deps.mirrorRel, content: deps.content, kind: /** @type {const} */ ('as-is') }
  if (!SESSION_LOG_NAME_RE.test(name)) return asIs
  const compressed = isCompressedName(name)
  const parsed = readSessionHeader(deps.content, compressed)
  if (parsed === undefined || typeof parsed.header.cwd !== 'string') return asIs
  const parts = deps.mirrorRel.split('/')
  // 宿主布局 = <projectKey>/<sessionId>/<file>；旧扁平布局不投影（否则路径语义
  // 不对，宁可不改）。
  if (parts.length < 3) return asIs
  if (decodeSegment(parts[1]) !== parsed.header.id) {
    return { ...asIs, kind: 'skipped' }
  }
  const projection = projectCwd(parsed.header.cwd, {
    map: deps.cwdMap,
    sessionRoot: deps.sessionRoot,
    platform: deps.platform,
  })
  if (!projection.mapped && !projection.unmapped) return asIs
  const rel = projectedRelOf(deps.mirrorRel, /** @type {string} */ (projection.cwd))
  if (rel === undefined || rel === deps.mirrorRel) return asIs
  const header = { ...parsed.header, cwd: projection.cwd }
  const entry = {
    canonicalRel: deps.mirrorRel,
    projectedRel: rel,
    id: parsed.header.id,
    originalCwd: parsed.header.cwd,
    projectedCwd: projection.cwd,
    readOnly: projection.readOnly,
    compressed,
    headerFrame: parsed.frame.length <= MAX_HEADER_FRAME_BYTES ? parsed.frame.toString('base64') : undefined,
  }
  return {
    rel,
    content: Buffer.concat([encodeSessionHeader(header, compressed), parsed.rest]),
    kind: projection.readOnly ? 'placeholder' : 'mapped',
    entry,
  }
}

/**
 * 把本机投影副本还原成镜像字节：镜像里的原首帧 + 本地追加尾部。
 * 占位（只读视图）与 header 被改动的副本一律返回 undefined（永不推送）。
 * @param {{entry: object, localContent: Buffer, mirrorContent?: Buffer}} deps - 投影条目与两侧字节。
 * @returns {Buffer|undefined} 可推送的镜像字节。
 */
export function canonicalizeProjectedFile(deps) {
  const entry = deps.entry
  if (entry.readOnly === true) return undefined
  if (!Buffer.isBuffer(deps.localContent)) return undefined
  const local = readSessionHeader(deps.localContent, entry.compressed === true)
  if (local === undefined) return undefined
  if (local.header.id !== entry.id) return undefined
  if (local.header.cwd !== entry.projectedCwd) return undefined
  let headerFrame
  if (Buffer.isBuffer(deps.mirrorContent)) {
    const mirror = readSessionHeader(deps.mirrorContent, entry.compressed === true)
    // 镜像 header 可能被对端迁移更新过：优先沿用它的首帧，保证不丢更新。
    if (mirror !== undefined && mirror.header.id === entry.id) headerFrame = mirror.frame
  }
  if (headerFrame === undefined && typeof entry.headerFrame === 'string') {
    headerFrame = Buffer.from(entry.headerFrame, 'base64')
  }
  if (headerFrame === undefined) {
    headerFrame = encodeSessionHeader({ ...local.header, cwd: entry.originalCwd }, entry.compressed === true)
  }
  return Buffer.concat([headerFrame, local.rest])
}
