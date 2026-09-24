# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.20] - 2026-09-25

### Changed

- Host pins move to `0.1.7-rc.2`; re-verified against that host line. Every `@deepseek-ai/dsh-*` dev/test dependency now pins `0.1.7-rc.2`, the `dshWorkshop.compatibility.dshVersions` timeline appends `0.1.7-rc.2`, and the compatibility baseline in every README records the `dsh-v0.1.7-rc.2` host. The declared host ranges (`engines.dsh` and the `peerDependencies` union) are deliberately **unchanged** — they already admit `0.1.7-rc.2`, and a range is what the manifest accepts, not what has been tested.

## [0.2.19] - 2026-09-24
### Changed

- Host pins move to `0.1.7-rc.1`; re-verified against that host line. Every `@deepseek-ai/dsh-*` dev/test dependency now pins `0.1.7-rc.1`, the `pnpm-lock.yaml` graph is regenerated, `dshWorkshop.compatibility.dshVersions` appends `0.1.7-rc.1`, the monthly Compat workflow and the CI probe install the `0.1.7-rc.1` host, and the compatibility baseline in every README records `dsh-v0.1.7-rc.1`. The declared host ranges (`engines.dsh` and the `peerDependencies` union) are deliberately **unchanged** — they already admit `0.1.7-rc.1`, and a range is what the manifest accepts, not what has been tested.

## [0.2.18] - 2026-09-23

### Changed

- **Re-verified against the `0.1.7-alpha.2` host; the `@deepseek-ai/dsh-*` host pins move to `0.1.7-alpha.2`.** The `alpha.2` wave removes nothing this plugin consumes: the published type surface of every host package it resolves is either byte-identical to `0.1.7-alpha.1` (`@deepseek-ai/cordis` `4.0.3`≡`4.0.4`, `@deepseek-ai/schemastery` `3.18.3`≡`3.18.4`) or strictly additive (`ToolDefinition.projectContent?`, `ClientModuleLoader.importError()`, six added `dsh-client-locale` keys). The wave's only removals are internals no plugin in this family references — `dsh-subprocess-local` privates and its non-entry `bindManagedProcess`, `dsh-client-web` `assertEntriesActive`, `dsh-app-boot`'s `unhandledRejection` event, `dsh-client-ui-plugin-manager` `apply()`, a refined `dsh-client-ui-primitives` `CodeBlock` signature, and the `diff.files.one`/`diff.files.other` locale key pair. Both rulers therefore stay green on the moved pin: `typecheck` against the checkout, `typecheck:ci` against the published `0.1.7-alpha.2` faces.
- The declared host range is deliberately **unchanged**. It already admits `0.1.7-alpha.2` (`0.1.7-alpha.2` satisfies the `>=0.1.7-0 <0.2.0` clause), and the family convention keeps peer ranges wider than the verified line rather than narrowing them to it; a range is what the manifest accepts, not what has been tested.
- Repo documentation (`AGENTS.md`), the workspace graph pin (`pnpm-workspace.yaml`) and the published-line workflow pins move with the manifest, so no file still claims the previous line.


## [0.2.17] - 2026-09-22

### Fixed

- The conflict fork notice no longer writes the harness-retired `{ kind: 'plugin', plugin: … }` message source. DeepSeek Harness `0.1.7-alpha.1` turned `MessageSourceMap` into a merge-extensible producer-owned union with no shared `plugin` catch-all, and `@deepseek-ai/dsh-session-format-v3-to-v4`'s `assertV4MessageSources` refuses `kind === 'plugin'` when a session is read back, so a notice written by an earlier build left the forked session readable but not continuable. `injectForkNotice` now writes `{ kind: 'dsh-session-sync', form: 'notice', summary: … }` — the plugin's own producer-owned kind, declared by declaration merging in `types.d.ts`. `form` and `summary` are unchanged, so no user-visible behavior changes.

- `scripts/loader-runner.mjs` sweeps `ctx.registry` for `FiberState.FAILED` fibers after `ctx.loader.await()` and rethrows their `_error`. `cordis-plugin-loader` 1.0.4 (the loader the 0.1.7 host vendors) catches an import failure inside `Entry._init`, logs it and returns, and `EntryTree.await` settles its tasks with `Promise.allSettled`, which never rejects — so a failed mount stopped propagating and the invalid-config and default-export regression cases were exiting non-zero for the wrong reason (`the /sync command is missing`). `FiberState` is a `const enum` with no runtime object, so its `FAILED` value (`3`) is mirrored.

### Added

- `test/source-readback.test.mjs`, a real-host read-back gate: it drives the payload captured from `injectForkNotice` through the host's own admission functions (`assertV4RowAdmission`, `releasedV4SessionFormatCodec.encodeEvent`, `restoreReleasedV4Artifact`) and through `Session.fromRestore` + `deriveMessages`. It admits the new kind, admits the V3-migrated legacy `plugin:dsh-session-sync` form, and pins that the retired `{ kind: 'plugin' }` form is refused — a source-kind regression now fails at the read-back boundary instead of only in the type gate.

