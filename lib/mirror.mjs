// lib/mirror.mjs — 会话目录 → git 工作树的字节镜像（node:fs；零 DSH 依赖）。
//
// 会话文件一律按不透明字节复制（JSONL/zstd 等物理编码属于宿主，插件不解析）。
// 安全边界：
// - 绝不跟随符号链接（源或目标为链接一律跳过并报告，杜绝写出根外）；
// - 删除仅限工作树内、源已不存在、且非 fork 文件、非宿主私有产物的常规文件；
// - fork 文件（FORK_NAME_RE）永不复制、永不删除——冲突双方字节的持久载体；
// - 宿主私有会话产物（HOST_ARTIFACT_NAME_RE：session.lock / 迁移暂存）同样
//   永不复制、永不删除——运行时状态不属于可同步内容。

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { FORK_NAME_RE, HOST_ARTIFACT_NAME_RE } from './constants.mjs'

/** 递归枚举 root 下全部常规文件（POSIX 相对路径；符号链接跳过并回报）。 */
async function listFiles(root) {
  const files = []
  const skipped = []
  const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) {
        skipped.push(absolute)
        continue
      }
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (entry.isFile()) {
        files.push({ absolute, rel: path.relative(root, absolute).split(path.sep).join('/') })
      }
    }
  }
  await walk(root)
  return { files, skipped }
}

/** 内容一致则跳过写（返回 false），否则覆写（返回 true）。 */
async function writeIfDifferent(target, content) {
  try {
    const st = await fs.lstat(target)
    if (st.isSymbolicLink()) throw new Error('refusing to write through a symbolic link')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  try {
    const existing = await fs.readFile(target)
    if (existing.equals(content)) return false
  } catch {
    // 目标不存在 → 照写。
  }
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
  return true
}

/** 源快照状态文件：本地、不进提交、不随仓库同步。 */
export const SOURCE_SNAPSHOT_FILE = path.join('.git', 'dsh-session-sync-mirror.json')

/** @param {string} repoDir */
async function readSourceSnapshot(repoDir) {
  try {
    const raw = await fs.readFile(path.join(repoDir, SOURCE_SNAPSHOT_FILE), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.sourcePaths)) return undefined
    return new Set(parsed.sourcePaths.filter(rel => typeof rel === 'string'))
  } catch {
    return undefined
  }
}

/** @param {string} repoDir @param {Set<string>} sourcePaths */
async function writeSourceSnapshot(repoDir, sourcePaths) {
  const target = path.join(repoDir, SOURCE_SNAPSHOT_FILE)
  const payload = Buffer.from(`${JSON.stringify({ version: 1, sourcePaths: [...sourcePaths].sort() })}\n`)
  try {
    const st = await fs.stat(path.dirname(target))
    if (!st.isDirectory()) return
  } catch {
    return
  }
  await writeIfDifferent(target, payload)
}

/**
 * 把 sessionRoot 镜像进 <repoDir>/<mirrorDir>/…。
 * 宿主私有会话产物（租约/迁移暂存，HOST_ARTIFACT_NAME_RE）既不复制、也不删除：
 * 它们是运行时状态，同步它们只会把某设备的瞬时状态变成另一侧的删除/噪音。
 * @param {object} deps - {sessionRoot, repoDir, mirrorDir, forkNameRe?}。
 * @returns {Promise<{mirrored: number, unchanged: number, skippedLinks: string[], deleted: string[], forkedPreserved: string[], hostArtifactsSkipped: number, hostArtifactsPreserved: string[]}>}
 */
export async function mirrorSessionRoot(deps) {
  const forkRe = deps.forkNameRe ?? FORK_NAME_RE
  const source = await listFiles(deps.sessionRoot)
  const mirrorRoot = path.join(deps.repoDir, deps.mirrorDir)
  const targets = new Set()
  const previous = await readSourceSnapshot(deps.repoDir)

  let mirrored = 0
  let unchanged = 0
  let hostArtifactsSkipped = 0
  for (const file of source.files) {
    if (HOST_ARTIFACT_NAME_RE.test(path.posix.basename(file.rel))) {
      hostArtifactsSkipped += 1
      continue
    }
    const target = path.join(mirrorRoot, ...file.rel.split('/'))
    targets.add(file.rel)
    const wrote = await writeIfDifferent(target, await fs.readFile(file.absolute))
    if (wrote) mirrored += 1
    else unchanged += 1
  }

  // 删除：目标树中源已不存在、且非 fork 命名、非宿主私有产物的文件。
  const deleted = []
  const remotePreserved = []
  const forkedPreserved = []
  const hostArtifactsPreserved = []
  const targetFiles = []
  try {
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const absolute = path.join(dir, entry.name)
        if (entry.isSymbolicLink()) continue
        if (entry.isDirectory()) {
          await walk(absolute)
          continue
        }
        if (entry.isFile()) targetFiles.push(absolute)
      }
    }
    await walk(mirrorRoot)
  } catch {
    // 镜像根尚不存在 → 无删除可做。
  }
  for (const absolute of targetFiles) {
    const rel = path.relative(mirrorRoot, absolute).split(path.sep).join('/')
    const basename = path.posix.basename(rel)
    if (forkRe.test(basename)) {
      forkedPreserved.push(rel)
      continue
    }
    if (HOST_ARTIFACT_NAME_RE.test(basename)) {
      hostArtifactsPreserved.push(rel)
      continue
    }
    if (targets.has(rel)) continue
    if (previous === undefined || !previous.has(rel)) {
      // Never delete a file this device did not previously mirror from its own
      // sessionRoot: it arrived via pull, or provenance is unknown.
      remotePreserved.push(rel)
      continue
    }
    await fs.unlink(absolute)
    deleted.push(rel)
  }
  await writeSourceSnapshot(deps.repoDir, targets)

  return { mirrored, unchanged, skippedLinks: source.skipped, deleted, remotePreserved, snapshotUnknown: previous === undefined, forkedPreserved, hostArtifactsSkipped, hostArtifactsPreserved }
}

