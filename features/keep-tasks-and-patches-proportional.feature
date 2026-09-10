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
    Scenario Outline: Installed hosts apply feature ceremony only after classification
      Given <host> receives work already classified as <work_type>
      When <installed_entry> begins its workflow with real configuration and collaborators
      Then <planning_contract>

      Examples:
        | host | installed_entry | work_type | planning_contract |
        | Safeword CLI | actual installed CLI dispatch | task | no feature planning artifact or planning review is created |
        | Safeword CLI | actual installed CLI dispatch | feature | both feature plans and their independent reviews are required |
        | Claude Code | actual lifecycle dispatch from installed project hooks | feature | both feature plans and their independent reviews are required |
        | Claude Code | actual lifecycle dispatch from installed project hooks | task | no feature planning artifact or planning review is created |
        | Claude Code Cloud | lifecycle dispatch from project hooks in a deterministic fresh-clone fixture | task | no feature planning artifact or planning review is created |
        | Claude Code Cloud | lifecycle dispatch from project hooks in a deterministic fresh-clone fixture | feature | both feature plans and their independent reviews are required |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks | feature | both feature plans and their independent reviews are required |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks | task | no feature planning artifact or planning review is created |
        | OpenCode | actual lifecycle dispatch from the installed profile plugin | task | no feature planning artifact or planning review is created |
        | OpenCode | actual lifecycle dispatch from the installed profile plugin | feature | both feature plans and their independent reviews are required |
        | Cursor | actual lifecycle dispatch from installed project hooks | feature | both feature plans and their independent reviews are required |
        | Cursor | actual lifecycle dispatch from installed project hooks | task | no feature planning artifact or planning review is created |
        | Cursor Cloud Agents | lifecycle dispatch from project hooks in a deterministic fresh-clone fixture | task | no feature planning artifact or planning review is created |
        | Cursor Cloud Agents | lifecycle dispatch from project hooks in a deterministic fresh-clone fixture | feature | both feature plans and their independent reviews are required |

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
      Given proposed work changes <file_count> and has <trigger>
      When work type is evaluated
      Then it is classified as <work_type>

      Examples:
        | file_count | trigger | work_type |
        | one file | multiple user flows | feature |
        | one file | new persistent state | feature |
        | many files | an unresolved shared contract or architecture decision | feature |
        | many files | an unresolved data, migration, compatibility, or proof-boundary decision | feature |
        | one file | a settled private implementation choice with no behavior or shared-contract consequence | task |

  @plan-implementability.TBU3.3EG00H.R5
  Rule: plan-implementability.TBU3.3EG00H.R5 — Tasks are the total residual classification

    Scenario: Broad residual work remains task work
      Given work satisfies neither the patch contract nor any feature trigger but is too broad for one bounded task
      When classification completes
      Then it is classified as task work rather than left unclassified or promoted solely because of size

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

  @plan-implementability.TBU3.3EG00H.R7
  Rule: plan-implementability.TBU3.3EG00H.R7 — Tasks use inline test specifications

    @surface.safeword-cli
    Scenario: Installed task planning writes inline test specifications
      Given a bounded task has settled behavior and proof boundaries
      When actual installed CLI dispatch plans its work with real configuration and collaborators
      Then the task ticket contains inline test specifications naming its behavior and proof boundary

  @plan-implementability.TBU3.3EG00H.R8
  Rule: plan-implementability.TBU3.3EG00H.R8 — Behavior-changing tasks begin with meaningful RED

    @rejection
    Scenario: Production changes are blocked before meaningful RED
      Given NTB has a behavior-changing task with settled expected behavior and no observed failing test
      When production code modification is attempted
      Then the modification is blocked with creating one meaningful failing test through an existing boundary named as the one next action

    Scenario: Meaningful RED permits the production change
      Given NTB has a behavior-changing task with one observed meaningful failing test through an existing boundary and the failing evidence linked
      When production code modification is attempted
      Then the modification is permitted to proceed to GREEN with the linked failing evidence preserved

    @rejection @surface.claude-code
    Scenario: Installed lifecycle dispatch enforces meaningful RED
      Given NTB has a behavior-changing task with settled expected behavior and no observed failing test
      When actual lifecycle dispatch from installed Claude Code project hooks attempts a production modification with real configuration and collaborators
      Then the modification is blocked and the primary message names creating one meaningful failing test through an existing boundary as the one next action

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

  @plan-implementability.TBU3.3EG00H.R11
  Rule: plan-implementability.TBU3.3EG00H.R11 — TDD stops when it exposes a feature-triggering decision

    @rejection
    Scenario: Promotion preserves completed proof instead of guessing a contract
      Given NTB's task TDD has exposed an unresolved in-scope public-contract decision after producing test evidence
      When implementation reaches that decision
      Then production work stops, the completed test evidence is preserved, and the message names resuming at the owning feature phase as the one next action

    @rejection
    Scenario: Promotion before RED stops without inventing evidence
      Given NTB's task investigation exposes an unresolved public-contract decision before any failing test exists
      When implementation would otherwise begin
      Then production work stops, no test evidence is claimed, and the message names resuming at behavior definition as the one next action

  @plan-implementability.TBU3.3EG00H.R12
  Rule: plan-implementability.TBU3.3EG00H.R12 — Newly discovered decisions return to the right layer

    Scenario Outline: A promoted task resumes at the layer that owns its new choice
      Given a task is promoted after exposing <new_choice>
      When its return path is selected
      Then <return_path>

      Examples:
        | new_choice | return_path |
        | an in-scope product-behavior decision | behavior definition resumes with existing evidence preserved |
        | an in-scope implementation-design decision | Implementation Planning resumes with existing evidence preserved |
        | a sequencing-only change | Execution Planning resumes with existing evidence preserved |

    Scenario Outline: Out-of-scope discoveries route by consequence
      Given a task is promoted after exposing <out_of_scope_discovery>
      When its scope-boundary response is selected
      Then <scope_result>

      Examples:
        | out_of_scope_discovery | scope_result |
        | an irrelevant out-of-scope idea | the idea is dropped and the accepted scope remains unchanged |
        | an out-of-scope idea whose exclusion would change the accepted outcome | work remains blocked while the idea is surfaced as a user-owned scope decision |

    Scenario: Ordinary feature work uses the same decision return routes
      Given feature work discovers an in-scope implementation-design decision after Execution Planning
      When its return path is selected
      Then Implementation Planning resumes with existing evidence preserved

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
      Then the workflow remains blocked and the primary message names restoring the classification configuration as the one next action

  @plan-implementability.TBU3.3EG00H.R14 @demo
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

    @rejection
    Scenario: A completed task checklist cannot claim merge authority
      Given every contributor-controlled task obligation has current proof
      When Safeword reports contributor readiness
      Then it reports the task ready for human review without creating feature plans or claiming the change may merge
