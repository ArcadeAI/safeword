---
id: P4A681
slug: let-installed-codex-hooks-prove-protection
type: task
subtype: bug-investigated
phase: verify
status: in_progress
created: 2026-08-31T21:58:11.001Z
last_modified: 2026-08-31T21:58:11.001Z
---

# Let installed Codex hooks prove protection

**Goal:** Make the versioned Codex plugin runtime record lifecycle proof from its installed cache layout.

**Why:** Codex executes the released plugin hooks, but the bundled runtime cannot locate its adjacent hooks.json and silently drops proof, leaving protection permanently unverified.

**Scope:** Resolve the hook manifest from the physical Codex plugin cache layout and prove that the generated runtime records installed hook execution.

**Out of Scope:** Codex host dispatch behavior, legacy project-hook migration, and unrelated plugin catalogue warnings.

**Done When:**

- [x] An installed-cache `SessionStart` hook writes identity-bound 0.82.5+ proof.
- [x] Codex status observes that proof instead of reporting total activation failure.
- [x] Source, build, and installed plugin layouts retain the same manifest identity.

**Tests:**

- [x] RED: the generated runtime fails to record proof when copied into the physical cache layout.
- [x] GREEN: the same public hook command records proof beside an adjacent `hooks.json`.
- [x] Existing profile-proof, hook-command, release-contract, and physical-install tests pass.

## Root Cause

`packagedHookManifestPath()` only searches the CLI source/build layouts (`../codex-plugin/hooks.json` and `../../codex-plugin/hooks.json`). In the installed Codex plugin, the runtime is `<plugin>/runtime/cli.js` and the manifest is `<plugin>/hooks.json`, so both candidates are absent. `currentCodexPluginIdentity()` throws before writing proof, and `codexHook()` deliberately catches that advisory-state failure so the host reports the hook as completed.

Confirmed by running a real Codex terminal session: Codex listed Safeword 0.82.5 as installed/enabled and visibly completed its packaged SessionStart hook, while no `hook-proof-v2` file was created. The two runtime-relative candidates are absent from the installed cache.

Ruled out: host dispatch failure (the terminal TUI visibly ran the hook); plugin discovery failure (`codex plugin list --json` returned installed/enabled 0.82.5); hook trust failure (Codex reported the hook completed); and a stale package version (the executed cache and manifest both report 0.82.5).

## Work Log

- 2026-08-31T21:58:11.001Z Started: Created ticket P4A681
- 2026-08-31T21:59:00.000Z Investigated: Live Desktop and terminal probes narrowed the failure to bundled identity resolution after hook dispatch.
- 2026-08-31T21:59:00.000Z Root cause: the installed runtime omits `<plugin>/hooks.json` from its manifest lookup candidates; the advisory proof exception is swallowed by design.
- 2026-08-31T22:03:00.000Z RED: the physical-install release contract failed with `ENOENT` for `hook-proof-v2/session-start.json`.
- 2026-08-31T22:04:00.000Z GREEN: resolving `../hooks.json` from the bundled runtime produced identity-bound proof; the release-contract file passed 8/8 after regenerating both plugin runtimes.
- 2026-08-31T22:47:00.000Z Strengthened GREEN: the physical-cache release test compares the installed manifest to source, validates the proof digest and installed version, and confirms the public `codex status --json` observer reports partial proof after SessionStart.
- 2026-08-31T22:47:00.000Z Versioned release artifacts at 0.82.6 and refreshed the origin-main lifecycle fixtures from the released 0.82.5 baseline.
