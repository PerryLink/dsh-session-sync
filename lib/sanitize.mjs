// lib/sanitize.mjs — 展示/日志脱敏纯函数（零依赖）。
//
// 规则：任何可能携带凭据的文本（remote URL、git 输出、错误消息）在进入
// 日志、命令结果或工具结果前都必须过这里的纯函数。函数绝不抛错、绝不
// 访问 I/O；输入不合法时返回保守的脱敏文本。

/** URL 中视为凭据的查询键（值一律整体打码）。 */
const CREDENTIAL_QUERY_KEYS = /^(?:access_?token|token|key|secret|password|passwd|auth|credential|code|signature|x-amz-|sig)$/iu

/**
 * 常见令牌形态（前缀 + 足够长的 secret）。
 * `gh[pousr]_` 覆盖 GitHub 的 ghp/gho/ghu/ghs/ghr 全家族；`github_pat_` 单列
 * （fine-grained PAT 是现在的默认形态，曾整体漏网）；其余为各家用得最广的
 * 前缀形态。
 */
const TOKEN_PATTERN = /\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|gldt-[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{30,}|pypi-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{12,}|AIza[0-9A-Za-z_-]{30,}|ya29\.[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}|dop_v1_[A-Fa-f0-9]{40,}|shpat_[A-Fa-f0-9]{32,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|authorization:\s*[A-Za-z0-9._~+/=-]{8,})/giu

/** key=value 形态的凭据（值整体打码）。 */
const CREDENTIAL_ASSIGNMENT = /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|password|passwd|client[_-]?secret|private[_-]?key)\s*=\s*)([^\s&;,]+)/giu

/** URL userinfo（user:password@）——git stderr 可能回显远端地址。 */
const URL_USERINFO = /\/\/([^/\s:@]+):([^/\s@]+)@/gu

/**
 * 无密码时，URL 里的用户名本身是否就是凭据。
 * `https://<token>@host/…` 是 PAT 最常见的免交互写法：此时用户名字段装的是
 * 密钥而不是身份，`user:pass@` 的「用户名不是秘密」前提在这里不成立。
 * 判定依据（任一命中即视为凭据）：
 * 1. 已知令牌形态——`redactText` 认得出（github_pat_/ghp_/glpat-… 等前缀）；
 * 2. 纯十六进制且够长（≥16 位，覆盖无前缀的随机 token）；
 * 3. 够长（≥20）且不含分隔符的多字符类串（大小写/数字至少两类）。
 * 约定俗成的登录名（git/oauth2/x-access-token/gitlab-ci-token）与普通短人名
 * 不满足任何一条，保持可见。
 * @param {string} username - URL 的用户名部分。
 * @returns {boolean} 是否按凭据处理。
 */
function usernameIsCredential(username) {
  if (username.length === 0) return false
  if (redactText(username) !== username) return true
  if (/^[A-Fa-f0-9]{16,}$/u.test(username)) return true
  if (username.length >= 20 && !/[-_.]/u.test(username)) {
    const classes = [/[a-z]/u, /[A-Z]/u, /[0-9]/u].filter(pattern => pattern.test(username)).length
    if (classes >= 2) return true
  }
  return false
}

/**
 * 脱敏 remote URL：用户信息中的密码打码，凭据查询键的值打码。
 * scp 语法（user@host:path）不含密码，原样保留（用户名不是秘密）。
 * 例外：带用户名、不带密码的 http(s) URL 走 usernameIsCredential——那种形状
 * 的用户名常常就是令牌本身，原样回显会把它送进 `/sync status`、`sync_status`
 * 的工具结果和会话日志（而本插件随后还会把会话日志同步出去）。
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
    } else if (url.username !== '') {
      if (usernameIsCredential(url.username)) url.username = '***'
    }
    for (const key of [...url.searchParams.keys()]) {
      if (CREDENTIAL_QUERY_KEYS.test(key)) url.searchParams.set(key, '***')
    }
    return url.toString()
  } catch {
    // 解析失败（scp 语法、畸形 URL）走通用脱敏。模块契约是「输入不合法时返回
    // 保守的脱敏文本」：原样回显会让畸形 URL 里的令牌直接落到日志与模型。
    return redactText(trimmed)
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
