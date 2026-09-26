---
id: NDZA3K
slug: restore-planning-acceptance-for-maintainers
type: task
phase: intake
status: in_progress
subtype: bug-investigated
parent: 82T411
scope: Repair existing acceptance fixtures and guide assertions for the approved two-phase workflow.
out_of_scope: Production gate changes, placeholder steps, hidden scenarios, and unfinished sibling implementations.
done_when: Affected acceptance files, independent review, and final package checks pass without hiding missing coverage.
created: 2026-09-26T02:21:23.148Z
last_modified: 2026-09-26T02:21:23.148Z
---

# Restore trustworthy planning acceptance for maintainers

**Goal:** Make existing acceptance checks reflect the approved two-phase planning workflow without hiding unfinished epic scenarios.

**Why:** PR 4906 acceptance CI has 20 failures from obsolete transition fixtures, old guide assertions, and a broad step matcher.

## Work Log

- 2026-09-26T02:21:23.148Z Started: Created ticket NDZA3K

## Root Cause

The approved workflow adds `plan-execution`, but older acceptance fixtures
omit it from justified skips or jump directly to implementation. The hook
correctly rejects those jumps. Other assertions require superseded wording or
the second design-document lane replaced by the approved single-plan design.

A broad `an Implementation Plan has (.+)` step also claims an unfinished
review scenario outside its two supported states, misreporting missing steps
as an `unknown receipt presentation` assertion. Narrowing it preserves the
missing scenario instead of inventing a passing fixture.

Confirmed by the current-head CI log and local reproduction of all three
provenance failures. Migrated fixtures and assertions make the four affected
acceptance files pass without changing production code.

Ruled out Node 24 incompatibility: both Node versions passed package tests;
only Node 24 runs acceptance. Ruled out transient CI failure: fixtures fail
locally and the denials name the missing phase. Undefined sibling scenarios
remain unfinished work, not environment failure or proof of completion.

## Verification

- Acceptance command: `NODE_OPTIONS='--import tsx' node_modules/.bin/cucumber-js features/phase-provenance.feature features/plan-implementation-phase.feature features/add-spike-workflow.feature features/architecture-state-docs.feature --tags 'not @wip and not @proof.vitest and not @manual and not @live' --format summary`. Actual runner summary:

  ```text
  2 hooks (2 passed)
  145 scenarios (145 passed)
  6769 steps (6769 passed)
  0m 11.21s (0m 10.720s executing your code)
  ```

- Discovery: configured dry-run preserves 585 undefined scenarios; discovery is not execution proof. No scenarios were skipped or supplied placeholder steps.
- CLI suite: 642 files passed; 10,566 tests passed and 13 skipped. CLI typecheck, changed Gherkin lint, formatting, and diff whitespace checks passed.
- Independent Claude reviews `afdca9a3-3ded-41a5-8602-dfb6381044d3`, `206f8536-ce9b-44ac-9747-ef1ab617040a`, `4d041573-451e-4097-84ec-22a0b5bf70d3`, `203bc4b8-6522-4a95-907e-ddd02cd25156`, and `f7c3d0a6-d82e-4873-b8bf-60cf112b4aa0` requested changes. Fixed incomplete phase lists, a permissive stop assertion, ADR scaffold coverage, the stale documentation-task ownership claim, and weak denial/guide assertions. Exact missing-phase extraction rejects a mutation that omits a phase even when recovery advice lists it. Changed guide checks bind the instruction itself rather than unrelated keywords. Final review remains pending; this ticket is not complete.
- Full configured acceptance lane: 2372 scenarios (1778 passed, 3 skipped, 585 undefined, 6 failed); 110463 steps (108693 passed, 5 skipped, 1759 undefined, 6 failed). Failures are four automatic-Claude-migration scenarios, one contract-drift scenario, and one native-plugin generation scenario. These are outside this fixture repair; the full lane is not green.
