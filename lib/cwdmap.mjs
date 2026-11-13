// lib/cwdmap.mjs — 恢复期 cwd 投影（纯函数，零依赖）。
//
// 跨平台会话的 header.cwd 在另一台机器上不是本机绝对路径。宿主的
// dsh-workspace 用 realpathNormalize(header.cwd) 建 workspace 索引；
// session-persistence-jsonl 更靠前——header 解析本身就要求 cwd 是本机绝对
// 路径（`isAbsolute`），非本机路径的会话连"可见"都做不到。因此恢复时必须把
// cwd 投影成本机路径。投影只落在**本地副本**上：同步仓库（镜像）里的字节保持
// 原设备的 header，推送时由 lib/projection.mjs 把原首帧接回去（逐字节 append
// 语义不变）。
//
// 匹配语义（issue #28）：
// - `cwdMap: [{from, to}]`，按最长前缀优先；
// - 前缀必须结束在路径段边界上（`C:\Users\me2` 不匹配 `C:\Users\me`）；
// - Windows 风格前缀按 Windows 语义大小写不敏感比较，其余按字节比较；
// - 无匹配的跨平台 cwd 归一到 `sessionRoot/--unmapped--`（可见但只读）。

import path from 'node:path'
import { posix, win32 } from 'node:path'
import { UNMAPPED_DIR } from './constants.mjs'
import { badConfig } from './errors.mjs'

const WINDOWS_DRIVE_RE = /^[A-Za-z]:/u
const SEPARATOR_RUN_RE = /[\\/]+/gu
const TRAILING_SEPARATOR_RE = /[\\/]+$/u
const SAFE_PROJECT_KEY_CHAR_RE = /^[A-Za-z0-9._-]$/u

/**
 * 是否形如 Windows 路径（盘符或 UNC）。
 * @param {string} value - 原始路径。
 * @returns {boolean} Windows 风格为 true。
 */
function looksWindows(value) {
  return WINDOWS_DRIVE_RE.test(value) || value.startsWith('\\\\')
}

/**
 * 是否为某个平台上的完全限定路径（宿主 fullyQualifiedWorkspacePath 的并集）。
 * @param {string} value - 原始路径。
 * @returns {boolean} 任一并集平台上的绝对路径为 true。
 */
function absoluteOnSomePlatform(value) {
  if (typeof value !== 'string' || value.length === 0) return false
  if (posix.isAbsolute(value)) return true
  const root = win32.parse(value).root
  return win32.isAbsolute(value) && root !== '\\' && root !== '/'
}

/**
 * 宿主 `fullyQualifiedWorkspacePath` 的等价判定：本机平台的完全限定路径。
 * （dsh-workspace/src/paths.ts：非 win32 用 posix.isAbsolute；win32 要求
 * root 不是 `\` 或 `/`。）
 * @param {string} value - 待判定路径。
 * @param {NodeJS.Platform} [platform] - 目标平台（测试可注入）。
 * @returns {boolean} 本机完全限定为 true。
 */
export function isNativeAbsolutePath(value, platform = process.platform) {
  if (typeof value !== 'string' || value.length === 0) return false
  if (platform !== 'win32') return posix.isAbsolute(value)
  const root = win32.parse(value).root
  return win32.isAbsolute(value) && root !== '\\' && root !== '/'
}

/**
 * 是否为"另一平台"的绝对路径（本机不可索引，但语义上是绝对路径）。
 * 相对路径/空值不算——那种 header 本来就无效，不归投影管。
 * @param {string} value - header cwd。
 * @param {NodeJS.Platform} [platform] - 目标平台（测试可注入）。
 * @returns {boolean} 跨平台绝对路径为 true。
 */
export function isForeignCwd(value, platform = process.platform) {
  if (typeof value !== 'string' || value.length === 0) return false
  if (isNativeAbsolutePath(value, platform)) return false
  return absoluteOnSomePlatform(value)
}

