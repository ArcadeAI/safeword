---
id: QENH3V
slug: ignore-node-modules-on-install
type: patch
phase: done
status: done
created: 2026-11-15T01:36:37.368Z
last_modified: 2026-11-15T02:36:00Z
---

# Keep dependencies out of commits in fresh Safeword projects

**Goal:** The .gitignore Safeword installs ignores node_modules/ so a fresh project's git add -A never commits dependencies

**Why:** Retro #6764: a trial project's add-all commit pulled in node_modules

**Scope:** Add `node_modules/` to the repo-root managed `.gitignore` block (`GITIGNORE_BLOCK_PATHS` in `packages/cli/src/schema.ts`), keep the owned-line recognizer to Safeword's own paths, cover install/upgrade/uninstall in `reconcile.test.ts`, correct stale untrack comments, sync this repo's `.gitignore`, and regenerate plugin bundles.

**Out of scope:** Untracking already-committed dependencies; removing the dead `untrackIgnoredFiles` helper (separate change).

**Done when:** A fresh install ignores `node_modules/`; upgrade adds it to an older block; uninstall removes it while keeping any customer-owned `node_modules/` rule before the block or after an older one; PR ArcadeAI/safeword#7516 CI is green.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-15T01:36:37.368Z Started: Created ticket QENH3V
- 2026-11-15T02:36:00Z Found: Fix and tests landed on branch `claude/gitignore-node-modules-817d56` (ab558d464..1406434a1) before this ticket existed; ticket created to carry readiness evidence for PR ArcadeAI/safeword#7516.
- 2026-11-15T02:36:00Z Complete: Verify, audit, refactor and cross-agent quality review recorded in verify.md; CI green on 1406434a1. Closed at user's direction to admin-merge.
- 2026-11-15T02:36:36.940Z Phase: intake → done
