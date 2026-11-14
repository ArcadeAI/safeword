---
id: 530XE8
slug: prove-retro-failure-retries
type: task
phase: done
status: done
created: 2026-10-18T00:15:40.801Z
last_modified: 2026-10-18T01:15:00.000Z
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
- 2026-10-18 Verification completed: corrected empty-spool fixture representation;
  149 focused cases, 2,194 smoke cases, builds, types and acceptance pass. The
  aggregate run's original failure and eight baseline audit advisories remain
  disclosed in verify.md. All six cases reject the semantic success/failure
  mutation; restored production source is byte-identical. Extracted the fake
  Codex installer in a separate scoped refactor; 149 cases pass afterward.
  Final independent quality review and verification stamp remain pending.
- 2026-10-18 Final code review 9a48145c-0f33-469c-9f2a-69b2727239bd approved
  with no errors; remaining suggestions are answered in review-notes.md. Fresh
  real default extraction passes empty and planted examples without filing.
  Merged current main and regenerated its six conflicting generated artifacts;
  combined-tree checks pass 149 focused and 2,201 smoke tests, lint/types and
  parity. Final verification artifact review and authenticated stamp are next.
- 2026-10-18 Completed local assurance: final verification-artifact review
  55e705e6-5fae-4809-8e6a-6bd08f7b50be approved with no errors; its authentic
  verify-phase stamp succeeded before phase/status closure. Remaining notes are
  bounded: the new six cases were added after the first 673-file CLI collection
  and first executed in the second 674-file collection; there is no claimed
  pass-then-fail order dependence. Post-sync focused/smoke wrappers rebuild the
  CLI and declarations; root lint runs CLI tsc. Website/Astro/Python results
  remain the earlier baseline, while final hosted CI gates merging. The four
  retained choices include test assertions and required mirrors as well as
  production policy/resolution; only the local fixture helper was extracted.
  An additional offset-guard mutation remains optional and unexecuted.
  Fresh real Stop -> source CLI -> installed Codex also passes with no fake
  executable: empty findings commit offset 1079/toolUses 8/fires 1 exactly once,
  unchanged Stop performs no further extraction, and no draft is created.
  Result: .project/tmp/current-main-real-stop-result.json. No filing, release,
  plugin-cache upgrade, merge-policy exception or admin merge occurred.

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
