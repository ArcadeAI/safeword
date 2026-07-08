Feature: plan-implementation phase before TDD
  A gated BDD phase between scenario-gate and implement (GitHub #480):
  scenario-gate judges only scenario quality; the new phase owns impl-plan.md
  authoring; a transition gate keeps TDD RED from starting before a valid plan.

  @plan-implementation-phase.TB1.R1
  Rule: plan-implementation-phase.TB1.R1 — a new-flow feature cannot enter implement without a valid implementation plan

    @surface.claude-code
    Scenario: Feature with a valid plan advances into implement
      Given a new-flow feature ticket at the plan-implementation phase
      And its impl-plan.md is valid with status planned
      When the agent sets the ticket phase to implement
      Then the phase change is accepted

    @rejection @surface.claude-code
    Scenario: Feature without a plan is denied entry to implement
      Given a new-flow feature ticket at the plan-implementation phase
      And no impl-plan.md exists in the ticket folder
      When the agent sets the ticket phase to implement
      Then the phase change is denied

    @rejection @surface.claude-code
    Scenario: Feature with an incomplete plan is denied entry to implement
      Given a new-flow feature ticket at the plan-implementation phase
      And its impl-plan.md is missing a required section
      When the agent sets the ticket phase to implement
      Then the phase change is denied
      And the denial names the missing plan section

    @rejection @surface.claude-code
    Scenario: Plan still marked implemented from a replan loop is denied entry
      Given a new-flow feature ticket at the plan-implementation phase
      And its impl-plan.md is valid but its status line reads implemented
      When the agent sets the ticket phase to implement
      Then the phase change is denied
      And the denial names the stale plan status

    Scenario: Legacy feature without spec.md is grandfathered past the plan gate
      Given a feature ticket with no spec.md at the plan-implementation phase
      And no impl-plan.md exists in the ticket folder
      When the agent sets the ticket phase to implement
      Then the phase change is accepted

    Scenario: Task tickets reach implement without a plan requirement
      Given a task ticket with no impl-plan.md
      When the agent sets the ticket phase to implement
      Then the phase change is accepted

  @plan-implementation-phase.TB1.R2
  Rule: plan-implementation-phase.TB1.R2 — a ticket interrupted mid-planning resumes into planning work, not scenario re-validation

    Scenario: Resume guidance routes a planning-phase ticket to the planning doc
      Given the shipped bdd skill documents
      When the resume table and phase-file table are read
      Then the plan-implementation row directs the agent to PLAN_IMPLEMENTATION.md and continuing the implementation plan

    @surface.claude-code
    Scenario: Prompt guidance during planning names the planning work
      Given a session whose active feature ticket sits at the plan-implementation phase
      When the user submits a prompt
      Then the injected phase reminder describes authoring the implementation plan

  @plan-implementation-phase.TB1.R3
  Rule: plan-implementation-phase.TB1.R3 — the scenario-gate exit judges only scenario quality

    Scenario: Scenario-gate exit contains only scenario-quality steps
      Given the shipped bdd skill documents
      When the scenario-gate exit checklist is read
      Then no exit step directs authoring impl-plan.md
      And its phase advance targets plan-implementation

    Scenario: The planning phase doc owns the impl-plan authoring steps
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs authoring impl-plan.md with the five design sections

    Scenario: No shipped surface still claims the plan is authored at scenario-gate exit
      Given the shipped templates and hook sources
      When they are searched for the phrase "authored at scenario-gate exit"
      Then no occurrences are found

  @plan-implementation-phase.NTB1.R1
  Rule: plan-implementation-phase.NTB1.R1 — application code stays untouched while a feature ticket is in the planning phase

    @rejection @surface.claude-code
    Scenario: Application-code edit during planning is denied
      Given a new-flow feature ticket at the plan-implementation phase
      When the agent edits an application source file
      Then the edit is denied
      And the denial names the planning work remaining

    @surface.claude-code
    Scenario: Ticket artifacts stay editable during planning
      Given a new-flow feature ticket at the plan-implementation phase
      When the agent writes impl-plan.md in the ticket folder
      Then the write is accepted

  @plan-implementation-phase.NTB1.R2
  Rule: plan-implementation-phase.NTB1.R2 — a planning-gate denial names the missing artifact and the concrete next action in plain language

    @rejection @surface.claude-code
    Scenario: Transition denial explains what is missing and what to do next
      Given a new-flow feature ticket at the plan-implementation phase
      And no impl-plan.md exists in the ticket folder
      When the agent sets the ticket phase to implement
      Then the denial names impl-plan.md as the missing artifact
      And the denial names the scaffold template to author the plan from

  @plan-implementation-phase.SM1.R1
  Rule: plan-implementation-phase.SM1.R1 — every phase-keyed surface carries a plan-implementation entry

    Scenario: Canonical phase order places plan-implementation between scenario-gate and implement
      Given the canonical phase list
      Then it reads intake, define-behavior, scenario-gate, plan-implementation, implement, verify, done

    @surface.claude-code
    Scenario: A feature at scenario-gate advances one step into plan-implementation
      Given a feature ticket at the scenario-gate phase
      When the agent sets the ticket phase to plan-implementation
      Then the phase change is accepted

    @rejection @surface.claude-code
    Scenario: Jumping from scenario-gate straight to implement is denied as a skipped phase
      Given a feature ticket at the scenario-gate phase
      And the ticket carries no phase_skips justification for plan-implementation
      When the agent sets the ticket phase to implement
      Then the phase change is denied
      And the denial names plan-implementation as the skipped phase

    @surface.claude-code
    Scenario: A justified skip past plan-implementation is accepted
      Given a feature ticket at the scenario-gate phase
      And the ticket carries a phase_skips justification for plan-implementation
      When the agent sets the ticket phase to implement
      Then the phase change is accepted

    @rejection @surface.claude-code
    Scenario: A jump from intake to done names all five skipped phases
      Given a feature ticket at the intake phase
      When the agent sets the ticket phase to done
      Then the phase change is denied
      And the denial names define-behavior, scenario-gate, plan-implementation, implement, and verify as the skipped phases

    @rejection @surface.claude-code
    Scenario: Stopping at plan-implementation without the scenario ledger is blocked
      Given a feature ticket at the plan-implementation phase
      And no test-definitions.md exists in the ticket folder
      When the agent ends the session
      Then the stop is blocked until the ledger exists

    @surface.claude-code
    Scenario: Stopping mid-planning without a plan yet is allowed
      Given a feature ticket at the plan-implementation phase
      And its test-definitions.md exists with scenario checkboxes
      And no impl-plan.md exists in the ticket folder
      When the agent ends the session
      Then the stop is allowed

    Scenario: Splitting guidance is remapped to the planning phase
      Given the shipped bdd splitting document
      When its checkpoint and restart tables are read
      Then the task-count split checkpoint is keyed to plan-implementation
      And split children at plan-implementation or later restart at plan-implementation

  @plan-implementation-phase.SM1.R2
  Rule: plan-implementation-phase.SM1.R2 — the phase doc ships with full cross-harness parity

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: The planning phase doc ships to all three harnesses
      Given the schema manifest
      Then PLAN_IMPLEMENTATION.md is registered for the Claude skill directory, the Codex skill directory, and a Cursor rule
      And each installed copy is byte-identical to its template

  @plan-implementation-phase.SM1.R3
  Rule: plan-implementation-phase.SM1.R3 — the decomposition-retirement ADR is superseded on the record

    Scenario: The architecture record supersedes the decomposition retirement
      Given the project architecture record
      Then an accepted ADR records the plan-implementation phase
      And the decomposition-retirement ADR is marked superseded by it
