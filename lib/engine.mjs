// lib/engine.mjs — 同步编排（业务层；DSH 服务经回调注入，本模块零 DSH 依赖）。
//
// 操作语义：
// - push：镜像 → 提交 → push；被拒（远端领先）→ fetch + 拉取调和 → 重推一次；
//   绝不强推。
// - pull：先镜像 + 提交本地（保证合并基点是已提交状态）→ fetch → 三分支合并
//   （lib/merge.mjs 的 append-only 语义）→ 合并提交。冲突双方字节永不丢弃：
//   本地保留原路径，远端留存为 fork 文件。
// - 全部操作经 git.schedule 串行（同一仓库互不穿插）。

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { MERGE_KINDS, MIRROR_DIR, DEVICE_FILE } from './constants.mjs'
import { planMerge } from './merge.mjs'
import { mirrorSessionRoot, ensureDeviceFile } from './mirror.mjs'
import { collectStatus } from './status.mjs'
import { forkFileName } from './paths.mjs'
import { messageOf, SyncError } from './errors.mjs'
import { redactText, sanitizeRemote } from './sanitize.mjs'

/**
 * 同步引擎。
 * @typedef {object} EngineDeps
 * @property {import('./git.mjs').GitBackend} git - git 后端。
 * @property {string} sessionRoot - 会话存储根（绝对）。
 * @property {string} repoDir - 同步仓库根（绝对）。
 * @property {string} remote - 远端地址原文（展示时 sanitize）。
 * @property {string} branch - 分支名。
 * @property {string} deviceId - 设备 id（fork 归属）。
 * @property {(patch: object) => void} reportMeta - 元数据补丁回调（index.mjs 写领域）。
 * @property {(message: string) => void} reportError - 最近错误回调（写领域 lastError）。
 * @property {(forkRelPaths: string[]) => void} onForks - fork 文件产生回调（index.mjs 做会话级 fork + 事件）。
 * @property {{debug: Function, info: Function, warn: Function, error: Function}} logger - 日志。
 */
export class SyncEngine {
  /** @type {EngineDeps} */
  #deps

  /** @param {EngineDeps} deps - 依赖。 */
  constructor(deps) {
    this.#deps = deps
  }

  /** 设备 id（fork 文件名后缀；领域就绪后由 index.mjs 补齐）。 */
  set deviceId(value) {
    this.#deps.deviceId = value
  }

  /** 设备短 id（fork 文件名后缀，≤8 位小写十六进制）。 */
  get deviceShort() {
    return this.#deps.deviceId.replaceAll('-', '').slice(0, 8).toLowerCase() || 'unknown'
  }