### Changed

- Pin the `@deepseek-ai/dsh-*` dev/test dependencies to `0.1.7-alpha.1`, `@deepseek-ai/cordis` to `^4.0.3` (4.0.2 does not export `Volatile`, and `@deepseek-ai/dsh-session-format-v3-to-v4` peer-requires `^4.0.3`), `@deepseek-ai/schemastery` to `^3.18.3` and `@deepseek-ai/cosmokit` to `^1.8.4`. `pnpm-workspace.yaml` gains package-name `overrides` for the bare cordis/cosmokit/schemastery peer edges plus a self-referential `dsh-session-sync` entry, so one copy of each resolves and the host type graph cannot fork. `dshWorkshop.compatibility.dshVersions` now records `0.1.7-alpha.1`.

- Widen `engines.dsh` and every `peerDependencies` range with a fourth `|| >=0.1.7-0 <0.2.0` clause, and add `@deepseek-ai/dsh-session-format-v3-to-v4` to devDependencies. The clause is a bug fix rather than a gratuitous widening: under semver's prerelease rule a prerelease version satisfies a range only when some comparator shares its `major.minor.patch` tuple *and* carries a prerelease tag, so the previous three clauses excluded `0.1.7-alpha.1` — the target host itself.

- Declare `@deepseek-ai/dsh-llm` as a peer. `index.mjs` imports `createUserMessage` from it and `types.d.ts` augments its `MessageSourceMap`, so the dependency the plugin actually consumes was previously undeclared.

### Docs

- Refresh the five-language README compatibility baseline to `dsh-v0.1.7-alpha.1` (verified 2026-09-22) and record the producer-owned source kind in the session-log bullet. `AGENTS.md` gains the `MessageSourceMap` merge in the `types.d.ts` layout line, the corrected test-file count, and the accurate split between the two typecheck gates.

## [0.2.16] - 2026-09-19

### Added

- `pnpm run check:lockfile` (`scripts/check-lockfile-drift.mjs`) fails fast when `package.json` and `pnpm-lock.yaml` disagree; the probe is read-only and the documented checks chain runs it alongside the other gates.

### Changed

- The release workflow now publishes through **npm trusted publishing** (OIDC) instead of the long-lived `NPM_TOKEN` secret: `setup-node` no longer sets `registry-url` (its empty `_authToken` line made the registry answer 404 on PUT), npm is upgraded to >= 11.5.1 before publishing, and the "NPM_TOKEN is not set -> skip" guard is gone so a missing publisher cannot turn a release into a silent no-op.
## [0.2.15] - 2026-09-18

### Fixed

- The storage-domain handle no longer leaks across an unmount that lands while `ctx.storageDomain.open` is still in flight. The domain effect is registered synchronously inside the apply frame and owns the handle, so the disposer closes the domain once the open settles instead of throwing `INACTIVE_EFFECT` into a swallowed rejection. The silent `.catch(() => {})` is gone: an open or close failure now warns with its reason, and consumers still await the table promise.

- The `approval` confirmation channel reads the open-turn state from the host `turnBoundary` session projection (`openTurnStartSeq`) instead of the removed `Session.events` property. On hosts of the 0.1.6 line the previous read was always `undefined`, so `/sync pull|push` under `confirmVia: approval` failed even inside an open turn; it now proceeds there, and fails closed with an actionable reason when the projection is not composed (`@deepseek-ai/dsh-session-projection` missing) or no turn is open. The conflict path's session-level fork uses the same projection read and skips the fork when the turn state is unavailable (fork files are still preserved).

### Changed

- Host-private session artifacts are never mirrored or deleted. `session.lock` (the harness session lease) and `session.migration.*.tmp` staging files are per-host runtime state; copying them into the worktree leaked one device's transient state into shared history, and deleting them from the worktree churned commits (a previously committed lock could also be removed by a device that simply had no open session). Both mirror loops now protect them; session logs (`session.jsonl`, `session.v[1-9]*.jsonl[.zstd]`) remain the mirrored payload, and a regression test pins that they still sync. A source-side or target-side `session.lock` no longer changes the mirrored file count.

- Fork-path mapping is anchored on the fork file name itself (`forkFileName`'s pattern) instead of a fixed path depth: the session id is the fork file's parent segment, which resolves the host `<projectKey>/<sessionId>/` layout and the legacy flat layout identically and stays correct at any nesting depth.

### Added

- `dsh.manifestVersion: 1`, the canonical three-clause `engines.dsh` range, and an optional peer on `@deepseek-ai/dsh-session-projection` (the open-turn read falls back to a fail-closed reason when it is absent).

## [0.2.14] - 2026-09-12

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
