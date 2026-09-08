Feature: Turn accepted decisions into startable work
  Safeword turns an approved approach into work a fresh agent can start without inventing decisions.

  @plan-implementability.TBU2.7CAMAD.R1
  Rule: plan-implementability.TBU2.7CAMAD.R1 — Execution Planning requires a reviewed current approach

    @surface.safeword-cli
    Scenario Outline: Implementation Plan review state controls Execution Planning
      Given an Implementation Plan is <review_state>
      When the installed Safeword CLI attempts to begin Execution Planning
      Then <transition_result>

      Examples:
        | review_state | transition_result |
        | missing a semantic review receipt | the transition is blocked until the current plan has a valid review receipt |
        | changed after its recorded semantic review | the transition is blocked until the changed plan is reviewed again |
        | current with a valid semantic review receipt but no achieved review provenance recorded | the transition is blocked until the achieved review provenance is recorded |
        | current with a valid approving semantic review receipt and achieved review provenance recorded | the workflow enters Execution Planning |
        | current with a semantic review receipt recording rejection | the transition is blocked and the receipt's rejection is reported |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Each agent host applies review state at its real entry point
      Given an Implementation Plan is <review_state>
      When <host> attempts Execution Planning through <host_entry>
      Then <transition_result>

      Examples:
        | host | host_entry | review_state | transition_result |
        | Claude Code | installed lifecycle-hook dispatch | missing a semantic review receipt | the host keeps the ticket in Implementation Planning and reports the missing review |
        | Claude Code | installed lifecycle-hook dispatch | current with an approving receipt and recorded review provenance | the host enters Execution Planning |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | missing a semantic review receipt | the host keeps the ticket in Implementation Planning and reports the missing review |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | current with an approving receipt and recorded review provenance | the host enters Execution Planning |
        | OpenAI Codex | installed project workflow dispatch | missing a semantic review receipt | the host keeps the ticket in Implementation Planning and reports the missing review |
        | OpenAI Codex | installed project workflow dispatch | current with an approving receipt and recorded review provenance | the host enters Execution Planning |
        | OpenCode CLI/TUI | installed plugin-event dispatch | missing a semantic review receipt | the host keeps the ticket in Implementation Planning and reports the missing review |
        | OpenCode CLI/TUI | installed plugin-event dispatch | current with an approving receipt and recorded review provenance | the host enters Execution Planning |
        | Cursor | installed project-hook dispatch | missing a semantic review receipt | the host keeps the ticket in Implementation Planning and reports the missing review |
        | Cursor | installed project-hook dispatch | current with an approving receipt and recorded review provenance | the host enters Execution Planning |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | missing a semantic review receipt | the host keeps the ticket in Implementation Planning and reports the missing review |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | current with an approving receipt and recorded review provenance | the host enters Execution Planning |

    @surface.safeword-cli
    Scenario: Exhausted review routes preserve their actual provenance
      Given a current Implementation Plan has a valid receipt from the permitted exhausted-route fallback
      When the installed Safeword CLI begins Execution Planning
      Then the workflow enters Execution Planning and records the actual fallback route rather than independent provenance

    @surface.safeword-cli
    Scenario: An unearned fallback receipt cannot authorize planning
      Given a current Implementation Plan has a fallback receipt but no record that stronger review routes were attempted and unavailable
      When the installed Safeword CLI attempts to begin Execution Planning
      Then the transition is blocked and the strongest unexhausted route is named

    @surface.safeword-cli
    Scenario: A self-authored independence claim cannot authorize planning
      Given the authoring agent added a receipt claiming independent review without a matching reviewer route result
      When the installed Safeword CLI attempts to begin Execution Planning
      Then the transition is blocked and the unsupported provenance claim is named

  @plan-implementability.TBU2.7CAMAD.R2
  Rule: plan-implementability.TBU2.7CAMAD.R2 — Every execution step is startable without inventing a contract

    @demo @surface.safeword-cli
    Scenario: A fresh-context agent can begin the first step from accepted artifacts alone
      Given an agent has only the accepted behavior, Implementation Plan, and Execution Plan
      When it begins the first execution step
      Then the ledger records the plan's exact first test action failing before any production-code edit and records no new behavior-shaping decision

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: A forced behavior decision prevents a fresh-context start
      Given an Execution Plan leaves the authorization failure behavior undecided
      When a fresh-context agent attempts the first step through <host_entry>
      Then the workflow stops before production code and reports the unresolved authorization decision

      Examples:
        | host_entry |
        | Claude Code lifecycle-hook dispatch |
        | Claude Code Cloud project hooks in a fresh VM |
        | OpenAI Codex project workflow dispatch |
        | OpenCode CLI/TUI plugin-event dispatch |
        | Cursor project-hook dispatch |
        | Cursor Cloud Agents project hooks in a fresh runner |

    @surface.safeword-cli
    Scenario: A later unstartable step blocks an otherwise startable plan
      Given an Execution Plan whose first step is startable and whose fourth step leaves the accepted authorization failure behavior undecided
      When implementability is reviewed through the installed Safeword CLI
      Then approval is blocked and the fourth step is named as requiring a behavior decision

    @surface.safeword-cli
    Scenario Outline: Ordering state controls first-step startability
      Given an Execution Plan has <ordering_state>
      When the Execution Plan is reviewed for implementability through the installed Safeword CLI
      Then <ordering_result>

      Examples:
        | ordering_state | ordering_result |
        | a first step whose prerequisite is incomplete | approval is blocked with the prerequisite named |
        | no executable steps | approval is blocked because a fresh agent has nothing startable |
        | independent steps ordered so the highest-risk probe runs first | ordering does not block approval |
        | independent steps explicitly marked safe for parallel work after the risk-first probe | ordering does not block approval |

  @plan-implementability.TBU2.7CAMAD.R3
  Rule: plan-implementability.TBU2.7CAMAD.R3 — Authors and reviewers use one implementability contract

    @surface.safeword-cli
    Scenario Outline: Review-contract identity controls semantic approval
      Given the authoring review contract <contract_state>
      When the Execution Plan is submitted through the installed Safeword CLI for review
      Then <review_result>

      Examples:
        | contract_state | review_result |
        | omits a required startability check but retains the same version label | approval is blocked because the contract-byte identity differs |
        | is byte-identical to the reviewer contract | contract identity does not block semantic approval |

  @plan-implementability.TBU2.7CAMAD.R4
  Rule: plan-implementability.TBU2.7CAMAD.R4 — Execution discoveries return to the owning phase

    @surface.safeword-cli
    Scenario Outline: A discovered change returns only when it alters an accepted decision
      Given an Execution Planning discovery involving <change>
      When the installed Safeword CLI classifies and applies the discovery
      Then <destination>

      Examples:
        | change | destination |
        | fixture implementation | it remains in Execution Planning |
        | test command | it remains in Execution Planning |
        | accepted design boundary | it returns to Implementation Planning |
        | accepted proof boundary | it returns to Implementation Planning |
        | a file-path change that also alters an accepted API contract | it returns to Implementation Planning |

  @plan-implementability.TBU2.7CAMAD.R5
  Rule: plan-implementability.TBU2.7CAMAD.R5 — The Execution Plan is a project-local reviewed artifact

    @surface.safeword-cli
    Scenario Outline: Project-local Execution Plan state controls coding authorization
      Given <plan_state>
      When coding authorization is evaluated through the installed Safeword CLI
      Then <authorization_result>

      Examples:
        | plan_state | authorization_result |
        | the only execution notes are host-local scratch notes | coding is blocked because the project-local Execution Plan is missing |
        | a current reviewed project-local Execution Plan with achieved review provenance exists | coding is authorized by that project-local plan |
        | a stale unreviewed project-local Execution Plan and host-local scratch notes recording semantic approval exist | coding is blocked because only the project-local plan supplies authorization |

    @surface.safeword-cli
    Scenario: A missing project-local plan receipt supports both builder personas
      Given the only execution notes are host-local scratch notes
      When coding authorization is evaluated through the installed Safeword CLI
      Then one receipt names creating and reviewing the project-local Execution Plan as the next action and progressively discloses the failing check, expected plan location, and review command

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Agent hosts cannot authorize coding from host-local notes
      Given only host-local scratch notes record semantic approval and no project-local Execution Plan exists
      When production code is edited through <host_entry>
      Then the host blocks the edit and names the missing project-local Execution Plan

      Examples:
        | host_entry |
        | Claude Code lifecycle-hook dispatch |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM |
        | OpenAI Codex project workflow dispatch |
        | OpenCode CLI/TUI plugin-event dispatch |
        | Cursor project-hook dispatch |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner |

  @plan-implementability.TBU2.7CAMAD.R6
  Rule: plan-implementability.TBU2.7CAMAD.R6 — Semantic review detects disguised unresolved decisions

    @surface.safeword-cli
    Scenario Outline: Data-decision specificity controls semantic approval
      Given an Execution Plan <data_state>
      When the plan is semantically reviewed through the installed Safeword CLI
      Then <review_result>

      Examples:
        | data_state | review_result |
        | says to use the appropriate store without naming the accepted store or ownership contract | approval is blocked and the unresolved data decision is returned to Implementation Planning |
        | names the accepted store and ownership contract without changing them | the data decision does not block approval |

  @plan-implementability.TBU2.7CAMAD.R7
  Rule: plan-implementability.TBU2.7CAMAD.R7 — Structural gates report facts rather than semantic quality

    @surface.safeword-cli
    Scenario Outline: Structure reports facts while semantics controls implementability
      Given an Execution Plan has <structural_state>
      When the structural gate evaluates it through the installed Safeword CLI
      Then <structural_result>

      Examples:
        | structural_state | structural_result |
        | a present artifact, planned status, and valid receipt | it reports those facts without calling the plan implementable, approved, or ready for coding |
        | an absent artifact | it reports artifact absent without calling the plan implementable, approved, or ready for coding |

  @plan-implementability.TBU2.7CAMAD.R8
  Rule: plan-implementability.TBU2.7CAMAD.R8 — Accepted proof strategies become exact test work

    @surface.safeword-cli
    Scenario Outline: Concrete proof content controls test-step startability
      Given an accepted proof strategy requires an edited-plan denial with exit code 2 through the real CLI subprocess
      When the installed Safeword CLI reviews an Execution Plan supplying <step_content>
      Then <startability_result>

      Examples:
        | step_content | startability_result |
        | a fixture from prerequisite step 1, command `bun run test tests/cli-protocol/phase-gates.test.ts -t edited-plan`, an edit action, exit code 2 assertion, and the installed CLI subprocess boundary | the test step is startable without placeholders |
        | TBD for the CLI subprocess boundary | the test step is rejected as not startable with the missing subprocess boundary named |
        | TBD for the denied-exit assertion | the test step is rejected as not startable with the missing exit-code assertion named |

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
        | current but the semantic reviewer returned no verdict | coding is blocked and the receipt records that no semantic verdict was obtained |
        | current but the semantic reviewer returned a rejection verdict | coding is blocked and the receipt records the rejection |
        | current with a valid permitted-fallback verdict and its actual route recorded | coding is authorized without relabeling the fallback as independent |
        | current with a fallback verdict but no record that stronger review routes were attempted and unavailable | coding is blocked and the strongest unexhausted route is named |
        | unedited after valid semantic approval with achieved independence recorded | coding is authorized |
        | approved before its source Implementation Plan changed | coding is blocked until the Execution Plan is reconciled to and reviewed against the current approach |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Agent hosts block edits authorized by a stale Execution Plan
      Given the project-local Execution Plan was edited after semantic approval
      When production code is edited through <host_entry>
      Then the host blocks the edit until the current project-local plan is reviewed

      Examples:
        | host_entry |
        | Claude Code lifecycle-hook dispatch |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM |
        | OpenAI Codex project workflow dispatch |
        | OpenCode CLI/TUI plugin-event dispatch |
        | Cursor project-hook dispatch |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner |

  @plan-implementability.TBU2.7CAMAD.R10
  Rule: plan-implementability.TBU2.7CAMAD.R10 — Every accepted obligation maps to startable work

    @surface.safeword-cli
    Scenario Outline: Every accepted obligation must map to startable work
      Given the accepted approach includes <obligation> but the Execution Plan omits it
      When implementability is reviewed through the installed Safeword CLI
      Then approval is blocked until that obligation has dependency-ordered work and a completion signal

      Examples:
        | obligation |
        | an accepted scenario |
        | an accepted design decision |
        | an accepted proof strategy |
        | an affected surface |
        | a migration obligation |
        | a rollout requirement |
        | a rollback requirement |
        | a documentation requirement |

    @surface.safeword-cli
    Scenario Outline: Partial obligation mapping is not startable
      Given a migration obligation is mapped to work with <mapping_gap>
      When implementability is reviewed through the installed Safeword CLI
      Then approval is blocked with <missing_element> named

      Examples:
        | mapping_gap | missing_element |
        | no completion signal | the completion signal |
        | no dependency order | the dependency order |

    @surface.safeword-cli
    Scenario: Complete obligation mapping permits semantic approval
      Given every accepted scenario, decision, proof strategy, affected surface, migration, rollout, rollback, and documentation obligation has dependency-ordered work and a completion signal
      When implementability is reviewed through the installed Safeword CLI
      Then obligation mapping does not block approval

    @surface.safeword-cli
    Scenario: An explicitly obligation-free accepted approach does not manufacture execution work
      Given the accepted approach explicitly records that it has no execution obligations
      When implementability is reviewed through the installed Safeword CLI
      Then obligation mapping reports nothing to map without creating placeholder steps

  @plan-implementability.TBU2.7CAMAD.R11
  Rule: plan-implementability.TBU2.7CAMAD.R11 — Execution Planning supplies rather than replaces TDD

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: An execution step still proceeds through RED GREEN and REFACTOR
      Given an approved Execution Plan names the exact test and build order
      When implementation completes that step through <host_entry>
      Then the ledger records RED from the named test before production code, GREEN with that test passing and no production edit outside the step's named scope, and REFACTOR under the same passing proof

      Examples:
        | host_entry |
        | Claude Code lifecycle-hook dispatch |
        | Claude Code Cloud project hooks in a fresh VM |
        | OpenAI Codex project workflow dispatch |
        | OpenCode CLI/TUI plugin-event dispatch |
        | Cursor project-hook dispatch |
        | Cursor Cloud Agents project hooks in a fresh runner |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Production code cannot precede the named RED
      Given an approved Execution Plan names the first test action
      When production code is edited through <host_entry> before that test has an observed failure
      Then the edit is blocked and the named RED action is the recovery

      Examples:
        | host_entry |
        | Claude Code lifecycle-hook dispatch |
        | Claude Code Cloud project hooks in a fresh VM |
        | OpenAI Codex project workflow dispatch |
        | OpenCode CLI/TUI plugin-event dispatch |
        | Cursor project-hook dispatch |
        | Cursor Cloud Agents project hooks in a fresh runner |
