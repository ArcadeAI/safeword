# Test Definitions: Eng review on green PRs with verifiable provenance

Feature source: `packages/cli/features/eng-review-green-prs.feature`

`test-definitions.md` is the R/G/R ledger for this ticket. The executable
Given/When/Then scenarios live in the feature source above; this file tracks
only RED/GREEN/REFACTOR progress so hooks can derive the active step.

Behavioral dimensions and partitioning rationale: `./dimensions.md`.

Deferred — not deterministic scenarios:

- `eval: golden-set @ implement` — TB1.AC1 (context actually improves the
  review) and NTB1.AC1 quality (prose genuinely plain). Covered by a curated
  golden set + rubric/LLM-judge; effective-FP rate (TB2.AC3) is the online
  metric. NTB1.AC1's structural half (next-action present) is scenario'd.
- `skip: architectural constraint` — SM1.AC3 (verification path has no LLM
  dependency — a pure function over flag+receipt+sha; the C-rule gate scenarios
  exercise it deterministically) and SM1.AC4 (skill/schema/receipt factored as a
  shared core so Phase B reuses them). Validated by audit, not runtime scenarios.

## Rule: A review result must be well-formed to be recorded

### Scenario: eng-review-green-prs.TB1.AC3.valid_result_accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB1.AC3.invalid_verdict_value_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB1.AC3.invalid_severity_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB1.AC2.finding_without_location_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB1.AC2.finding_without_failure_mode_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.NTB1.AC1.blocking_verdict_without_next_action_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB1.AC3.unparseable_review_result_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Approval is bound to the exact commit reviewed

### Scenario: eng-review-green-prs.TB3.AC1.approval_binds_to_reviewed_commit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB3.AC2.new_commit_voids_prior_approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A deliberate skip is an audited break-glass bypass, not an approval

### Scenario: eng-review-green-prs.TB3.AC3.skip_permits_merge_under_enabled_gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB3.AC3.skip_is_recorded_distinct_from_approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB3.AC3.skip_with_empty_reason_rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The merge gate is opt-in and blocks only on blockers

### Scenario: eng-review-green-prs.SM1.AC1.gate_off_never_blocks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.SM1.AC2.gate_on_without_approval_blocks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.SM1.AC2.gate_on_with_fresh_approval_permits

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB2.AC1.advisory_only_findings_do_not_block

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB2.AC1.blocker_finding_blocks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Review independence is enforced when required

### Scenario: eng-review-green-prs.NTB1.AC2.same_model_review_rejected_when_enabled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.NTB1.AC2.different_model_review_accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.NTB1.AC2.same_model_accepted_when_disabled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Finding usefulness is measurable

### Scenario: eng-review-green-prs.TB2.AC3.finding_disposition_is_recorded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB2.AC3.effective_fp_rate_is_computed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Review thoroughness scales to change risk

### Scenario: eng-review-green-prs.TB2.AC2.small_low_risk_diff_gets_lightweight_review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB2.AC2.large_diff_gets_thorough_review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: eng-review-green-prs.TB2.AC2.sensitive_path_escalates_regardless_of_size

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at implement-exit (the whole-ticket quality-review + refactor pass):
either `<sha>` (the refactor commit) or `skip: <non-empty reason>`.

- [ ] cross-scenario
