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

- Acceptance: 145 scenarios and 6,768 steps passed across the four affected feature files.
- Discovery: configured dry-run preserves 585 undefined scenarios; discovery is not execution proof. No scenarios were skipped or supplied placeholder steps.
- CLI suite: 642 files passed; 10,566 tests passed and 13 skipped. CLI typecheck, changed Gherkin lint, formatting, and diff whitespace checks passed.
- Independent Claude reviews `afdca9a3-3ded-41a5-8602-dfb6381044d3` and `206f8536-ce9b-44ac-9747-ef1ab617040a` requested changes. Fixed incomplete phase lists, a permissive stop assertion, ADR scaffold coverage, and the stale documentation-task ownership claim. Final review and latest acceptance rerun remain pending; this ticket is not complete.
