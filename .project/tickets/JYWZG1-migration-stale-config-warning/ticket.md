---
id: JYWZG1
slug: migration-stale-config-warning
type: feature
phase: verify
status: in_progress
epic: project-namespace-default
follows: 9MMWS7
created: 2026-06-13T03:27:01.402Z
last_modified: 2026-06-13T03:30:00.000Z
scope:
  - 'After a successful executeNamespaceMigration in `safeword upgrade`, scan a curated set of tooling-config files for the literal `.safeword-project` and print a one-shot warning listing the matching files + the old→new mapping. Edits nothing.'
  - 'Curated, extensible file set: eslint.config.{ts,mjs,cjs,js}, .eslintrc*, .prettierignore, .prettierrc*, tsconfig*.json, .github/workflows/*.{yml,yaml}, knip.{json,ts}, .dependency-cruiser.{cjs,js}, .jscpd.json. Glob-matched at the repo root (workflows one level deep).'
  - 'Exclusions: the moved namespace dir (.project/) and safeword-owned .safeword/ are never scanned. Within .prettierignore, lines inside the `# Safeword - managed prettier exclusions` block are skipped (safeword writes both roots there by design — a false positive otherwise).'
  - 'Detection module is pure and unit-testable (scan a cwd → list of {file} hits); upgrade wiring prints the warning only when the migration actually moved (plan was offer + consent given).'
out_of_scope:
  - 'Auto-rewriting any customer file — /figure-it-out ruled this out (routine upgrade ≠ codemod consent; blind replace corrupts the intentional both-roots .prettierignore block).'
  - 'Scanning arbitrary repo files / a blanket grep — 159 documentary refs (tickets, learnings) legitimately keep the old path; only functional tooling configs are in scope.'
  - 'A persistent `safeword check` advisory for stale refs — the both-dirs advisory (9MMWS7) already covers the persistent-state case; this is the one-shot in-context complement at the move.'
  - 'Detecting stale refs from any namespace other than the legacy `.safeword-project` (e.g. a custom paths.projectRoot rename) — migration only ever moves legacy → .project/.'
done_when:
  - 'After a real migration that moves the dir, a tooling config still referencing .safeword-project/ is named in the upgrade output with the old→new mapping; nothing is edited.'
  - 'A config with no stale ref, and the safeword-managed both-roots .prettierignore block, produce no warning (no false positive).'
  - 'Documentary refs under .project/ (e.g. a ticket mentioning .safeword-project) never trigger the warning.'
  - 'When migration does not move (declined, both-dirs, custom-root, current install), no stale-config warning is printed.'
  - 'Full suite green on a fresh build.'
---

# Warn on stale tooling-config namespace refs after migration

**Goal:** After `safeword upgrade --migrate-namespace` moves a repo to `.project/`, surface (don't silently break, don't silently edit) any customer-owned tooling config still pointing at `.safeword-project/`, so the developer fixes their lint/CI in the same review where they commit the move. Follow-up to epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md) / 9MMWS7, found during the v0.46.0 dogfood (this repo's own `eslint.config.ts` broke post-migration).

**See:** [spec.md](./spec.md) for personas, JTBDs, and outcomes.

## Work Log

- 2026-06-13T03:55:00.000Z Implement: 14/14 scenarios green (9 scanner unit + 5 upgrade integration). New stale-config-scan util + warnStaleToolingConfigs wiring on the successful-move path. Phase → verify.

- 2026-06-13T03:40:00.000Z Complete: scenario-gate — review 1 FAIL (AC4 silent pair had no fired counterpart; fixed + 4 strengthens), review 2 PASS (0 must-fix; no-move Scenario Outline added over 4 classes). 14 scenarios. Stamped. impl-plan.md written. Phase → implement.

- 2026-06-13T03:27:01.402Z Started: Created ticket JYWZG1
- 2026-06-13T03:30:00.000Z Intake: decision pre-made via /figure-it-out (detect-and-warn, never auto-edit; curated tooling-config set; skip the managed prettierignore block). Scope locked. Phase → define-behavior.
