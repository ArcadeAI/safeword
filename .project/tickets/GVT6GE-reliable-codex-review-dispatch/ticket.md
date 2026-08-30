---
id: GVT6GE
slug: reliable-codex-review-dispatch
type: task
phase: verify
status: in_progress
created: 2026-08-30T15:42:06.625Z
last_modified: 2026-08-30T16:08:00.000Z
---

# Keep Codex reviews reliable without package bootstrap

**Goal:** Run Codex Safeword review workflows from the installed plugin even when Bun package installation is corrupted or concurrent.

**Why:** Codex skills still invoke bunx for initial review dispatch, so a partial shared bunx tree can block reviews before the self-contained pending-review recovery applies.

## Work Log

- 2026-08-30T15:42:06.625Z Started: Created ticket GVT6GE
- 2026-08-30T15:42:30Z Found: Codex loaded the v0.82.2 skill, but initial review dispatch still used bunx and reused a partial temporary commander install. The v0.82.2 self-contained runtime fix only covers status recovery after REVIEW_PENDING.
- 2026-08-30T15:42:30Z Decided: Bundle the standalone CLI in the Codex plugin and generate versioned plugin-cache invocations; reject global-PATH and bunx-repair designs because both retain external mutable state.
- 2026-08-30T16:08:00Z Implemented: Generated the standalone runtime into the Codex plugin, routed hooks and generated skills through it, and added release-contract, parity, schema, BDD, and empty-cache execution coverage.

## Acceptance

- Generated Codex review and project-knowledge commands invoke the bundled plugin CLI without `bunx`.
- The Codex plugin ships the standalone CLI bundle used by those commands.
- Generation and release-contract tests fail when the runtime or versioned invocation drifts.
- Focused review, catalogue, and release tests pass.
