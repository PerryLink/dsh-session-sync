# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-08-23

### Fixed

- Corrected the stale test count in the Development sections (the repo runs 10 `node --test` files, not 6 suites) across the five-language READMEs and `AGENTS.md`, and fixed `ARCHITECTURE.md`'s periodic-pull description to match the code (`ctx.effect` wrapping `setInterval`, not `ctx.setInterval`). Documentation only — no behavior change.

## [0.1.3] - 2026-08-22

### Changed

- Upgraded every `@deepseek-ai/dsh-*` devDependency to `0.1.1-rc.2`: devDependencies pin exact `0.1.1-rc.2`, peerDependencies keep their `>=0.1.0-rc.8 <0.2.0` range (the plugin uses no rc.2-only API), and `dshWorkshop.compatibility.dshVersions` now lists `0.1.1-rc.2`. The session-event adaptive gate stays closed on `0.1.1-rc.2` (the harness still does not record `sync/*` types, and rc.2 `Session.append` takes no `ignorable` envelope for non-surface types), so sessions keep loading unchanged.
- CI compat probe now verifies the plugin against `@deepseek-ai/dsh-base`/`dsh-headless` at `0.1.1-rc.2`; the five-language READMEs, `AGENTS.md`, `ARCHITECTURE.md`, and `THIRD_PARTY_NOTICES.md` document the `0.1.1-rc.2` target.

## [0.1.2] - 2026-08-21

### Changed

- Upgraded every `@deepseek-ai/dsh-*` dependency to `0.1.0-rc.8`: devDependencies pin exact `0.1.0-rc.8`, peerDependencies widen to `>=0.1.0-rc.8 <0.2.0`, and `dshWorkshop.compatibility.dshVersions` now lists `0.1.0-rc.8`. The session-event adaptive gate stays closed on rc.8 (the harness still does not record `sync/*` types, and rc.8 `Session.append` takes no `ignorable` envelope for non-surface types), so sessions keep loading unchanged.
- CI compat probe now verifies the plugin against `@deepseek-ai/dsh-base`/`dsh-headless` at `0.1.0-rc.8`; the five-language READMEs, `AGENTS.md`, `ARCHITECTURE.md`, and `THIRD_PARTY_NOTICES.md` document the rc.8 target.

### Fixed

- `scripts/loader-runner.mjs` calls the rc.8 `commands.execute(agent, line, images, signal)` signature (empty image batch), so the real-Loader composition tests run against the rc.8 commands registry.

## [0.1.1] - 2026-08-17

### Fixed

- The bundle patch now composes the storage stack (`@deepseek-ai/dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`) and declares all three packages, so a bare profile gets the `storageDomain` service the plugin injects instead of hanging with `pending (waiting for service: storageDomain)`.

## [0.1.0] - 2026-08-16

### Added

- Cross-device session sync for DeepSeek Harness: a dedicated git mirror of the session store, `push`/`pull`/`status` with append-only keep-both + fork conflict resolution (never silently overwrites), the `/sync` command (`status`/`pull`/`push`/`diff`/`log`/`help`), and the `sync_pull`/`sync_push`/`sync_status` model tools.
- Configurable auto modes: pull on mount (`autoPullOnStart`), push after each closed turn (`autoPushOnTurnEnd`), and periodic pull (`pullIntervalMinutes`), all reversible Cordis effects.
- Confirmation gate for mutating operations (`confirmVia: auto`/`userQuestions`/`approval`, fail closed when no answerer); read-only surfaces never ask.
- `sync/push`, `sync/pull`, and `sync/conflict` session events behind an adaptive gate (append only when the host records the types or supports the `ignorable` envelope).
- Session-level conflict fork with a persistent `user/message` notice when a diverged session is live and has no open turn.
- `session-sync` storage-domain metadata (device id, last pull/push, last push head, last error).
- Schemastery configuration with fail-loud bounds; every tunable documented in `cordis.patch.yml` and the five-language READMEs.
