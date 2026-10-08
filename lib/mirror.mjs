// lib/mirror.mjs — 会话目录 → git 工作树的字节镜像（node:fs；零 DSH 依赖）。
//
// 会话文件一律按不透明字节复制（JSONL/zstd 等物理编码属于宿主，插件不解析）。
// 安全边界：
// - 绝不跟随符号链接（源或目标为链接一律跳过并报告，杜绝写出根外）；
// - 删除仅限工作树内、**上一次镜像时确实来自源**、这次源已不存在、且非 fork
//   文件、非宿主私有产物的常规文件；
// - fork 文件（FORK_NAME_RE）永不复制、永不删除——冲突双方字节的持久载体；
// - 宿主私有会话产物（HOST_ARTIFACT_NAME_RE：session.lock / 迁移暂存）同样
//   永不复制、永不删除——运行时状态不属于可同步内容。
//
// 「上一次镜像时确实来自源」这条判据是必需的：工作树里的文件有两种来源——
// 由本机 sessionRoot 镜像来的，和由 pull 从远端合进来的。只按「源里没有」删除
// 会把后者也清掉（拉来的会话从没进过活会话库），于是每次 pull 的成果都会被
// 下一次镜像抹掉，并把删除推回远端，形成 A/B 两台设备互相删除的来回震荡。
// 判据存在 <repoDir>/.git 下（本地、不进提交、不随仓库同步）；读不到就一律
// 不删（失败方向是留下文件，不是丢文件）。

import { promises as fs } from 'node:fs'
import path from 'node:path'
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
    const existing = await fs.readFile(target)
    if (existing.equals(content)) return false
  } catch {
    // 目标不存在 → 照写。
  }
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
  return true
}

/** 源快照状态文件（相对 <repoDir>/.git）：本地、不进提交、不随仓库同步。 */
export const SOURCE_SNAPSHOT_FILE = path.join('.git', 'dsh-session-sync-mirror.json')

/**
 * 读上一次镜像时 sessionRoot 的文件清单。
 * 返回 undefined 表示「不知道」——此时调用方一律不得删除任何镜像文件，
 * 失败方向必须是「留下文件」而不是「丢文件」。
 * @param {string} repoDir - 同步仓库根。
 * @returns {Promise<Set<string>|undefined>} 相对路径集合，或 undefined（未知）。
 */
async function readSourceSnapshot(repoDir) {
  try {
    const raw = await fs.readFile(path.join(repoDir, SOURCE_SNAPSHOT_FILE), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.sourcePaths)) return undefined
    return new Set(parsed.sourcePaths.filter(rel => typeof rel === 'string'))
  } catch {
    // 首次运行、被清理、损坏、或 <repoDir> 还不是 git 仓库 → 视为未知。
    return undefined
  }
}

/**
 * 写回本次镜像的源清单（内容不变则跳过写）。
 * @param {string} repoDir - 同步仓库根。
 * @param {Set<string>} sourcePaths - 本次实际镜像的源相对路径。
 * @returns {Promise<boolean>} 是否写入。
 */
async function writeSourceSnapshot(repoDir, sourcePaths) {
  const target = path.join(repoDir, SOURCE_SNAPSHOT_FILE)
  const payload = Buffer.from(`${JSON.stringify({ version: 1, sourcePaths: [...sourcePaths].sort() })}\n`)
  try {
    const stat = await fs.stat(path.dirname(target))
    // <repoDir> 不是 git 工作树（.git 缺失或为 file 形式的 gitdir 指针）时不留状态，
    // 该次运行也就不会删除任何东西。
    if (!stat.isDirectory()) return false
  } catch {
    return false
  }
  return writeIfDifferent(target, payload)
}

/**
 * 把 sessionRoot 镜像进 <repoDir>/<mirrorDir>/…。
 * 宿主私有会话产物（租约/迁移暂存，HOST_ARTIFACT_NAME_RE）既不复制、也不删除：
 * 它们是运行时状态，同步它们只会把某设备的瞬时状态变成另一侧的删除/噪音。
 * @param {object} deps - {sessionRoot, repoDir, mirrorDir, forkNameRe?}。
 * @returns {Promise<{mirrored: number, unchanged: number, skippedLinks: string[], deleted: string[], remotePreserved: string[], snapshotUnknown: boolean, forkedPreserved: string[], hostArtifactsSkipped: number, hostArtifactsPreserved: string[]}>}
 */
export async function mirrorSessionRoot(deps) {
  const forkRe = deps.forkNameRe ?? FORK_NAME_RE
  const source = await listFiles(deps.sessionRoot)
  const mirrorRoot = path.join(deps.repoDir, deps.mirrorDir)
  const targets = new Set()
  // 上一次镜像时源里有什么。undefined = 未知（首次运行/状态被清）→ 本次不删任何东西。
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

  // 删除：仅限「上一次镜像时确实来自源」（previous 命中）而这次源里已经没有的
  // 文件。工作树里源里没有的文件有两种：本机删掉的会话，和 pull 从远端合进来的
  // 会话——后者从没进过活会话库，按「源里没有」删掉会让每次 pull 的成果被下一次
  // 镜像抹掉并把删除推回远端。previous 未知时一律不删（失败方向是留下，不是丢）。
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
      // 上一次镜像时源里没有它（远端拉来的），或快照未知 → 保留，绝不删。
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
    deleted,
    remotePreserved,
    snapshotUnknown: previous === undefined,
    forkedPreserved,
    hostArtifactsSkipped,
    hostArtifactsPreserved,
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
