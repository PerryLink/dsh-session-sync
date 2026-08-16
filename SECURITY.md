# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately through GitHub's private vulnerability reporting:

**https://github.com/PerryLink/dsh-session-sync/security/advisories/new**

That flow keeps the report confidential while we triage, and it is the channel we watch first.

## Before you report

- **Redact sensitive data** from any logs or `/sync` output you attach: tokens, API keys, secrets, Authorization/request headers, personal paths, and account identifiers. The plugin already redacts remote-URL credentials in its own output; still, do not paste a raw remote URL that embeds a password or token.
- Include, when possible: the plugin version, the harness (`dsh`) version, Node and OS versions, the remote type (git over https/ssh), and the minimal steps to reproduce.

## What to expect

- **Acknowledgment**: within 5 business days.
- **Triage**: within 10 business days we confirm the issue and assess severity, or ask for more details.
- **Fix**: security fixes are prepared in a private fork, released as a patch version, and announced in the release notes.

## Disclosure and credit

- We follow coordinated disclosure: a public advisory (and CVE request where appropriate) is published once a fix ships.
- Reporters are credited in the advisory unless they ask to remain anonymous. There is no bug bounty program at this time.

## Scope

This plugin mirrors the DSH session store into a local git worktree and syncs it to a user-provided remote. Its own guarantees are:

- **Never silently overwrite.** The append-only three-way merge keeps both sides on any divergence; fork files are never deleted, and git never force-pushes, resets, rebases, or switches branches.
- **Bounded, sanitized output.** Remote-URL credentials, tokens, and `key=value` secrets are redacted before reaching the model or the log; path display refuses anything outside its root.
- **Path containment.** Session files are copied as opaque bytes with symlinks refused and every joined path containment-checked (`PATH_UNSAFE` fails loud).
- **No credential storage.** The plugin stores no credentials itself; git credentials live in the user's normal git credential helper. The reserved end-to-end-encryption backend is unimplemented and keys never enter the sync repository.
- **Git hardening.** Git runs with `GIT_TERMINAL_PROMPT=0` and `GIT_OPTIONAL_LOCKS=0`, deadline- and signal-bounded, with a per-stream output cap.

The security of the synced session data depends on the remote you configure: a private repository is the baseline, and the future encrypted backend is the path to encrypting session bytes before they leave the device. Vulnerabilities in the harness itself should be reported to the official harness maintainers instead.
