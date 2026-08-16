// lib/paths.mjs — 路径解析与越界校验（零依赖）。
//
// 全部纯函数：解析同步根/工作树根、校验嵌套关系、把会话文件相对路径
// 安全地映射进工作树。任何把外部输入拼进路径的地方必须先经 assertRelPath
// 或 containment 检查（路径越界 = PATH_UNSAFE 响亮失败，绝不静默）。

import path from 'node:path'
import { badConfig, pathUnsafe } from './errors.mjs'

/**
 * 解析会话存储根：配置为空时取 $DSH_HOME/sessions；两者皆缺 → 响亮失败。
 * 目录是否真实存在由消费方（镜像/状态）处理；这里只做路径层面的解析。
 * @param {string} configured - Config.sessionRoot（'' = 默认）。
 * @param {string|undefined} [dshHome] - 环境 $DSH_HOME（测试注入）。
 * @returns {string} 绝对路径。
 */
export function resolveSessionRoot(configured, dshHome = process.env.DSH_HOME) {
  if (typeof configured === 'string' && configured.length > 0) {
    return path.resolve(configured)
  }
  if (typeof dshHome === 'string' && dshHome.length > 0) {
    return path.join(dshHome, 'sessions')
  }
  throw badConfig('sessionRoot is empty and $DSH_HOME is not set; run under dsh or set sessionRoot explicitly')
}

/**
 * 解析同步仓库工作树根：配置为空时取 $DSH_HOME/dsh-session-sync/repo。
 * @param {string} configured - Config.repoDir（'' = 默认）。
 * @param {string|undefined} [dshHome] - 环境 $DSH_HOME（测试注入）。
 * @returns {string} 绝对路径。
 */
export function resolveRepoDir(configured, dshHome = process.env.DSH_HOME) {
  if (typeof configured === 'string' && configured.length > 0) {
    return path.resolve(configured)
  }
  if (typeof dshHome === 'string' && dshHome.length > 0) {
    return path.join(dshHome, 'dsh-session-sync', 'repo')
  }
  throw badConfig('repoDir is empty and $DSH_HOME is not set; run under dsh or set repoDir explicitly')
}

/**
 * 两目录不得互相包含：镜像会把 sessionRoot 复制进 repoDir（或反之时递归）。
 * @param {string} sessionRoot - 已解析的会话存储根。
 * @param {string} repoDir - 已解析的同步仓库根。
 * @returns {void} 违反时抛 BAD_CONFIG。
 */
export function assertNestingSafe(sessionRoot, repoDir) {
  const inside = (a, b) => {
    const rel = path.relative(a, b)
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
  }
  if (inside(sessionRoot, repoDir)) {
    throw badConfig(`repoDir ${JSON.stringify(repoDir)} must not be inside sessionRoot ${JSON.stringify(sessionRoot)} (the mirror would copy itself)`)
  }
  if (inside(repoDir, sessionRoot)) {
    throw badConfig(`sessionRoot ${JSON.stringify(sessionRoot)} must not be inside repoDir ${JSON.stringify(repoDir)} (the mirror would copy itself)`)
  }
}

/**
 * 校验会话文件的相对路径：拒绝绝对路径、空段、`.`/`..`、反斜杠与越界。
 * 镜像与 fork 路径拼接的唯一入口。
 * @param {string} rel - 相对路径（POSIX 分隔）。
 * @returns {string} 规范化后的同一相对路径。
 */
export function assertRelPath(rel) {
  if (typeof rel !== 'string' || rel.length === 0) {
    throw pathUnsafe('relative path must be a non-empty string')
  }
  if (rel.includes('\\') || rel.includes('\0')) {
    throw pathUnsafe(`relative path contains reserved characters: ${JSON.stringify(rel)}`)
  }
  const segments = rel.split('/')
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      throw pathUnsafe(`relative path contains traversal segment: ${JSON.stringify(rel)}`)
    }
  }
  return rel
}

/**
 * 相对路径 → 工作树镜像路径（<repoDir>/sessions/<rel>）。
 * @param {string} repoDir - 同步仓库根。
 * @param {string} mirrorDir - 镜像目录名（MIRROR_DIR）。
 * @param {string} rel - 已校验的相对路径。
 * @returns {string} 工作树内绝对路径。
 */
export function mirrorPathOf(repoDir, mirrorDir, rel) {
  return path.join(repoDir, mirrorDir, ...assertRelPath(rel).split('/'))
}

/**
 * fork 文件名：<basename>.remote-fork-<UTC 14 位时间戳>-<设备短 id>。
 * 同一目录内同一时刻的冲突靠设备 id 区分；绝不覆盖既有 fork 文件。
 * @param {string} basename - 原文件名。
 * @param {string} timestampUtc - UTC 时间戳（yyyyMMddHHmmss）。
 * @param {string} deviceShort - 设备短 id（≤ 8 位小写十六进制）。
 * @returns {string} fork 文件名。
 */
export function forkFileName(basename, timestampUtc, deviceShort) {
  const stamp = /^\d{14}$/u.test(timestampUtc) ? timestampUtc : '19700101000000'
  const device = /^[0-9a-z]{1,8}$/iu.test(deviceShort) ? deviceShort.toLowerCase() : 'unknown'
  return `${basename}.remote-fork-${stamp}-${device}`
}
