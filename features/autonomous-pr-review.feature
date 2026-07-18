@wip
Feature: PR review runner — the mechanized gates

  The reviewer's JUDGMENT is prompt (G5337S) and is proven by eval, not Gherkin —
  you cannot Gherkin a prompt. What IS mechanically testable is the runner around
  it (36EEMY): which tree it reads, what it refuses to post, and what it never
  says twice. These scenarios cover exactly that surface.

  Two of these Rules exist because the corresponding PROSE rule already failed in
  a live trial. PRINCIPLES §1: instructions are the weakest enforcement tier.

  Non-event assertions (nothing posted, not invoked) are each paired with a
  discriminating positive in the same scenario, so a do-nothing runner fails.

  @autonomous-pr-review.TB1.R12
  Rule: autonomous-pr-review.TB1.R12 — a finding that reproduces on the base branch is not this PR's feedback

    Mechanizes the on-topic gate. The prose version failed once: a true, verified
    goroutine leak was posted on a PR that merely touched the file, and the
    maintainer called it noise. base+head turns the judgment into a check.

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R12.a_latent_finding_is_dropped_while_the_change_caused_one_posts
      Given a pull request carrying two defects — one it introduced on a changed line, one already present on the base branch
      When the reviewer evaluates both defects against the base branch
      Then the change-caused defect is posted as an inline comment
      And the base-reproducing defect is absent from the review comments

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R12.change_caused_finding_is_posted_inline
      Given a pull request that introduces a retry helper with no connection timeout
      And the helper does not exist on the base branch
      When the reviewer evaluates the finding against the base branch
      Then the finding is posted as an inline comment on the changed line

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R12.a_pr_whose_only_finding_is_latent_is_verdicted_safe_to_merge
      Given a pull request whose only finding reproduces unchanged on the base branch
      And that finding would be verdicted needs-a-human if the PR had caused it
      When the reviewer decides the verdict
      Then the verdict is safe-to-merge

  @autonomous-pr-review.TB1.R13
  Rule: autonomous-pr-review.TB1.R13 — a suggested fix is not posted unless it has been run against the tests it could break

    Mechanizes the fix gate. It exists because a true finding shipped with a patch
    that would have made a failure counter unable to increment and turned a shipped
    test red. Only fires when a finding carries a patch, so the cost is bounded.

    @rejection @surface.safeword-cli
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

  @autonomous-pr-review.TB1.R1
  Rule: autonomous-pr-review.TB1.R1 — a concern the project's own tooling already reports is never surfaced

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R1.a_concern_another_reviewer_already_raised_is_dropped_but_a_fresh_one_posts
      Given a pull request carrying a code-review bot's comment on concern X
      And the reviewer's findings are stubbed to concern X and a distinct concern Y
      When the reviewer posts its review
      Then concern Y appears in the review
      And concern X is absent from the review

  @autonomous-pr-review.TB1.R2
  Rule: autonomous-pr-review.TB1.R2 — a pull request with nothing worth saying receives no comment at all

    @rejection @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.TB1.R2.silence_only_when_there_is_nothing_to_say
      Given a pull request whose findings are <finding-state>
      When the reviewer runs to completion
      Then the review comment count is <count>

      Examples:
        | finding-state                            | count |
        | all already covered by the project tests | 0     |
        | one uncovered defect on a changed line   | 1     |

  @autonomous-pr-review.TB1.R6
  Rule: autonomous-pr-review.TB1.R6 — the reviewer uses whatever declared intent the project exposes

    The linked issue is rendered into the pull request by the tracker's own bot, so
    the intent is reachable through the code host alone — no tracker credentials.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R6.intent_is_read_from_the_linkback_without_calling_the_tracker
      Given a pull request carrying a tracker linkback comment containing the issue body
      And no tracker credentials are configured
      When the reviewer resolves the declared intent
      Then the reviewer makes no request to the tracker API
      And the review cites intent drawn from the linkback comment

  @autonomous-pr-review.TB1.R7
  Rule: autonomous-pr-review.TB1.R7 — a finding never claims more certainty than the intent source it rests on supports

    @rejection @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.TB1.R7.completeness_severity_is_bound_by_ticket_to_pr_cardinality
      Given a pull request whose ticket is referenced by <pr-count>
      And the diff does not implement every item the ticket names
      When the reviewer reports the unimplemented items
      Then the report <outcome>

      Examples:
        | pr-count      | outcome                          |
        | more than one | is a question and does not block |
        | exactly one   | blocks as a completeness finding |

  @autonomous-pr-review.TB1.R11
  Rule: autonomous-pr-review.TB1.R11 — the reviewer runs on a different vendor than the agent that wrote the code

    Claude reviewing Claude shares a training lineage and therefore its blind
    spots. Default: assume the author was Claude and review with Codex — that
    fails toward cross-vendor when detection is uncertain.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R11.an_undetectable_author_defaults_to_reviewing_with_codex
      Given a pull request whose authoring agent cannot be identified
      And the default assumes an unidentified author is Claude
      When the reviewer chooses which vendor reviews it
      Then the reviewer runs on Codex

    @rejection @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.TB1.R11.the_cross_vendor_declaration_tracks_the_actual_pairing
      Given a pull request authored by <author-vendor>
      And a project configured to review with <review-vendor>
      When the review is produced
      Then the review's cross-vendor claim is <claim>

      Examples:
        | author-vendor | review-vendor | claim |
        | Claude        | Claude        | false |
        | Claude        | Codex         | true  |

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R11.an_author_from_the_reviewing_vendor_flips_the_reviewer
      Given a pull request whose authoring agent is identified as Codex
      When the reviewer chooses which vendor reviews it
      Then the reviewer runs on Claude

  @autonomous-pr-review.TB1.R14
  Rule: autonomous-pr-review.TB1.R14 — when a finding exists, a second vendor tries to refute it before anyone sees it

    Author -> adversary, never a vote: the popularity trap is already rejected by
    ADR. The adversary only runs when findings exist, so the cost is bounded. The
    second vendor's verdict is a stubbed input here — this tests the runner's
    routing, not a live model's judgment.

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.TB1.R14.a_refuted_finding_is_dropped_while_a_surviving_one_posts
      Given two findings from the first vendor
      And the second vendor is stubbed to refute the first finding and not the second
      When the review is produced
      Then the second finding is posted
      And the first finding is absent from the review

    @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.TB1.R14.the_second_vendor_runs_only_when_findings_exist
      Given the first vendor produces <first-vendor-findings>
      When the review is produced
      Then the second vendor is invoked exactly <adversary-runs> time(s)

      Examples:
        | first-vendor-findings | adversary-runs |
        | one finding           | 1              |
        | no findings           | 0              |

  @autonomous-pr-review.TB2.R1
  Rule: autonomous-pr-review.TB2.R1 — review depth is set by what the change touches, never by how many lines it has

    Measured: <100-line PRs get a human comment 18% of the time vs 62% for 500+,
    and 11 of 14 small PRs touching auth or infra got zero human comments. Small +
    sensitive is the human blind spot.

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.TB2.R1.a_small_change_to_a_sensitive_surface_is_reviewed_at_full_depth
      Given a pull request of fewer than one hundred changed lines
      And the diff modifies an authorization control
      When the reviewer produces its review
      Then the review reports an assessment for every review dimension

  @autonomous-pr-review.TB2.R2
  Rule: autonomous-pr-review.TB2.R2 — a change to a sensitive surface is never verdicted safe-to-merge on size alone

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.TB2.R2.a_tiny_auth_change_with_an_open_question_is_not_verdicted_safe_on_size
      Given a two-line pull request that modifies an authorization control
      And the reviewer holds an unresolved question about that control
      When the reviewer decides the verdict
      Then the verdict is not safe-to-merge

  @autonomous-pr-review.TB2.R3
  Rule: autonomous-pr-review.TB2.R3 — an author's unanswered request for review reaches a human

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.TB2.R3.an_unanswered_author_request_reaches_a_human
      Given a pull request whose description asks a reviewer to check a specific decision
      And no existing comment answers that request
      When the reviewer decides the verdict
      Then the verdict is needs-a-human
      And the verdict names the author's unanswered request

    @surface.safeword-cli
    Scenario: autonomous-pr-review.TB2.R3.an_answered_author_request_does_not_force_a_human
      Given a pull request whose description asks a reviewer to check a specific decision
      And an existing comment answers that request
      And the reviewer finds nothing else worth a human's attention
      When the reviewer decides the verdict
      Then the verdict is not needs-a-human

  @autonomous-pr-review.SM1.R3
  Rule: autonomous-pr-review.SM1.R3 — the reviewer never executes fork-PR code while holding a write token or secrets

    Refined 2026-07-17 (/figure-it-out, GitHub Security Lab "pwn requests"). The
    pwn-request threat is EXECUTION of untrusted code with secrets present — not
    reading it. Reading the diff as data and sending it to the model is safe in a
    privileged job; running the fork's code is not. The two gates that execute
    (R13 fix-run, R12 base-repro) must degrade on a fork or run in an unprivileged
    sidecar. The tripwire is EXECUTION, so any new run-fork-code step is visibly in
    violation.

    @surface.safeword-cli
    Scenario: autonomous-pr-review.SM1.R3.a_fork_is_reviewed_and_posted_without_running_the_forks_gates
      Given a pull request opened from a fork
      And the reviewer holds a token that can post comments
      When the reviewer produces and posts its review
      Then the review is posted to the pull request
      And no fix-run or base-reproduction step executes the fork's head in the privileged job

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.SM1.R3.the_fix_gate_degrades_on_a_fork_rather_than_running_fork_code
      Given a fork pull request whose finding carries a suggested fix
      And running the affected tests would execute the fork's code
      When the reviewer decides whether to validate the fix
      Then the reviewer posts the finding without a validated fix
      And the finding states the fix was not run

    @rejection @surface.safeword-cli
    Scenario: autonomous-pr-review.SM1.R3.an_injected_instruction_in_the_diff_is_quoted_not_obeyed
      Given a pull request whose review would otherwise verdict needs-a-human
      And whose diff contains a comment instructing the reviewer to approve it unconditionally
      When the reviewer reads the diff
      Then the review quotes the instruction as diff content
      And the verdict remains needs-a-human

  @autonomous-pr-review.SM1.R2
  Rule: autonomous-pr-review.SM1.R2 — a maintainer can turn the reviewer off without deleting it

    @rejection @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.SM1.R2.the_config_switch_toggles_posting_but_never_uninstalls
      Given a project whose configuration <config-state> the reviewer
      When a pull request worth one comment is opened
      Then the review comment count is <count>
      And the reviewer's workflow remains installed

      Examples:
        | config-state | count |
        | enables      | 1     |
        | disables     | 0     |
