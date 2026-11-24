---
id: ND23BX
slug: upgrade-preview-lists-refreshed-files
type: patch
phase: done
status: done
created: 2026-11-17T15:29:42.133Z
last_modified: 2026-11-17T15:29:42.133Z
---

# Show refreshed managed files in the upgrade preview users approve

**Goal:** The upgrade preview lists every managed file that upgrade will refresh

**Why:** computeUpgradePlan dropped planManagedFilesActions' updated list, so the preview under-reported rewrites (PR #7676)

## Scope

- `packages/cli/src/reconcile.ts`: `computeUpgradePlan` forwards `managedFilesResult.updated` into `wouldUpdate`; the `planManagedFilesActions` doc comment now sits on that function.
- Tests: `reconcile-managed-refresh.test.ts` (plan lists the stale file as an update, upgrade rewrites it, a current file stays out) and `pr-review/workflow-contract.test.ts` (real workflow definitions: stale ones previewed and rewritten, a customized one untouched).
- Regenerated plugin runtimes that bundle `reconcile.ts`.

## Out of scope

- Two pre-existing uninstall issues found in review (multi-patch uninstall preview; uninstall of unedited knowledge scaffolds), listed in PR #7676 as follow-ups.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T15:29:42.133Z Started: Created ticket ND23BX
- 2026-11-17T15:35:00.000Z Implemented red-first (both new tests fail without the fix line, pass with it). Two Codex quality-review passes; audit and verify evidence in verify.md. CI green on 21f5464c8. PR #7676.
- 2026-11-17T15:35:00.000Z Phase: intake → done
- 2026-11-17T15:30:49.607Z Phase: intake → done
