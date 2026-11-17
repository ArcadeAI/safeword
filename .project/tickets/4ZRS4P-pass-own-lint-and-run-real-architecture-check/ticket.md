---
id: 4ZRS4P
slug: pass-own-lint-and-run-real-architecture-check
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/6966
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/7662
scope:
  - Install adds a typescript-eslint-compatible typescript and a strict no-emit tsconfig.json for the TypeScript BDD lane, unless typescript is declared or resolvable
  - Generated eslint.config.mjs and cucumber.mjs pass the preset Safeword installs
  - Under ESLint 10, `eslint .` never lints vendored .safeword files, while the hook's --config run still lints project files
  - The preset allows cucumber's import-time registration in step files
  - The audit's architecture check runs only the project-local dependency-cruiser, and reports not-installed, crashed, and zero-module runs as manual evidence (#7514)
out_of_scope:
  - Upgrade preview omitting refreshed managed files (#7676)
  - Cucumber line selectors in cucumber.mjs (#7687)
  - Legacy .eslintrc hook config dropping project rules (proposed follow-up)
  - Bumping a project's own typescript or supporting TypeScript 7 before typescript-eslint does
done_when:
  - A fresh TypeScript install with Cursor delivery passes `eslint .`, `tsc --noEmit`, and the BDD lane, and a JS-only install gets typescript with no findings in Safeword's files (integration tests)
  - A second identical install reports no change
  - The audit never resolves the npm depcruise placeholder, and reports a missing, crashing, or zero-module dependency-cruiser loudly (audit tests)
  - Cross-agent quality review has no open in-scope errors and CI is green
created: 2026-11-17T07:46:44.107Z
last_modified: 2026-11-17T07:46:44.107Z
---

# Make fresh installs pass their own lint and run the audit's real architecture check

**Goal:** A fresh install passes eslint, tsc and its BDD lane, and /audit runs the project's dependency-cruiser or says loudly that it didn't

**Why:** Fresh installs failed their own lint (#6966) and the audit's architecture check silently ran npm's depcruise placeholder (#7514)

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T07:46:44.107Z Started: Created ticket 4ZRS4P — retroactively. The work below was done before the ticket existed (process deviation: no classify/ticket step at the start).
- 2026-11-15 Found: reproduced #6966 in a fresh TS install — 16 lint errors (steps/*.ts parse errors without a compiler, generated eslint.config.mjs `deps` naming and object-injection, cucumber.mjs missing JSDoc, .safeword/eslint.config.mjs linting itself under ESLint 10 nearest-config lookup).
- 2026-11-15 Complete (TDD, RED first): audit runs only node_modules/.bin/depcruise, with loud missing/crash/zero-module evidence — a511c1799. Real depcruise output strings were checked before matching on them.
- 2026-11-16 Complete: install scaffold fix — 556a5f6d7. Deviation: implemented before writing tests (not RED-first); unit and integration tests followed in the same change.
- 2026-11-17 Found (tdd-review): no automated end-to-end proof. Added whole-install lint/tsc tests, which exposed Cursor's .safeword/hooks still linted under ESLint 10 → absolute-basePath self-ignore, gated to ESLint 10 — 84fb8c5f6.
- 2026-11-17 Found (audit): the new test in presets imported CLI templates → moved to tests/ — df50de078.
- 2026-11-17 Found (CI): second install not converging — a run-dependent directive in .safeword/eslint.config.mjs. Removed it and pinned run-independence — 66b29c4cb.
- 2026-11-17 Found (cross-agent review): ignore test only matched text → real ESLint 10 runs in both modes, shown to fail without the ignore — 2050d2895; TS end-to-end suite skipped installs → real installs — 9ac375039. Three pre-existing bugs routed out of scope (#7676, #7687, legacy .eslintrc follow-up).
- 2026-11-17 Complete: CI 15/15 green at 9ac375039; readiness evidence recorded in PR #7662.
- 2026-11-17T07:47:58.955Z Phase: intake → implement
- 2026-11-17T07:55:07.903Z Phase: implement → verify
