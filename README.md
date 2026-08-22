<div align="center">

# 🔄 dsh-session-sync
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-session-sync)

**Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store.**

*Sync your sessions between devices, keep both sides on any conflict, never lose a turn.*

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

## Compatibility

| Surface | Status |
|---|---|
| Harness | DeepSeek Harness `0.1.1-rc.2` |
| Node | `^22.19.0 \|\| >=24.0.0` |
| Platforms | Anywhere `git` and DSH run (git-based mirror; no platform-specific code) |
| Model | Text-only models fully supported; no vision or extra model capability required |

## What you get

`dsh-session-sync` mirrors your DSH session store into a dedicated git worktree and syncs it to a remote **you** control — no cloud service, no third-party storage:

- **`/sync` command** — `status` (branch, sanitized remote, ahead/behind, dirty files, forks), `diff`, `log`, `pull`, `push`, `help`.
- **`sync_status` / `sync_pull` / `sync_push` tools** — the same surface for the model, inside a turn.
- **Append-only conflict resolution** — session logs are append-only; on any divergence the plugin keeps **both** sides (local version kept, remote version preserved as fork files) and never silently overwrites. Diverged sessions can also fork at the session level.
- **Auto modes** — pull on start, push after every closed turn, and periodic pull, all configurable and all reversible.
- **Confirmation-gated writes** — `pull`/`push` ask first (through `userQuestions` or `approval`); read-only surfaces never ask; with no answerer the operation fails closed.

```text
device A                              remote (your git repo)                  device B
$DSH_HOME/sessions ──mirror──▶ commit ──push──▶ [sessions] ──pull──▶ merge (keep-both + fork)
```

## Quick start

```sh
# 1. install the bundle into your profile
dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"

# or from npm (published releases)
dsh plugin --profile web add dsh-session-sync

# 2. point it at a private git remote and verify the row
dsh --profile web --dump-config | grep -A2 'id: session-sync'
```

Then set the remote in your profile patch (a **private** repository is the baseline) and sync:

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

## Install & uninstall

- **git channel** (latest `main`): `dsh plugin --profile web add "github:PerryLink/dsh-session-sync#main"` (equivalent to installing from `git+https://github.com/PerryLink/dsh-session-sync.git`). No build step — `index.mjs` and `lib/` are the shipped artifacts.
- **npm channel** (published releases): `dsh plugin --profile web add dsh-session-sync`.
- **tarball channel**: `pnpm pack` in this repo, then `dsh plugin --profile web add ./dsh-session-sync-<version>.tgz`.
- **uninstall**: `dsh plugin --profile web remove dsh-session-sync` (or remove the row from the profile patch).

## Configuration

All tunables are Schemastery `Config` fields (changeable from cordis.yml). An id-targeted override replaces the whole row — restate every key you need. `cordis.patch.yml` documents each key inline.

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch; `false` unregisters the command, tools, listeners, and auto modes |
| `backend` | `git` | Sync backend; only `git` is implemented (encrypted backends are reserved and fail loud) |
| `sessionRoot` | `''` | Session store root; empty = `$DSH_HOME/sessions` (both missing fails load) |
| `repoDir` | `''` | Sync worktree root; empty = `$DSH_HOME/dsh-session-sync/repo` |
| `remote` | `''` | Remote address (required before pull/push; status/diff work without one) |
| `branch` | `main` | Remote branch name |
| `gitBin` | `git` | git executable path |
| `autoPullOnStart` | `false` | Pull once when the plugin mounts (config is the grant; no re-confirm) |
| `autoPushOnTurnEnd` | `false` | Push after every closed turn |
| `pullIntervalMinutes` | `0` | Periodic pull every N minutes (`0` = off, max `10080`) |
| `confirmVia` | `auto` | Confirmation channel: `auto` (userQuestions first, then approval), `userQuestions`, `approval` |
| `graceMs` | `10000` | Grace period for git kills (ms) |
| `commandTimeoutMs` | `120000` | Per-command timeout (ms) |
| `maxOutputBytes` | `262144` | Per-stream collected-output cap (bytes) |
| `commitName` | `dsh-session-sync` | Commit author name |
| `commitEmail` | `dsh-session-sync@localhost` | Commit author email |
| `registerCommand` | `true` | Register the `/sync` command |
| `registerTools` | `true` | Register the `sync_*` tools when the tools service is present |

