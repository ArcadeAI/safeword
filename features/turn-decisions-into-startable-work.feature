Feature: Turn accepted decisions into startable work
  Safeword turns an approved approach into work a fresh agent can start without inventing decisions.

  @plan-implementability.TBU2.7CAMAD.R1
  Rule: plan-implementability.TBU2.7CAMAD.R1 — Execution Planning requires a reviewed current approach

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    @rejection
    Scenario Outline: A stale or unreviewed Implementation Plan cannot authorize Execution Planning
      Given an Implementation Plan is <review_state>
      When the workflow attempts to begin Execution Planning
      Then the transition is blocked until the current plan has a valid review receipt with achieved independence recorded

      Examples:
        | review_state |
        | missing a semantic review receipt |
        | changed after its recorded semantic review |

  @plan-implementability.TBU2.7CAMAD.R2
  Rule: plan-implementability.TBU2.7CAMAD.R2 — Every execution step is startable without inventing a contract

    @demo
    @rejection
    Scenario: A fresh-context agent can begin the first step from accepted artifacts alone
      Given an agent has only the accepted behavior, Implementation Plan, and Execution Plan
      When it begins the first execution step
      Then it runs the exact first test action, observes its expected pre-implementation failure, and supplies no new behavior-shaping decision

  @plan-implementability.TBU2.7CAMAD.R3
  Rule: plan-implementability.TBU2.7CAMAD.R3 — Authors and reviewers use one implementability contract

    @rejection
    Scenario: An edited Execution Plan contract cannot receive semantic approval
      Given the authoring copy omits a required startability check but retains the same version label
      When the Execution Plan is submitted for review
      Then approval is blocked because the contract-byte identity differs

  @plan-implementability.TBU2.7CAMAD.R4
  Rule: plan-implementability.TBU2.7CAMAD.R4 — Execution discoveries return to the owning phase

    @rejection
    Scenario Outline: A discovered change returns only when it alters an accepted decision
      Given Execution Planning discovers a change limited to <change>
      When the change is classified
      Then <destination>

      Examples:
        | change | destination |
        | fixture, helper, path, command, or sequence | it remains in Execution Planning |
        | accepted behavior, design, data, or proof boundary | it returns to Implementation Planning |

  @plan-implementability.TBU2.7CAMAD.R5
  Rule: plan-implementability.TBU2.7CAMAD.R5 — The Execution Plan is a project-local reviewed artifact

    @rejection
    Scenario: Host-private execution notes cannot replace the reviewed artifact
      Given an agent has host-local scratch notes and a project-local Execution Plan
      When coding authorization is evaluated
      Then only the current reviewed project-local Execution Plan can authorize coding

  @plan-implementability.TBU2.7CAMAD.R6
  Rule: plan-implementability.TBU2.7CAMAD.R6 — Semantic review detects disguised unresolved decisions

    @rejection
    Scenario: Vague sequencing language cannot hide an architecture choice
      Given an Execution Plan says to use the appropriate store without naming the accepted store or ownership contract
      When the plan is semantically reviewed
      Then approval is blocked and the unresolved data decision is returned to Implementation Planning

  @plan-implementability.TBU2.7CAMAD.R7
  Rule: plan-implementability.TBU2.7CAMAD.R7 — Structural gates report facts rather than semantic quality

    @rejection
    Scenario: Valid structure cannot claim an unimplementable plan is complete
      Given an Execution Plan has a valid artifact, status, and receipt but one step still requires an undefined API contract
      When structural and semantic gates evaluate it
      Then the structural gate reports only its facts and semantic review blocks coding

  @plan-implementability.TBU2.7CAMAD.R8
  Rule: plan-implementability.TBU2.7CAMAD.R8 — Accepted proof strategies become exact test work

    @rejection
    Scenario: A test step without a concrete boundary and assertion is not startable
      Given an accepted proof strategy says to verify authorization behavior
      When it is decomposed into Execution Plan work
      Then the step names setup, action, assertion, real process boundary, command, and dependency order

  @plan-implementability.TBU2.7CAMAD.R9
  Rule: plan-implementability.TBU2.7CAMAD.R9 — Coding requires a reviewed current Execution Plan

    @rejection
    Scenario: A changed Execution Plan invalidates coding authorization
      Given an approved Execution Plan is edited after review
      When production-code work is attempted
      Then coding is blocked until the current plan passes semantic review with achieved independence recorded

  @plan-implementability.TBU2.7CAMAD.R10
  Rule: plan-implementability.TBU2.7CAMAD.R10 — Every accepted obligation maps to startable work

    @rejection
    Scenario Outline: Every accepted obligation must map to startable work
      Given the accepted approach includes <obligation> but the Execution Plan omits it
      When implementability is reviewed
      Then approval is blocked until that obligation has dependency-ordered work and a completion signal

      Examples:
        | obligation |
        | an accepted scenario |
        | an accepted design decision |
        | an accepted proof strategy |
        | an affected surface |
        | a migration requirement |
        | a rollout requirement |
        | a rollback requirement |
        | a documentation requirement |

  @plan-implementability.TBU2.7CAMAD.R11
  Rule: plan-implementability.TBU2.7CAMAD.R11 — Execution Planning supplies rather than replaces TDD

    @rejection
    Scenario: An execution step still proceeds through RED GREEN and REFACTOR
      Given an approved Execution Plan names the exact test and build order
      When implementation begins that step
      Then the test is observed failing before production code, made green minimally, and refactored under passing proof
