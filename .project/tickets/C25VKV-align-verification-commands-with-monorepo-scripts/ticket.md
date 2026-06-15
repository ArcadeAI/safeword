---
id: C25VKV
slug: align-verification-commands-with-monorepo-scripts
type: task
phase: intake
status: in_progress
created: 2026-06-15T13:52:10.892Z
last_modified: 2026-06-15T13:52:44Z
---

# Align verification commands with monorepo scripts

**Goal:** Make Safeword's verify/lint command guidance use this monorepo's canonical scripts instead of root commands that produce false failures.

**Why:** `/verify` and `/lint` should report actionable project health; root `tsc --noEmit`, root `bun run build`, and `format --if-present` currently create misleading warnings or errors.

**Scope:** Update the local/template skill guidance or scripts so monorepo verification chooses `bun run lint`, `bun run --cwd packages/cli typecheck`, and `bun run --cwd packages/cli build` where appropriate, and avoids passing `--if-present` through to Prettier.

**Out of Scope:** Changing production package behavior or broad CI restructuring.

**Done When:**

- [ ] The verify flow no longer calls a missing root `build` script in this repo.
- [ ] The lint flow no longer runs root `tsc --noEmit` when the package typecheck is canonical.
- [ ] The format step no longer emits `Ignored unknown option --if-present`.
- [ ] Updated guidance is reflected in templates if the generated skills need the same behavior.

## Work Log

- 2026-06-15T13:52:10.892Z Started: Created ticket C25VKV
- 2026-06-15T13:52:44Z Intake: Audit found root `bun run build` fails with `Script not found "build"`, root `bunx tsc --noEmit` reports 38 ES2023 lib diagnostics, while canonical `bun run lint` and package `typecheck` pass.
