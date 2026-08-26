// types.d.ts — dsh-session-sync 类型契约（会话事件声明合并 + 配置类型）。

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    /**
     * 一次推送结果（log-only）。auto 模式（turn/end）与 /sync push、
     * sync_push 工具共用；ok=false 携带结构化错误。
     * 注意：当前宿主构建（KNOWN_SESSION_EVENT_TYPES）尚未收录 sync/*，
     * 运行时经自适应门跳过 append；宿主收录后自动开启（见 README「会话事件」）。
     */
    'sync/push': {
      sessionId: string
      ok: boolean
      error?: string
      pushed?: boolean
      mirrored?: number
      deleted?: number
      head?: string
    }
    /**
     * 一次拉取结果（log-only）。conflict 语义（append-only、keep-both +
     * fork）的关键字段：adopted（仅远端追加，本地未变）、appended（双边
     * 追加）、diverged（非追加分歧）；forks 为留存远端版本的 fork 文件。
     */
    'sync/pull': {
      sessionId: string
      ok: boolean
      error?: string
      pulled?: boolean
      merged?: boolean
      adopted?: number
      appended?: number
      diverged?: number
      forks?: string[]
      head?: string
    }
    /**
     * 冲突裁决（log-only）：fork 文件路径 + 可选会话级 fork 子会话 id。
     * 会话级 fork 仅在目标会话 live 且无开放轮次时发生（轮次中跳过，
     * 文件级两边保留恒成立）。
     */
    'sync/conflict': {
      sessionId: string
      forkPaths: string[]
      childSessionId?: string
      diverged?: number
    }
  }
}

export interface Config {
  /** 总开关；false 时命令、工具、监听器与自动模式全部卸载。 */
  enabled?: boolean
  /** 同步后端词汇；`git` 明文、`encrypted` age 加密的 git；对象存储为预留占位（配置即响亮失败）。 */
  backend?: 'git' | 'encrypted'
  /** 会话存储根；空 = $DSH_HOME/sessions（两者皆缺加载期响亮失败）。 */
  sessionRoot?: string
  /** 同步 git 工作树根；空 = $DSH_HOME/dsh-session-sync/repo。 */
  repoDir?: string
  /** 远端地址（自定义 remote）；pull/push 前必须非空，status/diff 不需要。 */
  remote?: string
  /** 远端分支名（默认 main）。 */
  branch?: string
  /** git 可执行路径（默认 'git'）。 */
  gitBin?: string
  /** age 可执行路径（默认 'age'；backend: encrypted 时探测，缺失降级明文）。 */
  ageBin?: string
  /** age 收件人（公钥/身份串；空 = 无法加密，降级明文）。 */
  ageRecipient?: string
  /** age 身份文件路径（无口令私钥；空 = 无法解密，降级明文）。 */
  ageIdentity?: string
  /** 挂载时自动拉取一次（配置即授权，不再确认）。 */
  autoPullOnStart?: boolean
  /** 每个 turn/end 后自动推送（配置即授权，不再确认）。 */
  autoPushOnTurnEnd?: boolean
  /** 周期自动拉取间隔分钟（0 = 关闭；上限 10080）。 */
  pullIntervalMinutes?: number
  /** 确认通道：auto（userQuestions 优先，其次 approval）· userQuestions · approval。 */
  confirmVia?: 'auto' | 'userQuestions' | 'approval'
  /** git 子进程终止宽限（ms；默认 10000）。 */
  graceMs?: number
  /** 单条 git 命令超时（ms；默认 120000）。 */
  commandTimeoutMs?: number
  /** git 输出单流收集上限（字节；默认 262144）。 */
  maxOutputBytes?: number
  /** 插件提交者名。 */
  commitName?: string
  /** 插件提交者邮箱。 */
  commitEmail?: string
  /** 注册 /sync 命令（默认 true）。 */
  registerCommand?: boolean
  /** tools 服务存在时注册 sync_* 工具（默认 true）。 */
  registerTools?: boolean
}

/** sync_status 工具规范结果。 */
export interface StatusValue {
  ok: boolean
  branch: string
  remote: string
  head?: string
  remoteHead?: string
  ahead: number
  behind: number
  dirty: string[]
  forks: string[]
  diffStat: string
  mergeInProgress: boolean
  lastCommits: string[]
  lastPullAt?: number
  lastPushAt?: number
  lastError?: string
  error?: string
  warnings?: string[]
}

/** sync_pull 工具规范结果。 */
export interface PullValue {
  ok: boolean
  pulled?: boolean
  merged?: boolean
  adopted?: number
  appended?: number
  diverged?: number
  forks?: string[]
  head?: string
  error?: string
  warnings?: string[]
}

/** sync_push 工具规范结果。 */
export interface PushValue {
  ok: boolean
  pushed?: boolean
  head?: string
  mirrored?: number
  deleted?: number
  remote?: string
  error?: string
  warnings?: string[]
}
