# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cross-device session sync for DeepSeek Harness: a dedicated git mirror of the session store, `push`/`pull`/`status` with append-only keep-both + fork conflict resolution (never silently overwrites), the `/sync` command (`status`/`pull`/`push`/`diff`/`log`/`help`), and the `sync_pull`/`sync_push`/`sync_status` model tools.
- Configurable auto modes: pull on mount (`autoPullOnStart`), push after each closed turn (`autoPushOnTurnEnd`), and periodic pull (`pullIntervalMinutes`), all reversible Cordis effects.
- Confirmation gate for mutating operations (`confirmVia: auto`/`userQuestions`/`approval`, fail closed when no answerer); read-only surfaces never ask.
- `sync/push`, `sync/pull`, and `sync/conflict` session events behind an adaptive gate (append only when the host records the types or supports the `ignorable` envelope).
- Session-level conflict fork with a persistent `user/message` notice when a diverged session is live and has no open turn.
- `session-sync` storage-domain metadata (device id, last pull/push, last push head, last error).
- Schemastery configuration with fail-loud bounds; every tunable documented in `cordis.patch.yml` and the five-language READMEs.
