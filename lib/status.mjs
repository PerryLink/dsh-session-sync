// lib/status.mjs — 只读状态收集（零依赖；组合 GitBackend 原语）。
//
// 全部命令为本地只读（status/log/diff/ls-files/rev-parse），不 fetch、
// 不写任何文件；远端对比基于最近一次 fetch 的远端跟踪引用（报告注明）。

import { FORK_NAME_RE } from './constants.mjs'
import { sanitizeRemote } from './sanitize.mjs'

/** porcelain 状态行 → 路径（rename 取新路径）。 */
function pathOfPorcelainLine(line) {
  const rest = line.slice(3)
  const arrow = rest.indexOf(' -> ')
  return arrow >= 0 ? rest.slice(arrow + 4) : rest
}

/**
 * 收集同步状态快照（JSON 安全、可直接进工具结果）。
 * @param {import('./git.mjs').GitBackend} git - git 后端。
 * @param {object} deps - {branch, remote}。
 * @returns {Promise<{ok: boolean, branch: string, remote: string, head?: string, remoteHead?: string, ahead: number, behind: number, dirty: string[], forks: string[], diffStat: string, mergeInProgress: boolean, lastCommits: string[], error?: string}>}
 */
export async function collectStatus(git, deps) {
  const base = {
    ok: false,
    branch: deps.branch,
    remote: sanitizeRemote(deps.remote),
    head: undefined,
    remoteHead: undefined,
    ahead: 0,
    behind: 0,
    dirty: [],
    forks: [],
    diffStat: '',
    mergeInProgress: false,
    lastCommits: [],
    error: undefined,
  }
  try {
    const [head, remoteHead, dirtyLines, inProgress, lastCommits] = await Promise.all([
      git.headSha(),
      git.remoteHeadSha(),
      git.dirtyLines(),
      git.mergeInProgress(),
      git.recentCommits(5),
    ])
    base.head = head
    base.remoteHead = remoteHead
    base.dirty = dirtyLines.map(pathOfPorcelainLine)
    base.mergeInProgress = inProgress
    base.lastCommits = lastCommits
    if (head !== undefined && remoteHead !== undefined && head !== remoteHead) {
      const [ahead, behind, diffStat] = await Promise.all([
        git.countCommitsSafe(remoteHead, head),
        git.countCommitsSafe(head, remoteHead),
        git.diffStat(head, remoteHead),
      ])
      base.ahead = ahead
      base.behind = behind
      base.diffStat = diffStat
    }
    const ls = await git.lsFiles()
    base.forks = ls.filter(file => FORK_NAME_RE.test(file.split('/').at(-1) ?? '')).sort()
    base.ok = true
    return base
  } catch (error) {
    base.error = error instanceof Error ? error.message : String(error)
    return base
  }
}
