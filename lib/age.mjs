// lib/age.mjs — age 二进制探测与加解密（零 DSH 依赖）。
//
// age 是「探测 → 使用 → 优雅降级」的可选外部二进制：encrypted 后端在 resolve
// 期探测其是否存在，缺 age/缺 recipient/identity 时降级为明文 git 并显式警告，
// 绝不硬依赖 age。操作期（encrypted 模式下）加解密失败一律 fail closed
// （AGE_FAILED），绝不静默回退成明文传输。
//
// runner 契约（与 git 一致，但 args 为「含可执行路径的完整 argv」）：
//   run(args, { cwd, timeoutMs, signal, binary, maxBytes }) → { code, stdout, stderr }
//   args[0] 为 age 可执行路径，其余为 age 参数。

import { redactText } from './sanitize.mjs'
import { ageFailed } from './errors.mjs'

/**
 * 探测 age：`age --version` 退出 0 → 返回配置的二进制路径；否则（含 runner
 * 抛错）返回 null。纯探测，不抛错——调用方据此降级。
 * @param {(args: string[], opts?: object) => Promise<{code: number, stdout: string|Buffer, stderr: string}>} run - 子进程 runner。
 * @param {string} [ageBin] - age 可执行路径（默认 'age'）。
 * @param {{timeoutMs?: number, cwd?: string}} [opts] - 探测参数。
 * @returns {Promise<string|null>} 二进制路径或 null。
 */
export async function detectAge(run, ageBin = 'age', opts = {}) {
  if (typeof ageBin !== 'string' || ageBin.length === 0) return null
  try {
    const result = await run([ageBin, '--version'], { timeoutMs: opts.timeoutMs, cwd: opts.cwd })
    return result.code === 0 ? ageBin : null
  } catch {
    return null
  }
}

/**
 * 执行一条 age 命令并把失败包成 AGE_FAILED（stderr 尾部脱敏嵌入）。
 * @param {(args: string[], opts?: object) => Promise<{code: number, stdout: string|Buffer, stderr: string}>} run - 子进程 runner。
 * @param {string[]} args - 完整 argv（含可执行路径）。
 * @param {{cwd?: string, timeoutMs?: number}} [opts] - 命令参数。
 * @returns {Promise<{code: number, stdout: string|Buffer, stderr: string}>}
 */
async function runAge(run, args, opts = {}) {
  let result
  try {
    result = await run(args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs })
  } catch (error) {
    throw ageFailed(args[0] ?? 'age', redactText(error instanceof Error ? error.message : String(error)))
  }
  if (result.code !== 0) {
    const tail = redactText(String(result.stderr ?? '')).trim().split('\n').slice(-3).join(' | ') || `exit ${result.code}`
    throw ageFailed(args[0] ?? 'age', tail)
  }
  return result
}

/**
 * age 加密单个明文文件 → 密文文件：`age -r <recipient> -o <out> <in>`。
 * 文件入参（非 stdin）避免写管道的宿主限制；身份文件无需、不触网。
 * @param {(args: string[], opts?: object) => Promise<{code: number, stdout: string|Buffer, stderr: string}>} run - 子进程 runner。
 * @param {object} deps - {ageBin, recipient, inPath, outPath, timeoutMs?, cwd?}。
 * @returns {Promise<string>} 密文输出路径。
 */
export async function ageEncrypt(run, deps) {
  await runAge(run, [deps.ageBin, '-r', deps.recipient, '-o', deps.outPath, deps.inPath], deps)
  return deps.outPath
}

/**
 * age 解密密文文件 → 明文文件：`age -d -i <identity> -o <out> <in>`。
 * 身份文件必须是「无口令」的 age 私钥（有口令会走 TTY 提示；stdin 已 ignore，
 * 将立即失败——这是 fail-closed 的预期行为，用户需用无口令身份文件）。
 * @param {(args: string[], opts?: object) => Promise<{code: number, stdout: string|Buffer, stderr: string}>} run - 子进程 runner。
 * @param {object} deps - {ageBin, identity, inPath, outPath, timeoutMs?, cwd?}。
 * @returns {Promise<string>} 明文输出路径。
 */
export async function ageDecrypt(run, deps) {
  await runAge(run, [deps.ageBin, '-d', '-i', deps.identity, '-o', deps.outPath, deps.inPath], deps)
  return deps.outPath
}
