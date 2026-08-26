// lib/constants.mjs — 词汇表与协议常量（零依赖）。

// 插件标识、命令名与工具名。
export const PLUGIN_NAME = 'session-sync'
export const COMMAND_NAME = 'sync'
export const TOOL_PUSH = 'sync_push'
export const TOOL_PULL = 'sync_pull'
export const TOOL_STATUS = 'sync_status'

// ctx.storageDomain 领域名（同步元数据：设备 id、最近推/拉时间与错误）。
// 下划线命名：storage-domain 的域名正则不允许连字符。
export const DOMAIN_NAME = 'session_sync'

// git 工作树内镜像目录：sessionRoot 的相对镜像落在 <repoDir>/<MIRROR_DIR>/…。
export const MIRROR_DIR = 'sessions'

// 仓库根下的设备身份文件（随机 UUID，提交进仓库供跨设备归属 fork）。
export const DEVICE_FILE = 'device.txt'

// 存储领域 state 表的单例键。
export const STATE_KEY = 'singleton'

// 后端词汇：git 为明文传输，encrypted 为 age 加密的 git 传输（镜像内容
// 加密后再推，见 lib/backend.mjs 的 seam 契约与 lib/encrypted.mjs）。
export const BACKENDS = Object.freeze({
  GIT: 'git',
  ENCRYPTED: 'encrypted',
})

// 预留后端（接口占位，尚未实现）：配置即加载期响亮失败（backendUnsupported）。
// 与 git/encrypted 共享同一 seam（status/push/pull 三方法），只是传输介质不同。
export const RESERVED_BACKENDS = Object.freeze({
  OBJECT_STORAGE: 'object-storage',
})

// encrypted 后端在 git 工作树内放置密文镜像的目录名与单个密文文件后缀
// （每会话文件一个 .age 密文；明文镜像 sessions/ 只存在于本地、绝不提交）。
export const ENC_DIR = 'encrypted'
export const ENC_EXT = '.age'

// Config.confirmVia 的取值。
export const CONFIRM_CHANNELS = Object.freeze({
  AUTO: 'auto',
  USER_QUESTIONS: 'userQuestions',
  APPROVAL: 'approval',
})

// 冲突分类（lib/merge.mjs 三分支合并的产物，命令/工具渲染与事件共用）。
export const MERGE_KINDS = Object.freeze({
  IDENTICAL: 'identical',
  OURS_ONLY: 'ours-only',
  THEIRS_ONLY: 'theirs-only',
  APPEND_BOTH: 'append-both',
  DIVERGED: 'diverged',
})

// 会话事件类型（插件自有；运行时是否 append 取决于宿主是否收录该类型，
// 或宿主 append 是否支持 ignorable 信封，见 lib/gate.mjs 的自适应门）。
export const SESSION_EVENTS = Object.freeze({
  PUSH: 'sync/push',
  PULL: 'sync/pull',
  CONFLICT: 'sync/conflict',
})

// 领域错误码（稳定、可路由）。
export const ERROR_CODES = Object.freeze({
  BAD_CONFIG: 'BAD_CONFIG',
  BACKEND_UNSUPPORTED: 'BACKEND_UNSUPPORTED',
  REGISTRY_UNAVAILABLE: 'REGISTRY_UNAVAILABLE',
  GIT_FAILED: 'GIT_FAILED',
  PUSH_REJECTED: 'PUSH_REJECTED',
  SYNC_DENIED: 'SYNC_DENIED',
  PATH_UNSAFE: 'PATH_UNSAFE',
  AGE_FAILED: 'AGE_FAILED',
})

// fork 文件名模式：<basename>.remote-fork-<UTC 时间戳>-<设备短 id>；镜像与
// 清理永不删除、永不覆盖匹配该模式的文件（两边保留的持久载体）。
export const FORK_NAME_RE = /\.remote-fork-\d{14}-[0-9a-z]{8}(?:\.|$)/iu

// 默认值（Config schema 的默认与 DEFAULT_* 常量同源；cordis.yml 可整体覆盖）。
export const DEFAULTS = Object.freeze({
  ENABLED: true,
  BACKEND: BACKENDS.GIT,
  SESSION_ROOT: '',
  REPO_DIR: '',
  REMOTE: '',
  BRANCH: 'main',
  GIT_BIN: 'git',
  AGE_BIN: 'age',
  AGE_RECIPIENT: '',
  AGE_IDENTITY: '',
  AUTO_PULL_ON_START: false,
  AUTO_PUSH_ON_TURN_END: false,
  PULL_INTERVAL_MINUTES: 0,
  CONFIRM_VIA: CONFIRM_CHANNELS.AUTO,
  GRACE_MS: 10000,
  COMMAND_TIMEOUT_MS: 120000,
  MAX_OUTPUT_BYTES: 262144,
  COMMIT_NAME: 'dsh-session-sync',
  COMMIT_EMAIL: 'dsh-session-sync@localhost',
  REGISTER_COMMAND: true,
  REGISTER_TOOLS: true,
})

// 配置字段合法性边界（加载期校验，越界响亮失败）。
export const LIMITS = Object.freeze({
  MIN_GRACE_MS: 1000,
  MAX_GRACE_MS: 2_147_483_647, // SubprocessSpawnSpec.graceMs 上限（Node 定时器上限）。
  MIN_COMMAND_TIMEOUT_MS: 1000,
  MAX_COMMAND_TIMEOUT_MS: 3_600_000,
  MIN_MAX_OUTPUT_BYTES: 4096,
  MAX_MAX_OUTPUT_BYTES: 16 * 1024 * 1024,
  MIN_PULL_INTERVAL_MINUTES: 0,
  MAX_PULL_INTERVAL_MINUTES: 10080,
  MAX_COMMIT_MESSAGE_LENGTH: 200,
  MAX_DEVICE_ID_LENGTH: 128,
})

// git 白名单动词（运行时断言；见 lib/git.mjs 的 ALLOWED_VERBS）。
// 归入 lib/git.mjs 会形成 lib 内循环依赖提示，故这里只放展示用的说明常量。
export const GIT_ENV = Object.freeze({
  // 终端凭据提示会让 git 挂起等待输入；可选锁避免只读原语触发锁竞争。
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
})
