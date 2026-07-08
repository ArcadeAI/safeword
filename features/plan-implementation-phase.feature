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

  @plan-implementation-phase.TB1.R4
  Rule: plan-implementation-phase.TB1.R4 — the architecture record stays honest through planning

    Scenario: Planning directs review of prior architecture decisions
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs consulting the architecture record before filling the alignment section

    Scenario: A significant planning decision triggers an ADR draft offer
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs offering an ADR draft when a decision spans features, data ownership, or cross-service contracts

    @rejection
    Scenario: A deviation from a recorded decision directs superseding the record
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs amending or superseding the contradicted ADR rather than recording the deviation alone

    @rejection
    Scenario: A routine decision stays in the decisions table without an ADR
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it bounds the ADR offer to decisions affecting structure, key quality attributes, or ones difficult to reverse
      And it directs recording routine choices in the plan's decisions table alone

    Scenario: Emitted ADRs scaffold from the shipped template into the configured record location
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs scaffolding new ADRs from the safeword ADR template
      And it directs writing them to the location resolved from paths.architecture, appending to a file or adding a date-prefixed file to a directory

    @rejection
    Scenario: Generated architecture state docs never receive ADRs
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs never writing decision records into generated architecture state documents

    Scenario: A decision proven wrong during implement updates the record mid-flight
      Given the shipped bdd skill documents
      When the planning and TDD phase docs are read
      Then they direct updating the plan and superseding any affected ADR when implementation contradicts a planned decision, before verify

  @plan-implementation-phase.TB2.R1
  Rule: plan-implementation-phase.TB2.R1 — plan depth tracks feature size and risk in both directions

    Scenario: The planning doc keys plan depth to blast radius in both directions
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it states a brief plan is correct for a small feature
      And it directs deeper treatment for hard-to-reverse or cross-cutting work

    Scenario: Planning stores only the plan and qualifying ADRs
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs storing impl-plan.md and qualifying ADRs, routing deeper design to the existing design-doc lane rather than novel artifact kinds

  @plan-implementation-phase.TB2.R2
  Rule: plan-implementation-phase.TB2.R2 — ADRs stay lean

    Scenario: The planning doc bounds each ADR to a lean record
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs keeping each ADR to a page or two
      And it warns against mega-records and design guides in disguise

  @plan-implementation-phase.TB2.R3
  Rule: plan-implementation-phase.TB2.R3 — the editorial check governs size, never whether

    @rejection
    Scenario: Editorial review flags information-free padding
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then its exit review directs flagging spans deletable without information loss
      And it states a shorter plan scores no worse than a longer one at equal decision coverage

    Scenario: Proportionality never waives the mandatory sections
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it states skip lines govern applicability, never effort or size
      And the five sections remain content-or-skip regardless of feature size

  @plan-implementation-phase.TB3.R1
  Rule: plan-implementation-phase.TB3.R1 — current-architecture awareness after the ideal design, never sunk-cost conformance

    Scenario: Planning directs architecture awareness after the ideal design
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs reading the generated architecture state doc and the decision record for reuse candidates after sketching the ideal approach
      And it frames existing architecture as changeable with a recorded decision, not a constraint to conform to

  @plan-implementation-phase.TB3.R2
  Rule: plan-implementation-phase.TB3.R2 — deep design routes through the existing design lanes

    Scenario: Deep technical and data design routes through the existing lanes
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it routes component and data-model design to the design-doc template and the data-architecture guide rather than new plan sections

  @plan-implementation-phase.TB3.R3
  Rule: plan-implementation-phase.TB3.R3 — each load-bearing design choice gets a figure-it-out pass

    Scenario: Load-bearing choices get a figure-it-out pass
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs running the figure-it-out skill for each load-bearing design choice recorded in the decisions table

  @plan-implementation-phase.NTB2.R1
  Rule: plan-implementation-phase.NTB2.R1 — human handoff only after the independent review passes

    Scenario: Raw planning output is never handed to the user
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs any human-facing plan checkpoint to occur only after the phase's independent review has passed

    Scenario: User-only information gaps route to the user at any time
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs asking the user for information not derivable from the codebase or research whenever the gap appears

  @plan-implementation-phase.NTB2.R2
  Rule: plan-implementation-phase.NTB2.R2 — human design approval is an opt-in toggle, autonomous by default

    Scenario: Design approval defaults to autonomous
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it states the reviewed plan advances to implement without human approval when designApprovalGate is absent or off

    @rejection
    Scenario: Enabled design approval waits for the user after the review
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it states that with designApprovalGate enabled the reviewed plan is presented for user approval before implement

  @plan-implementation-phase.NTB2.R3
  Rule: plan-implementation-phase.NTB2.R3 — headless sessions record pending approval instead of blocking

    @surface.claude-code-on-the-web @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: Headless session with approval enabled surfaces the plan instead of stalling
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then it directs sessions without an interactive user to record the pending approval in the work log
      And it directs surfacing the reviewed plan in the session's reviewable output

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

  @plan-implementation-phase.SM1.R4
  Rule: plan-implementation-phase.SM1.R4 — the phase contract runs on current harnesses including cloud surfaces

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.claude-code-on-the-web @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: The phase contract carries no interactive-only dependencies
      Given the shipped bdd skill documents
      When PLAN_IMPLEMENTATION.md is read
      Then its steps require no bash auto-expansion and no interactively-authenticated tools
      And every gate it describes has defined behavior for sessions without an interactive user

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
