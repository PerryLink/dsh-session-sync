// lib/encrypted.mjs — age 加密的 git 传输后端（零 DSH 依赖）。
//
// 传输语义（在镜像层之上）：明文镜像只存在于本地工作树 <repoDir>/sessions/
// （.gitignore 忽略、绝不提交）；git 仓库只跟踪 <repoDir>/encrypted/**/*.age
// 密文（每会话文件一个 age 密文）。远端看到的只有密文 + git 元数据（提交信息、
// 文件名结构、.gitignore），绝无明文会话字节。
//
// - push：镜像 → sessions/ → 加密到 encrypted/ → 提交 → push（被拒时拉取调和
//   重推一次，绝不强推）。
// - pull：本地提交检查点 → fetch → 取 merge-base 与远端的密文树解密成明文 →
//   用 lib/merge.mjs 的三分支语义在明文上合并（append-only keep-both + fork）
//   → 重新加密 → 提交（与 git 后端一致，pull 不自动 push）。
// - 无 age / 缺 recipient / identity：resolve 期降级为明文 git（内部复用
//   SyncEngine），显式警告进入 status/push/pull 结果与日志；绝不静默降级。
// - 加密模式下 age 加解密失败 → AGE_FAILED fail closed，绝不回退明文传输。

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BACKENDS, ENC_DIR, ENC_EXT, FORK_NAME_RE, MERGE_KINDS, MIRROR_DIR } from './constants.mjs'
import { SyncEngine } from './engine.mjs'
import { mirrorSessionRoot } from './mirror.mjs'
import { classifyPath } from './merge.mjs'
import { detectAge, ageEncrypt, ageDecrypt } from './age.mjs'
import { selectEncryptionMode, BACKEND_MODES } from './backend.mjs'
import { collectStatus } from './status.mjs'
import { forkFileName } from './paths.mjs'
import { messageOf, SyncError } from './errors.mjs'
import { redactText, sanitizeRemote } from './sanitize.mjs'

/** 插件自有引用：记录最近一次已调和（push/pull 后本地与远端一致）的远端头，
 * 作为下一次三方合并的基点（encrypted 后端不做 git 合并提交，需自持基点）。 */
const BASE_REF = 'refs/dsh-sync/base'

/** 递归枚举 root 下全部常规文件（POSIX 相对路径；符号链接跳过）。 */
async function listRelFiles(root) {
  const files = []
  const walk = async (dir) => {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'))
    }
  }
  await walk(root)
  return files
}

/** 读整棵树为 Map<rel, Buffer>。 */
async function readTree(root) {
  const map = new Map()
  for (const rel of await listRelFiles(root)) {
    map.set(rel, await fs.readFile(path.join(root, ...rel.split('/'))))
  }
  return map
}

/** 把 Map<rel, Buffer> 写回 root（mkdir -p；删除 map 中不存在的既有文件）。 */
async function writeTree(root, map) {
  for (const rel of await listRelFiles(root)) {
    if (!map.has(rel)) await fs.unlink(path.join(root, ...rel.split('/')))
  }
  for (const [rel, content] of map) {
    const target = path.join(root, ...rel.split('/'))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
  }
}

/**
 * 加密整棵明文树 → 密文树（每文件一个 age 密文；删除明文已消失的密文）。
 * @param {string} plainRoot - 明文树根。
 * @param {string} encRoot - 密文树根。
 * @param {object} deps - {run, ageBin, recipient, timeoutMs}。
 * @returns {Promise<number>} 加密文件数。
 */
export async function encryptTree(plainRoot, encRoot, deps) {
  const plainFiles = await listRelFiles(plainRoot)
  const expected = new Set(plainFiles.map(rel => `${rel}${ENC_EXT}`))
  for (const rel of await listRelFiles(encRoot)) {
    if (!expected.has(rel)) await fs.unlink(path.join(encRoot, ...rel.split('/')))
  }
  for (const rel of plainFiles) {
    await fs.mkdir(encRoot, { recursive: true })
    const outPath = path.join(encRoot, ...`${rel}${ENC_EXT}`.split('/'))
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await ageEncrypt(deps.run, {
      ageBin: deps.ageBin,
      recipient: deps.recipient,
      inPath: path.join(plainRoot, ...rel.split('/')),
      outPath,
      timeoutMs: deps.timeoutMs,
    })
  }
  return plainFiles.length
}

