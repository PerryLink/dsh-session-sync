# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-09-02

### Changed

- Aligned the devDependency pins to the published dsh `0.1.2-alpha.5` line (12 `@deepseek-ai/dsh-*` packages) and raised the compat probe pins to `0.1.2-alpha.5`. The session-event adaptive gate stays closed on `0.1.2-alpha.5` (`Session.append` still cannot stamp the `ignorable` envelope), so behavior is unchanged.

## [0.2.1] - 2026-09-01

### Changed

- Aligned the devDependency pins to the published dsh `0.1.2-alpha.3` line (11 `@deepseek-ai/dsh-*` packages), aligned `cordis`/`schemastery` to `^4.0.2`/`^3.18.2`, and widened the `dsh-commands`/`dsh-subprocess` peers to the standard `>=0.1.0-rc.8 <0.2.0` range. The session-event adaptive gate stays closed on `0.1.2-alpha.3` (`Session.append` still cannot stamp the `ignorable` envelope), so behavior is unchanged.
- The CI compat probe now verifies against the dsh CLI and `dsh-base`/`dsh-headless` at `0.1.2-alpha.3`; the five-language READMEs and `AGENTS.md` document the alpha.3 target.

## [0.2.0] - 2026-08-26

### Added

- `backend: encrypted` — an age-encrypted git transport that encrypts mirror content before push and decrypts it before merging, with graceful fallback to plaintext git (plus an explicit warning) when `age`/`ageRecipient`/`ageIdentity` is unavailable. `object-storage` remains a reserved placeholder that fails loud at load.
- Transport backend seam (`lib/backend.mjs`: a documented `status`/`push`/`pull` contract and a pure `selectEncryptionMode`), `lib/age.mjs` (`detectAge` + file-based `ageEncrypt`/`ageDecrypt`), and `lib/encrypted.mjs` (`EncryptedBackend`). The plaintext `git` backend and its zero-dependency default path are unchanged.

### Docs

- README threat model describing the encryption boundary: age protects the mirror content, while keys/age identities stay user-managed and the remote remains a private repository in practice.

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
