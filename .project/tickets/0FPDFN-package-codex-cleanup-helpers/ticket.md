---
id: 0FPDFN
slug: package-codex-cleanup-helpers
type: task
phase: done
status: done
created: 2026-09-16T20:15:18.350Z
last_modified: 2026-09-16T22:18:19.000Z
---

# Package cleanup helpers for Codex users

**Goal:** Package and spawn every advertised Codex cleanup helper from the installed plugin.

**Why:** The generated Codex plugin omits templates/scripts, so cleanup-zombies and closeout-cleanup fail before they can preview any action.

**Type:** Bug

**Scope:** Preserve the generator's recursive `templates/hooks/` copy, copy exactly the two allowlisted `templates/scripts/` files, and prove the generated plugin reaches each script's non-mutating behavior boundary.

**Out of Scope:** Changing cleanup behavior, granting new permissions, automatically deleting branches or worktrees, or changing Claude/Cursor delivery.

**Done When:**

- [x] The generated Codex plugin contains every allowlisted project-runtime helper while retaining the complete hooks support tree.
- [x] From an enrolled generated-plugin fixture, `cleanup-zombies --help` returns its usage text and `closeout-cleanup` without `--pr` returns `PROJECT_RUNTIME_FAILED` with `closeout blocked: repository and a positive numeric --pr are required.`
- [x] Generated plugin artifacts and release checks are current.

**Tests:**

- [x] RED: a generated-plugin contract fails because both script-backed helpers are absent while confirming the existing hooks support tree is present.
- [x] GREEN: the generated-plugin contract uses an enrolled project, observes `cleanup-zombies --help` usage, and asserts the closeout helper's exact `PROJECT_RUNTIME_FAILED` refusal code and message.
- [x] REFACTOR: script-helper paths have one authoritative inventory shared by runtime dispatch and generation; recursive hook support remains unchanged.

## Root Cause

`runProjectRuntime` resolves two allowlisted commands under `templates/scripts/`, but the Codex plugin generator copies only `templates/hooks/`. The installed plugin therefore contains all three hook-backed helpers and neither script-backed helper. The recursive hooks copy must remain because `closeout-cleanup.ts` imports `closeout-binding.ts`, `retro-draft-spool.ts`, and `run-identity.ts` from the hooks support tree.

Confirmed by reproducing `PROJECT_RUNTIME_MISSING` for both commands in the installed `1.0.0-rc.3` cache and checking all five allowlisted paths. General plugin installation failure was ruled out because the three hook-backed paths are present. A cleanup-algorithm failure was ruled out because execution stops at the file-existence check before either script starts.

## Work Log

- 2026-09-16T20:15:18.350Z Started: Created ticket 0FPDFN
- 2026-09-16T20:18:00.000Z Found: Codex generation copies `templates/hooks/` but omits both allowlisted files under `templates/scripts/`.
- 2026-09-16T20:18:00.000Z Planned: Add a real generated-plugin execution contract, then derive copied script-helper assets from the runtime's authoritative inventory without replacing recursive hook copying.
- 2026-09-16T20:21:00.000Z Reviewed: Independent intake review `458e6e4b-defc-4eb9-983c-17c0fa7e0e2a` caught the need to preserve hook dependencies and name exact safe script outcomes; scope and tests were tightened accordingly.
- 2026-09-16T20:24:00.000Z Approved: Independent review `10efc3e0-5d09-4459-a67c-f35e5102fd4b` found no blocking defect and clarified the package/spawn promise, enrolled-fixture precondition, and exact refusal assertion.
- 2026-09-16T22:07:00.000Z Implemented: Added one authoritative project-runtime helper inventory, copied only its script-backed helpers into generated Codex plugins, retained recursive hook support, and kept closeout re-entrant calls on the same bundled CLI.
- 2026-09-16T22:13:00.000Z Verified: The full test command passed 10,132 tests with 34 intentional skips; both BDD lanes, builds, lint, typechecks, generator checks, and 74 release-contract tests passed.
- 2026-09-16T22:18:19.000Z Done: Independent quality review `cce03b6b-df15-4ec1-bf3a-f8b823ddf7c7` approved the source implementation. The phase stamp records that generated runtime bundles exceed the coordinator's 262144-byte per-file limit; generator and release checks cover those artifacts. Verification evidence is recorded in `verify.md`.
