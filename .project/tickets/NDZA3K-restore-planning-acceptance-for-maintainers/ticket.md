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

- 2026-10-07 Main integration: merged the updated guide base `c60ac8bd574bff8ebaa4f9ebd5695fe452c0d6c5`, which includes main `485d8ac773af44e73dbcd8c2ea64f08e5fee5154`. No production-source conflicts. Regenerated all five surfaces, preserved lifecycle result behavior, removed only the duplicate identical source-map-js override introduced by the merge and restored the base's generated architecture document to avoid incidental slice drift. Frozen install and typecheck pass. Four targeted root features pass: 145 scenarios, 6769 steps, both hooks, 8.84s (`/tmp/4200-acceptance-main-145.log`). No undefined sibling scenario receives a placeholder.

- 2026-10-07 Fresh complete repair review: external Claude `c1e91826-6e2b-4a7e-bded-38aef0c0fd0c` approves the current repair after main integration, with no blocking findings (`/tmp/4200-acceptance-main-quality.json`). Answered nonblocking limitations: these migrated scenarios exercise the Implementation-to-Execution handoff; implement-entry denial has separate lower-level coverage and is not claimed as proof from this packet. The justified-jump fixture bypasses intermediate phases deliberately; the normal-path execution-plan comment must not be read as proving that path has an execution receipt. Spike wording checks prove documentation contracts only, not runtime enforcement. No production gate or test changes made to expand this repair. Full guide-base suite had 10929 passes, one fixture-staging Git failure before assertion and 14 skips; the unchanged failed file then passed all 12 tests. That full failed result remains recorded rather than replaced by this targeted run. The historical six acceptance failures and 585 undefined scenarios remain unfinished epic evidence, not hidden by the 145 passes.

- 2026-09-26T02:21:23.148Z Started: Created ticket NDZA3K

## Root Cause

The approved workflow adds `plan-execution`, but older acceptance fixtures
omit it from justified skips or jump directly to implementation. The hook
correctly rejects those jumps. Other assertions require superseded wording or
the second design-document lane replaced by the approved single-plan design.

A broad `an Implementation Plan has (.+)` step also claims an unfinished
review scenario outside its two supported states, misreporting missing steps
as an `unknown receipt presentation` assertion. Narrowing it preserves the
missing scenario instead of inventing a passing fixture. The stop fixture also
disables terminal handoff correction because it supplies planning state rather
than a final reply; that separate check otherwise masks the planning verdict.

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
- Independent Claude reviews `afdca9a3-3ded-41a5-8602-dfb6381044d3`, `206f8536-ce9b-44ac-9747-ef1ab617040a`, `4d041573-451e-4097-84ec-22a0b5bf70d3`, `203bc4b8-6522-4a95-907e-ddd02cd25156`, and `f7c3d0a6-d82e-4873-b8bf-60cf112b4aa0` requested changes. Fixed incomplete phase lists, a permissive stop assertion, ADR scaffold coverage, the stale documentation-task ownership claim, and weak denial/guide assertions. Exact missing-phase extraction rejects a mutation that omits a phase even when recovery advice lists it. Changed guide checks bind the instruction itself rather than unrelated keywords. The current review found no blocking code defect and requested an evidence correction, now applied. This ticket remains in progress pending final verification.
- Full configured acceptance lane: 2372 scenarios (1778 passed, 3 skipped, 585 undefined, 6 failed); 110463 steps (108693 passed, 5 skipped, 1759 undefined, 6 failed). Failures are four automatic-Claude-migration scenarios, one contract-drift scenario, and one native-plugin generation scenario. These are outside this fixture repair; the full lane is not green.

### Current-head targeted verification — 2026-10-06

At production head `1be2b18c6`, the four targeted root feature files passed again:
145 scenarios, 6,769 steps, and both hooks, with no scenario filtering beyond the
recorded standard lane tags. Log: `/tmp/4200-acceptance-current-145.log`.
Fresh independent Claude review `53d24c24-e41d-4330-b0de-cf3c616063e0` approved
the canonical changed acceptance files, helper, planning test definitions, hook
template, and package declaration. Its guidance-only spike checks, missing-section
wording, and purpose-placeholder assertions carry nonblocking warnings. Generated
carriers were not additional semantic review targets. This closes the stale scoped
review gap; it does not supersede the historical full-lane six failures and 585
undefined scenarios, or establish epic completion. No promotion or merge occurred.
