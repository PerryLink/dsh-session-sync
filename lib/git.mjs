// lib/git.mjs — git 命令层（零 DSH 依赖；runner 由 index.mjs 经 ctx.subprocess 注入）。
//
// 安全边界：
// - 动词白名单 + 参数断言（运行时强制执行，防未来改坏）；
// - 绝不发出 force push（`-f`/`--force`/`--force-with-lease`/`+refspec` 全拒绝）；
// - 绝不发出 reset/clean/rebase/checkout 分支切换——工作树只经 add/commit/
//   merge(--no-commit)/checkout(--ours|--theirs 显式路径) 变更；
// - 错误消息嵌入前统一脱敏（remote 凭据、token 形态一律 redactText）。
//
// runner 契约（index.mjs 构造）：
//   run(args, { cwd, signal, timeoutMs, binary, maxBytes }) → { code, stdout, stderr }
//   stdout：binary=false 时为 UTF-8 文本；binary=true 时为 Buffer（原始字节）。

import { redactText } from './sanitize.mjs'
import { gitFailed, pushRejected } from './errors.mjs'
import { LIMITS } from './constants.mjs'

/** 允许的顶层动词。 */
export const ALLOWED_VERBS = new Set([
  'init',
  'config',
  'remote',
  'add',
  'commit',
  'push',
  'fetch',
  'merge',
  'merge-base',
  'rev-parse',
  'log',
  'diff',
  'cat-file',
  'show',
  'checkout',
  'ls-files',
  'status',
])

/** 断言命令是白名单内的安全原语。 */
export function assertSafe(args) {
  const verb = args[0] ?? ''
  if (!ALLOWED_VERBS.has(verb)) {
    throw gitFailed('assert', `forbidden git verb ${JSON.stringify(verb)} (whitelist violation)`)
  }
  if (verb === 'push') {
    for (const arg of args.slice(1)) {
      if (arg === '-f' || arg === '--force' || arg === '--force-with-lease' || arg === '--mirror' || arg.startsWith('+')) {
        throw gitFailed('assert', `git push argument ${JSON.stringify(arg)} is forbidden (never force-push)`)
      }
    }
  }
  if (verb === 'checkout' && !(args.includes('--ours') || args.includes('--theirs'))) {
    throw gitFailed('assert', 'git checkout is only allowed with --ours/--theirs (no branch switching)')
  }
  if (verb === 'merge' && !(args.includes('--no-commit') || args.includes('--abort'))) {
    throw gitFailed('assert', 'git merge is only allowed with --no-commit or --abort')
  }
  if (verb === 'commit' && args.includes('--amend')) {
    throw gitFailed('assert', 'git commit --amend is forbidden (history is append-only)')
  }
}

/**
 * git 同步后端。所有命令串行经内部互斥链执行（每仓库一把）。
 */
export class GitBackend {
  /** @type {(args: string[], opts?: object) => Promise<{code: number, stdout: string|Buffer, stderr: string}>} */
  #run
  /** @type {string} 工作树根。 */
  #repoDir
  /** @type {string} 远端地址（未脱敏原文，只用于 git 命令；展示一律 sanitizeRemote）。 */
  #remote
  /** @type {string} 分支名。 */
  #branch
  /** @type {string} 提交者名。 */
  #commitName
  /** @type {string} 提交者邮箱。 */
  #commitEmail
  /** @type {Promise<unknown>} 每仓库串行链。 */
  #chain = Promise.resolve()
  /** @type {number} 单条命令超时。 */
  #timeoutMs

  /**
   * @param {object} deps - {repoDir, remote, branch, commitName, commitEmail, run, timeoutMs}。
   */
  constructor(deps) {
    this.#run = deps.run
    this.#repoDir = deps.repoDir
    this.#remote = deps.remote
    this.#branch = deps.branch
    this.#commitName = deps.commitName
    this.#commitEmail = deps.commitEmail
    this.#timeoutMs = deps.timeoutMs
  }

