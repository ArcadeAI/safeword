@wip @eval-bound
Feature: PR review — the judgment-bound Rules (eval holding pen, NOT runner-provable)

  These five Rules were split out of the runner's scenario source on 2026-07-19.
  They are kept VERBATIM — nothing was reworded — but they do not belong to
  36EEMY's R/G/R ledger, and no runner test should claim to prove them.

  Why they are here: each one's Given describes CODE SHAPE ("wires up a new
  user-facing flow in two lines", "a <work-type> change", "changes 60 lines of an
  authorization control", "no existing comment answers that request") while its
  Then asserts the MODEL'S JUDGMENT about that shape. The runner reaches the
  vendor through an injected spawn seam, so in a runner harness the only way to
  supply those Givens is to stub the vendor's answer — at which point the test
  asserts the stub and cannot fail for a runner reason. That is the tautological-
  mock antipattern, and it is the same reasoning the ledger already uses to
  exclude R3, R4, R5, R10, R15, R16, R18, NTB1.R1-R3 and SM1.R1.

  Where they are owed: CWGYH0 (the eval). The harness exists —
  `experiments/gepa-review-spec/` (gepa-eval.ts, fixtures/, rescore.ts,
  validate-skill.ts) — so these become scored eval cases against a real model and
  a real corpus, which is the only instrument that can actually judge them.
  CWGYH0's `done_when` names them so this file does not quietly become a graveyard.

  Do NOT wire these to Cucumber steps. If a runner test ever turns green against
  one of them, that test is asserting its own fixture.

  @autonomous-pr-review.TB1.R19
  Rule: autonomous-pr-review.TB1.R19 — the review states the change's work type, judged by what it touches not its line count

    @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.TB1.R19.work_type_is_read_from_what_the_change_touches
      Given a pull request that carries a posted finding, whose change <shape>
      When the reviewer produces its review
      Then the stated work type is <work-type>

      Examples:
        | shape                                        | work-type    |
        | wires up a new user-facing flow in two lines | new behavior |
        | adds a branch inside an existing function     | logic change |
        | renames a symbol across many files            | patch        |

  @autonomous-pr-review.TB1.R20
  Rule: autonomous-pr-review.TB1.R20 — a change is flagged when its test coverage falls short of what its work type demands

    The finding is a mismatch between R19's work type and the coverage present, in
    the project's own idiom — it never demands a .feature or a safeword artifact,
    and never re-reports the line-percentage codecov already posts (R1). The demand
    varies BY work type: a patch with no test is not the same gap as a new behavior
    with nothing exercising it, so a runner that flags every untested change fails
    the patch row.

    @rejection @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.TB1.R20.coverage_is_judged_against_work_type_in_the_projects_idiom
      Given a <work-type> change in a project with no feature-file lane
      And its behavior is <coverage>
      When the reviewer produces its review
      Then a test-coverage finding is <presence>
      And no finding demands a feature file or a test-definitions artifact

      Examples:
        | work-type    | coverage                         | presence               |
        | new behavior | exercised by no test             | posted                 |
        | new behavior | exercised by an integration test | absent from the review |
        | patch        | exercised by no test             | absent from the review |

  @autonomous-pr-review.TB2.R1
  Rule: autonomous-pr-review.TB2.R1 — review depth is set by what the change touches, never by how many lines it has

    Measured: <100-line PRs get a human comment 18% of the time vs 62% for 500+,
    and 11 of 14 small PRs touching auth or infra got zero human comments. Small +
    sensitive is the human blind spot.

    @rejection @surface.safeword-cli
    Scenario Outline: autonomous-pr-review.TB2.R1.review_depth_tracks_the_surface_not_the_line_count
      Given a pull request that <change>
      When the reviewer produces its review
      Then the review <depth>

      Examples:
        | change                                       | depth                                     |
        | changes 60 lines of an authorization control | reports an assessment for every dimension |
        | changes 800 lines of generated fixture data  | assesses fewer than every dimension       |

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