/**
 * 解密整棵密文树 → 明文 Map<rel, Buffer>（只读 .age 文件，其余跳过）。
 * @param {string} encRoot - 密文树根。
 * @param {object} deps - {run, ageBin, identity, timeoutMs}。
 * @returns {Promise<Map<string, Buffer>>} 明文相对路径 → 内容。
 */
export async function decryptTree(encRoot, deps) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-dec-'))
  try {
    const map = new Map()
    let index = 0
    for (const rel of await listRelFiles(encRoot)) {
      if (!rel.endsWith(ENC_EXT)) continue
      const inPath = path.join(encRoot, ...rel.split('/'))
      const outPath = path.join(tmp, `out-${index}`)
      await ageDecrypt(deps.run, {
        ageBin: deps.ageBin,
        identity: deps.identity,
        inPath,
        outPath,
        timeoutMs: deps.timeoutMs,
      })
      map.set(rel.slice(0, -ENC_EXT.length), await fs.readFile(outPath))
      index += 1
    }
    return map
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
}

/**
 * 明文三方合并（复用 lib/merge.mjs 的 classifyPath 语义）：
 * 以 ours 为底，theirs-only 采纳远端；append-both/diverged 保留 ours + 把 theirs
 * 写为 fork 文件。返回合并后整树与计数。
 * @param {Map<string, Buffer>} base - 合并基点树。
 * @param {Map<string, Buffer>} ours - 本地树。
 * @param {Map<string, Buffer>} theirs - 远端树。
 * @param {string} stamp - fork 文件名 UTC 时间戳（yyyyMMddHHmmss）。
 * @param {string} deviceShort - 设备短 id（fork 归属）。
 * @returns {{merged: Map<string, Buffer>, forks: string[], adopted: number, appended: number, diverged: number}}
 */
export function mergeTrees(base, ours, theirs, stamp, deviceShort) {
  const merged = new Map(ours)
  const forks = []
  let adopted = 0
  let appended = 0
  let diverged = 0
  const keys = new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])
  for (const rel of keys) {
    const verdict = classifyPath(base.get(rel), ours.get(rel), theirs.get(rel))
    if (verdict.kind === MERGE_KINDS.THEIRS_ONLY) {
      merged.set(rel, theirs.get(rel))
      adopted += 1
    } else if (verdict.forkTheirs) {
      const forkRel = path.posix.join(path.posix.dirname(rel), forkFileName(path.posix.basename(rel), stamp, deviceShort))
      merged.set(forkRel, theirs.get(rel))
      forks.push(forkRel)
      if (verdict.kind === MERGE_KINDS.APPEND_BOTH) appended += 1
      else diverged += 1
    }
    // identical / ours-only：保留 ours（已在 merged 中）。
  }
  return { merged, forks, adopted, appended, diverged }
}

/**
 * age 加密的 git 传输后端：对会话镜像内容加密后再推、解密后再合并。
 * 与 SyncEngine 同 surface（status/push/pull + deviceId setter），可作为引擎
 * 直接交给命令/工具/自动模式；无 age 时内部降级为明文 SyncEngine。
 */
export class EncryptedBackend {
  /** @type {import('./git.mjs').GitBackend} */
  #git
  /** @type {SyncEngine} 明文降级引擎（无 age / 缺配置时复用）。 */
  #plain
  /** @type {(args: string[], opts?: object) => Promise<{code: number, stdout: string|Buffer, stderr: string}>} age runner。 */
  #run
  /** @type {string} */
  #ageBin
  /** @type {string} */
  #recipient
  /** @type {string} */
  #identity
  /** @type {number} */
  #timeoutMs
  /** @type {string} */
  #repoDir
  /** @type {string} */
  #sessionRoot
  /** @type {string} */
  #remote
  /** @type {string} */
  #branch
  /** @type {string} */
  #deviceId
  /** @type {(patch: object) => void} */
  #reportMeta
  /** @type {(message: string) => void} */
  #reportError
  /** @type {(forkRelPaths: string[]) => void} */
  #onForks
  /** @type {{debug: Function, info: Function, warn: Function, error: Function}} */
  #logger
  /** @type {string[]} */
  #warnings = []
  /** @type {Promise<{mode: string, warnings: string[]}>|undefined} 惰性探测结果。 */
  #ready

