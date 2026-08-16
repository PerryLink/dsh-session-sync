// lib/merge.mjs — append-only 三分支合并语义（纯函数，零依赖）。
//
// 会话日志是 append-only：三方（合并基点 base、本地 ours、远端 theirs）
// 逐文件按字节比较。规则（绝不静默覆盖——ours/theirs 任一字节都会存续）：
// - 相同（ours == theirs）→ 保留 ours；
// - 仅本地变（theirs == base）→ 保留 ours；
// - 仅远端变（ours == base）→ 采纳 theirs（本地无增量可丢，不是覆盖）；
// - 双边纯追加（base 是 ours 与 theirs 的共同字节前缀）→ 保留 ours 在原路径，
//   theirs 整体留存为 fork 文件（两边保留）；
// - 其余（任一侧重写/压缩打包/删除等真实分歧）→ 同样保留 ours + fork theirs，
//   并响亮报告 diverged，绝不替用户取舍。
//
// 内容按 Buffer 语义比较：zstd 等二进制日志与 UTF-8 文本同一套规则。

import { MERGE_KINDS } from './constants.mjs'

/** 任意内容形态 → Buffer|undefined。 */
function norm(value) {
  if (value === undefined || value === null) return undefined
  if (Buffer.isBuffer(value)) return value
  return Buffer.from(String(value))
}

/** a 是否为 b 的字节前缀（等长即相等）。 */
function isPrefix(prefix, whole) {
  return prefix !== undefined && whole !== undefined
    && prefix.length <= whole.length
    && whole.subarray(0, prefix.length).equals(prefix)
}

/**
 * 单路径三方分类。
 * @param {Buffer|string|undefined} base - 合并基点内容。
 * @param {Buffer|string|undefined} ours - 本地内容。
 * @param {Buffer|string|undefined} theirs - 远端内容。
 * @returns {{kind: string, keepOurs: boolean, forkTheirs: boolean}}
 *   kind ∈ MERGE_KINDS；keepOurs=false 时采纳 theirs（theirs-only）。
 */
export function classifyPath(base, ours, theirs) {
  const b = norm(base)
  const o = norm(ours)
  const t = norm(theirs)
  if (o !== undefined && t !== undefined && o.equals(t)) {
    return { kind: MERGE_KINDS.IDENTICAL, keepOurs: true, forkTheirs: false }
  }
  if (o === undefined && t === undefined) {
    return { kind: MERGE_KINDS.IDENTICAL, keepOurs: true, forkTheirs: false }
  }
  // 仅本地变：远端仍是基点内容。
  if (equalsOrBothMissing(t, b)) {
    return { kind: MERGE_KINDS.OURS_ONLY, keepOurs: true, forkTheirs: false }
  }
  // 仅远端变：本地仍是基点内容 → 采纳远端（本地无增量，非覆盖）。
  if (equalsOrBothMissing(o, b)) {
    return { kind: MERGE_KINDS.THEIRS_ONLY, keepOurs: false, forkTheirs: false }
  }
  // 双边纯追加：共同基点前缀 + 各自后缀 → 两边保留，远端转 fork 文件。
  if (isPrefix(b, o) && isPrefix(b, t)) {
    return { kind: MERGE_KINDS.APPEND_BOTH, keepOurs: true, forkTheirs: true }
  }
  // 真实分歧（重写/打包/单侧删除等）：同样两边保留 + 响亮报告。
  return { kind: MERGE_KINDS.DIVERGED, keepOurs: true, forkTheirs: true }
}

/** 两侧同时缺失或字节相等。 */
function equalsOrBothMissing(left, right) {
  if (left === undefined && right === undefined) return true
  if (left === undefined || right === undefined) return false
  return left.equals(right)
}

/**
 * 整批冲突路径的合并计划（pull 阶段对 merge 冲突路径逐一调用 classifyPath）。
 * @param {Array<{path: string, base?: Buffer|string, ours?: Buffer|string, theirs?: Buffer|string}>} conflicts - 冲突路径。
 * @returns {{resolutions: Array<{path: string, kind: string, adoptTheirs: boolean, forkTheirs: boolean}>, summary: {kept: number, adopted: number, appended: number, diverged: number, forkPaths: string[]}}}
 */
export function planMerge(conflicts) {
  const resolutions = []
  const summary = { kept: 0, adopted: 0, appended: 0, diverged: 0, forkPaths: [] }
  for (const entry of conflicts) {
    const verdict = classifyPath(entry.base, entry.ours, entry.theirs)
    const resolution = {
      path: entry.path,
      kind: verdict.kind,
      adoptTheirs: !verdict.keepOurs,
      forkTheirs: verdict.forkTheirs,
    }
    resolutions.push(resolution)
    if (verdict.kind === MERGE_KINDS.THEIRS_ONLY) summary.adopted += 1
    else summary.kept += 1
    if (verdict.kind === MERGE_KINDS.APPEND_BOTH) summary.appended += 1
    if (verdict.kind === MERGE_KINDS.DIVERGED) summary.diverged += 1
    if (verdict.forkTheirs) summary.forkPaths.push(entry.path)
  }
  return { resolutions, summary }
}
