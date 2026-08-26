// lib/backend.mjs — 传输后端 seam（零依赖）。
//
// Backend 契约（三类传输后端共享同一 surface；本次落地 git 与 encrypted，
// 对象存储 object-storage 为接口占位，配置即 resolveConfig 响亮失败）：
//
//   kind     : 'git' | 'encrypted' | 'object-storage'   —— 语义后端
//   mode     : 'plaintext' | 'encrypted'                 —— 实际生效的传输模式
//   warnings : string[]                                  —— 降级/边界警告（进入
//                                                          status/push/pull 结果）
//   status() -> StatusValue
//   push(opts) -> PushValue
//   pull(opts) -> PullValue
//
// git（GitBackend + SyncEngine）为明文内置实现；encrypted（lib/encrypted.mjs）
// 为 age 包装的 git 传输（镜像内容加密后再推、解密后再合并）；object-storage
// 无实现——只有契约与常量占位。

import { BACKENDS } from './constants.mjs'

/** 传输模式词汇。 */
export const BACKEND_MODES = Object.freeze({
  PLAINTEXT: 'plaintext',
  ENCRYPTED: 'encrypted',
})

/**
 * 选择 encrypted 后端实际生效的传输模式（纯函数；探测结果经参数注入，便于测试）。
 *
 * 降级规则（任一不满足即回退明文 git 并给出显式警告，绝不静默降级）：
 * - backend !== 'encrypted' → 明文（无警告）；
 * - age 二进制不可用 → 明文 + 警告；
 * - ageRecipient 为空 → 明文 + 警告（无法加密）；
 * - ageIdentity 为空 → 明文 + 警告（无法解密）。
 *
 * @param {object} deps - {backend, ageAvailable, ageRecipient, ageIdentity}。
 * @param {string} deps.backend - BACKENDS 之一。
 * @param {boolean} deps.ageAvailable - detectAge 是否探测到 age 二进制。
 * @param {string} deps.ageRecipient - age 收件人（公钥/身份串）。
 * @param {string} deps.ageIdentity - age 身份文件路径（解密私钥）。
 * @returns {{mode: 'plaintext'|'encrypted', warnings: string[]}}
 */
export function selectEncryptionMode({ backend, ageAvailable, ageRecipient, ageIdentity }) {
  if (backend !== BACKENDS.ENCRYPTED) return { mode: BACKEND_MODES.PLAINTEXT, warnings: [] }
  const warnings = []
  if (ageAvailable !== true) {
    warnings.push('age binary not found (probed `age --version`); mirror content will be pushed unencrypted')
  } else {
    if (typeof ageRecipient !== 'string' || ageRecipient.trim() === '') {
      warnings.push('ageRecipient is empty; mirror content will be pushed unencrypted')
    }
    if (typeof ageIdentity !== 'string' || ageIdentity.trim() === '') {
      warnings.push('ageIdentity is empty; mirror content will be pushed unencrypted')
    }
  }
  const mode = warnings.length === 0 ? BACKEND_MODES.ENCRYPTED : BACKEND_MODES.PLAINTEXT
  return { mode, warnings }
}
