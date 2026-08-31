---
id: 2Q5V78
slug: restore-codex-hook-activation
type: task
phase: intake
status: in_progress
created: 2026-08-31T17:42:09.861Z
last_modified: 2026-08-31T17:42:09.861Z
scope:
  - "Distinguish an app restart that completed without hook activation from an app that still needs restarting"
  - "Keep protection unverified until Codex emits exact current hook proof"
  - "Isolate packaged Codex hook tests from the user's real CODEX_HOME"
out_of_scope:
  - "Claim protection from plugin installation, enablement, or trust state alone"
  - "Patch Codex Desktop or duplicate hooks into another configuration layer"
done_when:
  - "After a different Codex app process replaces the install-time host without activation proof, status reports missing host dispatch and does not ask for another restart"
  - "When restart process evidence is unavailable or the install-time host still runs, status retains conservative restart guidance"
  - "Packaged hook tests cannot write proof into the user's real Codex profile"
---

# Confirm active Codex protection after plugin updates

**Goal:** Make Codex hook activation produce trustworthy proof after a plugin update so users are not trapped in a false restart loop.

**Why:** Codex displays enabled Safeword 0.82.4 hooks but does not emit lifecycle proof, while tests can overwrite the real profile proof with stale runtime data.

## Work Log

- 2026-08-31T17:42:09.861Z Started: Created ticket 2Q5V78
- 2026-08-31T17:49:00.000Z Reproduced: Codex Desktop 26.825.51511 / embedded CLI 0.151.0-alpha.7.2 lists all five Safeword 0.82.4 hooks as enabled and trusted, but emits no lifecycle proof after restart, prompts, or Code Mode tool calls.
- 2026-08-31T17:49:00.000Z Found: the install-time app-server PID is gone and a different app-server is the current ancestor, so the existing restart instruction is provably stale.
- 2026-08-31T17:49:00.000Z Found: `runCodexHook` inherits the real profile whenever a test omits `CODEX_HOME`; a 0.82.3 compatibility test overwrote the user's profile proof.
- 2026-08-31T17:49:00.000Z Decision: keep runtime proof fail-closed, classify a completed-but-unactivated restart as missing host dispatch, and isolate the test process boundary. Duplicate hooks and install-state-as-proof were rejected because both can claim safety without execution.
- 2026-08-31T18:15:00.000Z Implemented: status now reports `plugin_installed_hook_activation_failed` after a proven app-process transition without current lifecycle proof; unavailable, same-host, and overlapping-host observations remain restart-required.
- 2026-08-31T18:46:00.000Z Independent quality review found that a completed restart with only `SessionStart` proof could be mistaken for total hook activation failure before the first turn had a chance to emit `PostToolUse` or `Stop`.
- 2026-08-31T18:48:00.000Z Fixed: a process-observed restart with no lifecycle proof reports activation failure, while an identity-bound restart receipt with partial current proof reports `plugin_enabled_hook_unproven` and tells the user to continue the session instead of restarting or abandoning the surface.
- 2026-08-31T18:48:00.000Z BDD gap confirmed and covered: the prior matrix modeled no activation while the pending marker still existed, but did not model partial activation after `SessionStart` retired the marker and wrote the restart receipt.
- 2026-08-31T18:56:00.000Z Independent quality review found a second BDD gap: a successful install-time host scan with zero running Codex hosts was encoded as an unavailable scan, making activation impossible when Codex was installed while closed.
- 2026-08-31T18:57:00.000Z Fixed and covered: observed-zero host sets remain distinguishable from unavailable observation, and only a host whose process start time is at or after installation may write the restart receipt. The new acceptance scenario passes through the real SessionStart proof boundary.
- 2026-08-31T18:15:00.000Z Regression: packaged-hook subprocesses now receive a disposable `CODEX_HOME` unless the fixture explicitly provides one.
- 2026-08-31T18:15:00.000Z BDD gap: the existing continuity feature covered restart-pending and successful post-restart proof, but omitted the completed-restart/no-dispatch branch. Added that fixture to both human and schema-2 status matrices.
- 2026-08-31T18:15:00.000Z Primary-source evidence: OpenAI documents enabled/trusted hook state separately from execution; current Code Mode source does not provide the normal pre-tool hook payload, and open upstream issues report missing nested Code Mode hook dispatch (https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md, https://github.com/openai/codex/issues/23411, https://github.com/openai/codex/issues/38850, https://github.com/openai/codex/issues/21639).

## Tests

- [ ] A different current app-server with no install-time host left converts pending activation into hook-unproven status and actionable host-dispatch guidance.
- [ ] The same install-time host, an overlapping old host, and unavailable process observation retain restart-required status.
- [ ] Hook-test subprocesses receive an isolated `CODEX_HOME` unless the test explicitly supplies one.
- [ ] The real profile proof path remains unchanged across the packaged-hook compatibility regression test.
