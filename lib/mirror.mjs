// lib/mirror.mjs — 会话目录 → git 工作树的字节镜像（node:fs；零 DSH 依赖）。
//
// 会话文件一律按不透明字节复制（JSONL/zstd 等物理编码属于宿主，插件不解析）。
// 安全边界：
// - 默认绝不跟随符号链接（源或目标为链接一律跳过并报告，杜绝写出根外）；
//   `followSessionSymlinks: true` 时只跟随 realpath 仍落在 sessionRoot 内的链接
//   （proot link2symlink 那类"可读但 dirent 报 symlink"的宿主，见 #30）；
// - 删除仅限工作树内、源已不存在、且非 fork 文件、非宿主私有产物的常规文件；
// - fork 文件（FORK_NAME_RE）永不复制、永不删除——冲突双方字节的持久载体；
// - 宿主私有会话产物（HOST_ARTIFACT_NAME_RE：session.lock / 迁移暂存）同样
//   永不复制、永不删除——运行时状态不属于可同步内容。
//
// 跨平台 cwd 投影（#28）：恢复时把 header.cwd 投成本机路径、文件落到宿主布局的
// 投影位置；镜像里的字节仍是原设备的 header（见 lib/projection.mjs）。镜像枚举
// 因此跳过投影位置，并按投影表把本地尾部接回镜像里的原首帧——推送出去的字节
// 与对端追加的字节逐字节一致。

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { FORK_NAME_RE, HOST_ARTIFACT_NAME_RE, UNMAPPED_DIR } from './constants.mjs'
import {
  canonicalizeProjectedFile,
  planRestoreFile,
  readProjectionState,
  writeProjectionState,
} from './projection.mjs'

/** 跟随符号链接时允许的最大目录深度（防环耗尽栈）。 */
const MAX_WALK_DEPTH = 64

/** 符号链接的 realpath 是否仍在 root 内（真实路径 containment）。 */
function insideRoot(rootReal, targetReal) {
  const rel = path.relative(rootReal, targetReal)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * 递归枚举 root 下全部常规文件（POSIX 相对路径；符号链接默认跳过并回报）。
 * 跟随边界：只有当链接的 realpath 仍落在 `realpath(root)` 内时才读取/递归；
 * 越界链接仍进 `skipped`。目录链接用 realpath 去环。
 * @param {string} root - 会话存储根。
 * @param {{followSymlinks?: boolean}} [options] - 是否跟随根内符号链接。
 * @returns {Promise<{files: {absolute: string, rel: string}[], skipped: string[], followed: string[]}>} 枚举结果。
 */
async function listFiles(root, options = {}) {
  const followSymlinks = options.followSymlinks === true
  const files = []
  const skipped = []
  const followed = []
  const seenFiles = new Set()
  const rootReal = followSymlinks ? await fs.realpath(root) : undefined
  const visitedDirectories = new Set()
  const walk = async (dir, depth) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name)
      const rel = path.relative(root, absolute).split(path.sep).join('/')
      if (entry.isSymbolicLink()) {
        if (!followSymlinks) {
          skipped.push(absolute)
          continue
        }
        if (depth > MAX_WALK_DEPTH) {
          skipped.push(absolute)
          continue
        }
        let targetReal
        try {
          targetReal = await fs.realpath(absolute)
        } catch {
          skipped.push(absolute)
          continue
        }
        if (!insideRoot(/** @type {string} */ (rootReal), targetReal)) {
          skipped.push(absolute)
          continue
        }
        let stats
        try {
          stats = await fs.stat(absolute)
        } catch {
          skipped.push(absolute)
          continue
        }
        if (stats.isDirectory()) {
          if (visitedDirectories.has(targetReal)) continue
          visitedDirectories.add(targetReal)
          followed.push(rel)
          await walk(absolute, depth + 1)
          continue
        }
        if (stats.isFile()) {
          if (seenFiles.has(rel)) continue
          seenFiles.add(rel)
          files.push({ absolute, rel })
          followed.push(rel)
          continue
        }
        skipped.push(absolute)
        continue
      }
      if (entry.isDirectory()) {
        if (followSymlinks) {
          try {
            const real = await fs.realpath(absolute)
            if (visitedDirectories.has(real)) continue
            visitedDirectories.add(real)
          } catch {
            continue
          }
        }
        await walk(absolute, depth + 1)
        continue
      }
      if (entry.isFile()) {
        if (seenFiles.has(rel)) continue
        seenFiles.add(rel)
        files.push({ absolute, rel })
      }
    }
  }
  await walk(root, 0)
  return { files, skipped, followed }
}