/** 恢复状态文件：本地、不进提交、不随仓库同步。 */
export const RESTORE_STATE_FILE = path.join('.git', 'dsh-session-sync-restored.json')

/** @param {Buffer|string} content */
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex')
}

/** @param {string} repoDir */
async function readRestoreState(repoDir) {
  try {
    const raw = await fs.readFile(path.join(repoDir, RESTORE_STATE_FILE), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || parsed.version !== 1 || parsed.files === null || typeof parsed.files !== 'object') return new Map()
    return new Map(Object.entries(parsed.files).filter(([rel, hash]) => typeof rel === 'string' && typeof hash === 'string'))
  } catch {
    return new Map()
  }
}

/** @param {string} repoDir @param {Map<string,string>} files */
async function writeRestoreState(repoDir, files) {
  const target = path.join(repoDir, RESTORE_STATE_FILE)
  const payload = Buffer.from(`${JSON.stringify({ version: 1, files: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b))) })}
`)
  try {
    const st = await fs.stat(path.dirname(target))
    if (!st.isDirectory()) return
  } catch {
    return
  }
  await writeIfDifferent(target, payload)
}

/** @param {string} root */
async function mirrorRelSet(root) {
  const set = new Set()
  try {
    const entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const parent = entry.parentPath ?? entry.path ?? root
      set.add(path.relative(root, path.join(parent, entry.name)).split(path.sep).join('/'))
    }
  } catch {}
  return set
}

/**
 * Remove live-store copies that this plugin restored from a previous pull and
 * that the remote has now deleted, but only while the live bytes still match
 * the restored hash. A user-edited copy is kept (and will push normally).
 * @param {{repoDir: string, mirrorRoot: string, sessionRoot: string}} deps
 * @returns {Promise<{pruned: string[], keptEdited: string[]}>}
 */
export async function pruneRestoredSessions(deps) {
  const state = await readRestoreState(deps.repoDir)
  if (state.size === 0) return { pruned: [], keptEdited: [] }
  const mirror = await mirrorRelSet(deps.mirrorRoot)
  const pruned = []
  const keptEdited = []
  for (const [rel, expected] of [...state]) {
    if (mirror.has(rel)) continue
    const target = path.join(deps.sessionRoot, ...rel.split('/'))
    try {
      const st = await fs.lstat(target)
      if (st.isSymbolicLink()) { state.delete(rel); continue }
      const content = await fs.readFile(target)
      if (hashContent(content) === expected) {
        await fs.unlink(target)
        pruned.push(rel)
      } else {
        keptEdited.push(rel)
      }
    } catch {
      // already gone
    }
    state.delete(rel)
  }
  await writeRestoreState(deps.repoDir, state)
  return { pruned, keptEdited }
}

/**
 * Copy the merged mirror back into the live session store. Pull used to merge only
 * into the mirror; the next push then saw those files as "missing locally" and
 * unlinked them. This writes new/changed regular files back, never deletes, never
 * follows symlinks, and never writes fork files or host-private artifacts.
 * @param {object} deps - {repoDir, mirrorRoot, sessionRoot, forkNameRe?}.
 * @returns {Promise<{restored: number, unchanged: number, skipped: number, tracked: number}>}
 */
export async function restoreSessionRoot(deps) {
  const forkRe = deps.forkNameRe ?? FORK_NAME_RE
  let entries
  try {
    entries = await fs.readdir(deps.mirrorRoot, { recursive: true, withFileTypes: true })
  } catch {
    return { restored: 0, unchanged: 0, skipped: 0 }
  }
  let restored = 0
  let unchanged = 0
  let skipped = 0
  const state = deps.repoDir === undefined ? new Map() : await readRestoreState(deps.repoDir)
  for (const entry of entries) {
    if (!entry.isFile()) { skipped += 1; continue }
    const parent = entry.parentPath ?? entry.path ?? deps.mirrorRoot
    const absolute = path.join(parent, entry.name)
    const rel = path.relative(deps.mirrorRoot, absolute).split(path.sep).join('/')
    const basename = path.posix.basename(rel)
    if (forkRe.test(basename) || HOST_ARTIFACT_NAME_RE.test(basename)) { skipped += 1; continue }
    const target = path.join(deps.sessionRoot, ...rel.split('/'))
    let existed = false
    try {
      const st = await fs.lstat(target)
      if (st.isSymbolicLink()) { skipped += 1; continue }
      existed = true
    } catch { /* target absent */ }
    const content = await fs.readFile(absolute)
    const wrote = await writeIfDifferent(target, content)
    if (wrote) restored += 1
    else unchanged += 1
    // Track only copies this plugin created (target absent before) or already
    // tracked. A pre-existing user file is never claimed by the sync plugin.
    if (!existed || state.has(rel)) state.set(rel, hashContent(content))
  }
  if (deps.repoDir !== undefined) await writeRestoreState(deps.repoDir, state)
  return { restored, unchanged, skipped, tracked: state.size }
}

/**
 * 确保设备身份文件内容为 deviceId（不同才写；返回是否写入）。
 * @param {string} repoDir - 同步仓库根。
 * @param {string} deviceFile - 文件名（repoDir 直下）。
 * @param {string} deviceId - 设备 id。
 * @returns {Promise<boolean>} 是否写入。
 */
export async function ensureDeviceFile(repoDir, deviceFile, deviceId) {
  const target = path.join(repoDir, deviceFile)
  const content = Buffer.from(`${deviceId}\n`)
  return writeIfDifferent(target, content)
}
