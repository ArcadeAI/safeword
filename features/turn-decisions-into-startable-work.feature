Feature: Turn accepted decisions into startable work
  Safeword turns an approved approach into work a fresh agent can start without inventing decisions.

  # @live marks periodic reviewer-semantic evidence. The regenerated deterministic admission matrix
  # substitutes only for the live reviewer's verdict; CI still exercises each scenario through the
  # installed Safeword CLI. A failed live reviewer result fails its case without retry masking.

  @plan-implementability.TBU2.7CAMAD.R1
  Rule: plan-implementability.TBU2.7CAMAD.R1 — Execution Planning requires a reviewed current approach

    @surface.safeword-cli
    Scenario Outline: Implementation Plan review state controls Execution Planning
      Given an Implementation Plan is <review_state>
      When the installed Safeword CLI attempts to begin Execution Planning
      Then <transition_result>

      Examples:
        | review_state | transition_result |
        | absent entirely | the transition is blocked until the project-local Implementation Plan is created and reviewed |
        | missing a semantic review receipt | the transition is blocked until the current plan has a valid review receipt |
        | changed after its recorded semantic review | the transition is blocked until the changed plan is reviewed again |
        | current with a valid semantic review receipt but no achieved independence level recorded | the transition is blocked until the achieved independence level is recorded |
        | current with a valid approving semantic review receipt and achieved independence level recorded | the workflow enters Execution Planning |
        | current with a semantic review receipt recording rejection | the transition is blocked and the receipt's rejection is reported |

    @surface.safeword-cli
    Scenario Outline: Review routes preserve their actual provenance
      Given a current Implementation Plan has a receipt whose achieved independence level was validated by 5F5ZZA as <validated_level>
      When the installed Safeword CLI begins Execution Planning
      Then the transition report records <reported_level> rather than <incorrect_level>

      Examples:
        | validated_level | reported_level | incorrect_level |
        | a permitted fallback | the permitted-fallback achieved independence level | independent review |
        | independent cross-agent review | independent cross-agent review | a permitted fallback |

    @rejection @surface.safeword-cli
    Scenario: An unearned fallback receipt cannot authorize planning
      Given a current Implementation Plan has a receipt whose achieved independence level is unsatisfied after 5F5ZZA provenance validation
      When the installed Safeword CLI attempts to begin Execution Planning
      Then the transition is blocked because the required achieved independence level is absent

    @rejection @surface.safeword-cli
    Scenario: A self-authored independence claim cannot authorize planning
      Given an Implementation Plan receipt contains an author-written independence claim that 5F5ZZA provenance validation did not accept as the achieved independence level
      When the installed Safeword CLI attempts to begin Execution Planning
      Then the transition is blocked while the receipt still contains the disregarded author-written claim rather than an achieved independence level

  @plan-implementability.TBU2.7CAMAD.R2
  Rule: plan-implementability.TBU2.7CAMAD.R2 — Every execution step is startable without inventing a contract

    @surface.safeword-cli @live
    @demo
    Scenario: A fresh-context agent turns an accepted approach into the first RED
      Given an agent has only the accepted behavior and a current approved Implementation Plan
      When it uses the installed Safeword CLI to create and review the Execution Plan and begin its first step
      Then semantic review reports no unresolved behavior-shaping decision
      And the ledger records its named test action failing before any production edit

    @rejection @surface.safeword-cli @live
    Scenario: A later unstartable step blocks an otherwise startable plan
      Given an Execution Plan whose first step is startable and whose fourth step leaves the accepted authorization failure behavior undecided
      When implementability is reviewed through the installed Safeword CLI
      Then approval is blocked and the fourth step is named as requiring a behavior decision

    @surface.safeword-cli @live
    Scenario Outline: First-step availability and ordering control startability
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
      Given the authoring and reviewer contract copies <contract_state>
      When the Execution Plan is submitted through the installed Safeword CLI for review
      Then <review_result>

      Examples:
        | contract_state | review_result |
        | have a missing authoring copy | approval is blocked with the missing authoring copy named |
        | have a missing generated reviewer rubric | approval is blocked with the missing reviewer copy named |
        | have a byte-identical canonical authoring copy but a stale generated reviewer rubric | approval is blocked with the stale reviewer copy named |
        | have a generated reviewer rubric byte-identical to the current packaged canonical contract but an edited authoring copy | approval is blocked with the drifted authoring copy named |
        | match each other and declare the current version label but omit a required startability check from the current packaged canonical contract | approval is blocked because the canonical contract-byte identity differs |
        | are both byte-identical to the current packaged canonical implementability contract | contract identity does not block semantic approval |

  @plan-implementability.TBU2.7CAMAD.R4
  Rule: plan-implementability.TBU2.7CAMAD.R4 — Execution discoveries return to the owning phase

    @surface.safeword-cli @live
    Scenario Outline: A discovered change returns only when it alters an accepted decision
      Given an Execution Planning discovery involving <change>
      When the installed Safeword CLI classifies and applies the discovery
      Then <destination>

      Examples:
        | change | destination |
        | fixture implementation | it remains in Execution Planning |
        | test command | it remains in Execution Planning |
        | a file path or helper location with no contract change | it remains in Execution Planning |
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
        | a current project-local Execution Plan with an approving semantic review and achieved independence level exists while its source Implementation Plan is unchanged | coding is authorized from the project-local plan |
        | a stale unreviewed project-local Execution Plan and host-local scratch notes recording semantic approval exist | coding is blocked because only the project-local plan supplies authorization |

    @surface.safeword-cli
    Scenario: A missing project-local plan names the project-local artifact to create
      Given the only execution notes are host-local scratch notes
      When coding authorization is evaluated through the installed Safeword CLI
      Then one receipt names the project-local Execution Plan rather than host-local notes as the artifact to create and review

  @plan-implementability.TBU2.7CAMAD.R6
  Rule: plan-implementability.TBU2.7CAMAD.R6 — Semantic review detects disguised unresolved decisions

    @surface.safeword-cli @live
    Scenario Outline: Decision specificity controls semantic approval
      Given an Execution Plan <decision_state>
      When the plan is semantically reviewed through the installed Safeword CLI
      Then <review_result>

      Examples:
        | decision_state | review_result |
        | says to use the appropriate store without naming the accepted store or ownership contract | approval is blocked with the unnamed accepted data decision reported |
        | names a concrete store and ownership contract that the accepted Implementation Plan never decided | approval is blocked with the invented data decision reported |
        | names the accepted store and ownership contract without changing them | the data decision does not block approval |
        | says to use the appropriate component boundary without naming the accepted architecture decision | approval is blocked with the unnamed accepted architecture decision reported |

  @plan-implementability.TBU2.7CAMAD.R7
  Rule: plan-implementability.TBU2.7CAMAD.R7 — Structural gates report facts rather than semantic quality

    @surface.safeword-cli
    Scenario Outline: The structural gate reports artifact facts without a semantic verdict
      Given an Execution Plan has <structural_state>
      When the structural gate evaluates it through the installed Safeword CLI
      Then <structural_result>

      Examples:
        | structural_state | structural_result |
        | a present artifact, planned status, and valid receipt | it reports those facts without rendering any favorable or unfavorable implementability verdict or claiming the plan approved or ready for coding |
        | an absent artifact | it reports artifact absent without rendering any favorable or unfavorable implementability verdict or claiming the plan approved or ready for coding |
        | a present but unreadable artifact | it reports artifact unreadable without calling the plan present-and-valid, rendering any favorable or unfavorable implementability verdict, or claiming the plan approved or ready for coding |

  @plan-implementability.TBU2.7CAMAD.R8
  Rule: plan-implementability.TBU2.7CAMAD.R8 — Accepted proof strategies become exact test work

    @surface.safeword-cli @live
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
        | edited in its reviewed definition content after semantic approval | coding is blocked until the current plan passes semantic review |
        | unedited after valid semantic approval with its source Implementation Plan unchanged and the achieved independence level recorded | coding is authorized |
        | edited only by checking off a completed Delivery Checklist task after valid semantic approval | coding remains authorized |
        | edited to change a Delivery Checklist obligation's Required proof after valid semantic approval | coding is blocked until the current plan passes semantic review |

    @surface.safeword-cli
    Scenario Outline: Execution Plan verdict and recorded assurance control coding authorization
      Given a current Execution Plan has <review_state>
      When production-code work is attempted through the installed Safeword CLI
      Then <coding_result>

      Examples:
        | review_state | coding_result |
        | a semantic receipt with no verdict | coding is blocked and the missing verdict is reported |
        | a semantic receipt recording rejection | coding is blocked and the rejection is reported |
        | a valid permitted-fallback verdict with its actual assurance recorded | coding is authorized without treating the fallback as independent |
        | a valid independent cross-agent verdict with its actual assurance recorded | coding is authorized and the achieved independence is reported as independent rather than a permitted fallback |
        | a receipt whose achieved independence level is unsatisfied after 5F5ZZA provenance validation | coding is blocked because the required achieved independence level is absent |
        | a receipt containing an author-written independence claim that 5F5ZZA provenance validation did not accept | coding is blocked because the author-written claim does not establish achieved independence |

  @plan-implementability.TBU2.7CAMAD.R10
  Rule: plan-implementability.TBU2.7CAMAD.R10 — Every accepted obligation maps to startable work

    @surface.safeword-cli @live
    Scenario Outline: Every accepted obligation must map to startable work
      Given the accepted approach includes <obligation> but the Execution Plan omits it
      When implementability is reviewed through the installed Safeword CLI
      Then approval is blocked with the omitted obligation named until it has dependency-ordered work and a completion signal

      Examples:
        | obligation |
        | an accepted scenario |
        | an accepted decision |
        | an accepted proof strategy |
        | an affected surface |
        | a migration obligation |
        | a rollout obligation |
        | a rollback obligation |
        | a documentation obligation |

    @surface.safeword-cli @live
    Scenario Outline: Partial obligation mapping is not startable
      Given a migration obligation is mapped to work with <mapping_gap>
      When implementability is reviewed through the installed Safeword CLI
      Then approval is blocked with <missing_element> named

      Examples:
        | mapping_gap | missing_element |
        | no completion signal | the completion signal |
        | no dependency order | the dependency order |

    @surface.safeword-cli @live
    Scenario: Complete obligation mapping permits semantic approval
      Given every accepted scenario, decision, proof strategy, affected surface, migration, rollout, rollback, and documentation obligation has dependency-ordered work and a completion signal
      When implementability is reviewed through the installed Safeword CLI
      Then obligation mapping does not block approval

    @surface.safeword-cli @live
    Scenario: Explicitly inapplicable obligations do not manufacture execution work
      Given the accepted approach has one accepted behavior obligation and explicitly records migration, rollout, rollback, documentation, and affected-surface work as inapplicable
      When implementability is reviewed through the installed Safeword CLI
      Then the accepted behavior maps to startable work without placeholder work for the inapplicable categories

  @plan-implementability.TBU2.7CAMAD.R11
  Rule: plan-implementability.TBU2.7CAMAD.R11 — Execution Planning supplies rather than replaces TDD

    @surface.safeword-cli
    Scenario: An execution step still proceeds through RED GREEN and REFACTOR
      Given an approved Execution Plan names the exact test and build order
      When implementation completes that step through the installed Safeword CLI contract workflow
      Then the ledger records RED from the named test before production code, GREEN with that test passing, and REFACTOR under the same passing proof

    @rejection @surface.safeword-cli
    Scenario: Production code cannot precede the named RED
      Given an approved Execution Plan names the first test action
      When production code is requested through the installed Safeword CLI contract workflow before that test has an observed failure
      Then the edit is blocked and the named RED action is the recovery

  @plan-implementability.TBU2.7CAMAD.R12
  Rule: plan-implementability.TBU2.7CAMAD.R12 — The Execution Plan distinguishes current implementation from target work and uses the canonical evidence-currency taxonomy owned by A639WN.R7

    @surface.safeword-cli
    Scenario Outline: Evidence state controls the delivery claim
      Given an Execution Plan obligation has <delivery_state>
      When the installed Safeword CLI records its current-to-target state
      Then <recorded_claim>

      Examples:
        | delivery_state | recorded_claim |
        | no implementation and no proof | the obligation is target work with no proof |
        | matching implementation with current-revision real-boundary proof | the obligation is implemented and proven at the current revision |
        | matching implementation with only earlier-revision proof | the obligation is implemented with reusable but stale proof and remains open for current proof |
        | a known defect contradicting the accepted design | the current defect and target correction are separate and the obligation is not called complete |
        | complete contributor work with accepted human authority still pending | the obligation names the pending human dependency and is not called complete |

    @surface.safeword-cli
    Scenario Outline: Delivery evidence uses the canonical checklist taxonomy
      Given an Execution Plan obligation has <available_evidence>
      When the installed Safeword CLI records its delivery evidence state
      Then it uses the canonical A639WN evidence class <evidence_class>

      Examples:
        | available_evidence | evidence_class |
        | an authenticated passing receipt produced at the current revision through the accepted real boundary | current-revision real-boundary proof |
        | an authenticated passing receipt from an earlier revision whose accepted boundary is unchanged | reusable earlier-revision proof |
        | a unit-level check for an obligation that requires the real CLI subprocess | partial or structural proof |
        | no authenticated receipt for the obligation | missing proof |

    @surface.safeword-cli
    Scenario Outline: Canonical delivery-contract identity prevents local contract drift
      Given the Execution Plan reviewer uses <delivery_contract_state>
      When delivery evidence is reviewed through the installed Safeword CLI
      Then <identity_result>

      Examples:
        | delivery_contract_state | identity_result |
        | a local taxonomy copy that differs from the current A639WN contract bytes | approval is blocked because the canonical contract identity differs |
        | the current A639WN contract bytes | contract identity does not block approval |

    @rejection @surface.safeword-cli
    Scenario: Partial structural evidence cannot authorize completion
      Given an Execution Plan obligation requires real subprocess proof and has only a unit-level structural check
      When delivery readiness is evaluated through the installed Safeword CLI
      Then the obligation remains open with the missing real boundary named

  @plan-implementability.TBU2.7CAMAD.R13
  Rule: plan-implementability.TBU2.7CAMAD.R13 — The Execution Plan carries the feature Delivery Checklist and maps accepted obligations into dependency-ordered tasks and independently reviewable pull-request slices under the sibling checklist and slicing contracts

    @surface.safeword-cli @live
    Scenario: The Execution Plan maps delivery obligations into owned review units
      Given an Execution Plan's Delivery Checklist maps required code, tests, migration, monitoring, rollback, and documentation into dependency-ordered tasks with completion signals
      When its Execution Plan is reviewed through the installed Safeword CLI
      Then approval is not blocked and every obligation is owned by a named pull-request slice under the canonical A639WN checklist and 6XW8H7 slicing contracts

    @surface.safeword-cli
    Scenario Outline: Canonical slicing-contract identity prevents local contract drift
      Given the Execution Plan reviewer uses <slicing_contract_state>
      When pull-request slicing is reviewed through the installed Safeword CLI
      Then <identity_result>

      Examples:
        | slicing_contract_state | identity_result |
        | a local slicing copy that differs from the current 6XW8H7 contract bytes | approval is blocked because the canonical contract identity differs |
        | the current 6XW8H7 contract bytes | contract identity does not block approval |

    @surface.safeword-cli @live
    Scenario Outline: Contribution shape controls pull-request decomposition
      Given an accepted feature has <contribution_shape>
      When its Execution Plan is reviewed through the installed Safeword CLI against the 6XW8H7 slicing contract
      Then <slice_result>

      Examples:
        | contribution_shape | slice_result |
        | one coherent purpose with independently provable completion | the plan records one coherent pull-request slice without artificial decomposition |
        | several dependency-ordered purposes with independent proof | the plan records the dependency-ordered reviewable slices |

    @rejection @surface.safeword-cli @live
    Scenario: A complete-looking task list cannot leave delivery obligations unowned
      Given an Execution Plan lists coding tasks but maps no pull-request slice to the accepted rollback obligation
      When its execution completeness is reviewed through the installed Safeword CLI
      Then approval is blocked with the unowned rollback obligation named

  @plan-implementability.TBU2.7CAMAD.R14
  Rule: plan-implementability.TBU2.7CAMAD.R14 — Execution Plan approval establishes only that delivery is startable and provable without a new behavior-shaping decision; it does not claim implementation, verification, human release approval, or merge authority

    @surface.safeword-cli
    Scenario Outline: Execution approval cannot impersonate a downstream approval
      Given a current Execution Plan has passed semantic implementability review
      When a downstream gate asks the installed Safeword CLI to substantiate <claimed_state> from that approval
      Then <report_result>

      Examples:
        | claimed_state | report_result |
        | delivery is startable and provable without a new behavior-shaping decision | the CLI confirms exactly that state and records no implementation, verification, release-approval, or merge claim |
        | implementation is complete | the claim is rejected because implementation evidence has not been established |
        | verification passed | the claim is rejected because verification evidence has not been established |
        | release has human approval | the claim is rejected because human authority has not been established |
        | the contribution may merge | the claim is rejected because merge authority has not been established |

  @plan-implementability.TBU2.7CAMAD.R15
  Rule: plan-implementability.TBU2.7CAMAD.R15 — Accepted measurement decisions become concrete instrumentation, test, and evidence-collection work without redefining the upstream promise or validity contract

    @surface.safeword-cli @live
    Scenario Outline: Measurement execution preserves the accepted promise and validity contract
      Given the accepted plans define an outcome, population, target, measurement origin, method, validity safeguards, and failure behavior
      When the installed Safeword CLI reviews an Execution Plan that <execution_state>
      Then <review_result>

      Examples:
        | execution_state | review_result |
        | maps them to owned instrumentation, tests, evidence collection, and a completion signal | measurement execution does not block approval |
        | omits the accepted instrumentation work | approval is blocked with the missing instrumentation work named |
        | omits evidence collection for the accepted target | approval is blocked with the missing evidence work named |
        | changes the target while defining instrumentation | approval is blocked because execution changed Product-owned behavior |
        | changes the measurement origin without returning to Implementation Planning | approval is blocked because execution changed the accepted design |
        | weakens an accepted validity safeguard while defining instrumentation | approval is blocked because execution changed the accepted validity contract |
        | redefines the accepted failure behavior for the measure | approval is blocked because execution changed the accepted validity contract |

  @plan-implementability.TBU2.7CAMAD.R16
  Rule: plan-implementability.TBU2.7CAMAD.R16 — Changing load-bearing behavior or scope invalidates both plan reviews, changing the accepted Implementation Plan invalidates both plan reviews, and changing only the Execution Plan invalidates only its own review

    @surface.safeword-cli
    Scenario Outline: Review invalidation follows dependency direction
      Given the Implementation and Execution Plans each have a current review
      When the installed Safeword CLI records <change>
      Then <invalidation_result>

      Examples:
        | change | invalidation_result |
        | accepted product behavior | both planning reviews become stale |
        | the accepted scope boundary | both planning reviews become stale |
        | the accepted Implementation Plan | both planning reviews become stale |
        | only Execution Plan sequencing | only the Execution Plan review becomes stale |
        | only a completed delivery task being checked off in the Execution Plan's Delivery Checklist | neither planning review becomes stale |
        | only a Delivery Checklist obligation's Required proof | only the Execution Plan review becomes stale |

    @rejection @surface.safeword-cli
    Scenario: An Execution Plan cannot stay current after its source approach changes
      Given an Execution Plan was approved before its source Implementation Plan changed
      When coding is requested through the installed Safeword CLI
      Then coding remains blocked until both the changed Implementation Plan and its reconciled Execution Plan are reviewed against the current approach

  @plan-implementability.TBU2.7CAMAD.R17
  Rule: plan-implementability.TBU2.7CAMAD.R17 — A design-changing implementation decision returns through revised and re-reviewed Implementation and Execution Plans, while a sequencing-only decision returns through a revised and re-reviewed Execution Plan; both paths preserve still-valid work and evidence and resume from the first invalidated obligation

    @demo @surface.safeword-cli
    Scenario Outline: Implementation-time replanning preserves valid progress and refreshes the affected plans
      Given implementation has completed proof that remains valid under <new_decision>
      And implementation has reached <new_decision>
      When the installed Safeword CLI routes and completes the replan
      Then <resume_result>
      And the previously completed proof remains recorded without being re-run or promoted from its existing A639WN currency class

      Examples:
        | new_decision | resume_result |
        | a change to the accepted authorization approach | the revised Implementation Plan and dependent Execution Plan each receive a fresh exact-content review before work resumes from the first invalidated authorization obligation |
        | a change only to the order of two independent build tasks | only the revised Execution Plan receives a fresh exact-content review before work resumes from the first reordered task |

    @rejection @surface.safeword-cli
    Scenario: Replanning reopens proof invalidated by the changed decision
      Given implementation has current proof for an authorization contract accepted before a design change
      And an implementation-time decision has changed that authorization contract
      When the installed Safeword CLI routes and completes the replan
      Then the previous proof remains audit evidence but is no longer current proof for the first invalidated authorization obligation

    @rejection @surface.safeword-cli
    Scenario: Implementation cannot continue under a stale affected plan
      Given the accepted data ownership approach has changed since the Execution Plan was approved
      When production work attempts to continue through the installed Safeword CLI using the previously approved Execution Plan
      Then the work remains unauthorized until both affected plans are revised and reviewed while still-valid completed evidence remains recorded
