@wip
Feature: Route ready PRs with a safe advisory review

  Every ready pull request receives one exact-head, technology-neutral advisory
  review whose ordinary conversation receipt cannot execute code, approve, or
  affect merge eligibility.

  @safe-advisory-core.TBU1.R1 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.TBU1.R1 — Every eligible head receives exactly one automatic review

    Scenario: A ready revision is reviewed once at its exact head
      Given a pull request is ready and its required prerequisites have settled successfully
      And its current head is revision A
      When Safeword completes the advisory review
      Then the reviewed revision is A
      And exactly one current receipt exists for revision A

    @rejection
    Scenario Outline: An ineligible revision cannot acquire an advisory route
      Given a pull request is <condition>
      When Safeword evaluates review eligibility
      Then no `looks ready` or `needs a human` route is published
      And the non-run reason is <reason>

      Examples:
        | condition | reason |
        | still a draft | not ready |
        | waiting for a required prerequisite | prerequisites pending |
        | failing a required prerequisite | prerequisites failed |

    @rejection
    Scenario Outline: Repeated triggers cannot produce another review attempt
      Given revision A is already <claim-state>
      When another eligible trigger arrives for revision A
      Then no second review attempt runs
      And the trigger is recorded as <disposition>

      Examples:
        | claim-state | disposition |
        | completely reviewed | suppressed |
        | being reviewed by another trigger | coalesced |

  @safe-advisory-core.TBU1.R2 @surface.safeword-cli
  Rule: safe-advisory-core.TBU1.R2 — Every changed text artifact receives the same technology-neutral integrity floor

    Scenario Outline: Changed text reaches the integrity reviewer without a technology-specific gate
      Given a ready pull request changes <artifact>
      When Safeword assembles the integrity evidence
      Then the artifact path and changed text are supplied to the integrity reviewer

      Examples:
        | artifact |
        | recognized source code |
        | an unfamiliar behavior-affecting file |

    @rejection
    Scenario: A consequential unfamiliar-artifact finding routes to a human
      Given an unfamiliar artifact reached the integrity reviewer
      And the reviewer returned a consequential access-control finding
      When Safeword derives the route
      Then the route is `needs a human`
      And the receipt associates the finding with that artifact

    @evaluation @live-model @live-evidence
    Scenario: The unfamiliar Flux policy regression routes to a human
      Given a ready pull request changes an unfamiliar `.flux` policy from `allow admin` to `allow *`
      When the configured reviewer performs the technology-neutral integrity review
      Then an access-control finding cites the permissive policy change
      And the route is `needs a human`

  @safe-advisory-core.TBU1.R3 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.TBU1.R3 — Only a complete clean current review may report looks ready

    @rejection
    Scenario Outline: Evidence state conservatively determines the advisory route
      Given the current review is <evidence-state>
      When Safeword derives the advisory route
      Then the published state is <published-state>
      And the route is <route>

      Examples:
        | evidence-state | published-state | route |
        | complete with no consequential finding or unresolved unknown | complete | `looks ready` |
        | complete with a consequential finding | complete | `needs a human` |
        | complete with an unresolved unknown | complete | `needs a human` |
        | missing required evidence | incomplete | `needs a human` |
        | interrupted by a reviewer or tool error | failed | `needs a human` |
        | completed for a head that is no longer current | stale | `needs a human` |

  @safe-advisory-core.TBU1.R4 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.TBU1.R4 — Every new head invalidates the old conclusion and requires a fresh review

    @rejection
    Scenario Outline: A new head cannot inherit an earlier conclusion
      Given revision A has a current receipt
      And <timing> revision B becomes the pull request head
      When Safeword handles the change
      Then revision A is visibly stale or superseded
      And revision B requires a full fresh review before a current route is published

      Examples:
        | timing |
        | before a new review begins |
        | while revision A is being reviewed |

  @safe-advisory-core.NTB1.R1 @surface.github-pull-request-conversation
  Rule: safe-advisory-core.NTB1.R1 — The current receipt exposes what the review did and did not establish

    @rejection
    Scenario Outline: Available and missing evidence remain distinguishable
      Given a terminal review attempt has <evidence-availability>
      When Safeword publishes the current receipt
      Then the receipt names the reviewed revision and run state
      And it lists reviewers, checks, skipped checks, remaining unknowns, available token use, and finding counts
      And unavailable evidence is reported as unknown rather than zero or successful

      Examples:
        | evidence-availability |
        | complete usage and check evidence |
        | partial usage or check evidence before failure |

  @safe-advisory-core.NTB1.R2 @surface.github-pull-request-conversation
  Rule: safe-advisory-core.NTB1.R2 — Receipt findings are actionable without claiming approval or tested remedies

    Scenario: A consequential finding gives one evidence-bounded next action
      Given a current review has a consequential finding
      When Safeword renders the ordinary-comment receipt
      Then the finding names its path and location, evidence, consequence, and one next action
      And any model-proposed remedy is labeled unverified

    @rejection
    Scenario: A no-finding result creates no reassuring comment noise
      Given a complete current review has no consequential finding or unresolved unknown
      When Safeword publishes the result
      Then exactly one current receipt reports `looks ready`
      And no other comment claims the pull request is safe to merge

  @safe-advisory-core.SWM1.R1 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.SWM1.R1 — Inspection and publication remain split across least-privilege boundaries

    @rejection
    Scenario: An untrusted fork is reviewed as data without execution
      Given a ready pull request comes from an untrusted fork
      And model inspection has no GitHub write credential
      And publication has only serialized advisory evidence
      When Safeword reviews and publishes the result
      Then the fork changes are inspected as data without checkout or execution
      And no write-capable job receives fork code or executable artifacts

    @rejection
    Scenario: Adversarial pull-request text cannot expand authority or suppress human routing
      Given untrusted pull-request text requests approval, merge, modification, or suppression of a known concern
      And deterministic evidence requires human judgment
      When Safeword derives and publishes the result
      Then the route remains `needs a human`
      And Safeword neither approves, merges, modifies code, nor executes customer code

  @safe-advisory-core.SWM1.R2 @surface.github-pull-request-conversation
  Rule: safe-advisory-core.SWM1.R2 — The receipt cannot approve a PR or satisfy a required check

    @rejection
    Scenario: Publishing the receipt leaves GitHub merge eligibility unchanged
      Given a pull request is subject to approval and required-check rules
      When Safeword publishes its current receipt
      Then the receipt is an ordinary non-review conversation comment
      And it creates neither an approval nor a status or check conclusion
      And merge eligibility is unchanged
