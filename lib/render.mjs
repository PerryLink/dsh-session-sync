// lib/render.mjs — 结果文本渲染（纯函数，零依赖；输入全部 JSON 安全）。

import { MERGE_KINDS } from './constants.mjs'

/** 时间戳 → 本地可读时间（缺省 '-'）。 */
function timeOf(value) {
  if (typeof value !== 'number' || value <= 0) return '-'
  return new Date(value).toISOString()
}

/**
 * /sync 状态文本（sync_status 工具共用同一渲染）。
 * @param {object} status - collectStatus 产物。
 * @returns {string}
 */
export function renderStatus(status) {
  if (!status.ok) {
    return `sync: status unavailable: ${status.error ?? 'unknown error'}`
  }
  const lines = [
    `sync: repo branch ${status.branch} · remote ${status.remote}`,
    `      head ${status.head ?? '(no commits yet)'} · remote ${status.remoteHead ?? '(never fetched)'}`,
    `      ahead ${status.ahead} · behind ${status.behind}${status.mergeInProgress ? ' · merge in progress (resolve or re-pull)' : ''}`,
  ]
  if (status.dirty.length > 0) {
    lines.push(`      uncommitted (${status.dirty.length}): ${status.dirty.slice(0, 10).join(', ')}${status.dirty.length > 10 ? ' …' : ''}`)
  } else {
    lines.push('      mirror clean (nothing uncommitted)')
  }
  if (status.forks.length > 0) {
    lines.push(`      fork files (both-sides-kept conflicts): ${status.forks.slice(0, 10).join(', ')}${status.forks.length > 10 ? ' …' : ''}`)
  }
  if ((status.cwdMapped ?? 0) > 0 || (status.cwdUnmapped ?? 0) > 0) {
    lines.push(`      cwd projection: ${status.cwdMapped ?? 0} mapped to local path(s), ${status.cwdUnmapped ?? 0} unmapped (read-only under ${status.cwdPlaceholder ?? 'sessionRoot/--unmapped--'})`)
  }
  if ((status.followedSymlinks ?? 0) > 0) {
    lines.push(`      followed symbolic links inside sessionRoot: ${status.followedSymlinks}`)
  }
  if ((status.skippedSymlinks ?? 0) > 0) {
    const sample = (status.skippedSymlinkPaths ?? []).slice(0, 5).join(', ')
    lines.push(`      skipped symbolic links (not mirrored; followSessionSymlinks=${status.followSessionSymlinks === true}): ${status.skippedSymlinks}${sample.length > 0 ? ` — ${sample}${status.skippedSymlinks > 5 ? ' …' : ''}` : ''}`)
  }
  if (status.diffStat !== '') {
    lines.push(`      diff HEAD..remote:\n${status.diffStat.split('\n').map(line => `        ${line}`).join('\n')}`)
  }
  if (status.lastCommits.length > 0) {
    lines.push(`      last commits:\n${status.lastCommits.map(line => `        ${line}`).join('\n')}`)
  }
  if (status.error !== undefined) lines.push(`      last error: ${status.error}`)
  for (const warning of (status.warnings ?? [])) lines.push(`      warning: ${warning}`)
  return lines.join('\n')
}

/**
 * /sync diff 文本：本地未提交变更 + HEAD..远端统计（只读）。
 * @param {object} status - collectStatus 产物。
 * @returns {string}
 */
export function renderDiff(status) {
  if (!status.ok) return `sync: diff unavailable: ${status.error ?? 'unknown error'}`
  const lines = ['sync: diff (local worktree vs last-fetched remote; read-only)']
  if (status.dirty.length === 0) lines.push('  uncommitted changes: none')
  else {
    lines.push(`  uncommitted changes (${status.dirty.length}):`)
    for (const path of status.dirty.slice(0, 50)) lines.push(`    M ${path}`)
    if (status.dirty.length > 50) lines.push(`    … ${status.dirty.length - 50} more`)
  }
  if (status.diffStat === '') lines.push('  HEAD..remote: no difference (or remote never fetched)')
  else lines.push(`  HEAD..remote:\n${status.diffStat.split('\n').map(line => `    ${line}`).join('\n')}`)
  return lines.join('\n')
}

