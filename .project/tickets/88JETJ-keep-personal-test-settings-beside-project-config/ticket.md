---
id: 88JETJ
slug: keep-personal-test-settings-beside-project-config
type: task
phase: done
status: done
created: 2026-08-18T18:33:57.767Z
last_modified: 2026-08-18T18:33:57.767Z
---

# Keep personal test settings beside project config

**Goal:** Use .safeword/config.local.json as the private project-specific override for .safeword/config.json.

**Why:** Keep one Safeword configuration model while preserving a Git-ignored personal override.

## Work Log

- 2026-08-18T18:33:57.767Z Started: Created ticket 88JETJ
- Chose `.safeword/config.local.json` so shared and personal settings use one
  recognizable Safeword config model. Precedence remains command, personal,
  project, built-in.
- Kept the local file optional, worktree-local, Git-ignored, and untracked.
  Only `testExecution` is accepted until another setting is intentionally made
  personal-overridable.
- RED: `bun run test packages/cli/tests/cli-protocol/test-execution-wiring.test.ts`
  failed seven focused cases because the CLI still read
  `.project/personal/config.json` (commit `78fe292c6`).
- GREEN proof moved to GitHub Actions after two local attempts waited one and
  ten minutes respectively behind an active Vitest owner without starting a
  test process.
- GREEN: remote run `32173743466` passed the real done lane for commit
  `bdf72849a`; the focused local suite then passed 48/48 tests after the lock
  became available.
