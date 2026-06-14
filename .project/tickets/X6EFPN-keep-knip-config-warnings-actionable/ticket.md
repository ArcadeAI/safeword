---
id: X6EFPN
slug: keep-knip-config-warnings-actionable
type: patch
phase: intake
status: in_progress
created: 2026-06-14T11:51:36.330Z
last_modified: 2026-06-14T12:00:00.000Z
scope:
  - Remove the stale `.safeword-project/**` entry from the root `knip.json` ignore list if Knip still reports it as a configuration hint.
  - Preserve intentional ignores for installed/generated safeword assets that still exist.
  - Re-run `bunx knip` and confirm the `.safeword-project/** Remove from ignore` configuration hint is gone.
out_of_scope:
  - Fixing lazy-loaded stack-specific ESLint plugin false positives; `eslint-plugins-as-peer-deps (7JDZFF)` owns that.
  - Fixing hook-template export false positives, unresolved `.safeword/hooks` test imports, or unlisted integration-test binaries.
  - Reworking package-level `packages/cli/knip.json`.
done_when:
  - Root `knip.json` no longer contains a stale ignore for a directory absent from this repo.
  - Knip no longer emits the `.safeword-project/**` configuration hint.
  - Any remaining Knip findings are unchanged baseline noise or separately ticketed.
---

# Keep Knip config warnings actionable

**Goal:** Remove stale root Knip configuration so future audit runs do not train maintainers to ignore configuration hints.

**Why:** Knip's stale-ignore hint is cheap to fix and distinct from the larger known false-positive set. Clearing it keeps the audit signal honest without pulling in the broader peer-dependency migration.

## Work Log

- 2026-06-14T11:51:36.330Z Started: Created ticket X6EFPN
- 2026-06-14T12:00:00.000Z Intake: Force-ranked as P3 because it is low-risk audit hygiene. Explicitly excluded the larger Knip dependency/export baseline.
