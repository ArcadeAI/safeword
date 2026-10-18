---
id: 530XE8
slug: prove-retro-failure-retries
type: task
phase: verify
status: in_progress
created: 2026-10-18T00:15:40.801Z
last_modified: 2026-10-18T00:15:40.801Z
scope:
  - Prove real Codex Stop and CLI extraction failures preserve retryable transcript state.
  - Separate hook-input failures from nested extractor failures in the manual BDD contract.
  - Apply diff-scoped verification, audit, refactor and independent quality-review findings.
out_of_scope:
  - Changing extraction behavior, timeout budgets, prompts, or model selection.
  - Waiving release review coverage or repository approval requirements.
done_when:
  - Nonzero, missing, malformed and schema-invalid Codex output is proved across the real hook and CLI boundary.
  - A schema-valid empty retry advances the transcript offset exactly once without filing work.
  - Current checks and independent review results, including limitations, are recorded.
---

# Preserve retryable retrospectives for Codex users

**Goal:** Prove real Stop-to-CLI extraction failures preserve retryable transcript state, and complete the requested verify, audit, refactor and quality-review passes.

**Why:** The test-quality assessment found a missing cross-process failure proof; the user requested the recommended improvements.

## Work Log

- 2026-10-18T00:15:40.801Z Started: Created ticket 530XE8
- 2026-10-18 Reviewed implementation: six real-process failure/retry cases and
  partitioned manual scenarios; independent Claude/Opus quality review
  8edb5a3c-7545-4bca-b4d5-4cff600c6d0c approved. Its authentic implement-phase
  stamp succeeded before advancing to verification. Full root lint/typecheck,
  generated surfaces and parity pass. The first full test pass is green;
  completion awaits the second prescribed pass and focused mutation proof.

## Test Definitions

Use a fresh temporary project and a symlink to the unmodified real source CLI.
Replace only the external Codex executable. For each nonzero, absent-output,
malformed-JSON and schema-invalid-output result, require silent Stop success,
real CLI failure diagnostics, no offset advancement, no draft and no filed
record. Retry the same transcript with valid empty findings and require checked
extraction success and the exact committed offset/tool count/fire count.
No network model call or issue creation belongs in this test.

Each fake Codex invocation records its failure mode and argv. Require the exact
extraction failure reason and completed CLI exit before checking state. Use a
nonempty transcript digest. After the empty retry, repeat Stop without growth:
the offset must remain identical and the fake Codex must have only two calls.
Timeout proof remains explicitly unproved manual debt; production timeout
budgets and timeout injection are outside this task.

## Plan

1. Run the prescribed local verification block and diff-scoped audit.
2. Add the missing integration proof and split the mixed manual failure outline.
3. Run focused tests and current static checks; apply the refactor scout ledger
   one change at a time only where a concrete improvement warrants it.
4. Fetch current primary sources, run the shared quality-review coordinator,
   apply or answer findings, and record final verification evidence.
