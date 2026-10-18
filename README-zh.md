<div align="center">

# 🔄 dsh-session-sync
- **1024 商店渠道**：先 `npm i -g dsh1024`，再 `dsh1024 plugin --profile web add dsh-session-sync`（计入 [deepseek1024.com](https://deepseek1024.com) 安装排行）。

**DeepSeek Harness 的跨设备会话同步 —— 为你的会话存储建立专用 git 镜像。**

*在设备间同步会话，冲突时两边都保留，绝不丢失任何一轮。*

> **官方仓库。** 本仓库是 dsh-session-sync 的唯一官方仓库，由 PerryLink 维护。其他账号下的同名仓库与本项目无关。

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-session-sync)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-session-sync.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-top-rated.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-session-sync/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-session-sync/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-session-sync?label=version)](https://github.com/PerryLink/dsh-session-sync/releases)
[![npm version](https://img.shields.io/npm/v/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)
[![npm downloads](https://img.shields.io/npm/dm/dsh-session-sync)](https://www.npmjs.com/package/dsh-session-sync)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-session-sync?metric=downloads&lang=zh)](https://dshfind.com/zh/plugins/PerryLink/dsh-session-sync?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <name> add dsh-session-sync
```


</div>

---


**📖 生态实测知识库**（实测数据，不是营销）：[插件开发指南 · 选型实测数据 · 维护取舍判据](https://perrylink.github.io/dsh-plugin-guide/)。

<!-- star-cta -->
## ⭐ 如果它帮到了你

这个插件是 [DSH 插件家族](https://github.com/PerryLink)的一员（40+ 个，全部 Apache-2.0）。如果你在用，**给个 star** —— 它不会解锁任何功能，但会让下一个人在搜索里更容易找到它。

*English:* part of a 40+ plugin family for DeepSeek Harness. If it is useful, **a star helps the next person find it** — nothing is gated behind it.

## What is dsh-session-sync?

DeepSeek Harness 的跨设备会话同步 —— 为你的会话存储建立专用 git 镜像。

在设备间同步会话，冲突时两边都保留，绝不丢失任何一轮。

![dsh-session-sync 终端演示：dsh-session-sync — mirror the session store, then /sync](https://raw.githubusercontent.com/PerryLink/dsh-session-sync/main/docs/assets/dsh-session-sync-hero.png)

![Animated terminal demo of dsh-session-sync](https://raw.githubusercontent.com/PerryLink/dsh-session-sync/main/docs/assets/dsh-session-sync-demo.gif)

*同一次运行，动图版。*

## 兼容性

| 项目 | 状态 |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.2.1-alpha.1`（GitHub tag，2026-09-24 已核验：完整门控链，针对钉住的 `0.1.7-rc.2` peers）。npm 依赖线 `0.1.7-rc.2`，peers `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0 || >=0.1.6-0 <0.2.0 || >=0.1.7-0 <0.2.0`。（2026-09-24 已适配）：冲突 fork 通知携带插件自有的 producer-owned 消息 source kind——宿主已退役共享的 `plugin` kind，读回时一律拒收。 |
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
dsh plugin --profile web add github:PerryLink/dsh-session-sync
```

```sh
# 1. 把 bundle 安装进你的 profile
dsh plugin --profile web add github:PerryLink/dsh-session-sync

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

- **git 通道**（最新 `main`）：`dsh plugin --profile web add github:PerryLink/dsh-session-sync`（等价于从 `git+https://github.com/PerryLink/dsh-session-sync.git` 安装）。无构建步骤 —— `index.mjs` 与 `lib/` 即发布产物。
- **npm 通道**（已发布版本）：`dsh plugin --profile web add dsh-session-sync`。
- **tarball 通道**：在本仓库执行 `pnpm pack`，然后 `dsh plugin --profile web add ./dsh-session-sync-<version>.tgz`。
- **卸载**：`dsh plugin --profile web remove dsh-session-sync`（或从 profile patch 删除该行）。

## 配置

所有可调项都是 Schemastery `Config` 字段（可从 cordis.yml 覆盖）。按 id 的覆盖会替换整行 —— 重述你需要的每个键。`cordis.patch.yml` 对每个键都有行内注释。

| 键 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | 总开关；`false` 卸载命令、工具、监听器与自动模式 |
| `backend` | `git` | 同步后端：`git`（明文镜像）或 `encrypted`（age 加密镜像内容） |
| `sessionRoot` | `''` | 会话存储根；空 = `$DSH_HOME/sessions`（两者皆缺加载失败） |
| `repoDir` | `''` | 同步工作树根；空 = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | 远端地址（pull/push 前必须非空；status/diff 无需） |
| `branch` | `main` | 远端分支名 |
| `gitBin` | `git` | git 可执行路径 |
| `ageBin` | `age` | age 可执行路径（`backend: encrypted` 时探测；缺失降级明文） |
| `ageRecipient` | `''` | age 收件人（公钥/身份串）；空 = 无法加密、降级明文 |
| `ageIdentity` | `''` | 无口令 age 私钥文件路径（用于解密）；空 = 无法解密、降级明文 |
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
- **会话日志**：`sync/push`、`sync/pull`、`sync/conflict` 在 `types.d.ts` 中声明；仅当宿主收录这些类型时才追加（见已知限制）。所有写入与展示的内容都经过脱敏。插件写入的唯一持久消息——冲突 fork 通知——携带插件自有的 producer-owned source kind（`dsh-session-sync`）；宿主已退役共享的 `plugin` kind，读回会话时一律拒收。

## 安全边界

- **绝不静默覆盖。** append-only 三分支合并在任何分歧时都保留两边；fork 文件永不被删除，git 绝不强推、reset、rebase 或切换分支。
- **路径收容。** 文件按不透明字节镜像、拒绝符号链接，每次路径拼接都做收容校验（`PATH_UNSAFE` 响亮失败）。
- **脱敏输出。** 远端 URL 凭据、令牌与 `key=value` 密钥在进入模型或日志前被打码；路径展示拒绝根外路径。
- **不存凭据。** 插件自身不存凭据；git 凭据由你常规的 git credential helper 管理。age 身份/接收方文件由你管理，密钥绝不进入同步仓库。
- **git 加固。** git 以 `GIT_TERMINAL_PROMPT=0`、`GIT_OPTIONAL_LOCKS=0` 运行，带截止时间与信号边界，输出按流封顶。
- **失败关闭。** 缺少确认回答者、缺少远端或不安全路径都会响亮拒绝操作。

## 加密与威胁模型

`backend: encrypted` 在镜像之上增加一层可选的 **age** 加密：会话字节在提交与推送前加密为 `encrypted/**/*.age` 文件，合并前再解密回本地明文镜像。三方合并始终在本地明文上进行，因此追加式保留双方语义不变。

加密**保护**什么：

- **远端中的镜像内容。** 你推送的会话文件是 age 密文；远端主机、其运维者以及任何克隆该仓库的人，没有私钥都看不到明文的会话字节。

加密**不**保护什么（边界）：

- **密钥与 age 身份由你管理。** 接收方/身份文件从不由插件随包分发、存储或轮换。密钥泄露会使它保护的镜像内容暴露。请使用无口令身份并把它放在仓库之外。
- **远端实际仍是私有仓库。** git 元数据——提交信息、`.gitignore`、`encrypted/` 路径结构、分支名与推拉活动——对远端主机依然可见。加密隐藏的是*内容*，不是你在同步这个事实，也不是会话树的形态。
- **明文仍存在于本地。** `<repoDir>/sessions/` 的镜像在磁盘上是明文；加密保护的是传输中/远端的那份，而非本地磁盘加密或正在使用的会话存储。
- **优雅降级意味着明文。** 使用 `backend: encrypted` 时，若 `age` 缺失，或 `ageRecipient`/`ageIdentity` 为空，插件会回退到明文 git 路径**并在状态/日志中显式告警**——它绝不假装已经加密。在把远端当作已加密之前，先检查 `/sync status` 中的告警。

基线：`backend: git`（默认）下，会话字节以未加密形式存放在**你的** git 远端——请使用私有仓库。

## 已知限制

- **加密可选。** `backend: encrypted` 增加一层 age 加密（见上文「加密与威胁模型」）；`age` 或密钥缺失时它会显式告警并降级为明文。`backend: git`（默认）下，会话字节以未加密形式存放在**你的** git 远端 —— 请使用私有仓库。
- **依赖 git。** 插件需要 `git` 可执行文件与 `subprocess` 服务；没有它们时同步操作会给出明确原因失败（profile 仍可启动）。
- **`0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2`/`0.1.2-alpha.2`/`0.1.2-alpha.3`/`0.1.2-rc.1`/`0.1.7-alpha.2` 上的会话事件。** harness 尚未收录 `sync/*` 事件类型，因此会话日志追加被跳过（会话仍可加载）；宿主收录类型或 `Session.append` 暴露 `ignorable` 信封后插件会自动开启。
- **轮次间的 `approval`。** `/sync` 在轮次之间运行，`approval` 通道没有开放轮次可挂靠；请对命令式同步使用 `confirmVia: userQuestions`，或在轮次内经工具驱动同步。开放轮次判定读宿主 `turnBoundary` 会话投影：未组合 `@deepseek-ai/dsh-session-projection` 时无法核实轮次状态，按失败关闭并给出该原因。
- **宿主私有产物不进同步。** `session.lock`（宿主会话租约）与 `session.migration.*.tmp`（迁移暂存）永不镜像、永不删除——它们是运行时状态而非可同步内容；会话日志（`session.jsonl`、`session.v[1-9]*.jsonl[.zstd]`）仍是镜像载荷。

## 开发

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs，针对已发布的 0.1.7-alpha.2 peers
pnpm test                                          # node --test（13 个测试文件；git 引擎套件在无 git 时跳过）
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

本项目是 [PerryLink](https://github.com/PerryLink) 维护的 DeepSeek Harness 插件家族成员：**87 个活跃维护**，名册共 **95** 个，其中 **5 个已冻结**、**3 个已退役**。完整名单默认折叠，避免每个 README 的首屏被长表淹没；点击展开可查看每一行，原因见「状态」列。

<details>
<summary>展开全部 95 个插件</summary>

| 插件 | 一句话 | 状态 |
|---|---|---|
| **[dsh-aqua-input-check](https://github.com/PerryLink/dsh-aqua-input-check)** | 水产养殖投入品记录核对（按投入品用量、休药期与起捕间隔核对记录自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-archive-check](https://github.com/PerryLink/dsh-archive-check)** | 档案归档完整性与保管期限核对（依据《档案法》及配套规定，仅提示差异，不作出定性结论） |  |
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default |  |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command |  |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | 🚫 已退役 — 见仓库 README |
| **[dsh-bid-ca-precheck](https://github.com/PerryLink/dsh-bid-ca-precheck)** | 投标文件符合性预检（按招标文件逐条核对响应情况，仅提示差异，不作出定性结论） |  |
| **[dsh-bid-qual-check](https://github.com/PerryLink/dsh-bid-qual-check)** | 投标人资格条件核对（按资格条件与证明材料核对逐条响应，仅提示差异，不作出定性结论） |  |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | 🧊 已冻结 — 见仓库 README |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence |  |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |  |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | 🧊 已冻结 — 见仓库 README |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. |  |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search |  |
| **[dsh-contract-stance](https://github.com/PerryLink/dsh-contract-stance)** | 合同条款立场台账核对（按立场、风险等级与退让底线核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-customs-doc-check](https://github.com/PerryLink/dsh-customs-doc-check)** | 报关单证一致性核对（按公开的报关单填制规范核对单证间字段一致性，仅提示差异，不作出定性结论） |  |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) |  |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | 🧊 已冻结 — 见仓库 README |
| **[dsh-demurrage-ledger](https://github.com/PerryLink/dsh-demurrage-ledger)** | 滞箱费台账核对（按免箱期与费率核对超期天数与金额的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review |  |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | 🧊 已冻结 — 见仓库 README |
| **[dsh-drill-script-check](https://github.com/PerryLink/dsh-drill-script-check)** | 应急演练脚本核对（按阶段、响应分级、指挥与资源要素核对脚本齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-eia-guide-check](https://github.com/PerryLink/dsh-eia-guide-check)** | 环评导则适用性核对（按要素、导则名称与执行标准核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-emergency-plan](https://github.com/PerryLink/dsh-emergency-plan)** | 应急预案要素齐备性与条款级页码定位（依据 GB/T 29639-2020 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-essay-rubric-check](https://github.com/PerryLink/dsh-essay-rubric-check)** | 作文量表评分核对（按评分项、原文定位与分值算术核对评分自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-evidence-check](https://github.com/PerryLink/dsh-evidence-check)** | 证据清单齐备性核对（按待证事实与证据要素核对清单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-export-ctl-check](https://github.com/PerryLink/dsh-export-ctl-check)** | 出口管制物项核对（按管制清单、最终用途与许可证核对台账齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. |  |
| **[dsh-fmea-table-check](https://github.com/PerryLink/dsh-fmea-table-check)** | FMEA 分析表要素齐备性与风险顺序数一致性核对（按公开的 FMEA 方法标准核对表内自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-forecast-penalty](https://github.com/PerryLink/dsh-forecast-penalty)** | 预测准确率考核核对（按准确率、门槛与考核单价核对考核费用的算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds |  |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval |  |
| **[dsh-gongwen-flow-check](https://github.com/PerryLink/dsh-gongwen-flow-check)** | 公文流转与办理时限核对（按公开的公文处理规范核对环节完整性与时限，仅提示差异，不作出定性结论） |  |
| **[dsh-gongwen-word-check](https://github.com/PerryLink/dsh-gongwen-word-check)** | 公文格式要素核对（按公开的党政机关公文格式标准核对版头与主体要素，仅提示差异，不作出定性结论） |  |
| **[dsh-guard-plan-qc](https://github.com/PerryLink/dsh-guard-plan-qc)** | 劳动保护与安全防护用品配置表核对（按公开的配备标准核对品名规格与配置数量，仅提示差异，不作出定性结论） |  |
| **[dsh-hazchem-check](https://github.com/PerryLink/dsh-hazchem-check)** | 危险化学品临界量与重大危险源辨识核对（按储存量与临界量核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-hazplan-check](https://github.com/PerryLink/dsh-hazplan-check)** | HAZOP 分析表要素齐备性与偏差推导一致性核对（依据公开的危险与可操作性分析标准，仅提示差异，不作出定性结论） |  |
| **[dsh-hidden-risk-map](https://github.com/PerryLink/dsh-hidden-risk-map)** | 安全隐患台账→《工贸企业重大事故隐患判定标准》（应急管理部令第10号）条款映射提示（仅提示差异，不作出定性结论） |  |
| **[dsh-hs-classify](https://github.com/PerryLink/dsh-hs-classify)** | 商品归类层级一致性核对（按章、品目、子目与商品编号的层级关系核对自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-icd-rule-check](https://github.com/PerryLink/dsh-icd-rule-check)** | ICD 合并编码与星剑号配对提示（依据 GB/T 14396-2016 与公开的 ICD 使用说明，仅提示差异，不作出定性结论） |  |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` |  |
| **[dsh-lawcite-adapter](https://github.com/PerryLink/dsh-lawcite-adapter)** | 法条引用与文书要素核对（按名称、条号、原文与效力状态核对引用可核验性，仅提示差异，不作出定性结论） |  |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools |  |
| **[dsh-lc-doc-check](https://github.com/PerryLink/dsh-lc-doc-check)** | 信用证单据条款核对（按单据种类、份数、期限与不符点核对交单自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-learning-gap-check](https://github.com/PerryLink/dsh-learning-gap-check)** | 能力差距与培养计划核对（按能力等级差、培养措施与完成期限核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. |  |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. |  |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers |  |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer |  |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |  |
| **[dsh-medrec-qc](https://github.com/PerryLink/dsh-medrec-qc)** | 病案首页形式质控与逻辑矛盾提示（依据国卫办医发〔2016〕24号等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |  |
| **[dsh-nsfc-form-check](https://github.com/PerryLink/dsh-nsfc-form-check)** | 国家自然科学基金申请书形式审查与匿名化提示（依据《国家自然科学基金条例》与申请人导入的当年指南，仅提示差异，不作出定性结论） |  |
| **[dsh-nurse-record-check](https://github.com/PerryLink/dsh-nurse-record-check)** | 护理记录时限、签名与评估表完整性校验（依据《病历书写基本规范》等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |  |
| **[dsh-origin-rvc-check](https://github.com/PerryLink/dsh-origin-rvc-check)** | 原产地区域价值成分核对（按 RVC 定义式与门槛核对原产地判定自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-ota-review-check](https://github.com/PerryLink/dsh-ota-review-check)** | 在线点评回复台账核对（按回复时限、问题分类与整改状态核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching |  |
| **[dsh-paper-doc-adapter](https://github.com/PerryLink/dsh-paper-doc-adapter)** | 试卷解析结构核对（按题型、答案、分值与 yotta 标识核对试卷结构自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit |  |
| **[dsh-permit-report-check](https://github.com/PerryLink/dsh-permit-report-check)** | 行政许可办理核对（按申请材料、法定时限与决定记录核对台账闭环，仅提示差异，不作出定性结论） |  |
| **[dsh-pipeline-check](https://github.com/PerryLink/dsh-pipeline-check)** | 项目全流程文件链条核对（按环节先后与金额口径核对链条自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-pleading-draft](https://github.com/PerryLink/dsh-pleading-draft)** | 起诉状要素齐备性核对（按诉请、事实、证据、法条四要素核对文书齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins |  |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill |  |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins |  |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card |  |
| **[dsh-policy-brief-draft](https://github.com/PerryLink/dsh-policy-brief-draft)** | 政策专报要素核对（按观点、依据、出处与建议核对专报齐备，仅提示差异，不作出定性结论） |  |
| **[dsh-power-loss-split](https://github.com/PerryLink/dsh-power-loss-split)** | 线损电量拆分与考核表核对（依据公开的线损计算口径，仅提示差异，不作出定性结论） |  |
| **[dsh-power-ticket-check](https://github.com/PerryLink/dsh-power-ticket-check)** | 电力工作票要素齐备性与签发许可顺序核对（依据现行电力安全工作规程，仅提示差异，不作出定性结论） |  |
| **[dsh-ppap-check](https://github.com/PerryLink/dsh-ppap-check)** | PPAP 提交要素齐备性核对（按公开的 PPAP 手册与提交等级核对要素齐备与版本填写，仅提示差异，不作出定性结论） |  |
| **[dsh-protest-deadline](https://github.com/PerryLink/dsh-protest-deadline)** | 质疑与投诉期限核对（按公开的政府采购质疑投诉规定核对期限与台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-railway-window](https://github.com/PerryLink/dsh-railway-window)** | 铁路施工天窗台账核对（按时间窗、时长算术与命令号核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | 🧊 已冻结 — 见仓库 README |
| **[dsh-repair-order-qc](https://github.com/PerryLink/dsh-repair-order-qc)** | 维修工单结算核对（按项目金额、配件工时合计与结算总额核对算术自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions |  |
| **[dsh-review-reply-check](https://github.com/PerryLink/dsh-review-reply-check)** | 审稿意见逐条回应覆盖核对（按意见与回应一一对应核对覆盖完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-rulefile-check](https://github.com/PerryLink/dsh-rulefile-check)** | 规则库文件自检核对（按条款引用纪律与效力上限核对规则库自身合规，仅提示差异，不作出定性结论） |  |
| **[dsh-safety-brief-check](https://github.com/PerryLink/dsh-safety-brief-check)** | 安全技术交底记录要素齐备性与签字闭环核对（依据公开的安全生产法规与检查标准，仅提示差异，不作出定性结论） |  |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. |  |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | 🚫 已退役 — 见仓库 README |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |  |
| **[dsh-site-log-check](https://github.com/PerryLink/dsh-site-log-check)** | 监理日志跨日连续性与旁站覆盖提示（依据 GB/T 50319-2013 等公开文件，仅提示差异，不作出定性结论） |  |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review |  |
| **[dsh-soe-decision-check](https://github.com/PerryLink/dsh-soe-decision-check)** | 三重一大决策台账核对（按前置研究、会议审议与决议记录核对程序留痕，仅提示差异，不作出定性结论） |  |
| **[dsh-soilwater-check](https://github.com/PerryLink/dsh-soilwater-check)** | 土壤与地下水监测台账核对（按点位、监测项目、限值与超标判定核对台账自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-sop-sync-check](https://github.com/PerryLink/dsh-sop-sync-check)** | 作业规程与 FMEA／控制计划一致性核对（按编号与版本核对三份文件是否同步，仅提示差异，不作出定性结论） |  |
| **[dsh-spc-gbt-adapter](https://github.com/PerryLink/dsh-spc-gbt-adapter)** | 控制图常数与过程能力指数核对（按 GB/T 4091 的常规控制图常数表核对控制限与 Cp/Cpk 的自洽性，仅提示差异，不作出定性结论） |  |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |  |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | 🚫 已退役 — 见仓库 README |
| **[dsh-tender-extract](https://github.com/PerryLink/dsh-tender-extract)** | 招标文件条款摘录核对（按出处与原文逐字核对摘录完整性，仅提示差异，不作出定性结论） |  |
| **[dsh-tender-matrix](https://github.com/PerryLink/dsh-tender-matrix)** | 评标因素评分矩阵核对（按分值上限与合计核对矩阵自洽，仅提示差异，不作出定性结论） |  |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |  |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools |  |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |  |
| **[dsh-warranty-calc](https://github.com/PerryLink/dsh-warranty-calc)** | 质保期与索赔金额核对（按质保期月数与里程、索赔金额算式核对自洽，仅提示差异，不作出定性结论） |  |

</details>

</details>

</details>

### 从 DSH Desktop 市场安装

所有 PerryLink 插件均可在 DSH Desktop 内置市场中浏览：**市场 → 来源 → 添加来源 → 粘贴** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ 选中**。安装仍需通过市场的 npm 身份校验与你的确认。

## 许可证

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
