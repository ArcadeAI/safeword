Feature: Turn accepted decisions into startable work
  Safeword turns an approved approach into work a fresh agent can start without inventing decisions.

  @plan-implementability.TBU2.7CAMAD.R1
  Rule: plan-implementability.TBU2.7CAMAD.R1 — Execution Planning requires a reviewed current approach

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Implementation Plan review state controls Execution Planning
      Given an Implementation Plan is <review_state>
      When the installed host workflow attempts to begin Execution Planning
      Then <transition_result>

      Examples:
        | review_state | transition_result |
        | missing a semantic review receipt | the transition is blocked until the current plan has a valid review receipt |
        | changed after its recorded semantic review | the transition is blocked until the changed plan is reviewed again |
        | current with a valid semantic review receipt and achieved independence recorded | the workflow enters Execution Planning |

  @plan-implementability.TBU2.7CAMAD.R2
  Rule: plan-implementability.TBU2.7CAMAD.R2 — Every execution step is startable without inventing a contract

    @demo
    Scenario: A fresh-context agent can begin the first step from accepted artifacts alone
      Given an agent has only the accepted behavior, Implementation Plan, and Execution Plan
      When it begins the first execution step
      Then the ledger records the plan's exact first test action failing before any production-code edit and records no new behavior-shaping decision

  @plan-implementability.TBU2.7CAMAD.R3
  Rule: plan-implementability.TBU2.7CAMAD.R3 — Authors and reviewers use one implementability contract

    Scenario Outline: Review-contract identity controls semantic approval
      Given the authoring review contract <contract_state>
      When the Execution Plan is submitted for review
      Then <review_result>

      Examples:
        | contract_state | review_result |
        | omits a required startability check but retains the same version label | approval is blocked because the contract-byte identity differs |
        | is byte-identical to the reviewer contract | contract identity does not block semantic approval |

  @plan-implementability.TBU2.7CAMAD.R4
  Rule: plan-implementability.TBU2.7CAMAD.R4 — Execution discoveries return to the owning phase

    Scenario Outline: A discovered change returns only when it alters an accepted decision
      Given Execution Planning discovers a change limited to <change>
      When the change is classified
      Then <destination>

      Examples:
        | change | destination |
        | fixture implementation | it remains in Execution Planning |
        | helper implementation | it remains in Execution Planning |
        | file path | it remains in Execution Planning |
        | test command | it remains in Execution Planning |
        | dependency sequence | it remains in Execution Planning |
        | accepted behavior, design, data, or proof boundary | it returns to Implementation Planning |

  @plan-implementability.TBU2.7CAMAD.R5
  Rule: plan-implementability.TBU2.7CAMAD.R5 — The Execution Plan is a project-local reviewed artifact

    @surface.safeword-cli
    Scenario Outline: Project-local Execution Plan state controls coding authorization
      Given <plan_state>
      When coding authorization is evaluated through the installed Safeword CLI
      Then <authorization_result>

      Examples:
        | plan_state | authorization_result |
        | the only execution notes are host-local scratch notes | coding is blocked and the reason names the missing project-local Execution Plan |
        | a current reviewed project-local Execution Plan exists | coding is authorized by that project-local plan |
        | both a project-local plan and divergent host-local scratch notes exist | only the project-local plan supplies coding authorization |

  @plan-implementability.TBU2.7CAMAD.R6
  Rule: plan-implementability.TBU2.7CAMAD.R6 — Semantic review detects disguised unresolved decisions

    @rejection
    Scenario: Vague execution language cannot hide a data ownership choice
      Given an Execution Plan says to use the appropriate store without naming the accepted store or ownership contract
      When the plan is semantically reviewed
      Then approval is blocked and the unresolved data decision is returned to Implementation Planning

  @plan-implementability.TBU2.7CAMAD.R7
  Rule: plan-implementability.TBU2.7CAMAD.R7 — Structural gates report facts rather than semantic quality

    @rejection
    Scenario Outline: Structure reports facts while semantics controls implementability
      Given an Execution Plan has a present artifact, planned status, valid receipt, and <semantic_state>
      When structural and semantic gates evaluate it
      Then the structural gate reports artifact present, status planned, and receipt valid without claiming completeness, while <semantic_result>

      Examples:
        | semantic_state | semantic_result |
        | one step requiring an undefined API contract | semantic review blocks coding |
        | every step startable from accepted contracts | semantic review permits coding |

  @plan-implementability.TBU2.7CAMAD.R8
  Rule: plan-implementability.TBU2.7CAMAD.R8 — Accepted proof strategies become exact test work

    Scenario Outline: Concrete proof content controls test-step startability
      Given an accepted proof strategy requires an edited-plan denial through the real CLI subprocess
      When the Execution Plan supplies <step_content>
      Then <startability_result>

      Examples:
        | step_content | startability_result |
        | fixture setup, the exact targeted test command, an edit action, an asserted denied exit, the CLI subprocess boundary, and its prerequisite step | the test step is startable without placeholders |
        | TBD for either the CLI subprocess boundary or denied-exit assertion | the test step is rejected as not startable with the unresolved field named |

  @plan-implementability.TBU2.7CAMAD.R9
  Rule: plan-implementability.TBU2.7CAMAD.R9 — Coding requires a reviewed current Execution Plan

    @surface.safeword-cli
    Scenario Outline: Execution Plan currency controls coding authorization
      Given an Execution Plan is <plan_state>
      When production-code work is attempted through the installed Safeword CLI
      Then <coding_result>

      Examples:
        | plan_state | coding_result |
        | edited after semantic approval | coding is blocked until the current plan passes semantic review |
        | unedited after valid semantic approval with achieved independence recorded | coding is authorized |

  @plan-implementability.TBU2.7CAMAD.R10
  Rule: plan-implementability.TBU2.7CAMAD.R10 — Every accepted obligation maps to startable work

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

    Scenario: Complete obligation mapping permits semantic approval
      Given every accepted scenario, decision, proof strategy, affected surface, migration, rollout, rollback, and documentation obligation has dependency-ordered work and a completion signal
      When implementability is reviewed
      Then obligation mapping does not block approval

  @plan-implementability.TBU2.7CAMAD.R11
  Rule: plan-implementability.TBU2.7CAMAD.R11 — Execution Planning supplies rather than replaces TDD

    Scenario: An execution step still proceeds through RED GREEN and REFACTOR
      Given an approved Execution Plan names the exact test and build order
      When implementation begins that step
      Then the ledger records RED from the named test before production code, GREEN from the minimal implementation, and REFACTOR under the same passing proof
