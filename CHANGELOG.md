# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Rename the four translated READMEs to `README-<lang>.md`. npm selects the package-page readme as the first markdown file matching its `{README,README.*}` glob (`@npmcli/package-json`, publish path), and that glob order puts `README.<lang>.md` ahead of `README.md` — so npm was serving the Simplified-Chinese file for this package too (measured on 15/15 sampled packages of the family). The new names sit outside the glob, so the English source is served again. No content changed apart from the language-switcher link each translation holds to its siblings, and the repo readme gate still passes. Takes effect with the next release; an already-published version cannot gain a corrected readme retroactively.
- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to the published `0.1.5-rc.2` line and record `0.1.5-rc.2` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now runs against `0.1.5-rc.2`. The peer range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` is unchanged, so no supported host line is dropped.

## [0.2.13] - 2026-09-10

### Changed

- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to the published `0.1.5-rc.1` line and record `0.1.5-rc.1` in `dshWorkshop.compatibility.dshVersions`; the monthly Compat workflow now runs against `0.1.5-rc.1`. The peer range `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` is unchanged, so no supported host line is dropped.

### Docs

- Refresh the five-language README compatibility baseline to `dsh-v0.1.5-rc.1` (verified 2026-09-10).

## [0.2.12] - 2026-09-09

### Fixed

- Generate the git-backend fork timestamp as strictly 14 digits: `lib/engine.mjs` stripped only `-` and `:` from `toISOString()` before slicing 14 characters, so the ISO `T` survived (`20260909T13523`), `forkFileName`'s `/^\d{14}$/` check failed, and every git-backend conflict fork silently fell back to the epoch stamp `19700101000000`. The stamp now removes `-`, `:` and `T` exactly like `lib/encrypted.mjs`, yielding a real `yyyyMMddHHmmss` UTC stamp; the encrypted backend was already correct and no other behavior changes. Regression tests assert a 14-digit non-epoch stamp on a real fork path plus the acceptance/fallback contract in `test/paths.test.mjs`.

## [0.2.11] - 2026-09-09

### Fixed

- Map fork files to sessions with the host's real session-store layout `$DSH_HOME/sessions/<projectKey>/<sessionId>/<file>`: the session-level fork lookup treated the project key as a session id, so on harness `dsh-v0.1.5-alpha.1` (session format V3, zstd by default) every session-level fork and its `sync/conflict` event was silently skipped while the fork files were still kept. `lib/paths.mjs` now exposes `sessionIdOfForkPath` and `decodeSegment` (the inverse of the host's `~XXXX` segment escaping), `handleForks` uses them and warns instead of staying silent when a fork path cannot be mapped, and the legacy flat `<mirrorDir>/<sessionId>/<file>` layout still maps when the last segment looks like a file. The byte-level mirror, merge, and encryption path is unchanged; no new dependencies.

## [0.2.10] - 2026-09-09

### Fixed

- Restore a green `pnpm install --frozen-lockfile` on pnpm 11: pnpm 11 enables `minimumReleaseAge` by default (1440 minutes) and its frozen-install lockfile supply-chain verification pass ignores `minimumReleaseAgeExclude` — both the exact `@deepseek-ai/dsh-*@0.1.5-alpha.1` entries and an `@deepseek-ai/*` pattern — so the freshly published `0.1.5-alpha.1` dev/test pins failed with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` (17 lockfile entries, reproduced locally against a clean store). `pnpm-workspace.yaml` now sets `minimumReleaseAge: 0`, matching the sibling PerryLink plugins, and keeps the exclusion list as the documented intent. The `v0.2.9` tag already carried that list and still failed at the Install step in both Release and CI, which is why `0.2.9` never reached npm; no runtime behavior changes.

## [0.2.9] - 2026-09-09

### Changed

- Align the `@deepseek-ai/dsh-*` peer ranges to `>=0.1.2-rc.1 <0.2.0 || >=0.1.5-alpha.1 <0.2.0` and pin the dev/test dependencies to the published `0.1.5-alpha.1` line: adaptation to DeepSeek Harness `dsh-v0.1.5-alpha.1` (session format V3, `ctx.agent` removal, `Inbox` type-only interface); runtime behavior is unchanged for every supported host line.
- Record `0.1.5-alpha.1` in `dshWorkshop.compatibility.dshVersions`.

### Docs

- Refresh the five-language README compatibility baseline to `dsh-v0.1.5-alpha.1` (verified 2026-09-09).

## [0.2.8] - 2026-09-07

### Docs

- Fix the DSH plugin badge URL: shields.io rejects the four-segment static badge form with "404 badge not found"; the label now uses the documented double-dash form (`dsh--plugin`), rendering identically; no behavior change.


## [0.2.7] - 2026-09-07

### Fixed

- Align the `@deepseek-ai/dsh-*` peer ranges to `>=0.1.2-rc.1 <0.2.0`: the older `>=0.1.0-rc.8 <0.2.0` band resolved to only the `0.1.0-rc.8` prerelease under registry-driven resolution and broke fresh tarball installs; no behavior change.

### Docs

- Refresh the five-language README support-version wording: the verified GitHub tag `dsh-v0.1.3-alpha.1` now leads the compatibility claim, while npm `0.1.2-rc.1` stays the published dependency-pin line (peers `>=0.1.2-rc.1 <0.2.0`); no behavior change.


## [0.2.6] - 2026-09-04

### Fixed

- Remove the `storage` / `storage-json` / `storage-domain` rows from the bundle patch: the shipped profiles compose that stack through `dsh-base`, so the inserted rows collided with the same ids and made the profile refuse to boot (`duplicate loader entry id: storage`). The patch now mounts only the `session-sync` row; bare profiles compose the storage stack themselves. The manifest test asserts the new patch contract (plugin row only).

## [0.2.4] - 2026-09-04

### Changed

- Align the devDependency pins to the published dsh `0.1.2-rc.1` line (12 `@deepseek-ai/dsh-*` packages), the `dshWorkshop` compatibility list, and the compat workflow's CLI/base/headless installs; the five-language READMEs record the rc.1 facts. No behavior change: the adaptive `sync/*` event gate stays closed on `0.1.2-rc.1` (`Session.append` still cannot stamp the `ignorable` marker).

## [0.2.3] - 2026-09-02

### Docs

- Sync the five-language READMEs to the 0.1.2-alpha.5 facts; no behavior change.

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
