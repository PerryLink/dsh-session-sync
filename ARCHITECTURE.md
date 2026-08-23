# Architecture

## Overview

`dsh-session-sync` mirrors the DSH session store into a dedicated git worktree and syncs it to a user-provided remote, giving cross-device session continuity with no cloud service. Session files are treated as **opaque bytes**: the plugin never parses JSONL/zstd — the physical encoding belongs to the harness, and the plugin's only job is to move those bytes, merge append-only histories, and report state.

## Roles

- **Consumes public services only**: `sessions`, `commands`, `storageDomain`, `subprocess` (hard `inject`); `tools` (registered via `ctx.inject(['tools'], …)` when present); `userQuestions` / `approval` (optional `ctx.get`, fail closed when absent).
- **`lib/` is zero-DSH-dependency**: services are wired only at the boundary in `index.mjs`; `lib/` depends only on `node:` built-ins (the single sanctioned exception is `lib/domain.mjs`, which imports `zod` and `@deepseek-ai/dsh-storage-domain` because the domain record schema is a persistence-boundary validator).

## Module map

| Module | Responsibility |
|---|---|
| `index.mjs` | The single host face: `Config` schema + `resolveConfig`, `makeRunGit`, tool factories, the `/sync` command handler, auto modes, `apply()` |
| `lib/constants.mjs` | Vocabulary + protocol constants (backends, confirm channels, merge kinds, error codes, defaults, bounds) — zero dependency |
| `lib/errors.mjs` | Structured domain errors (`SyncError` with stable `code` + `details`) |
| `lib/paths.mjs` | Path resolution, nesting checks, and fork-file naming — pure |
| `lib/sanitize.mjs` | Pure display/log redaction (remote-URL credentials, tokens, `key=value` secrets, path-containment display) |
| `lib/merge.mjs` | Append-only three-way merge classification — pure |
| `lib/mirror.mjs` | Byte mirror from the session store into the worktree (`node:fs`) |
| `lib/git.mjs` | Git command layer: verb whitelist + argument assertions, never force-push/reset/rebase/branch-switch |
| `lib/engine.mjs` | Sync orchestration: `push` (mirror → commit → push, reconcile-and-retry once on rejection), `pull` (commit → fetch → three-way merge), `status` |
| `lib/status.mjs` | Read-only status collection (no fetch, no writes) |
| `lib/render.mjs` | Result text rendering (pure, JSON-safe inputs) |
| `lib/gate.mjs` | Confirmation gate + session-event adaptive gate |
| `lib/domain.mjs` | The `session-sync` storage-domain spec (state table, singleton key) |

## Data flow

```text
$DSH_HOME/sessions ──byte mirror──▶ <repoDir>/sessions ──git──▶ custom remote
```

1. **Mirror** copies each session file as opaque bytes into the worktree (symlinks refused, deletions only for files that vanished at the source and are not fork files).
2. **Commit** records the mirror as a git commit (plugin identity, never the user's git identity).
3. **Push/pull** move commits to/from the configured remote over `ctx.subprocess`-driven git.

## Conflict resolution — never silently overwrite

The three-way merge compares `base` (merge base), `ours` (local), and `theirs` (remote) per file:

| Verdict | Condition | Outcome |
|---|---|---|
| `identical` | `ours == theirs` | keep ours |
| `ours-only` | `theirs == base` | keep ours |
| `theirs-only` | `ours == base` | adopt theirs (remote-only append) |
| `append-both` | both appended past base | keep ours + fork file for theirs |
| `diverged` | neither is a superset | keep ours + fork file for theirs |

Fork files are named `<basename>.remote-fork-<UTC timestamp>-<device8>`; mirror and cleanup **never delete or overwrite** files matching that pattern, so both lineages always survive. When a conflicting session is live and has no open turn, the plugin also forks the session at the harness level and injects a persistent `user/message` notice into the child.

## Confirmation gate

`pull`/`push` (command and tools) cross `confirmSync`. `confirmVia: auto` prefers `userQuestions` then `approval`; an explicit `userQuestions` or `approval` forces one channel. With no answerer the operation **fails closed**. Read-only surfaces (`status`/`diff`/`log`) never ask. The `approval` channel requires an open turn (tools run inside a turn; `/sync` runs between turns and is directed to mount `userQuestions`).

## Session events (adaptive gate)

`sync/push`, `sync/pull`, and `sync/conflict` are declared through `SessionEventMap` declaration merging in `types.d.ts`. At runtime the plugin appends one only when either (a) the host's `KNOWN_SESSION_EVENT_TYPES` already includes the type, or (b) the host `Session.append` exposes the `ignorable` envelope (`probeIgnorableAppend`). On `0.1.0-rc.6`, `0.1.0-rc.8`, and `0.1.1-rc.2` neither is true (rc.2's `append` takes no envelope for non-surface types; `ignorable` is a read-path marker only), so the gate stays closed and appends are skipped — sessions keep loading. Once a host records the types, appends turn on automatically; the gate is never removed by hand.

## Storage domain

Sync metadata (`deviceId`, `lastPullAt`, `lastPushAt`, `lastPushHead`, `lastError`) lives in the `session-sync` storage domain (`state` table, singleton key). The device id is a random UUID also written to `device.txt` in the sync repository for cross-device fork attribution.

## Auto modes — all reversible

Every automatic behavior is a Cordis effect, so stop/hot-reload removes it:

- `autoPullOnStart` — `ctx.effect` pulls once on mount.
- `autoPushOnTurnEnd` — `ctx.on('session/event')` pushes after `turn/end`.
- `pullIntervalMinutes` — `ctx.effect` wraps a `setInterval` periodic pull (the disposer clears the timer).

Auto runs are covered by the config grant and never re-confirm.

## Safety boundaries

- **Verb whitelist** in `lib/git.mjs`; `-f`/`--force`/`--force-with-lease`/`+refspec`, `reset`, `clean`, `rebase`, and branch-switch `checkout` are refused.
- **Path containment** before any join (`PATH_UNSAFE` fails loud).
- **Symlinks never followed** on either side of the mirror.
- **Sanitize before display/log** — remote-URL credentials, tokens, and `key=value` secrets are redacted before reaching the model or the log.
- **Bounded subprocesses** — git runs with `GIT_TERMINAL_PROMPT=0` and `GIT_OPTIONAL_LOCKS=0`, deadline- and signal-bounded, with a per-stream output cap.

## Backend vocabulary

`backend: git` is the only implemented backend. End-to-end-encryption backends (age/GPG-style) are reserved; configuring one fails loudly at load, and keys never enter the sync repository.
