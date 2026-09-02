# BDD source for QZAFT2. Existing headless-process, fresh-review, and
# content-bound stamp mechanics remain covered by their original features and
# Vitest suites; these scenarios prove the new cross-agent coordinator contract.
# `@manual` keeps the contract readable by codify/review-spec while the real
# CLI subprocess boundary is exercised by
# packages/cli/tests/cli-protocol/review-wiring.test.ts,
# packages/cli/tests/cli-protocol/review-alternate-authentication.test.ts, and
# packages/cli/tests/review/surface-parity.test.ts.
@cross-agent-adversarial-reviews @manual
Feature: Cross-agent adversarial reviews

  Class-1 reviews use a fresh headless session of the opposite agent whenever
  that route is available. Failures are classified, fallbacks are honest about
  reduced independence, and no result earns evidence without validated agent
  provenance.

  @cross-agent-review.TBU1.R1
  Rule: cross-agent-review.TBU1.R1 — Available class-1 reviews use the opposite agent

    @surface.claude-code @surface.openai-codex @surface.safeword-cli
    Scenario Outline: Each author agent selects the opposite headless reviewer
      Given <author> authored work requiring a class-1 review
      And <reviewer> is installed and authenticated
      When Safeword starts the review
      Then a fresh headless <reviewer> reviews the bounded work packet
      And no same-agent reviewer is selected

      Examples:
        | author | reviewer |
        | Claude | Codex    |
        | Codex  | Claude   |

    @rejection
    Scenario: A same-agent candidate cannot displace an available opposite reviewer
      Given Codex-authored work requires a class-1 review
      And both Claude and a fresh Codex reviewer are available
      When Safeword starts the review
      Then Claude is selected
      And the fresh Codex candidate is not used

    @rejection
    Scenario: An author outside the Claude and Codex pairing keeps its existing route
      Given work authored by a runtime other than Claude or Codex requires review
      When Safeword selects the review route
      Then no opposite-agent pairing is inferred
      And the runtime's existing review route is retained without cross-agent evidence

  @cross-agent-review.TBU1.R2
  Rule: cross-agent-review.TBU1.R2 — Review evidence names the actual agents and independence level

    Scenario: A validated opposite-agent result earns complete provenance
      Given Claude-authored work was reviewed successfully by headless Codex using an assigned model
      When Safeword records the completed review
      Then the evidence names Claude as author and Codex as reviewer
      And it records the assigned model and cross-agent independence

    @rejection
    Scenario Outline: Reviewer identity faults earn no review evidence
      Given a successful-looking review result <identity_fault>
      When Safeword validates the result
      Then no passing review evidence is recorded
      And the route is classified as <classification>

      Examples:
        | identity_fault                         | classification              |
        | lacks reviewer identity                | missing reviewer provenance |
        | names an agent other than the dispatched reviewer | contradictory reviewer provenance |

  @cross-agent-review.TBU1.R3
  Rule: cross-agent-review.TBU1.R3 — The reviewer is isolated from writes and unrelated credentials

    @rejection @surface.safeword-cli
    Scenario: A reviewer write attempt cannot alter the judged work
      Given the reviewer runs against a bounded snapshot in a neutral workspace
      When the reviewer writes to its working directory targeting the judged files
      Then the change is confined to the disposable snapshot
      And the source worktree is byte-for-byte unchanged
      And the write attempt earns no passing review evidence

    @rejection @surface.safeword-cli
    Scenario: An unrelated author-vendor credential never enters the reviewer boundary
      Given the reviewer vendor differs from the author vendor
      When Safeword constructs the child environment and review packet
      Then only credentials needed by the reviewer vendor cross the subprocess boundary
      And no unrelated vendor credential value appears in reviewer input, output, or diagnostics

  @cross-agent-review.TBU2.R1
  Rule: cross-agent-review.TBU2.R1 — Preferred-route failures are classified before fallback

    @rejection
    Scenario Outline: Each preferred-route failure keeps its specific cause
      Given the opposite-agent route encounters <failure>
      When Safeword evaluates whether to fall back
      Then the preferred route is reported as <classification>
      And fallback does not erase that cause

      Examples:
        | failure                         | classification         |
        | no executable is installed      | reviewer not installed |
        | no valid login is available     | reviewer not signed in |
        | the child exits non-zero         | reviewer process failed|
        | the child exceeds its deadline  | reviewer timed out     |
        | the child returns invalid output| invalid reviewer output|

    @rejection
    Scenario Outline: Missing reviewer authentication routes to reauthentication before fallback
      Given <reviewer> is the assigned opposite-agent reviewer
      And its independent route reports no valid login
      When Safeword evaluates whether to fall back
      Then the result is action required with code REVIEW_AUTHENTICATION_REQUIRED
      And recovery tells the agent to run <login_command> and retry the same review once
      And no same-agent fallback starts

      Examples:
        | reviewer | login_command     |
        | Codex    | codex login       |
        | Claude   | claude auth login |

  @cross-agent-review.TBU2.R2
  Rule: cross-agent-review.TBU2.R2 — Fallback evidence never overstates independence

    Scenario: A permitted host-native fallback is recorded as degraded
      Given the opposite reviewer is not installed
      And current policy permits a fresh host-native fallback
      When the fallback completes successfully
      Then its evidence names the actual same-agent reviewer
      And its independence level is degraded rather than cross-agent

    @rejection
    Scenario: A degraded fallback cannot satisfy hard cross-agent enforcement
      Given the opposite reviewer is not installed
      And hard cross-agent enforcement is enabled
      When a same-agent fallback completes successfully
      Then the cross-agent gate remains unsatisfied
      And the workflow reports how to restore the opposite reviewer

  @cross-agent-review.TBU2.R3
  Rule: cross-agent-review.TBU2.R3 — Exhausting safe routes blocks with recovery guidance

    @rejection
    Scenario: No safe review route blocks without hanging or minting evidence
      Given the opposite reviewer and every permitted fallback are unavailable
      When Safeword exhausts the review routes
      Then the review terminates within its configured deadline
      And the workflow is blocked with a concrete recovery action
      And no passing review evidence is recorded

  @cross-agent-review.NTB1.R1
  Rule: cross-agent-review.NTB1.R1 — The outcome plainly states whether an independent agent checked the work

    Scenario Outline: Every outcome leads with its independence status
      Given a class-1 review finishes with <outcome>
      When Safeword presents the result
      Then the first plain-language statement says <meaning>

      Examples:
        | outcome                 | meaning                                      |
        | a cross-agent pass      | an independent agent checked the work       |
        | a degraded fallback pass| the check ran but was not fully independent |
        | no safe route           | the independent check did not run           |

    @rejection
    Scenario: An opaque technical status is not accepted as the builder-facing result
      Given a review result contains only an exit code, agent name, and authentication class
      When Safeword prepares the builder-facing result
      Then it adds a plain-language independence statement
      And the opaque technical status is retained only as supporting detail

  @cross-agent-review.NTB1.R2
  Rule: cross-agent-review.NTB1.R2 — A degraded or blocked outcome leads with one recommended recovery action

    @rejection
    Scenario Outline: The builder receives one actionable recovery step for each failure
      Given the independent review is degraded or blocked because <cause>
      When Safeword explains what to do next
      Then it leads with <recommended_action>
      And the builder is not required to diagnose packages, environment variables, or credential formats

      Examples:
        | cause                              | recommended_action                    |
        | the reviewer is not installed      | install the named reviewer and retry  |
        | the reviewer is not signed in      | sign in to the named reviewer and retry|
        | the reviewer process failed        | retry the independent review          |
        | the reviewer timed out              | retry the independent review          |
        | the reviewer returned invalid output| retry the independent review          |

  @cross-agent-review.SWM1.R1
  Rule: cross-agent-review.SWM1.R1 — Every class-1 surface uses one coordinator contract

    @surface.claude-code @surface.openai-codex @surface.safeword-cli
    Scenario Outline: Each class-1 surface enters the shared coordinator
      Given <review_surface> requires an independent reviewer
      When its review starts
      Then its result names the selected reviewer, route status, failure classification, and independence level
      And no surface-private result can earn passing review evidence

      Examples:
        | review_surface                         |
        | whole-work quality review              |
        | scenario or phase-exit review          |
        | implementation-plan architecture review|

    @rejection
    Scenario: A class-1 surface that bypasses the coordinator fails parity validation
      Given one class-1 review surface invokes a reviewer through a private route
      When Safeword validates review-surface parity
      Then parity fails and names the bypassing surface

  @cross-agent-review.SWM1.R2
  Rule: cross-agent-review.SWM1.R2 — Opposite-agent behavior is consistent across desktop and cloud

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud
    Scenario Outline: Existing desktop or cloud authentication can run the opposite reviewer
      Given <author> authors work in <runtime>
      And the opposite reviewer has <credential_source>
      When a class-1 review starts
      Then the opposite reviewer is selected without requiring a manually copied API key

      Examples:
        | author | runtime           | credential_source          |
        | Claude | desktop           | an authenticated CLI profile|
        | Codex  | desktop           | an authenticated CLI profile|
        | Claude | a cloud session   | a managed cloud credential  |
        | Codex  | a cloud session   | a managed cloud credential  |

    @rejection @surface.claude-code-cloud @surface.openai-codex-cloud
    Scenario: A cloud session never invents or exposes a missing reviewer credential
      Given a cloud session has no usable credential for the opposite reviewer
      When a class-1 review starts
      Then Safeword reports that the reviewer is not signed in
      And it does not request, print, or synthesize a secret value

    Scenario: An explicit opt-out retains the existing route without cross-agent evidence
      Given the builder explicitly opts out of cross-agent review
      When a class-1 review starts
      Then no opposite-agent reviewer process is launched
      And the existing review route is retained without cross-agent evidence
      And the outcome says the independent cross-agent check was not requested

    @rejection
    Scenario: An explicit opt-out cannot satisfy hard cross-agent enforcement
      Given hard cross-agent enforcement is enabled
      And the builder explicitly opts out of cross-agent review
      When a class-1 review starts
      Then the cross-agent gate remains unsatisfied
      And the outcome says the independent cross-agent check was not requested

  @cross-agent-review.SWM1.R3
  Rule: cross-agent-review.SWM1.R3 — Non-class-1 work retains its existing routing

    @rejection
    Scenario Outline: Excluded reviewer classes do not enter the cross-agent coordinator
      Given <excluded_work> is about to run
      When Safeword selects its execution path
      Then it retains its existing route
      And no opposite-agent review process is launched

      Examples:
        | excluded_work                         |
        | a class-2 deterministic check         |
        | a class-3 producer or discovery fan-out|
        | an internal per-step TDD self-check   |
