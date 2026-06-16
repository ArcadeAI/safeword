---
id: BKTTZA
slug: test-plan-resolver
type: feature
phase: verify
status: in_progress
parent: Q4FX8Y
created: 2026-06-16T15:46:47.000Z
last_modified: 2026-06-16T15:46:47.000Z
scope:
  - Pure resolver `resolveTestPlan(root, { kind, isToolAvailable })` → `PlanEntry[]` (language, cwd, command, runner, available)
  - Detects ALL languages present (polyglot, no first-match); reuses `findInTree`/`SUBDIRECTORY_EXCLUDE` for nested manifests
  - Per-language runner detection — Python pytest/tox/unittest (PM-aware), Rust nextest/cargo --workspace, Go go.work-aware, JS the project's own script (PM-aware)
  - `--kind test|build`; missing toolchain → entry flagged `available:false`, never dropped
  - Exposed as `safeword test-plan [--kind test|build] [--json]`; unit-tested with injected availability + temp fixtures
out_of_scope:
  - Wiring test-runner.ts / verify / audit onto the plan (that is 5FF0ZD)
  - Executing the commands (`--run`) — plan-only; callers execute
  - JS acceptance lane `test:bdd` (already wired in consumers; not the resolver's primary-suite job v1)
  - PM-recursive JS fallback for workspaces with no root `test` script (fast-follow); cross-language `test:done` fast-subset (fast-follow)
done_when:
  - `safeword test-plan --kind test --json` on a polyglot fixture lists an entry for every detected language
  - Each language's command reflects the detected runner; absent toolchains show `available:false`
  - Nested (sub-dir) manifests are discovered; no first-match drops a language
  - Resolver unit tests pass; tsc + lint clean
---

# safeword test-plan: one resolver that emits correct multi-language test/build plans

**Goal:** A single pure resolver, exposed as `safeword test-plan`, that emits the correct test/build commands for **every** language present in a repo — so consumers (5FF0ZD) can stop duplicating language logic and a polyglot done-gate can't go green with a language untested.

**See:** epic [Q4FX8Y](../Q4FX8Y-extract-shared-test-runner/ticket.md) for the full design, decisions, and revalidation notes. [spec.md](./spec.md) for JTBD/AC.

## Work Log

- 2026-06-16T15:46:47.000Z Started: Created ticket BKTTZA
- 2026-06-16 Intake: inherited epic scope (split confirmed); scope/out-of-scope/done-when set. → define-behavior.
- 2026-06-16 Implemented (outside-in TDD): `src/test-plan/resolve.ts` + `safeword test-plan [dir] --kind --json` CLI, reusing `findInTree`/`detectPackageManager`. 18/18 scenarios green (vitest resolver+CLI + cucumber acceptance lane), tsc + eslint clean, full bdd lane 49/49. Added `SAFEWORD_FAKE_TOOLS` test seam for deterministic acceptance. Awaiting verify phase (/verify + /audit).
