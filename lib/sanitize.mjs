// lib/sanitize.mjs — 展示/日志脱敏纯函数（零依赖）。
//
// 规则：任何可能携带凭据的文本（remote URL、git 输出、错误消息）在进入
// 日志、命令结果或工具结果前都必须过这里的纯函数。函数绝不抛错、绝不
// 访问 I/O；输入不合法时返回保守的脱敏文本。

/** URL 中视为凭据的查询键（值一律整体打码）。 */
const CREDENTIAL_QUERY_KEYS = /^(?:access_?token|token|key|secret|password|passwd|auth|credential|code|signature|x-amz-|sig)$/iu

/** 常见令牌形态（前缀 + 足够长的 secret）。 */
const TOKEN_PATTERN = /\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{16,}|gho_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|authorization:\s*[A-Za-z0-9._~+/=-]{8,})/giu

/** key=value 形态的凭据（值整体打码）。 */
const CREDENTIAL_ASSIGNMENT = /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|password|passwd|client[_-]?secret|private[_-]?key)\s*=\s*)([^\s&;,]+)/giu

/** URL userinfo（user:password@）——git stderr 可能回显远端地址。 */
const URL_USERINFO = /\/\/([^/\s:@]+):([^/\s@]+)@/gu

/**
 * 脱敏 remote URL：用户信息中的密码打码，凭据查询键的值打码。
 * scp 语法（user@host:path）不含密码，原样保留（用户名不是秘密）。
 * @param {string} remote - git remote 地址。
 * @returns {string} 脱敏后的地址。
 */
export function sanitizeRemote(remote) {
  if (typeof remote !== 'string' || remote.length === 0) return '<unset>'
  const trimmed = remote.trim()
  try {
    const url = new URL(trimmed)
    if (url.username !== '' && url.password !== '') {
      url.password = '***'
      return url.toString()
    }
    for (const key of [...url.searchParams.keys()]) {
      if (CREDENTIAL_QUERY_KEYS.test(key)) url.searchParams.set(key, '***')
    }
    return url.toString()
  } catch {
    return remote
  }
}

/**
 * 文本脱敏：令牌、Bearer/authorization 头与 key=value 凭据打码。
 * 非字符串输入先 String() 强转（绝不抛错——测试锁定此契约）。
 * @param {unknown} text - 任意输出文本（git stderr、错误消息等）。
 * @returns {string} 脱敏文本。
 */
export function redactText(text) {
  if (typeof text !== 'string') return String(text)
  return text
    .replace(TOKEN_PATTERN, '***')
    .replace(CREDENTIAL_ASSIGNMENT, '$1***')
    .replace(URL_USERINFO, '//***@')
}

/**
 * 展示路径：绝对路径落在 root 内时转为相对路径（仓库内视角），否则给出
 * 中性占位——绝不把根外的路径原样呈现给模型/用户（路径越界防御）。
 * @param {string} absolute - 绝对路径。
 * @param {string} root - 归属根目录（绝对、规范化后）。
 * @returns {string} 相对路径或 '<outside>'。
 */
export function displayPath(absolute, root) {
  if (typeof absolute !== 'string' || absolute.length === 0) return '<missing>'
  if (typeof root !== 'string' || root.length === 0) return '<outside>'
  const rel = relativeWithin(absolute, root)
  return rel === undefined ? '<outside>' : rel
}

/**
 * 计算 absolute 相对 root 的路径；不在 root 内时返回 undefined。
 * 纯路径运算（不访问文件系统），拒绝 `..` 越界。
 * @param {string} absolute - 绝对路径（可为相对形式，按原样计算）。
 * @param {string} root - 根目录。
 * @returns {string|undefined} 相对路径或 undefined。
 */
export function relativeWithin(absolute, root) {
  const normalized = normalizeSegments(absolute)
  const rootSegments = normalizeSegments(root)
  if (normalized.length < rootSegments.length) return undefined
  for (let index = 0; index < rootSegments.length; index += 1) {
    if (normalized[index] !== rootSegments[index]) return undefined
  }
  // 相对段按栈折叠 `.` 与 `..`：`..` 在空栈上即越出 root → undefined（绝不
  // 把能经 `..` 逃出 root 的路径呈现出来）。
  const stack = []
  for (const segment of normalized.slice(rootSegments.length)) {
    if (segment === '..') {
      if (stack.length === 0) return undefined
      stack.pop()
    } else {
      stack.push(segment)
    }
  }
  return stack.length === 0 ? '.' : stack.join('/')
}

/** 把路径切成规范段（跳过空段与 `.`，不做 I/O）。 */
function normalizeSegments(path) {
  return String(path)
    .replaceAll('\\', '/')
    .split('/')
    .filter(segment => segment.length > 0 && segment !== '.')
}
