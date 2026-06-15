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
  - Remove stale `eslint-plugin-jsdoc` from the root `knip.json` `ignoreDependencies` list now that it is a package dependency rather than a root false positive.
  - Ignore shipped Cucumber template assets via root `ignoreFiles` so Knip reports code reachability rather than packaged scaffolds.
  - Exempt `cucumber.mjs` from generated dependency-cruiser orphan checks because Cucumber discovers it as runner configuration rather than importing it.
  - Preserve intentional ignores for installed/generated safeword assets that still exist.
  - Re-run `bunx knip` and dependency-cruiser and confirm the stale configuration hints plus `packages/cli/cucumber.mjs` orphan warning are gone.
out_of_scope:
  - Fixing lazy-loaded stack-specific ESLint plugin false positives; `eslint-plugins-as-peer-deps (7JDZFF)` owns that.
  - Fixing hook-template export false positives, unresolved `.safeword/hooks` test imports, or unlisted integration-test binaries.
  - Reworking package-level `packages/cli/knip.json`.
done_when:
  - Root `knip.json` no longer contains a stale ignore for a directory absent from this repo.
  - Knip no longer emits stale configuration hints for `.safeword-project/**` or `eslint-plugin-jsdoc`.
  - Knip no longer reports shipped Cucumber templates as unused files.
  - Dependency-cruiser no longer reports `packages/cli/cucumber.mjs` as an orphan.
  - Any remaining Knip findings are unchanged baseline noise or separately ticketed.
---

# Keep Knip config warnings actionable

**Goal:** Remove stale root Knip configuration so future audit runs do not train maintainers to ignore configuration hints.

**Why:** Knip's stale-ignore hint is cheap to fix and distinct from the larger known false-positive set. Clearing it keeps the audit signal honest without pulling in the broader peer-dependency migration.

## Work Log

- 2026-06-14T11:51:36.330Z Started: Created ticket X6EFPN
- 2026-06-14T12:00:00.000Z Intake: Force-ranked as P3 because it is low-risk audit hygiene. Explicitly excluded the larger Knip dependency/export baseline.
- 2026-06-14T15:15:00Z Revalidated: Current Knip docs point stale config cleanup to `ignoreFiles` / config-hint hygiene; dependency-cruiser docs treat orphaned config entrypoints as intentional config exclusions. Expanded scope to cover stale `eslint-plugin-jsdoc`, Cucumber template assets, and `cucumber.mjs` orphan noise while keeping lazy ESLint plugin dependency modeling out of scope.