/** 拒绝任何解析后落在 root 之外的写入（含父目录 symlink 逃逸）。 */
async function assertWriteInside(root, target) {
  let rootReal
  try { rootReal = await fs.realpath(root) } catch {
    await fs.mkdir(root, { recursive: true })
    rootReal = await fs.realpath(root)
  }
  await fs.mkdir(path.dirname(target), { recursive: true })
  const parentReal = await fs.realpath(path.dirname(target))
  const rel = path.relative(rootReal, parentReal)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`refusing to write outside ${rootReal}`)
}

/** 内容一致则跳过写（返回 false），否则覆写（返回 true）。root 可选，提供时做真实路径 containment。 */
async function writeIfDifferent(target, content, root) {
  if (root !== undefined) await assertWriteInside(root, target)
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
  try {
    await fs.writeFile(target, content)
  } catch (error) {
    // 只读投影副本（占位目录）由本插件写成 0o444；再次恢复前先解开写位。
    if (error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error
    await fs.chmod(target, 0o644).catch(() => {})
    await fs.writeFile(target, content)
  }
  return true
}

/** 删除文件；只读投影副本（占位目录 0o444）在 Windows 上先解开只读位再删。 */
async function unlinkFile(target) {
  try {
    await fs.unlink(target)
  } catch (error) {
    if (error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error
    await fs.chmod(target, 0o644).catch(() => {})
    await fs.unlink(target)
  }
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
  const payload = Buffer.from(`${JSON.stringify({ version: 1, sourcePaths: [...sourcePaths].sort() })}
`)
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
 * 跨平台 cwd 投影：投影位置（`projectedRel`）不作为镜像源；对应条目按投影表
 * 把本地追加尾部接回镜像首帧后写入**原路径**，镜像字节因此保持原设备视角。
 * @param {object} deps - {sessionRoot, repoDir, mirrorDir, forkNameRe?, followSessionSymlinks?, projectionState?}。
 * @returns {Promise<{mirrored: number, unchanged: number, skippedLinks: string[], followedLinks: string[], deleted: string[], remotePreserved: string[], snapshotUnknown: boolean, forkedPreserved: string[], hostArtifactsSkipped: number, hostArtifactsPreserved: string[], cwdMapped: number, cwdUnmapped: number, cwdProjectionSkipped: number, projectionError?: string}>}
 */
export async function mirrorSessionRoot(deps) {
  const forkRe = deps.forkNameRe ?? FORK_NAME_RE
  const projectionState = deps.projectionState ?? await readProjectionState(deps.repoDir)
  const projectedRels = new Set(projectionState.entries.map(entry => entry.projectedRel))
  const source = await listFiles(deps.sessionRoot, { followSymlinks: deps.followSessionSymlinks === true })
  const mirrorRoot = path.join(deps.repoDir, deps.mirrorDir)
  const targets = new Set()
  const previous = await readSourceSnapshot(deps.repoDir)

  let mirrored = 0
  let unchanged = 0
  let hostArtifactsSkipped = 0
  let cwdProjectionSkipped = 0
  let cwdMapped = 0
  let cwdUnmapped = 0
  for (const file of source.files) {
    if (projectedRels.has(file.rel)) continue
    if (HOST_ARTIFACT_NAME_RE.test(path.posix.basename(file.rel))) {
      hostArtifactsSkipped += 1
      continue
    }
    const target = path.join(mirrorRoot, ...file.rel.split('/'))
    targets.add(file.rel)
    const wrote = await writeIfDifferent(target, await fs.readFile(file.absolute), deps.repoDir)
    if (wrote) mirrored += 1
    else unchanged += 1
  }

  // 投影条目：本地投影副本存在 → 镜像原路径必须继续受保护（删除保护），
  // 且只在可推送（非占位只读）时把本地尾部接回原首帧后覆写。
  for (const entry of projectionState.entries) {
    let local
    const localPath = path.join(deps.sessionRoot, ...entry.projectedRel.split('/'))
    try {
      const localStat = await fs.lstat(localPath)
      // 投影副本必须是常规文件：绝不经符号链接读取（根内跟随只对镜像源开放）。
      if (localStat.isSymbolicLink() || !localStat.isFile()) continue
      local = await fs.readFile(localPath)
    } catch {
      continue
    }
    targets.add(entry.canonicalRel)
    let mirrorExisting
    try {
      mirrorExisting = await fs.readFile(path.join(mirrorRoot, ...entry.canonicalRel.split('/')))
    } catch {
      mirrorExisting = undefined
    }
    // 占位（只读视图）永不作为推送源；可映射条目要求本地首帧仍是投影形状。
    if (entry.readOnly === true) {
      cwdUnmapped += 1
      continue
    }
    const canonical = canonicalizeProjectedFile({ entry, localContent: local, mirrorContent: mirrorExisting })
    if (canonical === undefined) {
      cwdProjectionSkipped += 1
      continue
    }
    cwdMapped += 1
    const wrote = await writeIfDifferent(path.join(mirrorRoot, ...entry.canonicalRel.split('/')), canonical, deps.repoDir)
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

  return {
    mirrored,
    unchanged,
    skippedLinks: source.skipped,
    followedLinks: source.followed,
    deleted,
    remotePreserved,
    snapshotUnknown: previous === undefined,
    forkedPreserved,
    hostArtifactsSkipped,
    hostArtifactsPreserved,
    cwdMapped,
    cwdUnmapped,
    cwdProjectionSkipped,
    projectionError: projectionState.error,
  }
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
 * 删除本插件曾经从某次 pull 恢复、且远端随后删除的本机副本；只有当前字节仍等于
 * 记录的哈希时才删（用户改过的副本保留并照常推送）。投影位置通过投影表映射回
 * 镜像相对路径。
 * @param {{repoDir: string, mirrorRoot: string, sessionRoot: string, projectionState?: object}} deps
 * @returns {Promise<{pruned: string[], keptEdited: string[]}>}
 */
export async function pruneRestoredSessions(deps) {
  const state = await readRestoreState(deps.repoDir)
  if (state.size === 0) return { pruned: [], keptEdited: [] }
  const projectionState = deps.projectionState ?? await readProjectionState(deps.repoDir)
  const mirror = await mirrorRelSet(deps.mirrorRoot)
  const pruned = []
  const keptEdited = []
  for (const [rel, expected] of [...state]) {
    const canonicalRel = projectionState.byProjected.get(rel)?.canonicalRel ?? rel
    if (mirror.has(canonicalRel)) continue
    const target = path.join(deps.sessionRoot, ...rel.split('/'))
    try {
      const st = await fs.lstat(target)
      if (st.isSymbolicLink()) { state.delete(rel); continue }
      const content = await fs.readFile(target)
      if (hashContent(content) === expected) {
        await unlinkFile(target)
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
 * unlinked them. This writes new/changed regular files back, never deletes,
 * never follows symlinks, and never writes fork files or host-private artifacts.
 *
 * 跨平台 cwd 投影（#28）：需要投影的会话写到宿主布局的投影位置
 * （`<projectKey(投影 cwd)>/<sessionId>/<file>`）并改写首帧 cwd；镜像里的原
 * 路径不落盘（同一会话 id 不能同时出现在两个项目目录）。投影表落在本地
 * `.git/` 下，推送时用于把原首帧接回。
 * @param {object} deps - {repoDir, mirrorRoot, sessionRoot, forkNameRe?, cwdMap?, platform?}。
 * @returns {Promise<{restored: number, unchanged: number, skipped: number, tracked: number, cwdMapped: number, cwdUnmapped: number, cwdProjectionSkipped: number, projectionError?: string}>}
 */
export async function restoreSessionRoot(deps) {
  const forkRe = deps.forkNameRe ?? FORK_NAME_RE
  const mirrorRoot = deps.mirrorRoot
  let entries
  try {
    entries = await fs.readdir(mirrorRoot, { recursive: true, withFileTypes: true })
  } catch {
    return { restored: 0, unchanged: 0, skipped: 0, tracked: 0, cwdMapped: 0, cwdUnmapped: 0, cwdProjectionSkipped: 0 }
  }
  const previous = await readProjectionState(deps.repoDir)
  const nextEntries = []
  const nextRelSet = new Set()
  let restored = 0
  let unchanged = 0
  let skipped = 0
  let cwdMapped = 0
  let cwdUnmapped = 0
  let cwdProjectionSkipped = 0
  const state = deps.repoDir === undefined ? new Map() : await readRestoreState(deps.repoDir)
  for (const entry of entries) {
    if (!entry.isFile()) { skipped += 1; continue }
    const parent = entry.parentPath ?? entry.path ?? mirrorRoot
    const absolute = path.join(parent, entry.name)
    const rel = path.relative(mirrorRoot, absolute).split(path.sep).join('/')
    const basename = path.posix.basename(rel)
    if (forkRe.test(basename) || HOST_ARTIFACT_NAME_RE.test(basename)) { skipped += 1; continue }
    const content = await fs.readFile(absolute)
    const plan = planRestoreFile({
      content,
      mirrorRel: rel,
      cwdMap: deps.cwdMap ?? [],
      sessionRoot: deps.sessionRoot,
      platform: deps.platform,
    })
    if (plan.kind === 'skipped') {
      cwdProjectionSkipped += 1
      // 无法投影（如 id 与目录不符）：保持镜像原样落盘，绝不写坏布局。
    }
    if (plan.kind === 'mapped') cwdMapped += 1
    if (plan.kind === 'placeholder') cwdUnmapped += 1
    if (plan.entry !== undefined) {
      nextEntries.push(plan.entry)
      // 映射目标 / 占位目录必须真实存在，宿主才能 realpath 并把它归入 workspace
      // （失败不影响可读性：会话仍会以 ungrouped 出现在列表里）。
      await fs.mkdir(plan.entry.projectedCwd, { recursive: true }).catch(() => {})
    }
    nextRelSet.add(plan.rel)
    const target = path.join(deps.sessionRoot, ...plan.rel.split('/'))
    let existed = false
    try {
      const st = await fs.lstat(target)
      if (st.isSymbolicLink()) { skipped += 1; continue }
      existed = true
    } catch { /* target absent */ }
    const wrote = await writeIfDifferent(target, plan.content, deps.sessionRoot)
    if (wrote) restored += 1
    else unchanged += 1
    // 占位投影是只读视图：尽力在文件系统层面也标注只读（root 可写时由推送端
    // 兜底——占位条目永不作为推送源）。
    if (plan.kind === 'placeholder') await fs.chmod(target, 0o444).catch(() => {})
    // Track only copies this plugin created (target absent before) or already
    // tracked. A pre-existing user file is never claimed by the sync plugin.
    if (!existed || state.has(plan.rel)) state.set(plan.rel, hashContent(plan.content))
    // 投影位置与原路径不同：清掉旧版或旧映射遗留在原路径上的本机副本，否则
    // 宿主会把同一 session id 看成两个项目里的重复会话。
    if (plan.rel !== rel) {
      const legacyTarget = path.join(deps.sessionRoot, ...rel.split('/'))
      let legacyStat
      try {
        legacyStat = await fs.lstat(legacyTarget)
      } catch {
        legacyStat = undefined
      }
      if (legacyStat?.isFile() === true) {
        const legacyContent = await fs.readFile(legacyTarget)
        const tracked = state.get(rel)
        if (legacyContent.equals(content) || (tracked !== undefined && hashContent(legacyContent) === tracked)) {
          await unlinkFile(legacyTarget)
          state.delete(rel)
        }
      }
    }
  }
  // 失效投影清理：配置变更（映射删除/改写）后，旧投影位置上的副本若仍是本插件
  // 写的字节，就删掉；否则保留并让状态记录它（用户改动优先）。
  for (const oldEntry of previous.entries) {
    if (nextRelSet.has(oldEntry.projectedRel)) continue
    const oldTarget = path.join(deps.sessionRoot, ...oldEntry.projectedRel.split('/'))
    let oldStat
    try {
      oldStat = await fs.lstat(oldTarget)
    } catch {
      oldStat = undefined
    }
    if (oldStat?.isFile() !== true) continue
    const expected = state.get(oldEntry.projectedRel)
    try {
      const oldContent = await fs.readFile(oldTarget)
      // 只删"本插件上次恢复、且此后没人改动"的副本：无哈希记录或字节已变都保留
      // （用户改动优先，宁可留下一个可见副本也不误删数据）。
      if (expected !== undefined && hashContent(oldContent) === expected) {
        await unlinkFile(oldTarget)
        state.delete(oldEntry.projectedRel)
      }
    } catch {
      // 读不到就不删（安全优先）。
    }
  }
  if (deps.repoDir !== undefined) {
    await writeRestoreState(deps.repoDir, state)
    await writeProjectionState(deps.repoDir, nextEntries)
  }
  return {
    restored,
    unchanged,
    skipped,
    tracked: state.size,
    cwdMapped,
    cwdUnmapped,
    cwdProjectionSkipped,
    projectionError: previous.error,
  }
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

export { UNMAPPED_DIR }