/**
 * pull 结果文本。
 * @param {{ok: boolean, pulled?: boolean, merged?: boolean, adopted?: number, appended?: number, diverged?: number, forks?: string[], head?: string, restored?: number, cwdMapped?: number, cwdUnmapped?: number, error?: string, warnings?: string[]}} result - pull 产物。
 * @returns {string}
 */
export function renderPull(result) {
  if (!result.ok) return `sync: pull failed: ${result.error ?? 'unknown error'}`
  const lines = ['sync: pull ok']
  if (!result.pulled) {
    lines.push('  already up to date (no remote changes or remote never fetched)')
    return lines.join('\n')
  }
  lines.push(`  remote changes merged${result.merged === true ? ' (merge commit)' : ''} → head ${result.head ?? ''}`)
  if ((result.adopted ?? 0) > 0) lines.push(`  adopted ${result.adopted} remote-only append(s) (local side was unchanged)`)
  if ((result.appended ?? 0) > 0) lines.push(`  both sides appended in ${result.appended} file(s): local version kept, remote version preserved as fork file(s)`)
  if ((result.diverged ?? 0) > 0) lines.push(`  diverged in ${result.diverged} file(s) (non-append rewrite): local version kept, remote version preserved as fork file(s) — inspect before continuing`)
  if ((result.cwdMapped ?? 0) > 0) lines.push(`  cwd projection: ${result.cwdMapped} restored session(s) mapped to a local path (header on disk is local; the mirror keeps the origin device's bytes)`)
  if ((result.cwdUnmapped ?? 0) > 0) lines.push(`  cwd projection: ${result.cwdUnmapped} restored session(s) have no cwdMap entry — shown read-only under the --unmapped-- placeholder`)
  for (const fork of (result.forks ?? []).slice(0, 20)) lines.push(`    fork ${fork}`)
  if ((result.forks ?? []).length > 20) lines.push(`    … ${result.forks.length - 20} more`)
  for (const warning of (result.warnings ?? [])) lines.push(`    warning: ${warning}`)
  return lines.join('\n')
}

/**
 * push 结果文本。
 * @param {{ok: boolean, pushed?: boolean, head?: string, mirrored?: number, deleted?: number, remote?: string, skippedSymlinks?: number, skippedSymlinkPaths?: string[], error?: string, warnings?: string[]}} result - push 产物。
 * @returns {string}
 */
export function renderPush(result) {
  if (!result.ok) return `sync: push failed: ${result.error ?? 'unknown error'}`
  if (!result.pushed) return 'sync: push ok — nothing new to push (mirror already committed and remote up to date)'
  const lines = [
    'sync: push ok',
    `  mirrored ${result.mirrored ?? 0} file(s)${(result.deleted ?? 0) > 0 ? `, deleted ${result.deleted} (removed locally)` : ''}`,
    `  pushed to ${result.remote ?? 'remote'} → head ${result.head ?? ''}`,
  ]
  if ((result.skippedSymlinks ?? 0) > 0) {
    lines.push(`  skipped ${result.skippedSymlinks} symbolic link(s) under sessionRoot (not mirrored; set followSessionSymlinks: true to include links inside the root)`)
  }
  for (const warning of (result.warnings ?? [])) lines.push(`  warning: ${warning}`)
  return lines.join('\n')
}

/**
 * 工具规范结果里的错误块（pull/push/status 共用）。
 * @param {string} message - 已脱敏的错误消息。
 * @returns {{ok: boolean, error: string}}
 */
export function errorValue(message) {
  return { ok: false, error: message }
}

export { MERGE_KINDS, timeOf }