/**
 * 路径 → 段数组（分隔符归一；去掉绝对根产生的空首段与尾部空段）。
 * `C:\Users\me` → ['C:','Users','me']；`/home/me` → ['home','me']；`/` → []。
 * @param {string} value - 路径。
 * @returns {string[]} 段数组。
 */
function splitSegments(value) {
  const parts = value.replace(SEPARATOR_RUN_RE, '/').split('/')
  if (parts.length > 0 && parts[0] === '') parts.shift()
  while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

/**
 * 校验并规范化 cwdMap：非法项加载期响亮失败（Loud misconfiguration）。
 * 规范化结果按最长前缀优先排序，并携带预计算段（匹配热路径不重复切分）。
 * @param {unknown} entries - Config.cwdMap 原始值。
 * @returns {ReadonlyArray<{from: string, to: string, windows: boolean, segments: ReadonlyArray<string>}>} 规范化后的映射表。
 */
export function normalizeCwdMap(entries) {
  if (entries === undefined || entries === null) return Object.freeze([])
  if (!Array.isArray(entries)) throw badConfig('cwdMap must be an array of { from, to } objects')
  const seen = new Set()
  const normalized = []
  for (const [index, entry] of entries.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw badConfig(`cwdMap[${index}] must be an object with from/to`)
    }
    const value = /** @type {{from?: unknown, to?: unknown}} */ (entry)
    const extra = Object.keys(entry).filter(key => key !== 'from' && key !== 'to')
    if (extra.length > 0) throw badConfig(`cwdMap[${index}] has unknown key(s): ${extra.join(', ')}`)
    if (typeof value.from !== 'string' || value.from.trim().length === 0) {
      throw badConfig(`cwdMap[${index}].from must be a non-empty string`)
    }
    if (typeof value.to !== 'string' || value.to.trim().length === 0) {
      throw badConfig(`cwdMap[${index}].to must be a non-empty string`)
    }
    const from = value.from.replace(TRAILING_SEPARATOR_RE, '') || value.from
    const to = value.to.replace(TRAILING_SEPARATOR_RE, '') || value.to
    if (!absoluteOnSomePlatform(from)) {
      throw badConfig(`cwdMap[${index}].from must be an absolute path: ${JSON.stringify(value.from)}`)
    }
    if (!isNativeAbsolutePath(to)) {
      throw badConfig(`cwdMap[${index}].to must be an absolute path on this platform: ${JSON.stringify(value.to)}`)
    }
    const windows = looksWindows(from)
    const key = windows ? from.toLowerCase() : from
    if (seen.has(key)) throw badConfig(`cwdMap has a duplicate from: ${JSON.stringify(value.from)}`)
    seen.add(key)
    normalized.push({ from, to, windows, segments: splitSegments(from) })
  }
  normalized.sort((left, right) =>
    right.segments.length - left.segments.length
    || right.from.length - left.from.length
    || left.from.localeCompare(right.from))
  return Object.freeze(normalized.map(entry => Object.freeze(entry)))
}

/**
 * 最长前缀匹配（段边界）。cwd 必须能完整覆盖某个 from 的段序列。
 * @param {string} cwd - header.cwd。
 * @param {ReadonlyArray<{from: string, to: string, windows: boolean, segments: ReadonlyArray<string>}>} maps - normalizeCwdMap 的产物。
 * @returns {{entry: {from: string, to: string, windows: boolean, segments: ReadonlyArray<string>}, remainder: string[]}|undefined} 匹配项与剩余段。
 */
export function matchCwdMap(cwd, maps) {
  if (typeof cwd !== 'string' || cwd.length === 0) return undefined
  const segments = splitSegments(cwd)
  for (const entry of maps) {
    if (segments.length < entry.segments.length) continue
    let matches = true
    for (let index = 0; index < entry.segments.length; index += 1) {
      const left = entry.windows ? segments[index].toLowerCase() : segments[index]
      const right = entry.windows ? entry.segments[index].toLowerCase() : entry.segments[index]
      if (left !== right) {
        matches = false
        break
      }
    }
    if (!matches) continue
    return { entry, remainder: segments.slice(entry.segments.length) }
  }
  return undefined
}

