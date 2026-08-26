# AGENTS.md

Standalone DeepSeek Harness plugin repository (`dsh-session-sync`). Development follows the dsh-plugin-guide skill and the official plugin contract; this file records repo-local decisions. Read `README.md` (external contract) and `ARCHITECTURE.md` (design decisions) before changing behavior.

## Layout (JS form, pure host, no browser half)

```
index.mjs             single host face: Config schema + resolveConfig, git runner,
                      /sync command handler, sync_* tool factories, auto modes, apply()
types.d.ts            Config/result types + sync/* SessionEventMap declaration merging
lib/                  zero-DSH-dependency modules (see ARCHITECTURE.md module map);
                      the only lib module allowed to import zod/@deepseek-ai/* is
                      lib/domain.mjs (persistence-boundary validator)
test/*.test.mjs       node --test; engine/git use real git (git tests skip when git
                      is absent) and real temp dirs; scripted runners where git
                      availability is not guaranteed
scripts/              mechanical gates: verify-self-contained.mjs, verify-artifacts.mjs,
                      verify-readmes.mjs, changelog-section.mjs
cordis.patch.yml      bundle declaration (insert session-sync); every Config key
                      documented inline
pnpm-workspace.yaml   nearest-workspace root (isolates this repo from the surrounding
                      deepseek-harness workspace during development)
package.json          npm metadata; files whitelist = published content
tsconfig.check.json   tsc --checkJs typecheck gate against the published 0.1.1-rc.2 peers
.github/workflows/    CI (3 OS × 2 Node), monthly compat probe, v* npm release
README.md             English primary (GitHub default page; source of truth)
README.{zh,es,pt,hi}.md  translations, top switcher, updated in the same commit
ARCHITECTURE.md       seam roles + module map + design decisions
CHANGELOG.md          Keep a Changelog, [Unreleased] at the top
SECURITY.md           private vulnerability reporting + scope
THIRD_PARTY_NOTICES.md  install-time dependencies (none bundled)
LICENSE               Apache-2.0
```

## Hard rules applied here

- **Optional seams fail closed.** `tools` registers only when present (`ctx.inject(['tools'], …)`); `userQuestions`/`approval` are looked up with `ctx.get` and a missing answerer returns `allowed: false` — read-only surfaces never ask, mutating ones never proceed without an answer.
- **Session-event adaptive gate is mandatory.** `sync/push`, `sync/pull`, `sync/conflict` are declared in `types.d.ts`, but runtime appends only when the host records the type or supports the `ignorable` envelope (`probeIgnorableAppend`). On `0.1.0-rc.6`, `0.1.0-rc.8`, and `0.1.1-rc.2` the gate stays closed so sessions keep loading. Do not remove the gate "just because" — see `ARCHITECTURE.md`.
- **Append never flips outcomes.** A failed session-event append is swallowed (warn only); a failed fork-notice append must not turn a successful pull into a failure.
- **Model-visible ⟺ logged.** The only model-visible plugin content is sanitized tool/command output; mutating outcomes append `sync/push`/`sync/pull`/`sync/conflict` through the gate, so the log reconstructs them.
- **Sanitize before display/log.** Remote-URL credentials, tokens, and `key=value` secrets are redacted in `lib/sanitize.mjs` before reaching the model or the log; path display refuses anything outside its root.
- **Never silently overwrite.** The append-only three-way merge keeps both sides on any divergence (keep-both + fork files); the mirror never deletes fork files, and git never force-pushes.
- **Loud misconfiguration.** Unknown backend, unknown `confirmVia`, out-of-bounds numbers, and empty/unsafe paths fail `resolveConfig` at load.
- **Waterfall discipline.** This plugin registers no waterfall listeners; if it ever does, allow/passthrough MUST call `next()` and only a deliberate deny/ask may short-circuit.
- **No build step.** Pure ESM: `index.mjs` + `lib/` are the shipped artifacts. There is no `build`/`prepare` script — keep it that way; do not introduce a bundler.

## Checks

```sh
pnpm install                                        # node ^22.19 || >=24
pnpm run typecheck && pnpm run typecheck:ci         # tsc --checkJs (tsconfig.check.json)
pnpm test                                           # node --test (12 test files; the engine git suite skips without git)
pnpm run verify:self-contained                      # dependency specs resolve from the registry
pnpm run verify:artifacts                           # shipped files present + index.mjs importable
pnpm run check:readmes                              # five-language README consistency
pnpm pack                                           # the published tarball
```

`typecheck` resolves `@deepseek-ai/*` from this repo's own `node_modules` (the pinned `0.1.1-rc.2` peers installed by pnpm). The repo must be its own pnpm workspace (`pnpm-workspace.yaml`) so it never resolves into a surrounding `deepseek-harness` checkout's node_modules.

## Release

Version is currently `0.1.3`. For a new version: bump `package.json#version`, stamp the CHANGELOG `[Unreleased]` section into `## [<x.y.z>] - <UTC date>`, re-run the full gate, commit `chore(release): <x.y.z>`, and `git tag -a v<x.y.z>`. `git push origin main --follow-tags` triggers `.github/workflows/release.yml`, which re-runs the gate, publishes to npm with provenance (skipped without the `NPM_TOKEN` secret), and creates the GitHub Release from the stamped CHANGELOG section. Never push a tag for a version already on the registry.

## Docs

- Five-language READMEs (`README.md` is the source; `README.zh.md`, `README.es.md`, `README.pt.md`, `README.hi.md` follow). Every behavior change updates all five in the same commit; `check:readmes` enforces the shared surface in CI.
- GitHub topics `dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `session-sync`, `session`, `git`, `sync`, `cross-device` (mirror `package.json` keywords; the ecosystem's visibility channel is the `dsh-plugin` topic).
- License is Apache-2.0 (`LICENSE` + the package.json `license` field). `THIRD_PARTY_NOTICES.md` documents install-time dependencies; nothing is bundled.
