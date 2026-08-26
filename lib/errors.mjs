// lib/errors.mjs — 结构化领域错误（code + details，零依赖）。

import { ERROR_CODES } from './constants.mjs'

/**
 * 插件领域错误基类：稳定 code 供 UI/日志路由，details 携带机器可读事实。
 */
export class SyncError extends Error {
  /**
   * @param {string} code - ERROR_CODES 之一。
   * @param {string} message - 面向用户的说明。
   * @param {object} [details] - 可选结构化事实。
   */
  constructor(code, message, details = undefined) {
    super(message)
    this.name = 'SyncError'
    this.code = code
    this.details = details
  }
}

/**
 * 配置非法（加载期响亮失败用）。
 * @param {string} message - 具体非法项说明。
 * @returns {SyncError} code=BAD_CONFIG。
 */
export function badConfig(message) {
  return new SyncError(ERROR_CODES.BAD_CONFIG, `dsh-session-sync config: ${message}`)
}

/**
 * 配置的 backend 尚未实现（对象存储等预留面）。
 * @param {unknown} backend - 配置值。
 * @returns {SyncError} code=BACKEND_UNSUPPORTED。
 */
export function backendUnsupported(backend) {
  return new SyncError(
    ERROR_CODES.BACKEND_UNSUPPORTED,
    `sync backend ${JSON.stringify(backend)} is not implemented (available: git, encrypted; reserved: object-storage; keys never enter the repo)`,
    { backend },
  )
}

/**
 * 同步元数据领域不可用（打开/读写失败）。
 * @param {string} reason - 失败原因。
 * @returns {SyncError} code=REGISTRY_UNAVAILABLE。
 */
export function registryUnavailable(reason) {
  return new SyncError(ERROR_CODES.REGISTRY_UNAVAILABLE, `session-sync metadata store unavailable: ${reason}`, { reason })
}

/**
 * git 命令失败。
 * @param {string} operation - 失败阶段（bootstrap|status|push|pull|merge…）。
 * @param {string} message - 失败说明（含 exit code/stderr 摘要）。
 * @param {object} [details] - 可选结构化事实。
 * @returns {SyncError} code=GIT_FAILED。
 */
export function gitFailed(operation, message, details = undefined) {
  return new SyncError(ERROR_CODES.GIT_FAILED, `git ${operation} failed: ${message}`, details)
}

/**
 * push 被远端拒绝（远端领先；调用方应拉取并重试，绝不强推）。
 * @param {string} message - 拒绝说明。
 * @returns {SyncError} code=PUSH_REJECTED。
 */
export function pushRejected(message) {
  return new SyncError(ERROR_CODES.PUSH_REJECTED, `git push rejected (never force-pushed): ${message}`)
}

/**
 * age 加解密失败（encrypted 后端操作期错误；resolve 期缺 age 走降级而非抛错）。
 * @param {string} operation - 失败阶段（encrypt|decrypt|detect）。
 * @param {string} message - 失败说明（含 exit code/stderr 摘要）。
 * @returns {SyncError} code=AGE_FAILED。
 */
export function ageFailed(operation, message) {
  return new SyncError(ERROR_CODES.AGE_FAILED, `age ${operation} failed: ${message}`, { operation })
}

/**
 * 确认门拒绝/无回答者（失败关闭）。
 * @param {string} reason - 拒绝或不可用原因。
 * @returns {SyncError} code=SYNC_DENIED。
 */
export function syncDenied(reason) {
  return new SyncError(ERROR_CODES.SYNC_DENIED, `sync cancelled: ${reason}`, { reason })
}

/**
 * 路径越界（拼接前校验失败：绝不把根外的路径写进工作树或报告）。
 * @param {string} reason - 越界说明。
 * @returns {SyncError} code=PATH_UNSAFE。
 */
export function pathUnsafe(reason) {
  return new SyncError(ERROR_CODES.PATH_UNSAFE, `unsafe sync path refused: ${reason}`, { reason })
}

/**
 * 任意值 → 稳定消息文本（日志/结果用，不信任其字符串转换）。
 * @param {unknown} error - 任意抛出的值。
 * @returns {string} 消息文本。
 */
export function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}
