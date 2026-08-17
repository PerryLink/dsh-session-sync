<div align="center">

# 🔄 dsh-session-sync

**DeepSeek Harness 的跨设备会话同步 —— 为你的会话存储建立专用 git 镜像。**

*在设备间同步会话，冲突时两边都保留，绝不丢失任何一轮。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-session-sync/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-session-sync/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-session-sync?label=version)](https://github.com/PerryLink/dsh-session-sync/releases)
[![npm version](https://img.shields.io/npm/v/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)
[![npm downloads](https://img.shields.io/npm/dm/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## 兼容性

| 项目 | 状态 |
|---|---|
| Harness | DeepSeek Harness `0.1.0-rc.6` |
| Node | `^22.19.0 \|\| >=24.0.0` |
| 平台 | 任何能运行 `git` 和 DSH 的环境（基于 git 镜像；无平台特定代码） |
| 模型 | 纯文本模型即可完整支持；无需视觉或额外模型能力 |

## 你能得到什么

`dsh-session-sync` 把你的 DSH 会话存储镜像到一个专用 git 工作树，并同步到**你自己**控制的远端 —— 无云服务、无第三方存储：

- **`/sync` 命令** —— `status`（分支、脱敏后的远端、领先/落后、未提交文件、fork 文件）、`diff`、`log`、`pull`、`push`、`help`。
- **`sync_status` / `sync_pull` / `sync_push` 工具** —— 在轮次内为模型提供同样的能力。
- **append-only 冲突裁决** —— 会话日志是 append-only；任何分歧都会**两边都保留**（本地版本保留、远端版本留存为 fork 文件），绝不静默覆盖。分歧的会话还可在会话层面 fork。
- **自动模式** —— 启动时拉取、每个关闭轮次后推送、周期拉取，全部可配置且可逆。
- **写操作走确认门** —— `pull`/`push` 会先询问（经 `userQuestions` 或 `approval`）；只读界面从不询问；没有回答者时操作失败关闭。

```text
设备 A                              远端（你的 git 仓库）                  设备 B
$DSH_HOME/sessions ──镜像──▶ 提交 ──推送──▶ [sessions] ──拉取──▶ 合并（两边保留 + fork）
```

## 快速开始

```sh
# 1. 把 bundle 安装进你的 profile
dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"

# 或从 npm（已发布版本）
dsh plugin --profile web add dsh-session-sync

# 2. 指向一个私有 git 远端并核对挂载行
dsh --profile web --dump-config | grep -A2 'id: session-sync'
```

然后在你的 profile patch 里设置远端（基线应是**私有**仓库）并同步：

```yaml
- insert:
    - id: session-sync
      name: dsh-session-sync
      config:
        remote: git@github.com:you/your-dsh-sessions.git
```

```
> /sync status
> /sync pull
> /sync push
```

## 安装与卸载

- **git 通道**（最新 `main`）：`dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"`（等价于从 `git+https://github.com/PerryLink/dsh-session-sync.git` 安装）。无构建步骤 —— `index.mjs` 与 `lib/` 即发布产物。
- **npm 通道**（已发布版本）：`dsh plugin --profile web add dsh-session-sync`。
- **tarball 通道**：在本仓库执行 `pnpm pack`，然后 `dsh plugin --profile web add ./dsh-session-sync-<version>.tgz`。
- **卸载**：`dsh plugin --profile web remove dsh-session-sync`（或从 profile patch 删除该行）。

## 配置

所有可调项都是 Schemastery `Config` 字段（可从 cordis.yml 覆盖）。按 id 的覆盖会替换整行 —— 重述你需要的每个键。`cordis.patch.yml` 对每个键都有行内注释。

| 键 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | 总开关；`false` 卸载命令、工具、监听器与自动模式 |
| `backend` | `git` | 同步后端；仅 `git` 已实现（加密后端为预留、配置即响亮失败） |
| `sessionRoot` | `''` | 会话存储根；空 = `$DSH_HOME/sessions`（两者皆缺加载失败） |
| `repoDir` | `''` | 同步工作树根；空 = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | 远端地址（pull/push 前必须非空；status/diff 无需） |
| `branch` | `main` | 远端分支名 |
| `gitBin` | `git` | git 可执行路径 |
| `autoPullOnStart` | `false` | 插件挂载时拉取一次（配置即授权，不再确认） |
| `autoPushOnTurnEnd` | `false` | 每个关闭轮次后推送 |
| `pullIntervalMinutes` | `0` | 每 N 分钟周期拉取（`0` = 关闭，最大 `10080`） |
| `confirmVia` | `auto` | 确认通道：`auto`（优先 userQuestions，其次 approval）、`userQuestions`、`approval` |
| `graceMs` | `10000` | git 终止宽限（毫秒） |
| `commandTimeoutMs` | `120000` | 单条命令超时（毫秒） |
| `maxOutputBytes` | `262144` | 单流收集输出上限（字节） |
| `commitName` | `dsh-session-sync` | 提交者名 |
| `commitEmail` | `dsh-session-sync@localhost` | 提交者邮箱 |
| `registerCommand` | `true` | 注册 `/sync` 命令 |
| `registerTools` | `true` | tools 服务存在时注册 `sync_*` 工具 |

在你的 profile patch 中的覆盖示例：

```yaml
- insert:
    - id: session-sync
      name: dsh-session-sync
      config:
        remote: git@github.com:you/your-dsh-sessions.git
        branch: main
        autoPushOnTurnEnd: true
        pullIntervalMinutes: 30
        confirmVia: userQuestions
```

## 工具与界面

| 界面 | 只读 | 需要确认 | 说明 |
|---|---|---|---|
| `/sync status` | ✅ | — | 分支、脱敏远端、领先/落后、未提交文件、fork 文件、最近推/拉 |
| `/sync diff` | ✅ | — | 未提交变更 + `HEAD..remote` 统计（只读） |
| `/sync log` | ✅ | — | 同步仓库最近提交 |
| `/sync pull` | | ✅ | fetch + 合并（两边保留语义；本地保留、远端留存为 fork） |
| `/sync push` | | ✅ | 镜像 + 提交 + 推送；绝不强推，被拒时拉取调和后重试一次 |
| `sync_status` | ✅ | — | 为模型提供 `/sync status` 同样的信息 |
| `sync_pull` | | ✅ | 模型可调用的拉取 |
| `sync_push` | | ✅ | 模型可调用的推送 |

## 权限与数据

- **权限**：写操作走确认门（`confirmVia`）；插件从不重新实现或绕过 harness 的 `userQuestions`/`approval` 服务。自动模式由配置授权覆盖，不再确认。
- **数据**：同步元数据（设备 id、最近推/拉、最近推送头、最近错误）存于 `session-sync` 存储领域。会话文件按不透明字节复制 —— 插件从不解析它们。设备 id 也写入同步仓库的 `device.txt`，用于跨设备 fork 归属。
- **会话日志**：`sync/push`、`sync/pull`、`sync/conflict` 在 `types.d.ts` 中声明；仅当宿主收录这些类型时才追加（见已知限制）。所有写入与展示的内容都经过脱敏。

## 安全边界

- **绝不静默覆盖。** append-only 三分支合并在任何分歧时都保留两边；fork 文件永不被删除，git 绝不强推、reset、rebase 或切换分支。
- **路径收容。** 文件按不透明字节镜像、拒绝符号链接，每次路径拼接都做收容校验（`PATH_UNSAFE` 响亮失败）。
- **脱敏输出。** 远端 URL 凭据、令牌与 `key=value` 密钥在进入模型或日志前被打码；路径展示拒绝根外路径。
- **不存凭据。** 插件自身不存凭据；git 凭据由你常规的 git credential helper 管理。预留的端到端加密后端尚未实现，密钥绝不进入同步仓库。
- **git 加固。** git 以 `GIT_TERMINAL_PROMPT=0`、`GIT_OPTIONAL_LOCKS=0` 运行，带截止时间与信号边界，输出按流封顶。
- **失败关闭。** 缺少确认回答者、缺少远端或不安全路径都会响亮拒绝操作。

## 已知限制

- **仅 git 后端。** 端到端加密后端（age/GPG 风格）为预留、尚未实现；配置它会响亮失败。在此之前，会话字节以未加密形式存放在**你的** git 远端 —— 请使用私有仓库。
- **依赖 git。** 插件需要 `git` 可执行文件与 `subprocess` 服务；没有它们时同步操作会给出明确原因失败（profile 仍可启动）。
- **`0.1.0-rc.6` 上的会话事件。** harness 尚未收录 `sync/*` 事件类型，因此 rc.6 上会话日志追加被跳过（会话仍可加载）；宿主收录类型或支持 `ignorable` 信封后插件会自动开启。
- **轮次间的 `approval`。** `/sync` 在轮次之间运行，`approval` 通道没有开放轮次可挂靠；请对命令式同步使用 `confirmVia: userQuestions`，或在轮次内经工具驱动同步。

## 开发

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs，针对已发布的 rc.6 peers
pnpm test                                          # node --test（6 个套件；git 套件在无 git 时跳过）
pnpm run verify:self-contained                     # 依赖 spec 可从 registry 解析
pnpm run verify:artifacts                          # 发布文件齐全 + index.mjs 可 import
pnpm run check:readmes                             # 五语 README 一致性
pnpm pack                                          # 发布 tarball
```

无构建步骤：纯 ESM，`index.mjs` 与 `lib/` 即发布产物。

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `session-sync`, `session`, `git`, `sync`, `cross-device`

## 贡献者

- [@PerryLink](https://github.com/PerryLink) —— 创建者与维护者：git 镜像引擎、append-only 两边保留合并、`/sync` 命令与 `sync_*` 工具、自动模式、脱敏器与五语文档。

## PerryLink DSH Plugin Family

本项目是由 [PerryLink](https://github.com/PerryLink) 维护的 [29 个 DeepSeek Harness 插件](https://github.com/PerryLink)之一。如果这个对你有用，其他插件很可能也会：

| Plugin | One-liner |
|---|---|
| [dsh-auto-review](https://github.com/PerryLink/dsh-auto-review) | 审批链上的第二模型自动审查，默认失败关闭 |
| [dsh-background-agents](https://github.com/PerryLink/dsh-background-agents) | 持久化后台子代理，带 Web UI 侧边栏、消息与打断 |
| [dsh-budget](https://github.com/PerryLink/dsh-budget) | DeepSeek Harness 的成本治理：预算、碳排与延迟一屏呈现。 |
| [dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind) | Claude Code /rewind 等价物：快照、会话分叉、一次性恢复 |
| [dsh-claude-move](https://github.com/PerryLink/dsh-claude-move) | 将 Claude Code 会话、记忆、技能与 CLAUDE.md 迁入 DSH |
| [dsh-click](https://github.com/PerryLink/dsh-click) | 跨平台原生桌面控制（DeepSeek Harness），Windows 优先。 |
| [dsh-composer-history](https://github.com/PerryLink/dsh-composer-history) | Web 输入框的终端式输入历史：方向键、Ctrl+R 搜索 |
| [dsh-defend](https://github.com/PerryLink/dsh-defend) | DeepSeek Harness 的提示注入、越狱与密钥泄露防护。 |
| [dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck) | 工程纪律门禁：需求质询、测试门禁、对抗式审查 |
| [dsh-draw](https://github.com/PerryLink/dsh-draw) | DeepSeek Harness 的统一静态图像生成路由。 |
| [dsh-fast](https://github.com/PerryLink/dsh-fast) | DeepSeek Harness 的只读性能诊断。 |
| [dsh-github](https://github.com/PerryLink/dsh-github) | DSH 的 GitHub PR/issue 集成，每次写入都经审批门 |
| [dsh-library](https://github.com/PerryLink/dsh-library) | DeepSeek Harness 的本地文档知识库。 |
| [dsh-local-ai](https://github.com/PerryLink/dsh-local-ai) | DeepSeek Harness 的本地模型（Ollama）接入。 |
| [dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions) | 经语言服务器的 LSP 诊断、格式化、补全、代码操作与重命名 |
| [dsh-mask](https://github.com/PerryLink/dsh-mask) | DeepSeek Harness 的 PII 脱敏中间件——数据到模型前匿名化，展示层还原。 |
| [dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel) | 只读 MCP 运行时面板：/mcp 命令 + 带状态、工具与错误的设置页 |
| [dsh-memento](https://github.com/PerryLink/dsh-memento) | 带审批门的跨会话记忆：ctx.memory 接缝 + SQLite + memory 工具 |
| [dsh-observe](https://github.com/PerryLink/dsh-observe) | DeepSeek Harness 的 OpenTelemetry 与 Langfuse 可观测导出器。 |
| [dsh-output-styles](https://github.com/PerryLink/dsh-output-styles) | Claude Code outputStyles 等价的运行时样式切换 |
| [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | Claude Code 风格声明式 allow/deny/ask 权限规则，带审计 |
| [dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide) | 按需 agent 技能形式的插件开发知识库 |
| [dsh-score](https://github.com/PerryLink/dsh-score) | DeepSeek Harness 插件的多指标质量评分。 |
| [dsh-session-pin](https://github.com/PerryLink/dsh-session-pin) | 在 Web 侧边栏置顶会话，顺序持久化 |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | DeepSeek Harness 的跨设备会话同步——会话存储的专用 git 镜像。 |
| [dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security) | 安全审计技能包：密钥扫描、依赖与供应链审查 |
| [dsh-talk](https://github.com/PerryLink/dsh-talk) | DeepSeek Harness 的语音优先会话闭环：对它说，听它答。 |
| [dsh-test-drive](https://github.com/PerryLink/dsh-test-drive) | DeepSeek Harness 插件的隔离式安装冒烟实测。 |
| [dsh-translate](https://github.com/PerryLink/dsh-translate) | DeepSeek Harness 的厂商参数翻译与确定性 JSON 修复。 |

## 许可证

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