  /** 串行执行一次同步操作（同仓库互斥）。 */
  #schedule(fn) {
    return this.#deps.git.schedule(fn)
  }

  /** 失败包装：脱敏 → reportError → 结构化错误结果。 */
  #fail(error) {
    const message = redactText(messageOf(error))
    this.#deps.reportError(message)
    this.#deps.logger.warn(`sync failed: ${message}`)
    return { ok: false, error: message }
  }

  /** remote 未配置时响亮失败（状态类操作不拦）。 */
  #requireRemote() {
    if (this.#deps.remote === undefined || this.#deps.remote.trim() === '') {
      throw new Error('no sync remote configured — set config.remote (status/diff work without one)')
    }
  }

  /**
   * 镜像 + 提交（push/pull 共用前置）。
   * @returns {Promise<{deviceWritten: boolean, mirror: {mirrored: number, unchanged: number, deleted: string[], forkedPreserved: string[], skippedLinks: string[]}}>}
   */
  // 镜像（不提交）：把 sessionRoot 的字节镜像进工作树 + 确保设备文件。
  // 只写本地工作树，不触网、不确认、不提交。调用方已持有 schedule 锁，
  // 这里绝不能再走 #schedule。
  async #mirrorOnly() {
    const deviceWritten = await ensureDeviceFile(this.#deps.repoDir, DEVICE_FILE, this.#deps.deviceId)
    const mirror = await mirrorSessionRoot({
      sessionRoot: this.#deps.sessionRoot,
      repoDir: this.#deps.repoDir,
      mirrorDir: MIRROR_DIR,
    })
    return { deviceWritten, mirror }
  }

  // 前置镜像 + 提交。调用方（push/pull）已持有 schedule 锁，这里绝不能再走
  // #schedule —— 嵌套 schedule 会在同一 git 链上自锁（fnM 等 fnP 完成、fnP 等 fnM）。
  async #mirrorAndCommit(message) {
    const { deviceWritten, mirror } = await this.#mirrorOnly()
    if (deviceWritten || mirror.mirrored > 0 || mirror.deleted.length > 0) {
      const committed = await this.#deps.git.commitAll(message)
      return { ...mirror, committed }
    }
    return { ...mirror, committed: null }
  }

  /**
   * 状态：先本地初始化 + 镜像（不提交），使未同步的会话变更以"未提交文件"
   * 形式进入 dirty；只写本地工作树，不触网、不确认。
   * @returns {Promise<{ok: boolean, branch?: string, remote?: string, head?: string, remoteHead?: string, ahead: number, behind: number, dirty: string[], forks: string[], diffStat: string, mergeInProgress: boolean, lastCommits: string[], error?: string}>}
   */
  status() {
    return this.#schedule(async () => {
      try {
        await fs.mkdir(this.#deps.repoDir, { recursive: true })
        await this.#deps.git.ensureRepo()
        await this.#mirrorOnly()
      } catch {
        // 初始化/镜像失败不阻断状态：collectStatus 会返回带 error 的快照。
      }
      return collectStatus(this.#deps.git, { branch: this.#deps.branch, remote: this.#deps.remote ?? '' })
    })
  }

  /**
   * 推送：镜像 → 提交 → push；被拒时拉取调和后重推一次。
   * @param {object} [opts] - {signal?: AbortSignal}。
   * @returns {Promise<{ok: boolean, pushed?: boolean, head?: string, mirrored?: number, deleted?: number, remote?: string, error?: string}>}
   */
  push(opts = {}) {
    return this.#schedule(async () => {
      try {
        this.#requireRemote()
        // git 命令以 repoDir 为 cwd，首次操作前必须保证它存在（cwd 缺失时
        // spawn 静默失败，甚至伪装成 exit 0）。
        await fs.mkdir(this.#deps.repoDir, { recursive: true })
        await this.#deps.git.bootstrap()
        const mirror = await this.#mirrorAndCommit('dsh-session-sync: push snapshot')
        try {
          await this.#deps.git.push({ signal: opts.signal })
        } catch (error) {
          if (!(error instanceof SyncError && error.code === 'PUSH_REJECTED')) {
            throw error
          }
          // 远端领先：先拉取调和（保留双方），再重推一次。
          this.#deps.logger.info('push rejected (remote moved); pulling and reconciling before one retry')
          const pulled = await this.#pullInternal(opts)
          if (!pulled.ok) throw error
          await this.#deps.git.push({ signal: opts.signal })
        }
        const head = await this.#deps.git.headSha()
        this.#deps.reportMeta({ lastPushAt: Date.now(), lastPushHead: head })
        this.#deps.logger.info(`sync push ok: head ${head ?? ''} (${mirror.mirrored} mirrored, ${mirror.deleted} deleted)`)
        return {
          ok: true,
          pushed: true,
          head,
          mirrored: mirror.mirrored,
          deleted: mirror.deleted.length,
          remote: sanitizeRemote(this.#deps.remote),
        }
      } catch (error) {
        return this.#fail(error)
      }
    })
  }

  /**
   * 拉取：本地提交 → fetch → 三分支合并（append-only 语义）。
   * @param {object} [opts] - {signal?: AbortSignal}。
   * @returns {Promise<{ok: boolean, pulled?: boolean, merged?: boolean, adopted?: number, appended?: number, diverged?: number, forks?: string[], head?: string, error?: string}>}
   */
  pull(opts = {}) {
    return this.#schedule(async () => {
      try {
        this.#requireRemote()
        await fs.mkdir(this.#deps.repoDir, { recursive: true })
        await this.#deps.git.bootstrap()
        await this.#mirrorAndCommit('dsh-session-sync: local checkpoint before pull')
        return await this.#pullInternal(opts)
      } catch (error) {
        return this.#fail(error)
      }
    })
  }

  /**
   * 拉取内部步骤（push 重试路径复用；前置已保证仓库存在且本地已提交）。
   * @param {object} [opts] - {signal?: AbortSignal}。
   * @returns {Promise<object>}
   */
  async #pullInternal(opts = {}) {
    const fetched = await this.#deps.git.fetch({ signal: opts.signal })
    if (!fetched) {
      this.#deps.reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0 }
    }
    const [head, remoteHead] = [await this.#deps.git.headSha(), await this.#deps.git.remoteHeadSha()]
    if (remoteHead === undefined) {
      this.#deps.reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0 }
    }
    if (head === remoteHead) {
      this.#deps.reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0 }
    }
    const behind = await this.#deps.git.countCommitsSafe(head, remoteHead)
    if (behind === 0) {
      // 本地领先（远端无新提交）：无拉取内容。
      this.#deps.reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0 }
    }
    const merged = await this.#deps.git.beginMerge(remoteHead)
    if (!merged.inProgress) {
      this.#deps.reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0 }
    }
    let result
    if (merged.conflicted) {
      result = await this.#resolveConflicts()
    } else {
      result = { adopted: 0, appended: 0, diverged: 0, forks: [] }
      await this.#deps.git.addAll()
    }
    const newHead = await this.#deps.git.commitMerge()
    this.#deps.reportMeta({ lastPullAt: Date.now() })
    this.#deps.logger.info(`sync pull ok: merged remote head ${remoteHead} → ${newHead ?? ''} (${result.appended} appended-both, ${result.diverged} diverged, ${result.forks.length} forks)`)
    if (result.forks.length > 0) this.#deps.onForks(result.forks)
    return {
      ok: true,
      pulled: true,
      merged: true,
      adopted: result.adopted,
      appended: result.appended,
      diverged: result.diverged,
      forks: result.forks,
      head: newHead ?? undefined,
    }
  }

  /**
   * 冲突解决：逐路径分类 → ours/theirs 检出 → 远端侧留存为 fork 文件 →
   * 全量暂存（提交由调用方落合并提交）。失败时 abortMerge 恢复。
   * @returns {Promise<{adopted: number, appended: number, diverged: number, forks: string[]}>}
   */
  async #resolveConflicts() {
    try {
      const conflicts = await this.#deps.git.conflictedPaths()
      const entries = []
      for (const conflict of conflicts) {
        const [base, ours, theirs] = await Promise.all([
          this.#deps.git.readStageBlob('1', conflict.path),
          this.#deps.git.readStageBlob('2', conflict.path),
          this.#deps.git.readStageBlob('3', conflict.path),
        ])
        entries.push({ path: conflict.path, base, ours, theirs })
      }
      const { resolutions, summary } = planMerge(entries)
      const forks = []
      const now = new Date()
      const stamp = now.toISOString().replaceAll('-', '').replaceAll(':', '').slice(0, 14)
      for (const resolution of resolutions) {
        if (resolution.adoptTheirs) {
          await this.#deps.git.checkoutStage('theirs', resolution.path)
          continue
        }
        if (resolution.forkTheirs) {
          // 先取 theirs 工作树字节 → 写 fork 文件 → 再检出 ours 回原路径。
          await this.#deps.git.checkoutStage('theirs', resolution.path)
          const absolute = path.join(this.#deps.repoDir, ...resolution.path.split('/'))
          const content = await fs.readFile(absolute)
          const forkName = forkFileName(path.posix.basename(resolution.path), stamp, this.deviceShort)
          await fs.writeFile(path.join(path.dirname(absolute), forkName), content)
          await this.#deps.git.checkoutStage('ours', resolution.path)
          const forkRel = path.posix.join(path.posix.dirname(resolution.path), forkName)
          forks.push(forkRel)
          continue
        }
        await this.#deps.git.checkoutStage('ours', resolution.path)
      }
      await this.#deps.git.addAll()
      return { adopted: summary.adopted, appended: summary.appended, diverged: summary.diverged, forks }
    } catch (error) {
      try {
        await this.#deps.git.abortMerge()
      } catch {
        // 恢复失败以原始错误为主，恢复失败只记录。
      }
      throw error
    }
  }
}

export { MERGE_KINDS }