  /**
   * 串行执行：同一仓库的所有操作按序排队（镜像/推/拉互不穿插）。
   * @template T
   * @param {() => Promise<T>} fn - 排队的操作。
   * @returns {Promise<T>}
   */
  schedule(fn) {
    const run = this.#chain.then(fn, fn)
    this.#chain = run.then(() => undefined, () => undefined)
    return run
  }

  /**
   * 执行一条 git 命令（白名单断言 → runner → 失败包装）。
   * @param {string[]} args - git 参数（不含 gitBin）。
   * @param {object} [opts] - {binary?: boolean, signal?: AbortSignal}。
   * @returns {Promise<{code: number, stdout: string|Buffer, stderr: string}>}
   */
  async #git(args, opts = {}) {
    assertSafe(args)
    try {
      return await this.#run(args, {
        cwd: this.#repoDir,
        binary: opts.binary ?? false,
        timeoutMs: this.#timeoutMs,
        signal: opts.signal,
      })
    } catch (error) {
      throw gitFailed(args[0] ?? 'git', redactText(error instanceof Error ? error.message : String(error)))
    }
  }

  /** 必成功的 git 调用（code !== 0 → gitFailed，stderr 尾部脱敏嵌入）。 */
  async #must(args, opts = {}) {
    const result = await this.#git(args, opts)
    if (result.code !== 0) {
      const tail = redactText(String(result.stderr ?? '')).trim().split('\n').slice(-3).join(' | ') || `exit ${result.code}`
      throw gitFailed(args[0] ?? 'git', tail)
    }
    return result
  }

  /** 可选成功的 git 调用（非零退出返回 null；runner/白名单错误照常抛出）。 */
  async #maybe(args, opts = {}) {
    const result = await this.#git(args, opts)
    return result.code === 0 ? result : null
  }

  /** 该目录是否已是 git 仓库。 */
  async isRepo() {
    const out = await this.#maybe(['rev-parse', '--is-inside-work-tree'])
    return out !== null && String(out.stdout).trim() === 'true'
  }

  /**
   * 本地初始化（无 remote、无提交）：init（如缺）→ 禁用行尾转换 → 提交者身份。
   * 供 status 与 bootstrap 共用；repoDir 必须已由调用方（引擎）建好。
   * @returns {Promise<void>}
   */
  async ensureRepo() {
    if (!(await this.isRepo())) {
      await this.#must(['init', '-b', this.#branch])
    }
    // 字节镜像必须逐字节保真：core.autocrlf=false 关闭 checkout/checkin 的
    // CRLF/LF 转换（否则 Windows 检出会把 LF 会话字节改成 CRLF，破坏镜像）。
    await this.#must(['config', 'core.autocrlf', 'false'])
    await this.#must(['config', 'user.name', this.#commitName])
    await this.#must(['config', 'user.email', this.#commitEmail])
  }

  /**
   * 引导仓库：本地初始化 → origin remote（增/改）→ 初始提交。
   * 幂等：每次挂载/首次操作都走一遍，代价为几条本地命令。
   * @returns {Promise<void>}
   */
  async bootstrap() {
    await this.ensureRepo()
    const current = await this.#maybe(['remote', 'get-url', 'origin'])
    if (current === null) {
      await this.#must(['remote', 'add', 'origin', this.#remote])
    } else if (String(current.stdout).trim() !== this.#remote.trim()) {
      await this.#must(['remote', 'set-url', 'origin', this.#remote])
    }
    const head = await this.headSha()
    if (head === undefined) {
      await this.commitAll('dsh-session-sync: initial commit', { allowEmpty: true })
    }
  }

  /** 当前 HEAD sha；unborn 时为 undefined。 */
  async headSha() {
    const out = await this.#maybe(['rev-parse', '--verify', 'HEAD'])
    const sha = out === null ? '' : String(out.stdout).trim()
    return sha === '' ? undefined : sha
  }

  /** 远端跟踪引用（refs/remotes/origin/<branch>）sha；未拉取过为 undefined。 */
  async remoteHeadSha() {
    const out = await this.#maybe(['rev-parse', '--verify', `refs/remotes/origin/${this.#branch}`])
    const sha = out === null ? '' : String(out.stdout).trim()
    return sha === '' ? undefined : sha
  }

  /** 两提交的合并基点 sha；无公共祖先为 undefined。 */
  async mergeBaseOf(left, right) {
    const out = await this.#maybe(['merge-base', left, right])
    const sha = out === null ? '' : String(out.stdout).trim()
    return sha === '' ? undefined : sha
  }

  /** 提交数统计（log --oneline 行数；rev-list 不进白名单）。 */
  async countCommitsSafe(left, right) {
    if (left === right) return 0
    const out = await this.#maybe(['log', '--oneline', `${left}..${right}`])
    if (out === null) return 0
    const lines = String(out.stdout).trim()
    return lines === '' ? 0 : lines.split('\n').length
  }

  /**
   * 工作树全量提交（add -A → 有变更才 commit）。返回新 HEAD sha 或
   * 无变更时的 null。
   * @param {string} message - 提交信息（长度已截断）。
   * @param {object} [opts] - {allowEmpty?: boolean}。
   * @returns {Promise<string|null>}
   */
  async commitAll(message, opts = {}) {
    await this.#must(['add', '-A'])
    const status = await this.#must(['status', '--porcelain'])
    if (String(status.stdout).trim() === '' && !(opts.allowEmpty ?? false)) return null
    await this.#must(['commit', '-m', message.slice(0, LIMITS.MAX_COMMIT_MESSAGE_LENGTH), ...(opts.allowEmpty === true ? ['--allow-empty'] : [])])
    return this.headSha() ?? null
  }

  /**
   * push 到远端（显式 refspec HEAD:refs/heads/<branch>，与本地分支名解耦）。
   * 被拒（远端领先）→ PUSH_REJECTED；绝不重试强推。
   * @param {object} [opts] - {signal?: AbortSignal}。
   * @returns {Promise<void>}
   */
  async push(opts = {}) {
    const result = await this.#git(['push', 'origin', `HEAD:refs/heads/${this.#branch}`], { signal: opts.signal })
    if (result.code !== 0) {
      throw pushRejected(redactText(String(result.stderr ?? '')).trim().split('\n').slice(-3).join(' | ') || `exit ${result.code}`)
    }
  }

  /**
   * fetch 远端分支到远端跟踪引用（+ 只影响跟踪引用，绝不触碰工作树）。
   * 远端尚无该分支（首次 push 前）返回 false。
   * @param {object} [opts] - {signal?: AbortSignal}。
   * @returns {Promise<boolean>} 是否拿到远端分支。
   */
  async fetch(opts = {}) {
    const result = await this.#git(['fetch', 'origin', `+${this.#branch}:refs/remotes/origin/${this.#branch}`], { signal: opts.signal })
    if (result.code === 0) return true
    const stderr = String(result.stderr ?? '')
    if (/couldn't find remote ref/i.test(stderr)) return false
    throw gitFailed('fetch', redactText(stderr).trim().split('\n').slice(-3).join(' | ') || `exit ${result.code}`)
  }

  /**
   * 开始合并：git merge --no-commit --allow-unrelated-histories <remoteHead>。
   * 干净自动合并退出 0（变更已暂存，待 commit --no-edit 落合并提交）；
   * 冲突退出 1（工作树为 ours + 冲突标记，逐路径 resolve 后 add）。
   * 已是最新退出 0 且无 MERGE_HEAD。
   * --allow-unrelated-histories：首拉场景（本地空仓库 + 远端独立历史）必
   * 需；两历史已相关时该旗标是无害 no-op。
   * @param {string} remoteHead - 远端头 sha。
   * @returns {Promise<{conflicted: boolean, inProgress: boolean}>}
   */
  async beginMerge(remoteHead) {
    const result = await this.#git(['merge', '--no-commit', '--allow-unrelated-histories', remoteHead])
    if (result.code === 0) {
      const stderr = String(result.stderr ?? '')
      if (/already up to date/i.test(stderr)) return { conflicted: false, inProgress: false }
      return { conflicted: false, inProgress: true }
    }
    const inProgress = await this.mergeInProgress()
    return { conflicted: inProgress, inProgress }
  }

  /** 是否存在进行中的合并（MERGE_HEAD）。 */
  async mergeInProgress() {
    const out = await this.#maybe(['rev-parse', '--verify', 'MERGE_HEAD'])
    return out !== null && String(out.stdout).trim() !== ''
  }

  /** 放弃进行中的合并（失败路径恢复用）。 */
  async abortMerge() {
    if (!(await this.mergeInProgress())) return
    await this.#must(['merge', '--abort'])
  }

  /**
   * 冲突路径清单（ls-files -u 解析：stage 1=base、2=ours、3=theirs）。
   * @returns {Promise<Array<{path: string, base?: string, ours?: string, theirs?: string}>>}
   */
  async conflictedPaths() {
    const out = await this.#must(['ls-files', '-u'])
    const byPath = new Map()
    for (const line of String(out.stdout).split('\n')) {
      if (line.trim() === '') continue
      // 格式：<mode> <sha> <stage>\t<path>（未合并路径的 sha 为全零时也有 stage）。
      const [meta, ...rest] = line.split('\t')
      const rel = rest.join('\t')
      const stage = (meta ?? '').split(/\s+/)[2]
      let entry = byPath.get(rel)
      if (entry === undefined) {
        entry = { path: rel }
        byPath.set(rel, entry)
      }
      if (stage === '1') entry.base = (meta ?? '').split(/\s+/)[1]
      else if (stage === '2') entry.ours = (meta ?? '').split(/\s+/)[1]
      else if (stage === '3') entry.theirs = (meta ?? '').split(/\s+/)[1]
    }
    return [...byPath.values()]
  }

  /**
   * 读冲突索引阶段 blob 的原始字节（cat-file blob :<stage>:<path>）。
   * @param {string} stage - 1|2|3。
   * @param {string} rel - 仓库相对路径。
   * @returns {Promise<Buffer|undefined>} 内容；阶段缺失为 undefined。
   */
  async readStageBlob(stage, rel) {
    const out = await this.#maybe(['cat-file', 'blob', `:${stage}:${rel}`], { binary: true })
    if (out === null) return undefined
    return Buffer.isBuffer(out.stdout) ? out.stdout : Buffer.from(String(out.stdout))
  }

  /**
   * 从索引阶段检出单文件到工作树（仅 --ours/--theirs + 显式路径）。
   * @param {'ours'|'theirs'} which - 检出哪一侧。
   * @param {string} rel - 仓库相对路径。
   * @returns {Promise<void>}
   */
  async checkoutStage(which, rel) {
    await this.#must(['checkout', `--${which}`, '--', rel])
  }

  /** 暂存全部（冲突解决后、合并提交前）。 */
  async addAll() {
    await this.#must(['add', '-A'])
  }

  /** 落合并提交（MERGE_HEAD 在时生成真正的双亲合并提交）。 */
  async commitMerge() {
    if (!(await this.mergeInProgress())) return null
    await this.#must(['commit', '--no-edit'])
    return this.headSha() ?? null
  }

  /** 最近 N 条提交摘要（log --oneline -n）。 */
  async recentCommits(limit) {
    const out = await this.#maybe(['log', '--oneline', `-n${Math.max(1, Math.floor(limit))}`])
    if (out === null) return []
    return String(out.stdout).trim().split('\n').filter(line => line.length > 0)
  }

  /** 工作树脏状态（status --porcelain 原始行）。 */
  async dirtyLines() {
    // -uall: list every untracked FILE individually (porcelain otherwise
    // collapses a fully-untracked directory into one '?? dir/' entry).
    const out = await this.#must(['status', '--porcelain', '-uall'])
    return String(out.stdout).split('\n').filter(line => line.trim() !== '')
  }

  /** 已跟踪文件清单（ls-files）。 */
  async lsFiles() {
    const out = await this.#must(['ls-files'])
    return String(out.stdout).split('\n').filter(line => line.length > 0)
  }

  /** 两提交的路径差异统计（diff --stat）。 */
  async diffStat(left, right) {
    const out = await this.#maybe(['diff', '--stat', left, right])
    if (out === null) return ''
    return String(out.stdout).trim()
  }
}