Example override in your profile patch:

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

## Tools & surfaces

| Surface | Read-only | Needs confirmation | Notes |
|---|---|---|---|
| `/sync status` | ✅ | — | Branch, sanitized remote, ahead/behind, dirty files, fork files, last pull/push |
| `/sync diff` | ✅ | — | Uncommitted changes + `HEAD..remote` stat (read-only) |
| `/sync log` | ✅ | — | Last commits in the sync repository |
| `/sync pull` | | ✅ | Fetch + merge with keep-both semantics; local kept, remote preserved as forks |
| `/sync push` | | ✅ | Mirror + commit + push; never force-pushes, reconciles and retries once on rejection |
| `sync_status` | ✅ | — | Same facts as `/sync status` for the model |
| `sync_pull` | | ✅ | Model-callable pull |
| `sync_push` | | ✅ | Model-callable push |

## Permissions & data

- **Permissions**: mutating operations cross the confirmation gate (`confirmVia`); the plugin never re-implements or bypasses the harness's `userQuestions`/`approval` services. Auto modes are covered by the config grant and never re-confirm.
- **Data**: sync metadata (device id, last pull/push, last push head, last error) lives in the `session-sync` storage domain. Session files are copied as opaque bytes — the plugin never parses them. The device id is also written to `device.txt` in the sync repository for cross-device fork attribution.
- **Session log**: `sync/push`, `sync/pull`, and `sync/conflict` are declared in `types.d.ts`; they are appended only when the host records the types (see Known limitations). Everything written or shown is sanitized.

## Security boundaries

- **Never silently overwrite.** The append-only three-way merge keeps both sides on any divergence; fork files are never deleted, and git never force-pushes, resets, rebases, or switches branches.
- **Path containment.** Files are mirrored as opaque bytes with symlinks refused and every joined path containment-checked (`PATH_UNSAFE` fails loud).
- **Sanitized output.** Remote-URL credentials, tokens, and `key=value` secrets are redacted before reaching the model or the log; path display refuses anything outside its root.
- **No credential storage.** The plugin stores no credentials; git credentials live in your normal git credential helper. The reserved end-to-end-encryption backend is unimplemented and keys never enter the sync repository.
- **Git hardening.** Git runs with `GIT_TERMINAL_PROMPT=0` and `GIT_OPTIONAL_LOCKS=0`, deadline- and signal-bounded, with a per-stream output cap.
- **Fail closed.** A missing confirmation answerer, a missing remote, or an unsafe path refuses the operation loudly.

## Known limitations

- **git backend only.** End-to-end-encryption backends (age/GPG-style) are reserved but not implemented; configuring one fails loudly at load. Until then, session bytes are stored unencrypted in **your** git remote — use a private repository.
- **git required.** The plugin needs the `git` executable and the `subprocess` service; without them, sync operations fail with a clear reason (profiles keep booting).
- **Session events on `0.1.0-rc.6`/`0.1.0-rc.8`/`0.1.1-rc.2`.** The harness does not record `sync/*` event types, so the session-log appends are skipped (sessions keep loading); the plugin enables them automatically once a host records the types or exposes the `ignorable` envelope on `Session.append`.
- **`approval` between turns.** `/sync` runs between turns, where the `approval` channel has no open turn to attach to; use `confirmVia: userQuestions` for command-driven sync, or drive sync through the tools inside a turn.

## Development

