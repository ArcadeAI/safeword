---
id: ECGEP9
slug: reliable-bdd-gates
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/2582
created: 2026-08-11T15:17:49.174Z
last_modified: 2026-08-11T15:56:00.000Z
---

# Keep behavior tests reliable for contributors

**Goal:** Make the executable BDD lane finish reliably and prove every no-mutation claim it advertises.

**Why:** The lane currently duplicates long acceptance work across Node versions and contains at least one claimed filesystem invariant without a matching assertion.

**Type:** Improvement

**Scope:** Repair unproved no-mutation behavior, stop duplicating the full Cucumber lane across Node matrix entries, and distinguish intentionally external proof from unfinished BDD work.

**Out of Scope:** Rewriting or splitting every large historical feature in this change; changing product behavior; weakening any required acceptance coverage.

**Done When:**

- [x] Command-override scenarios compare project and personal configuration before and after execution.
- [x] CI runs the full Cucumber acceptance lane once per commit while preserving package tests on both supported Node versions.
- [x] Features whose executable proof lives in Vitest use an explicit non-WIP proof tag and remain excluded from Cucumber.
- [x] Automated contract tests prevent these CI and tagging rules from drifting.

**Tests:**

- [x] Cucumber: command override preserves exact configuration bytes.
- [x] Vitest: CI workflow assigns Cucumber to exactly one Node matrix entry.
- [x] Vitest: the Cucumber tag expression excludes explicit external-proof features.
- [x] Existing Gherkin lint and relevant Cucumber lanes pass.

## Work Log

- 2026-08-11T15:17:49.174Z Started: Created ticket ECGEP9
- 2026-08-11T15:18:00.000Z Linked: GitHub issue #2582 and bounded the implementation scope.
- 2026-08-11T15:43:00.000Z Implemented: Added byte-for-byte configuration snapshots, assigned Cucumber to one Node matrix entry, and migrated separately proven behavior from `@wip` to `@proof.vitest` with executable proof pointers.
- 2026-08-11T15:56:00.000Z Verifying: Focused behavior/contracts, lint, typecheck, Gherkin lint, dependency audit, and Claude release contract are green; waiting for the shared Vitest slot before final rerun.
