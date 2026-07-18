---
id: SSDPBV
slug: complete-codex-handoff-without-reinstalling-reviewed-plugin
type: task
phase: done
status: done
external_prs: [https://github.com/ArcadeAI/safeword/pull/993]
created: 2026-07-18T11:54:57.682Z
last_modified: 2026-07-18T13:19:35Z
---

# Complete Codex hook handoff without reinstalling reviewed plugins

**Goal:** Let builders remove legacy Codex hooks after review without re-adding or refreshing the Safe Word plugin.

**Why:** Cleanup must preserve the reviewed-plugin trust boundary and must not depend on duplicate plugin-install behavior.

## Work Log

- 2026-07-18T13:19:35Z DONE: User authorized closure. GitHub CI run 29644390435 passed lint plus the full Node 22 and Node 24 CLI suites, Cucumber acceptance lane, and release gates. PR #993 has no unresolved review threads.
- 2026-07-18T12:25:07Z VERIFY: Independent fresh-context quality review approved the final diff against current Codex plugin documentation. The regression suite now proves both sides of the handoff: initial migration adds the marketplace and plugin; explicit cleanup verifies the enabled profile plugin without either add command. Focused migration integration (12/12), tagged Codex BDD (4/4), lint, and typecheck passed. The aggregate Vitest wrapper remains a known local no-result hang; audit found only repository-wide clone baseline, a dependency-cruiser warning outside this ticket's files, and a deferred dev-only markdownlint-cli2 patch update.
- 2026-07-18T12:21:00Z REVIEW: Independent review requested explicit initial `plugin add` coverage and an assertion for the verification-time concurrent-update error. Added both; focused migration integration passed 12/12.
- 2026-07-18T12:10:00Z REFACTOR: Extracted the initial-install subprocess sequence to keep the public command below the complexity threshold, then corrected the concurrent-update error to name final plugin verification rather than retired cleanup-time installation.
- 2026-07-18T11:56:30Z RED: `bun run test tests/commands/migrate-codex-plugin.test.ts` ran 12 migration integrations; the new cleanup contract failed because the command log contained both `plugin marketplace add` and `plugin add`, while the other 11 tests passed.
- 2026-07-18T11:55:00Z Decision: cleanup will verify the already-enabled plugin without marketplace or plugin add. Isolated CODEX_HOME evidence on the repository-pinned Codex CLI showed duplicate adds currently return success, but the published migration contract and current Codex docs separate add from explicit upgrade; cleanup must not depend on that behavior or refresh a reviewed hook definition.
- 2026-07-18T11:54:57.682Z Started: Created ticket SSDPBV

## Scope

**In scope:** Branch explicit legacy-hook cleanup before marketplace/plugin installation, retain Bun/Codex/plugin-enabled preflight checks, and correct the stale `textPatches` comment.

**Out of scope:** Changing initial installation, Codex trust state, marketplace upgrade behavior, or hook definitions.

## Done When

- [x] `--remove-legacy-hooks` removes recognized legacy hooks only after `plugin list --json` confirms `safeword@safeword` is enabled.
- [x] Cleanup never invokes `codex plugin marketplace add` or `codex plugin add`.
- [x] The schema comment names no retired Codex retrofit.

## Tests

- [x] CLI integration: cleanup removes the legacy hook and never invokes either add command.
- [x] CLI integration: config mutation during final plugin verification still aborts cleanup without a backup.

## Root Cause

The initial-install and post-review-cleanup paths shared unconditional marketplace and plugin installation. Although the current Codex CLI treats duplicate adds as successful, the second command in the documented handoff should verify the reviewed profile plugin rather than rerun mutable installation work.
