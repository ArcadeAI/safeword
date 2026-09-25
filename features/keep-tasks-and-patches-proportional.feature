Feature: Keep tasks and patches proportional
  Safeword keeps small work lightweight while promoting consequential decisions before implementation invents them.
  Untagged scenarios prove the shared work-type contract; tagged scenarios prove installed entry points.

  @plan-implementability.TBU3.3EG00H.R1
  Rule: plan-implementability.TBU3.3EG00H.R1 — Formal planning phases remain feature-only

    Scenario Outline: Planning ceremony follows work type
      Given proposed work is already classified as <work_type>
      When its workflow begins
      Then <planning_contract>

      Examples:
        | work_type | planning_contract |
        | patch | no Implementation Plan, Execution Plan, or independent planning review is created |
        | task | no Implementation Plan, Execution Plan, or independent planning review is created |
        | feature | an Implementation Plan, Execution Plan, and independent review for each plan are required |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts apply feature ceremony by work type
      Given <host> receives work already classified as <work_type>
      When <installed_entry> begins its workflow with real configuration and collaborators
      Then <planning_contract>

      Examples:
        | host | installed_entry | work_type | planning_contract |
        | Safeword CLI | actual installed CLI dispatch | task | no feature planning artifact or planning review is created |
        | Safeword CLI | actual installed CLI dispatch | patch | no feature planning artifact or planning review is created |
        | Safeword CLI | actual installed CLI dispatch | feature | both feature plans and their independent reviews are required |
        | Claude Code | actual lifecycle dispatch from installed project hooks | feature | both feature plans and their independent reviews are required |
        | Claude Code | actual lifecycle dispatch from installed project hooks | task | no feature planning artifact or planning review is created |
        | Claude Code | actual lifecycle dispatch from installed project hooks | patch | no feature planning artifact or planning review is created |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | task | no feature planning artifact or planning review is created |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | patch | no feature planning artifact or planning review is created |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM | feature | both feature plans and their independent reviews are required |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks | feature | both feature plans and their independent reviews are required |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks | task | no feature planning artifact or planning review is created |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks | patch | no feature planning artifact or planning review is created |
        | OpenCode | actual lifecycle dispatch from the installed profile plugin | task | no feature planning artifact or planning review is created |
        | OpenCode | actual lifecycle dispatch from the installed profile plugin | patch | no feature planning artifact or planning review is created |
        | OpenCode | actual lifecycle dispatch from the installed profile plugin | feature | both feature plans and their independent reviews are required |
        | Cursor | actual lifecycle dispatch from installed project hooks | feature | both feature plans and their independent reviews are required |
        | Cursor | actual lifecycle dispatch from installed project hooks | task | no feature planning artifact or planning review is created |
        | Cursor | actual lifecycle dispatch from installed project hooks | patch | no feature planning artifact or planning review is created |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | task | no feature planning artifact or planning review is created |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | patch | no feature planning artifact or planning review is created |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner | feature | both feature plans and their independent reviews are required |

  @plan-implementability.TBU3.3EG00H.R2
  Rule: plan-implementability.TBU3.3EG00H.R2 — Work classification has explicit precedence

    Scenario Outline: The first applicable work contract wins
      Given proposed work <observable_shape>
      When Safeword classifies it
      Then it is classified as <work_type>

      Examples:
        | observable_shape | work_type |
        | is a one-line non-behavioral edit with targeted proof and is also bounded residual work | patch |
        | changes a shared public response contract despite also correcting a typo | feature |
        | performs a mechanical multi-file update that also introduces new persistent state | feature |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts route unclassified work through the shared classifier
      Given <installed_entry> receives unclassified work that <observable_shape>
      When the host's real dispatch classifies the work with real configuration and collaborators
      Then the shared classifier returns <work_type>

      Examples:
        | installed_entry | observable_shape | work_type |
        | actual installed CLI dispatch | is a one-line non-behavioral correction with targeted proof | patch |
        | actual installed CLI dispatch | changes a shared public response contract | feature |
        | actual installed CLI dispatch | is bounded residual work requiring new regression proof | task |
        | actual Claude Code lifecycle dispatch from installed project hooks | is a one-line non-behavioral correction with targeted proof | patch |
        | actual Claude Code lifecycle dispatch from installed project hooks | changes a shared public response contract | feature |
        | actual Claude Code lifecycle dispatch from installed project hooks | is bounded residual work requiring new regression proof | task |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM | is a one-line non-behavioral correction with targeted proof | patch |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM | changes a shared public response contract | feature |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM | is bounded residual work requiring new regression proof | task |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks | is a one-line non-behavioral correction with targeted proof | patch |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks | changes a shared public response contract | feature |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks | is bounded residual work requiring new regression proof | task |
        | actual OpenCode lifecycle dispatch from the installed profile plugin | is a one-line non-behavioral correction with targeted proof | patch |
        | actual OpenCode lifecycle dispatch from the installed profile plugin | changes a shared public response contract | feature |
        | actual OpenCode lifecycle dispatch from the installed profile plugin | is bounded residual work requiring new regression proof | task |
        | actual Cursor lifecycle dispatch from installed project hooks | is a one-line non-behavioral correction with targeted proof | patch |
        | actual Cursor lifecycle dispatch from installed project hooks | changes a shared public response contract | feature |
        | actual Cursor lifecycle dispatch from installed project hooks | is bounded residual work requiring new regression proof | task |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner | is a one-line non-behavioral correction with targeted proof | patch |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner | changes a shared public response contract | feature |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner | is bounded residual work requiring new regression proof | task |

  @plan-implementability.TBU3.3EG00H.R3
  Rule: plan-implementability.TBU3.3EG00H.R3 — Patches exclude feature triggers

    @rejection
    Scenario: A tiny public-contract change cannot be labeled a patch
      Given a one-line edit changes a shared public response contract
      When the narrow patch contract is evaluated
      Then patch classification is rejected because a feature trigger applies

  @plan-implementability.TBU3.3EG00H.R4
  Rule: plan-implementability.TBU3.3EG00H.R4 — Consequential unresolved choices make work a feature

    Scenario Outline: Feature classification follows unresolved decision risk
      Given proposed work has <trigger>
      When work type is evaluated
      Then it is classified as <work_type>

      Examples:
        | trigger | work_type |
        | multiple user flows | feature |
        | new persistent state | feature |
        | an unresolved public or shared contract decision | feature |
        | an unresolved durable architecture decision | feature |
        | an unresolved data ownership or lifecycle decision | feature |
        | an unresolved migration or compatibility decision | feature |
        | an unresolved required proof-boundary decision | feature |
        | a settled private implementation choice with no shared-contract consequence that requires new regression proof | task |

  @plan-implementability.TBU3.3EG00H.R5
  Rule: plan-implementability.TBU3.3EG00H.R5 — Tasks are the total residual classification

    Scenario: Broad residual work remains task work
      Given work satisfies neither the patch contract nor any feature trigger but is too broad for one bounded task
      When classification completes
      Then it remains task work and is split into dependency-ordered tasks rather than left unclassified or promoted solely because of size

    Scenario: Unfamiliar residual work still receives a task classification
      Given work matches no known patch example, has no feature trigger, and is bounded enough for one unit of work
      When classification completes
      Then it is classified as a task rather than left unclassified or deferred for another work type

  @plan-implementability.TBU3.3EG00H.R6
  Rule: plan-implementability.TBU3.3EG00H.R6 — Size signals trigger reevaluation rather than decide type

    Scenario Outline: File count cannot override semantic work type
      Given proposed work changes <file_count> and <semantic_shape>
      When it is classified
      Then its work type is <work_type>

      Examples:
        | file_count | semantic_shape | work_type |
        | one file | introduces a new user flow | feature |
        | many files | performs a mechanical rename with settled behavior | task |

    Scenario Outline: Crossing a size signal triggers semantic reevaluation
      Given work is classified as a task and its change set grows beyond the configured size signal with <semantic_shape>
      When the workflow observes the growth
      Then a classification reevaluation is recorded before further production changes and the resulting type is <work_type>

      Examples:
        | semantic_shape | work_type |
        | only a mechanical rename with settled behavior | task |
        | a newly introduced user flow | feature |

    Scenario Outline: Crossing an affected-surface signal triggers semantic reevaluation
      Given work is classified as a task and expands from one surface to <surface_breadth> with <semantic_shape>
      When the workflow observes the growth
      Then a classification reevaluation is recorded before further production changes and the resulting type is <work_type>

      Examples:
        | surface_breadth | semantic_shape | work_type |
        | seven installed host surfaces | only mechanical parity with settled behavior | task |
        | two public surfaces | a newly divergent user flow | feature |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts enforce reevaluation only after a configured signal is crossed
      Given <installed_entry> is running task work whose size and affected surfaces <signal_state>
      When the installed workflow observes the growth with real configuration and collaborators
      Then <gate_result>

      Examples:
        | installed_entry | signal_state | gate_result |
        | actual installed CLI dispatch | remain within configured signals | production continues without a classification reevaluation |
        | actual installed CLI dispatch | cross the configured surface signal | production pauses until semantic reevaluation is recorded |
        | actual Claude Code lifecycle dispatch from installed project hooks | remain within configured signals | production continues without a classification reevaluation |
        | actual Claude Code lifecycle dispatch from installed project hooks | cross the configured surface signal | production pauses until semantic reevaluation is recorded |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM | remain within configured signals | production continues without a classification reevaluation |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM | cross the configured surface signal | production pauses until semantic reevaluation is recorded |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks | remain within configured signals | production continues without a classification reevaluation |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks | cross the configured surface signal | production pauses until semantic reevaluation is recorded |
        | actual OpenCode lifecycle dispatch from the installed profile plugin | remain within configured signals | production continues without a classification reevaluation |
        | actual OpenCode lifecycle dispatch from the installed profile plugin | cross the configured surface signal | production pauses until semantic reevaluation is recorded |
        | actual Cursor lifecycle dispatch from installed project hooks | remain within configured signals | production continues without a classification reevaluation |
        | actual Cursor lifecycle dispatch from installed project hooks | cross the configured surface signal | production pauses until semantic reevaluation is recorded |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner | remain within configured signals | production continues without a classification reevaluation |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner | cross the configured surface signal | production pauses until semantic reevaluation is recorded |

  @plan-implementability.TBU3.3EG00H.R7
  Rule: plan-implementability.TBU3.3EG00H.R7 — Tasks use inline test specifications

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed task planning writes inline test specifications
      Given a bounded task has settled behavior and proof boundaries
      When <installed_entry> plans its work with real configuration and collaborators
      Then the task ticket contains inline test specifications naming its behavior and proof boundary

      Examples:
        | installed_entry |
        | actual installed CLI dispatch |
        | actual Claude Code lifecycle dispatch from installed project hooks |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks |
        | actual OpenCode lifecycle dispatch from the installed profile plugin |
        | actual Cursor lifecycle dispatch from installed project hooks |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner |

    @rejection @surface.safeword-cli
    Scenario: An inline task specification missing its proof boundary is incomplete
      Given a task ticket contains expected behavior but its inline test specification names no proof boundary
      When installed Safeword CLI dispatch validates task readiness
      Then the task is reported incomplete and cannot begin TDD

  @plan-implementability.TBU3.3EG00H.R8
  Rule: plan-implementability.TBU3.3EG00H.R8 — Behavior-changing tasks begin with meaningful RED

    @rejection
    Scenario: Production changes are blocked before meaningful RED
      Given a technical builder has a behavior-changing task with settled expected behavior and no observed failing test
      When production code modification is attempted
      Then the modification is blocked because no meaningful failing test through an existing boundary has been observed

    Scenario: Meaningful RED permits the production change
      Given a technical builder has a behavior-changing task with one observed meaningful failing test through an existing boundary and the failing evidence linked
      When production code modification is attempted
      Then the modification is permitted to proceed to GREEN with the linked failing evidence preserved

    @rejection
    Scenario Outline: An observed but meaningless failure does not satisfy RED
      Given a behavior-changing task has an observed failing test that <invalid_proof>
      When production code modification is attempted
      Then the modification remains blocked and that failure is rejected as meaningful RED

      Examples:
        | invalid_proof |
        | fails only through a newly invented boundary |
        | fails for a reason unrelated to the settled expected behavior |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed lifecycle dispatch enforces meaningful RED
      Given a technical builder has a behavior-changing task with settled expected behavior and <red_state>
      When <installed_entry> attempts a production modification with real configuration and collaborators
      Then <gate_result>

      Examples:
        | installed_entry | red_state | gate_result |
        | actual installed CLI dispatch | no observed failing test | the modification is blocked because meaningful RED is missing |
        | actual installed CLI dispatch | an observed meaningful failing test through an existing boundary with linked evidence | the modification is permitted to proceed to GREEN with the linked evidence preserved |
        | actual Claude Code lifecycle dispatch from installed project hooks | no observed failing test | the modification is blocked because meaningful RED is missing |
        | actual Claude Code lifecycle dispatch from installed project hooks | an observed meaningful failing test through an existing boundary with linked evidence | the modification is permitted to proceed to GREEN with the linked evidence preserved |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM | no observed failing test | the modification is blocked because meaningful RED is missing |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM | an observed meaningful failing test through an existing boundary with linked evidence | the modification is permitted to proceed to GREEN with the linked evidence preserved |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks | no observed failing test | the modification is blocked because meaningful RED is missing |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks | an observed meaningful failing test through an existing boundary with linked evidence | the modification is permitted to proceed to GREEN with the linked evidence preserved |
        | actual OpenCode lifecycle dispatch from the installed profile plugin | no observed failing test | the modification is blocked because meaningful RED is missing |
        | actual OpenCode lifecycle dispatch from the installed profile plugin | an observed meaningful failing test through an existing boundary with linked evidence | the modification is permitted to proceed to GREEN with the linked evidence preserved |
        | actual Cursor lifecycle dispatch from installed project hooks | no observed failing test | the modification is blocked because meaningful RED is missing |
        | actual Cursor lifecycle dispatch from installed project hooks | an observed meaningful failing test through an existing boundary with linked evidence | the modification is permitted to proceed to GREEN with the linked evidence preserved |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner | no observed failing test | the modification is blocked because meaningful RED is missing |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner | an observed meaningful failing test through an existing boundary with linked evidence | the modification is permitted to proceed to GREEN with the linked evidence preserved |

  @plan-implementability.TBU3.3EG00H.R9
  Rule: plan-implementability.TBU3.3EG00H.R9 — Proof method follows the kind of small work

    Scenario: A behavior-preserving task reuses adequate existing proof
      Given a behavior-preserving task has an existing test that would fail if the protected behavior regressed
      When its pre-change proof is selected
      Then that existing test is recorded as the protection and no new RED test is required

    Scenario: A behavior-preserving task creates characterization proof when coverage is absent
      Given a behavior-preserving task has no existing test covering the protected behavior
      When its pre-change proof is selected
      Then a characterization test is created and observed passing before the change

    Scenario: An existing but inadequate test does not replace characterization proof
      Given a behavior-preserving task has an existing test touching the changed file that still passes when the protected behavior is deliberately regressed
      When its pre-change proof is selected
      Then that test is rejected as protection and a characterization test is created and observed passing before the change

    Scenario: A non-behavioral patch uses targeted verification without forced RED
      Given a patch changes no behavior and has a targeted check capable of catching its regression
      When its pre-change proof is selected
      Then that targeted verification is recorded and no failing test is required

  @plan-implementability.TBU3.3EG00H.R10
  Rule: plan-implementability.TBU3.3EG00H.R10 — TDD may settle reversible local implementation choices

    Scenario: A local reversible choice does not promote a task
      Given task TDD exposes two equivalent private helper shapes with no behavior or shared-contract consequence
      When the agent selects one during GREEN
      Then the work remains a task and the local choice is recorded inline

    Scenario: Task refactoring preserves proof without reopening classification
      Given a task is GREEN with linked passing proof and no feature trigger
      When REFACTOR changes only private structure
      Then the linked proof remains passing and the work remains a task without classification restarting

    Scenario: A sequencing-only task change stays in the inline task record
      Given task TDD discovers a sequencing-only change with no feature trigger
      When the task records the local execution adjustment
      Then the work remains a task without entering Implementation Planning or Execution Planning

  @plan-implementability.TBU3.3EG00H.R11
  Rule: plan-implementability.TBU3.3EG00H.R11 — TDD stops when it exposes a feature-triggering decision

    @rejection
    Scenario: Promotion preserves completed proof instead of guessing a contract
      Given a technical builder's task TDD has exposed an unresolved in-scope public-contract decision after producing test evidence
      When implementation reaches that decision
      Then production work stops, the completed test evidence is preserved, and the promoted work resumes at Implementation Planning

    @rejection
    Scenario: Promotion before RED stops without inventing evidence
      Given a technical builder's task investigation records findings and exposes an unresolved in-scope public-contract design decision before any failing test exists
      When implementation would otherwise begin
      Then production work stops, the recorded investigation findings survive the promotion, no test evidence is claimed, and the task is promoted without inventing the decision

    @rejection @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts promote a task when TDD exposes a feature decision
      Given task TDD has produced linked test evidence and then exposes an unresolved in-scope public-contract design decision
      When <installed_entry> reaches the decision through real dispatch with real configuration and collaborators
      Then production modification stops, the linked evidence is preserved, and the promoted work resumes at Implementation Planning

      Examples:
        | installed_entry |
        | actual installed CLI dispatch |
        | actual Claude Code lifecycle dispatch from installed project hooks |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks |
        | actual OpenCode lifecycle dispatch from the installed profile plugin |
        | actual Cursor lifecycle dispatch from installed project hooks |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner |

  @plan-implementability.TBU3.3EG00H.R12
  Rule: plan-implementability.TBU3.3EG00H.R12 — Newly discovered decisions return to the right layer

    Scenario Outline: A promoted task resumes at the layer that owns its new choice
      Given a task is promoted after exposing <new_choice>
      When its return path is selected
      Then <return_path>

      Examples:
        | new_choice | return_path |
        | an in-scope product-behavior decision | behavior definition resumes with existing evidence preserved |
        | an in-scope public-contract design decision | Implementation Planning resumes with existing evidence preserved |
        | an in-scope implementation-design decision | Implementation Planning resumes with existing evidence preserved |

    Scenario: Work already promoted to a feature routes a sequencing-only change to Execution Planning
      Given a task was already promoted to a feature for a feature-triggering decision and has an accepted Implementation Plan
      When the promoted feature discovers a sequencing-only change
      Then Execution Planning resumes with existing evidence preserved

    @rejection @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts return a promoted product decision to behavior definition
      Given task investigation has recorded evidence and exposes an unresolved in-scope product-behavior decision
      When <installed_entry> promotes the work through real dispatch with real configuration and collaborators
      Then production modification stops, the investigation evidence is preserved, and behavior definition resumes

      Examples:
        | installed_entry |
        | actual installed CLI dispatch |
        | actual Claude Code lifecycle dispatch from installed project hooks |
        | actual Claude Code Cloud lifecycle dispatch from project hooks in a fresh VM |
        | actual OpenAI Codex lifecycle dispatch from installed project hooks |
        | actual OpenCode lifecycle dispatch from the installed profile plugin |
        | actual Cursor lifecycle dispatch from installed project hooks |
        | actual Cursor Cloud Agents lifecycle dispatch from project hooks in a fresh runner |

    Scenario Outline: Out-of-scope discoveries route by consequence
      Given a task is promoted after exposing <out_of_scope_discovery>
      When its scope-boundary response is selected
      Then <scope_result>

      Examples:
        | out_of_scope_discovery | scope_result |
        | an irrelevant out-of-scope idea | the idea is dropped and the accepted scope remains unchanged |
        | an out-of-scope idea whose exclusion would change the accepted outcome | work remains blocked while the idea is surfaced as a user-owned scope decision |

  @plan-implementability.TBU3.3EG00H.R13
  Rule: plan-implementability.TBU3.3EG00H.R13 — Structural enforcement does not claim semantic classification

    @surface.safeword-cli
    Scenario: Installed checks distinguish structural validity from semantic classification
      Given a ticket declares task type and contains every required task field but hides an unresolved shared-contract choice
      When actual installed CLI validation and classification review run with real configuration and collaborators
      Then structural validation reports the declaration as valid while semantic review promotes the work to a feature

    @rejection @surface.safeword-cli
    Scenario: Installed classification failure cannot silently bypass feature ceremony
      Given a feature candidate reaches actual installed CLI dispatch with corrupt classification configuration
      When classification and structural validation attempt to run with real collaborators
      Then the workflow remains blocked and no feature ceremony is bypassed

  @plan-implementability.TBU3.3EG00H.R14
  Rule: plan-implementability.TBU3.3EG00H.R14 — Tasks and patches carry a proportionate Delivery Checklist in their existing inline work record, with each applicable obligation proven, concretely skipped, or assigned as a human dependency without creating feature plans or claiming merge authority

    Scenario Outline: Small work records every applicable delivery obligation honestly
      Given <work_type> has <delivery_obligation>
      When Safeword prepares the work for contributor handoff
      Then <checklist_result>

      Examples:
        | work_type | delivery_obligation | checklist_result |
        | task | a contributor-controlled documentation update | the inline task record keeps the item open until current proof is attached |
        | patch | monitoring is concretely irrelevant to a wording-only correction | the inline patch record marks monitoring not applicable with that reason |
        | task | production rollout approval owned by a human | the inline task record names the human dependency without claiming approval |

    @demo @surface.safeword-cli
    Scenario Outline: Equivalent small work reaches human review through the lightweight route
      Given a user requests <work> with settled scope and no feature trigger
      When installed Safeword CLI dispatch completes the proportional <work_type> workflow with real configuration and collaborators
      Then the existing inline work record contains <proof> and <checklist_resolution>, and the contribution is ready for human review without an Implementation Plan, Execution Plan, independent planning review, or merge-authority claim

      Examples:
        | work_type | work | proof | checklist_resolution |
        | task | a private retry correction with settled behavior | observed meaningful RED followed by passing targeted tests | the test item links that proof, documentation is not applicable because no public contract changed, and rollout approval remains assigned to the release owner |
        | patch | a misspelled guide heading | a targeted link check capable of catching the regression | documentation links the corrected render, tests are not applicable because executable behavior did not change, and monitoring is not applicable because no runtime changed |

    @surface.claude-code-cloud @surface.cursor-cloud-agents
    Scenario Outline: Cloud small-work handoff records a human dependency without blocking contributor readiness
      Given task work on <cloud_entry> has completed every contributor-controlled obligation and rollout approval remains human-owned
      When the real cloud workflow prepares contributor handoff
      Then the inline task record names the pending rollout approver and reports contributor-ready without claiming rollout or merge approval

      Examples:
        | cloud_entry |
        | Claude Code Cloud project hooks in a fresh VM |
        | Cursor Cloud Agents project hooks in a fresh runner |

    @rejection
    Scenario: A completed task checklist cannot claim merge authority
      Given every contributor-controlled task obligation has current proof
      When Safeword reports contributor readiness
      Then it reports the task ready for human review without creating feature plans or claiming the change may merge
