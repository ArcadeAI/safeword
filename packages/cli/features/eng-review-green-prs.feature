@eng-review-green-prs @wip
Feature: Eng review on green PRs with verifiable provenance

  A diff-focused engineering review runs on a green PR before merge. It emits a
  structured verdict, binds an approval to the exact commit reviewed, and gates
  the merge only on real blockers. These scenarios pin the deterministic
  contract; judgment quality (insightful findings, plain prose) is covered by a
  golden-set eval deferred to implement, not here.

  Rule: A review result must be well-formed to be recorded

    @eng-review-green-prs.TB1.AC3
    Scenario: eng-review-green-prs.TB1.AC3.valid_result_accepted
      Given a review result with verdict "APPROVE" and a finding located at "src/x.ts:42" describing "unbounded retry loop" at severity "should-fix"
      When the result is validated
      Then the result is accepted

    @eng-review-green-prs.TB1.AC3
    Scenario: eng-review-green-prs.TB1.AC3.invalid_verdict_value_rejected
      Given a review result with verdict "LGTM"
      When the result is validated
      Then the result is rejected naming the allowed verdicts APPROVE, REQUEST-CHANGES, and NEEDS-DISCUSSION

    @eng-review-green-prs.TB1.AC3
    Scenario: eng-review-green-prs.TB1.AC3.invalid_severity_rejected
      Given a review result with a finding at severity "meh"
      When the result is validated
      Then the result is rejected naming the allowed severities blocker, should-fix, and nit

    @eng-review-green-prs.TB1.AC2
    Scenario: eng-review-green-prs.TB1.AC2.finding_without_location_rejected
      Given a review result with a finding that has no file and line
      When the result is validated
      Then the result is rejected identifying the finding that is missing a location

    @eng-review-green-prs.TB1.AC2
    Scenario: eng-review-green-prs.TB1.AC2.finding_without_failure_mode_rejected
      Given a review result with a finding located at "src/x.ts:42" whose failure-mode description is empty
      When the result is validated
      Then the result is rejected because a finding must name a concrete failure mode

    @eng-review-green-prs.NTB1.AC1
    Scenario: eng-review-green-prs.NTB1.AC1.blocking_verdict_without_next_action_rejected
      Given a review result with verdict "REQUEST-CHANGES" and an empty next action
      When the result is validated
      Then the result is rejected because a non-approving verdict must state a next action

  Rule: Approval is bound to the exact commit reviewed

    @eng-review-green-prs.TB3.AC1
    Scenario: eng-review-green-prs.TB3.AC1.approval_binds_to_reviewed_commit
      Given an APPROVE result recorded for pull request 7 at head commit "C1"
      When the merge gate is checked for pull request 7 at head commit "C1"
      Then a valid approval is found

    @eng-review-green-prs.TB3.AC2
    Scenario: eng-review-green-prs.TB3.AC2.new_commit_voids_prior_approval
      Given an APPROVE result recorded for pull request 7 at head commit "C1"
      When a new commit "C2" is pushed and the merge gate is checked for pull request 7 at head commit "C2"
      Then no valid approval is found

    @eng-review-green-prs.TB3.AC3
    Scenario: eng-review-green-prs.TB3.AC3.skip_with_reason_is_auditable
      Given a review skipped for pull request 7 at head commit "C1" with reason "vendored bundle, not project code"
      When the review record for pull request 7 at commit "C1" is read
      Then an auditable skip is recorded carrying the reason text

  Rule: The merge gate is opt-in and blocks only on blockers

    @eng-review-green-prs.SM1.AC1
    Scenario: eng-review-green-prs.SM1.AC1.gate_off_never_blocks
      Given the PR review gate is disabled
      And no approval is recorded for pull request 7 at head commit "C1"
      When the merge gate is evaluated for pull request 7 at head commit "C1"
      Then merge is permitted

    @eng-review-green-prs.SM1.AC2
    Scenario: eng-review-green-prs.SM1.AC2.gate_on_without_approval_blocks
      Given the PR review gate is enabled
      And no fresh approval is recorded for pull request 7 at head commit "C1"
      When the merge gate is evaluated for pull request 7 at head commit "C1"
      Then merge is blocked

    @eng-review-green-prs.SM1.AC2
    Scenario: eng-review-green-prs.SM1.AC2.gate_on_with_fresh_approval_permits
      Given the PR review gate is enabled
      And an APPROVE result with no blocker findings is recorded for pull request 7 at head commit "C1"
      When the merge gate is evaluated for pull request 7 at head commit "C1"
      Then merge is permitted

    @eng-review-green-prs.TB2.AC1
    Scenario: eng-review-green-prs.TB2.AC1.advisory_only_findings_do_not_block
      Given the PR review gate is enabled
      And a fresh review for pull request 7 at head commit "C1" whose findings are all should-fix or nit
      When the merge gate is evaluated for pull request 7 at head commit "C1"
      Then merge is permitted

    @eng-review-green-prs.TB2.AC1
    Scenario: eng-review-green-prs.TB2.AC1.blocker_finding_blocks
      Given the PR review gate is enabled
      And a fresh review for pull request 7 at head commit "C1" carrying at least one blocker finding
      When the merge gate is evaluated for pull request 7 at head commit "C1"
      Then merge is blocked naming the blocker finding

  Rule: Review independence is enforced when required

    @eng-review-green-prs.NTB1.AC2
    Scenario: eng-review-green-prs.NTB1.AC2.same_model_review_rejected_when_enabled
      Given cross-model review is enabled and the change was authored by model "M1"
      When a review produced by model "M1" is recorded
      Then the review is rejected as a same-model review

    @eng-review-green-prs.NTB1.AC2
    Scenario: eng-review-green-prs.NTB1.AC2.different_model_review_accepted
      Given cross-model review is enabled and the change was authored by model "M1"
      When a review produced by model "M2" is recorded
      Then the review is accepted and reviewer model "M2" is recorded

    @eng-review-green-prs.NTB1.AC2
    Scenario: eng-review-green-prs.NTB1.AC2.same_model_accepted_when_disabled
      Given cross-model review is disabled and the change was authored by model "M1"
      When a review produced by model "M1" is recorded
      Then the review is accepted

  Rule: Finding usefulness is measurable

    @eng-review-green-prs.TB2.AC3
    Scenario: eng-review-green-prs.TB2.AC3.finding_disposition_is_recorded
      Given a surfaced finding on pull request 7
      When the developer marks it acted-on
      Then the review record reflects that the finding was acted-on

    @eng-review-green-prs.TB2.AC3
    Scenario: eng-review-green-prs.TB2.AC3.effective_fp_rate_is_computed
      Given a review for pull request 7 with four surfaced findings of which one was acted-on and three were dismissed as noise
      When the effective false-positive rate is computed
      Then the rate is reported as 0.75

  Rule: Review thoroughness scales to change risk

    @eng-review-green-prs.TB2.AC2
    Scenario: eng-review-green-prs.TB2.AC2.small_low_risk_diff_gets_lightweight_review
      Given a diff of 20 changed lines touching no sensitive paths
      When the review depth is selected
      Then a lightweight review is chosen

    @eng-review-green-prs.TB2.AC2
    Scenario: eng-review-green-prs.TB2.AC2.large_diff_gets_thorough_review
      Given a diff whose changed-line count exceeds the size threshold
      When the review depth is selected
      Then a thorough review is chosen

    @eng-review-green-prs.TB2.AC2
    Scenario: eng-review-green-prs.TB2.AC2.sensitive_path_escalates_regardless_of_size
      Given a diff of 5 changed lines that touches a sensitive path
      When the review depth is selected
      Then a thorough review is chosen