```sh
pnpm install                                       # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci        # tsc --checkJs against the published 0.1.1-rc.2 peers
pnpm test                                          # node --test (6 suites; git suites skip without git)
pnpm run verify:self-contained                     # dependency specs resolve from the registry
pnpm run verify:artifacts                          # shipped files present + index.mjs importable
pnpm run check:readmes                             # five-language README consistency
pnpm pack                                          # the published tarball
```

There is no build step: pure ESM, `index.mjs` and `lib/` are the shipped artifacts.

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `session-sync`, `session`, `git`, `sync`, `cross-device`

## Contributors

- [@PerryLink](https://github.com/PerryLink) — creator and maintainer: git mirror engine, append-only keep-both merge, `/sync` command and `sync_*` tools, auto modes, sanitizers, and the five-language docs.

## PerryLink DSH Plugin Family

This project is one of the [29 DeepSeek Harness plugins](https://github.com/PerryLink) maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| [dsh-auto-review](https://github.com/PerryLink/dsh-auto-review) | Second-model auto-review on the approval chain, fail-closed by default |
| [dsh-background-agents](https://github.com/PerryLink/dsh-background-agents) | Durable background child agents with a Web UI sidebar, messaging and interrupt |
| [dsh-budget](https://github.com/PerryLink/dsh-budget) | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. |
| [dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind) | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore |
| [dsh-claude-move](https://github.com/PerryLink/dsh-claude-move) | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH |
| [dsh-click](https://github.com/PerryLink/dsh-click) | Cross-platform native desktop control for DeepSeek Harness — Windows first. |
| [dsh-composer-history](https://github.com/PerryLink/dsh-composer-history) | Terminal-style input history for the web composer: arrows, Ctrl+R search |
| [dsh-defend](https://github.com/PerryLink/dsh-defend) | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. |
| [dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck) | Engineering-discipline guard: requirements grill, test gates, adversary review |
| [dsh-draw](https://github.com/PerryLink/dsh-draw) | Unified static-image generation routing for DeepSeek Harness. |
| [dsh-fast](https://github.com/PerryLink/dsh-fast) | Read-only performance diagnostics for DeepSeek Harness. |
| [dsh-github](https://github.com/PerryLink/dsh-github) | GitHub PR/issues integration for DSH, every write gated by approval |
| [dsh-library](https://github.com/PerryLink/dsh-library) | Local document knowledge base for DeepSeek Harness. |
| [dsh-local-ai](https://github.com/PerryLink/dsh-local-ai) | Local-model (Ollama) integration for DeepSeek Harness. |
| [dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions) | LSP diagnostics, formatting, completion, code actions and rename over language servers |
| [dsh-mask](https://github.com/PerryLink/dsh-mask) | PII masking middleware for DeepSeek Harness — anonymize personal data before it reaches the model, restore it at the display layer. |
| [dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel) | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors |
| [dsh-memento](https://github.com/PerryLink/dsh-memento) | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool |
| [dsh-observe](https://github.com/PerryLink/dsh-observe) | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. |
| [dsh-output-styles](https://github.com/PerryLink/dsh-output-styles) | Claude Code outputStyles-equivalent runtime style switching |
| [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | Claude Code-style declarative allow/deny/ask permission rules with audit |
| [dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide) | Plugin-development knowledge base as an on-demand agent skill |
| [dsh-score](https://github.com/PerryLink/dsh-score) | Multi-dimensional quality scoring for DeepSeek Harness plugins. |
| [dsh-session-pin](https://github.com/PerryLink/dsh-session-pin) | Pin sessions in the Web sidebar with durable ordering |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. |
| [dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security) | Security-audit skill pack: secret scan, dependency and supply-chain review |
| [dsh-talk](https://github.com/PerryLink/dsh-talk) | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. |
| [dsh-test-drive](https://github.com/PerryLink/dsh-test-drive) | Isolated install-and-smoke test drives for DeepSeek Harness plugins. |
| [dsh-translate](https://github.com/PerryLink/dsh-translate) | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. |

## License

[LICENSE](LICENSE) (Apache License 2.0) © 2026 dsh-session-sync contributors
