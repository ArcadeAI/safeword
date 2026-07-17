@wip
Feature: PR review runner — the mechanized gates

  The reviewer's JUDGMENT is prompt (G5337S) and is proven by eval, not Gherkin —
  you cannot Gherkin a prompt. What IS mechanically testable is the runner around
  it (36EEMY): which tree it reads, what it refuses to post, and what it never
  says twice. These scenarios cover exactly that surface.

  Two of these Rules exist because the corresponding PROSE rule already failed in
  a live trial. PRINCIPLES §1: instructions are the weakest enforcement tier.

  Rule: autonomous-pr-review.TB1.R12 — a finding that reproduces on the base branch is not this PR's feedback

    Mechanizes the on-topic gate. The prose version failed once: a true, verified
    goroutine leak was posted on a PR that merely touched the file, and the
    maintainer called it noise. base+head turns the judgment into a check.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R12.latent_finding_is_withheld_from_the_pull_request
      Given a pull request whose diff does not modify the authorization module
      And a defect in that module that is present on the base branch
      When the reviewer evaluates the defect against the base branch
      Then the defect is absent from the pull request's review comments

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R12.change_caused_finding_is_posted_inline
      Given a pull request that introduces a retry helper with no connection timeout
      And the helper does not exist on the base branch
      When the reviewer evaluates the finding against the base branch
      Then the finding is posted as an inline comment on the changed line

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R12.a_latent_finding_never_reaches_the_verdict
      Given a pull request whose only finding reproduces on the base branch
      When the reviewer decides the verdict
      Then the verdict is safe-to-merge

  Rule: autonomous-pr-review.TB1.R13 — a suggested fix is not posted unless it has been run against the tests it could break

    Mechanizes the fix gate. It exists because a true finding shipped with a patch
    that would have made a failure counter unable to increment and turned a shipped
    test red. Only fires when a finding carries a patch, so the cost is bounded.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R13.a_fix_that_breaks_a_shipped_test_is_withheld
      Given a finding whose suggested fix causes an existing test to fail
      When the reviewer runs that test against the suggested fix
      Then the finding is posted without a suggested fix
      And the finding states that no validated fix is offered

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R13.a_verified_fix_is_posted_with_the_finding
      Given a finding whose suggested fix leaves every affected test passing
      When the reviewer runs those tests against the suggested fix
      Then the finding is posted with the suggested fix

  Rule: autonomous-pr-review.TB1.R1 — a concern the project's own tooling already reports is never surfaced

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R1.a_concern_already_raised_by_another_reviewer_is_not_repeated
      Given a pull request carrying a review comment from an existing code-review bot
      When the reviewer would report the same concern
      Then that concern is absent from the reviewer's comments

  Rule: autonomous-pr-review.TB1.R2 — a pull request with nothing worth saying receives no comment at all

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R2.a_clean_pull_request_receives_nothing
      Given a pull request the reviewer finds nothing to report on
      When the reviewer finishes
      Then no comment is posted on the pull request

  Rule: autonomous-pr-review.TB1.R6 — the reviewer uses whatever declared intent the project exposes

    The linked issue is rendered into the pull request by the tracker's own bot, so
    the intent is reachable through the code host alone — no tracker credentials.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R6.intent_is_read_from_the_tracker_linkback_without_tracker_credentials
      Given a pull request carrying a tracker linkback comment containing the issue body
      And no tracker credentials are configured
      When the reviewer resolves the declared intent
      Then the reviewer reads the issue body from the linkback comment

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R7.a_ticket_shared_by_several_pull_requests_caps_completeness_at_a_question
      Given a pull request whose ticket is referenced by more than one pull request
      And the diff does not implement every item the ticket names
      When the reviewer reports the unimplemented items
      Then the report is a question
      And the report does not block

  Rule: autonomous-pr-review.TB1.R16 — a change to a sensitive surface is never verdicted safe-to-merge on size alone

    Measured: <100-line PRs get a human comment 18% of the time vs 62% for 500+,
    and 11 of 14 small PRs touching auth or infra got zero human comments.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R16.a_small_change_to_a_sensitive_surface_is_reviewed_at_full_depth
      Given a pull request of fewer than one hundred changed lines
      And the diff modifies an authorization control
      When the reviewer sets its review depth
      Then the reviewer evaluates the change on every dimension

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R17.an_unanswered_author_request_for_review_reaches_a_human
      Given a pull request whose description asks a reviewer to check a specific decision
      And no existing comment answers that request
      When the reviewer decides the verdict
      Then the verdict is needs-a-human
      And the verdict names the author's unanswered request

  Rule: autonomous-pr-review.TB1.R11 — the reviewer runs on a different vendor than the agent that wrote the code

    Claude reviewing Claude shares a training lineage and therefore its blind
    spots. Default: assume the author was Claude and review with Codex — that
    fails toward cross-vendor when detection is uncertain.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R11.an_undetectable_author_defaults_to_the_other_vendor
      Given a pull request whose authoring agent cannot be identified
      When the reviewer chooses which vendor reviews it
      Then the reviewer runs on a vendor other than the one assumed by default

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R11.a_review_that_cannot_establish_independence_says_so
      Given a project configured to review with the same vendor that authored the code
      When the review is produced
      Then the review declares that it is not cross-vendor

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R11.an_author_from_the_reviewing_vendor_flips_the_reviewer
      Given a pull request whose authoring agent is identified as the reviewing vendor
      When the reviewer chooses which vendor reviews it
      Then the reviewer runs on the other vendor

  Rule: autonomous-pr-review.TB1.R14 — when a finding exists, a second vendor tries to refute it before anyone sees it

    Author -> adversary, never a vote: the popularity trap is already rejected by
    ADR. The adversary only runs when findings exist, so the cost is bounded.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R14.a_finding_the_second_vendor_refutes_is_not_posted
      Given a finding produced by the first vendor
      And the second vendor refutes that finding
      When the review is produced
      Then the finding is absent from the review

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R14.a_finding_that_survives_refutation_is_posted
      Given a finding produced by the first vendor
      And the second vendor cannot refute that finding
      When the review is produced
      Then the finding is posted

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R14.a_review_with_no_findings_never_pays_for_a_second_vendor
      Given a pull request the first vendor finds nothing to report on
      When the review is produced
      Then the second vendor is not invoked

  Rule: autonomous-pr-review.SM1.R3 — the reviewer never executes fork-PR code while holding a write token or secrets

    Refined 2026-07-17 (/figure-it-out, GitHub Security Lab "pwn requests"). The
    pwn-request threat is EXECUTION of untrusted code with secrets present — not
    reading it. Reading the diff as data and sending it to the model is safe in a
    privileged job; running the fork's code is not. So the reviewer may read and
    post; the executing gates (R13 fix-run, R12 base-repro) must degrade on a
    fork or run in an unprivileged sidecar. The tripwire is EXECUTION, worded so
    any new run-fork-code step is visibly in violation.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.SM1.R3.a_fork_pull_request_is_reviewed_without_executing_its_code
      Given a pull request opened from a fork
      When the reviewer produces its review while holding a token that can post
      Then the reviewer does not execute any code from the fork

    @surface.safeword-cli
    Scenario: autonomous-pr-review.SM1.R3.the_fix_gate_degrades_on_a_fork_rather_than_running_fork_code
      Given a fork pull request whose finding carries a suggested fix
      And running the affected tests would execute the fork's code
      When the reviewer decides whether to validate the fix
      Then the reviewer posts the finding without a validated fix
      And the finding states the fix was not run

    @surface.safeword-cli
    Scenario: autonomous-pr-review.SM1.R3.instructions_inside_a_diff_do_not_direct_the_reviewer
      Given a pull request whose diff contains text addressed to the reviewer
      When the reviewer reads the diff
      Then the reviewer reports the text as content
      And the reviewer does not follow the text as an instruction

  Rule: autonomous-pr-review.SM1.R2 — a maintainer can turn the reviewer off without deleting it

    @surface.safeword-cli
    Scenario: autonomous-pr-review.SM1.R2.a_disabled_reviewer_posts_nothing_and_stays_installed
      Given a project whose configuration disables the reviewer
      When a pull request is opened
      Then no review is posted
      And the reviewer's workflow remains installed
