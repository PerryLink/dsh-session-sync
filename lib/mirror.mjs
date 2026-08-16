// lib/mirror.mjs — 会话目录 → git 工作树的字节镜像（node:fs；零 DSH 依赖）。
//
// 会话文件一律按不透明字节复制（JSONL/zstd 等物理编码属于宿主，插件不解析）。
// 安全边界：
// - 绝不跟随符号链接（源或目标为链接一律跳过并报告，杜绝写出根外）；
// - 删除仅限工作树内、源已不存在、且非 fork 文件的常规文件；
// - fork 文件（FORK_NAME_RE）永不复制、永不删除——冲突双方字节的持久载体。

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { FORK_NAME_RE } from './constants.mjs'

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

/**
 * 把 sessionRoot 镜像进 <repoDir>/<mirrorDir>/…。
 * @param {object} deps - {sessionRoot, repoDir, mirrorDir, forkNameRe?}。
 * @returns {Promise<{mirrored: number, unchanged: number, skippedLinks: string[], deleted: string[], forkedPreserved: string[]}>}
 */
export async function mirrorSessionRoot(deps) {
  const forkRe = deps.forkNameRe ?? FORK_NAME_RE
  const source = await listFiles(deps.sessionRoot)
  const mirrorRoot = path.join(deps.repoDir, deps.mirrorDir)
  const targets = new Set()

  let mirrored = 0
  let unchanged = 0
  for (const file of source.files) {
    const target = path.join(mirrorRoot, ...file.rel.split('/'))
    targets.add(file.rel)
    const wrote = await writeIfDifferent(target, await fs.readFile(file.absolute))
    if (wrote) mirrored += 1
    else unchanged += 1
  }

  // 删除：目标树中源已不存在、且非 fork 命名的文件。
  const deleted = []
  const forkedPreserved = []
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
    if (!targets.has(rel)) {
      await fs.unlink(absolute)
      deleted.push(rel)
    }
  }

  return { mirrored, unchanged, skippedLinks: source.skipped, deleted, forkedPreserved }
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
