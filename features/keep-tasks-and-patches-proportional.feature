Feature: Keep tasks and patches proportional
  Safeword keeps small work lightweight while promoting consequential decisions before implementation invents them.

  @plan-implementability.TBU3.3EG00H.R1
  Rule: plan-implementability.TBU3.3EG00H.R1 — Formal planning phases remain feature-only

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    @rejection
    Scenario: Tasks and patches discover decisions without receiving feature plan artifacts
      Given a task and patch each need a proportionate decision check
      When their workflows begin
      Then neither creates an Implementation Plan, an Execution Plan, nor an independent planning review

  @plan-implementability.TBU3.3EG00H.R2
  Rule: plan-implementability.TBU3.3EG00H.R2 — Work classification has explicit precedence

    @rejection
    Scenario Outline: The first applicable work contract wins
      Given proposed work satisfies <conditions>
      When Safeword classifies it
      Then it is classified as <work_type>

      Examples:
        | conditions | work_type |
        | the complete narrow patch contract | patch |
        | no patch contract and at least one feature trigger | feature |
        | neither patch nor feature contract | task |

  @plan-implementability.TBU3.3EG00H.R3
  Rule: plan-implementability.TBU3.3EG00H.R3 — Patches exclude feature triggers

    @rejection
    Scenario: A tiny public-contract change cannot be labeled a patch
      Given a one-line edit changes a shared public response contract
      When the narrow patch contract is evaluated
      Then patch classification is rejected because a feature trigger applies

  @plan-implementability.TBU3.3EG00H.R4
  Rule: plan-implementability.TBU3.3EG00H.R4 — Consequential unresolved choices make work a feature

    @rejection
    Scenario Outline: Feature classification follows behavior and decision risk rather than size
      Given proposed work has <trigger>
      When work type is evaluated
      Then it is classified as a feature regardless of file count

      Examples:
        | trigger |
        | multiple user flows |
        | new persistent state |
        | an unresolved shared contract or architecture decision |
        | an unresolved data, migration, compatibility, or proof-boundary decision |

  @plan-implementability.TBU3.3EG00H.R5
  Rule: plan-implementability.TBU3.3EG00H.R5 — Tasks are the total residual classification

    @rejection
    Scenario: Broad residual work is split into tasks rather than left unclassified
      Given work satisfies neither the patch contract nor any feature trigger but is too broad for one bounded task
      When classification completes
      Then it remains task work and is split into dependency-ordered bounded tasks

  @plan-implementability.TBU3.3EG00H.R6
  Rule: plan-implementability.TBU3.3EG00H.R6 — Size signals trigger reevaluation rather than decide type

    @rejection
    Scenario: File count cannot override semantic work type
      Given a one-file change has a feature trigger and a many-file mechanical change has none
      When both are classified
      Then the one-file change is a feature and the mechanical change is not

  @plan-implementability.TBU3.3EG00H.R7
  Rule: plan-implementability.TBU3.3EG00H.R7 — Tasks use inline test specifications

    @rejection
    Scenario: A bounded task receives an inline execution guide without feature planning ceremony
      Given a task has settled behavior and proof boundaries
      When its work is planned
      Then its ticket contains inline test specifications and contains neither feature planning artifacts nor planning reviews

  @plan-implementability.TBU3.3EG00H.R8
  Rule: plan-implementability.TBU3.3EG00H.R8 — Behavior-changing tasks begin with meaningful RED

    @rejection
    Scenario: Production changes are blocked until a meaningful existing-boundary test fails
      Given a behavior-changing task has settled expected behavior and no observed failing test
      When production code modification is attempted
      Then the modification is blocked until one meaningful test fails through an existing boundary

  @plan-implementability.TBU3.3EG00H.R9
  Rule: plan-implementability.TBU3.3EG00H.R9 — Proof method follows the kind of small work

    @rejection
    Scenario Outline: Small work receives the cheapest proof that can catch its regression
      Given the work is a <kind>
      When its pre-change proof is selected
      Then <proof>

      Examples:
        | kind | proof |
        | behavior-preserving task | existing or characterization proof protects the behavior |
        | non-behavioral patch | relevant targeted verification runs without a forced RED step |

  @plan-implementability.TBU3.3EG00H.R10
  Rule: plan-implementability.TBU3.3EG00H.R10 — TDD may settle reversible local implementation choices

    @rejection
    Scenario: A local reversible choice does not promote a task
      Given task TDD exposes two equivalent private helper shapes with no behavior or shared-contract consequence
      When the agent selects one during GREEN
      Then the work remains a task and the local choice is recorded inline

  @plan-implementability.TBU3.3EG00H.R11
  Rule: plan-implementability.TBU3.3EG00H.R11 — TDD stops when it exposes a feature-triggering decision

    @rejection
    Scenario: Promotion preserves completed proof instead of guessing a contract
      Given task TDD exposes an unresolved in-scope public-contract decision
      When implementation reaches that decision
      Then production work stops, completed test evidence is preserved, and the ticket is promoted to the owning feature phase

  @plan-implementability.TBU3.3EG00H.R12
  Rule: plan-implementability.TBU3.3EG00H.R12 — Newly discovered decisions return to the right layer

    @rejection
    Scenario Outline: Discovery routes by the kind and scope of the choice
      Given work discovers <new_choice>
      When its return path is selected
      Then <return_path>

      Examples:
        | new_choice | return_path |
        | an in-scope product-behavior decision | behavior definition resumes |
        | an in-scope implementation-design decision | Implementation Planning resumes |
        | a sequencing-only change | Execution Planning resumes |
        | an out-of-scope idea | it is dropped or offered as a user-owned scope decision |

  @plan-implementability.TBU3.3EG00H.R13
  Rule: plan-implementability.TBU3.3EG00H.R13 — Structural enforcement does not claim semantic classification

    @rejection
    Scenario: A structurally valid task label can still be challenged semantically
      Given a ticket declares task type and contains every required task field but hides an unresolved shared-contract choice
      When classification is checked
      Then structural checks report the declaration while semantic review promotes the work to a feature