  /**
   * @param {object} deps - {git, sessionRoot, repoDir, remote, branch, deviceId, reportMeta, reportError, onForks, logger, run, ageBin, ageRecipient, ageIdentity, timeoutMs}。
   */
  constructor(deps) {
    this.#git = deps.git
    this.#run = deps.run
    this.#ageBin = deps.ageBin
    this.#recipient = deps.ageRecipient
    this.#identity = deps.ageIdentity
    this.#timeoutMs = deps.timeoutMs
    this.#repoDir = deps.repoDir
    this.#sessionRoot = deps.sessionRoot
    this.#remote = deps.remote
    this.#branch = deps.branch
    this.#deviceId = deps.deviceId ?? 'pending'
    this.#reportMeta = deps.reportMeta
    this.#reportError = deps.reportError
    this.#onForks = deps.onForks
    this.#logger = deps.logger
    this.#plain = new SyncEngine({
      git: deps.git,
      sessionRoot: deps.sessionRoot,
      repoDir: deps.repoDir,
      remote: deps.remote,
      branch: deps.branch,
      deviceId: deps.deviceId ?? 'pending',
      reportMeta: deps.reportMeta,
      reportError: deps.reportError,
      onForks: deps.onForks,
      logger: deps.logger,
    })
  }

  /** 设备 id（fork 归属；同步转发给明文降级引擎）。 */
  set deviceId(value) {
    this.#deviceId = value
    this.#plain.deviceId = value
  }

  /** 设备短 id（fork 文件名后缀，≤8 位小写十六进制）。 */
  get deviceShort() {
    return this.#deviceId.replaceAll('-', '').slice(0, 8).toLowerCase() || 'unknown'
  }

  /**
   * 惰性探测并解析传输模式（首次操作触发，结果缓存）。
   * @returns {Promise<{mode: string, warnings: string[]}>}
   */
  probeMode() {
    if (this.#ready === undefined) {
      this.#ready = (async () => {
        const ageBin = await detectAge(this.#run, this.#ageBin, { timeoutMs: this.#timeoutMs })
        const selection = selectEncryptionMode({
          backend: BACKENDS.ENCRYPTED,
          ageAvailable: ageBin !== null,
          ageRecipient: this.#recipient,
          ageIdentity: this.#identity,
        })
        this.#warnings = selection.warnings
        for (const warning of selection.warnings) {
          this.#logger.warn(`session-sync encrypted backend degraded: ${warning}`)
        }
        return selection
      })()
    }
    return this.#ready
  }

  /** 串行执行一次加密路径操作（同仓库互斥；明文降级由 SyncEngine 自行串行）。 */
  #schedule(fn) {
    return this.#git.schedule(fn)
  }

  /** 失败包装：脱敏 → reportError → 结构化错误结果（warnings 一并携带）。 */
  #fail(error) {
    const message = redactText(messageOf(error))
    this.#reportError(message)
    this.#logger.warn(`sync failed: ${message}`)
    return { ok: false, error: message, warnings: this.#warnings }
  }

  /** remote 未配置时响亮失败（状态类操作不拦）。 */
  #requireRemote() {
    if (this.#remote === undefined || this.#remote.trim() === '') {
      throw new Error('no sync remote configured — set config.remote (status/diff work without one)')
    }
  }

  /** 镜像 sessionRoot → 明文工作树 sessions/（encrypted 后端不写 device.txt）。 */
  async #mirrorOnly() {
    return mirrorSessionRoot({
      sessionRoot: this.#sessionRoot,
      repoDir: this.#repoDir,
      mirrorDir: MIRROR_DIR,
    })
  }

  /** 确保 .gitignore（忽略明文 sessions/）与仓库就绪。 */
  async #ensureEncryptedRepo() {
    const gitignore = path.join(this.#repoDir, '.gitignore')
    const content = Buffer.from(`${MIRROR_DIR}/\n`)
    try {
      const existing = await fs.readFile(gitignore)
      if (!existing.equals(content)) await fs.writeFile(gitignore, content)
    } catch {
      await fs.writeFile(gitignore, content)
    }
    await this.#git.bootstrap()
  }

  /** 加密明文 sessions/ → encrypted/（返回加密文件数）。 */
  async #encryptMirror() {
    const encRoot = path.join(this.#repoDir, ENC_DIR)
    await fs.mkdir(encRoot, { recursive: true })
    return encryptTree(path.join(this.#repoDir, MIRROR_DIR), encRoot, {
      run: this.#run,
      ageBin: this.#ageBin,
      recipient: this.#recipient,
      timeoutMs: this.#timeoutMs,
    })
  }

  /** 明文工作树里的 fork 文件清单（sessions/ 前缀，排序）。 */
  async #plainForkFiles() {
    const files = await listRelFiles(path.join(this.#repoDir, MIRROR_DIR))
    return files.filter(file => FORK_NAME_RE.test(file.split('/').at(-1) ?? '')).map(file => `${MIRROR_DIR}/${file}`).sort()
  }

  /**
   * 解密某提交的密文树为明文 Map<rel, Buffer>。
   * @param {string} rev - 提交 sha 或引用名。
   * @returns {Promise<Map<string, Buffer>>}
   */
  async #treeAtRev(rev) {
    const files = (await this.#git.listFilesAtRev(rev)).filter(rel => rel.startsWith(`${ENC_DIR}/`) && rel.endsWith(ENC_EXT))
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-tree-'))
    try {
      const map = new Map()
      let index = 0
      for (const rel of files) {
        const blob = await this.#git.readFileAtRev(rev, rel)
        if (blob === undefined) continue
        const inPath = path.join(tmp, `in-${index}${ENC_EXT}`)
        const outPath = path.join(tmp, `out-${index}`)
        await fs.writeFile(inPath, blob)
        await ageDecrypt(this.#run, {
          ageBin: this.#ageBin,
          identity: this.#identity,
          inPath,
          outPath,
          timeoutMs: this.#timeoutMs,
        })
        map.set(rel.slice(ENC_DIR.length + 1, -ENC_EXT.length), await fs.readFile(outPath))
        index += 1
      }
      return map
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  }

  /**
   * 状态：先本地初始化 + 镜像（不提交），再收集 git 状态；fork 清单改从明文
   * 树读取（密文树里的 fork 文件名带 .age 后缀，不是面向用户的形态）。
   * @returns {Promise<object>}
   */
  async status() {
    const selection = await this.probeMode()
    if (selection.mode === BACKEND_MODES.PLAINTEXT) {
      return { ...(await this.#plain.status()), warnings: this.#warnings }
    }
    return this.#schedule(async () => {
      try {
        await fs.mkdir(this.#repoDir, { recursive: true })
        await this.#ensureEncryptedRepo()
        await this.#mirrorOnly()
      } catch {
        // 初始化/镜像失败不阻断状态：collectStatus 返回带 error 的快照。
      }
      const snapshot = await collectStatus(this.#git, { branch: this.#branch, remote: this.#remote ?? '' })
      return { ...snapshot, forks: await this.#plainForkFiles(), warnings: this.#warnings }
    })
  }

  /**
   * 推送：镜像 → 加密 → 提交 → push；被拒时拉取调和后重推一次。
   * @param {object} [opts] - {signal?: AbortSignal}。
   * @returns {Promise<object>}
   */
  async push(opts = {}) {
    const selection = await this.probeMode()
    if (selection.mode === BACKEND_MODES.PLAINTEXT) {
      return { ...(await this.#plain.push(opts)), warnings: this.#warnings }
    }
    return this.#schedule(async () => {
      try {
        this.#requireRemote()
        await fs.mkdir(this.#repoDir, { recursive: true })
        await this.#ensureEncryptedRepo()
        const mirror = await this.#mirrorOnly()
        await this.#encryptMirror()
        await this.#git.commitAll('dsh-session-sync: push snapshot (encrypted)')
        try {
          await this.#git.push({ signal: opts.signal })
        } catch (error) {
          if (!(error instanceof SyncError && error.code === 'PUSH_REJECTED')) throw error
          this.#logger.info('push rejected (remote moved); pulling and reconciling before one retry')
          const pulled = await this.#pullInternal(opts)
          if (!pulled.ok) throw error
          await this.#git.push({ signal: opts.signal })
        }
        const head = await this.#git.headSha()
        await this.#git.setRef(BASE_REF, head)
        this.#reportMeta({ lastPushAt: Date.now(), lastPushHead: head })
        this.#logger.info(`sync push ok (encrypted): head ${head ?? ''} (${mirror.mirrored} mirrored, ${mirror.deleted} deleted)`)
        return {
          ok: true,
          pushed: true,
          head,
          mirrored: mirror.mirrored,
          deleted: mirror.deleted.length,
          remote: sanitizeRemote(this.#remote),
          warnings: this.#warnings,
        }
      } catch (error) {
        return this.#fail(error)
      }
    })
  }

  /**
   * 拉取：本地提交检查点 → fetch → 明文三方合并 → 重新加密 → 提交。
   * @param {object} [opts] - {signal?: AbortSignal}。
   * @returns {Promise<object>}
   */
  async pull(opts = {}) {
    const selection = await this.probeMode()
    if (selection.mode === BACKEND_MODES.PLAINTEXT) {
      return { ...(await this.#plain.pull(opts)), warnings: this.#warnings }
    }
    return this.#schedule(async () => {
      try {
        this.#requireRemote()
        await fs.mkdir(this.#repoDir, { recursive: true })
        await this.#ensureEncryptedRepo()
        await this.#mirrorOnly()
        await this.#encryptMirror()
        await this.#git.commitAll('dsh-session-sync: local checkpoint before pull (encrypted)')
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
    const fetched = await this.#git.fetch({ signal: opts.signal })
    if (!fetched) {
      this.#reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0, warnings: this.#warnings }
    }
    const head = await this.#git.headSha()
    const remoteHead = await this.#git.remoteHeadSha()
    if (remoteHead === undefined || head === remoteHead) {
      this.#reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0, warnings: this.#warnings }
    }
    if (await this.#git.countCommitsSafe(head, remoteHead) === 0) {
      this.#reportMeta({ lastPullAt: Date.now() })
      return { ok: true, pulled: false, forks: [], adopted: 0, appended: 0, diverged: 0, warnings: this.#warnings }
    }
    // 三方合并基点：最近一次已调和的远端头（自持引用）；首次同步无基点 → 空树
    // （与 git 的 unrelated histories 语义一致：全部为 theirs-only 采纳）。
    const baseHead = (await this.#git.refSha(BASE_REF)) ?? (await this.#git.mergeBaseOf(head, remoteHead))
    const ours = await readTree(path.join(this.#repoDir, MIRROR_DIR))
    const base = baseHead === undefined ? new Map() : await this.#treeAtRev(baseHead)
    const theirs = await this.#treeAtRev(remoteHead)
    const stamp = new Date().toISOString().replace(/[-:T]/gu, '').slice(0, 14)
    const { merged, forks: rawForks, adopted, appended, diverged } = mergeTrees(base, ours, theirs, stamp, this.deviceShort)
    // fork 路径统一加 sessions/ 前缀，与 git 后端的 ls-files 约定一致（handleForks
    // 与展示都依赖该前缀）。
    const forks = rawForks.map(rel => `${MIRROR_DIR}/${rel}`)
    await writeTree(path.join(this.#repoDir, MIRROR_DIR), merged)
    await this.#encryptMirror()
    const newHead = await this.#git.commitAll('dsh-session-sync: pull merge (encrypted)')
    await this.#git.setRef(BASE_REF, remoteHead)
    this.#reportMeta({ lastPullAt: Date.now() })
    this.#logger.info(`sync pull ok (encrypted): merged remote head ${remoteHead} → ${newHead ?? ''} (${appended} appended-both, ${diverged} diverged, ${forks.length} forks)`)
    if (forks.length > 0) this.#onForks(forks)
    return {
      ok: true,
      pulled: true,
      merged: true,
      adopted,
      appended,
      diverged,
      forks,
      head: newHead ?? undefined,
      warnings: this.#warnings,
    }
  }
}