/**
 * 把匹配项的剩余段接到 to 上（保持 to 的分隔符风格）。
 * @param {{to: string}} entry - 匹配项。
 * @param {string[]} remainder - 剩余段。
 * @returns {string} 映射后的本机路径。
 */
function joinMapped(entry, remainder) {
  const separator = entry.to.includes('\\') ? '\\' : '/'
  const tail = remainder.join(separator)
  return tail.length === 0 ? entry.to : `${entry.to}${separator}${tail}`
}

/**
 * 宿主 `projectKey(cwd)` 的等价实现（session-persistence-jsonl/src/format.ts）。
 *
 * 必须逐字一致：宿主用 `<root>/<projectKey(header.cwd)>/<sessionId>/<file>` 定位
 * 会话，并在 `assertStoredIdentity` 里校验路径等于这条公式——投影后的目录名差
 * 一个字符，恢复出来的会话就会被判 corrupt。分隔符（含 `:`）折叠为单个 `-`，
 * 其余不安全字符转 `~XXXX`，截断到 251 字符后包成 `--…--`。
 * @param {string} cwd - 会话的 cwd（必须非空）。
 * @returns {string} 项目目录名。
 */
export function projectKey(cwd) {
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new Error('cannot encode an empty project path')
  }
  let readable = ''
  let separatorRun = false
  for (let index = 0; index < cwd.length; index += 1) {
    const code = cwd.charCodeAt(index)
    const character = String.fromCharCode(code)
    if (character === '/' || character === '\\' || character === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (character !== '~' && SAFE_PROJECT_KEY_CHAR_RE.test(character)) {
      readable += character
      separatorRun = false
    } else {
      readable += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/u, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

/**
 * 计算投影后的镜像相对路径：把 `<projectKey(原 cwd)>` 段换成
 * `<projectKey(投影 cwd)>`，会话目录段与文件名不变（宿主布局
 * `<projectDir>/<sessionId>/<file>`）。
 * @param {string} canonicalRel - 镜像相对路径（POSIX 分隔）。
 * @param {string} projectedCwd - 投影后的本机 cwd。
 * @returns {string|undefined} 投影相对路径；旧扁平布局（不足 3 段）为 undefined。
 */
export function projectedRelOf(canonicalRel, projectedCwd) {
  if (typeof canonicalRel !== 'string' || canonicalRel.length === 0) return undefined
  const parts = canonicalRel.split('/')
  if (parts.length < 3) return undefined
  const [projectDir, sessionDir, ...rest] = parts
  if (projectDir.length === 0 || sessionDir.length === 0) return undefined
  return [projectKey(projectedCwd), sessionDir, ...rest].join('/')
}

/**
 * 恢复期 cwd 决策：有映射 → 映射目标；无映射的跨平台 cwd → 占位目录（只读）；
 * 本机 cwd → 原样。
 * @param {string|undefined} cwd - header.cwd。
 * @param {{map?: ReadonlyArray<object>, sessionRoot: string, platform?: NodeJS.Platform}} options - 映射表、会话根与平台。
 * @returns {{cwd: string|undefined, mapped: boolean, unmapped: boolean, readOnly: boolean, from: string|undefined}} 投影决策。
 */
export function projectCwd(cwd, options) {
  if (typeof cwd !== 'string' || cwd.length === 0) {
    return { cwd: undefined, mapped: false, unmapped: false, readOnly: false, from: cwd }
  }
  const match = matchCwdMap(cwd, options.map ?? [])
  if (match !== undefined) {
    return { cwd: joinMapped(match.entry, match.remainder), mapped: true, unmapped: false, readOnly: false, from: cwd }
  }
  if (!isForeignCwd(cwd, options.platform)) {
    return { cwd, mapped: false, unmapped: false, readOnly: false, from: cwd }
  }
  return {
    cwd: path.join(options.sessionRoot, UNMAPPED_DIR),
    mapped: false,
    unmapped: true,
    readOnly: true,
    from: cwd,
  }
}
