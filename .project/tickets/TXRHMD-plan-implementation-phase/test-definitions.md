# Test Definitions: plan-implementation phase before TDD

Feature source: `features/plan-implementation-phase.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementation-phase.TB1.R1 — a new-flow feature cannot enter implement without a valid implementation plan

### Scenario: Feature with a valid plan advances into implement

- [x] RED skip: over-blocking guard — allow-path passed pre-gate by design (#928); pinned in 93e792e0
- [x] GREEN 34110654
- [x] REFACTOR skip: shared slice-2 loop

### Scenario: Feature without a plan is denied entry to implement

- [x] RED 93e792e0
- [x] GREEN 34110654
- [x] REFACTOR skip: shared slice-2 loop

### Scenario: Feature with an incomplete plan is denied entry to implement

- [x] RED 93e792e0
- [x] GREEN 34110654
- [x] REFACTOR skip: shared slice-2 loop

### Scenario: Plan still marked implemented from a replan loop is denied entry

- [x] RED 93e792e0
- [x] GREEN 34110654
- [x] REFACTOR skip: shared slice-2 loop

### Scenario: Legacy feature without spec.md is grandfathered past the plan gate

- [x] RED skip: grandfather guard — passed pre-gate by design (#928); pinned in 93e792e0
- [x] GREEN 34110654
- [x] REFACTOR skip: shared slice-2 loop

### Scenario: Task tickets reach implement without a plan requirement

- [x] RED skip: exemption guard — passed pre-gate by design (#928); pinned in 93e792e0
- [x] GREEN 34110654
- [x] REFACTOR skip: shared slice-2 loop

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

## Rule: plan-implementation-phase.TB1.R2 — a ticket interrupted mid-planning resumes into planning work, not scenario re-validation

### Scenario: Resume guidance routes a planning-phase ticket to the planning doc

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prompt guidance during planning names the planning work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB1.R3 — the scenario-gate exit judges only scenario quality

### Scenario: Scenario-gate exit contains only scenario-quality steps

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The planning phase doc owns the impl-plan authoring steps

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No shipped surface still claims the plan is authored at scenario-gate exit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB1.R4 — the architecture record stays honest through planning

### Scenario: Planning directs review of prior architecture decisions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A significant planning decision triggers an ADR draft offer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A deviation from a recorded decision directs superseding the record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A routine decision stays in the decisions table without an ADR

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Emitted ADRs scaffold from the shipped template into the configured record location

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated architecture state docs never receive ADRs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A decision proven wrong during implement updates the record mid-flight

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB1.R5 — customer-visible changes carry a doc-impact plan

### Scenario: Customer-visible changes enumerate their doc impact in the plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Legacy five-section plans keep passing their gates

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

### Scenario: A present but empty Doc impact section fails validation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB1.R6 — proof coverage spans every spec-affected surface

### Scenario: Each affected surface appears in the plan's proof coverage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB2.R1 — plan depth tracks feature size and risk in both directions

### Scenario: The planning doc keys plan depth to blast radius in both directions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Planning stores only the plan and qualifying ADRs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB2.R2 — ADRs stay lean

### Scenario: The planning doc bounds each ADR to a lean record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB2.R3 — the editorial check governs size, never whether

### Scenario: Editorial review flags information-free padding

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Proportionality never waives the mandatory sections

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB3.R1 — current-architecture awareness after the ideal design, never sunk-cost conformance

### Scenario: Planning directs architecture awareness after the ideal design

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB3.R2 — deep design routes through the existing design lanes

### Scenario: Deep technical and data design routes through the existing lanes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB3.R3 — each load-bearing design choice gets a figure-it-out pass

### Scenario: Load-bearing choices get a figure-it-out pass

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB3.R4 — relevant environment skills surface during planning, never the full inventory

### Scenario: Planning surfaces installed language skills for the languages the feature touches

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A polyglot monorepo does not context-flood the planning phase

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.TB3.R5 — selected components are planned against current documentation

### Scenario: Selected components are planned against their installed version's documentation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.NTB2.R1 — human handoff only after the independent review passes

### Scenario: Raw planning output is never handed to the user

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: User-only information gaps route to the user at any time

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.NTB2.R2 — human design approval is an opt-in toggle, autonomous by default

### Scenario: Design approval defaults to autonomous

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Enabled design approval waits for the user after the review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The config reference documents the approval toggle

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.NTB2.R3 — headless sessions record pending approval instead of blocking

### Scenario: Headless session with approval enabled surfaces the plan instead of stalling

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.NTB1.R1 — application code stays untouched while a feature ticket is in the planning phase

### Scenario: Application-code edit during planning is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ticket artifacts stay editable during planning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

## Rule: plan-implementation-phase.NTB1.R2 — a planning-gate denial names the missing artifact and the concrete next action in plain language

### Scenario: Transition denial explains what is missing and what to do next

- [x] RED 93e792e0
- [x] GREEN 34110654
- [x] REFACTOR skip: shared slice-2 loop

## Rule: plan-implementation-phase.SM1.R1 — every phase-keyed surface carries a plan-implementation entry

### Scenario: Canonical phase order places plan-implementation between scenario-gate and implement

- [x] RED 82aa9ad0
- [x] GREEN ea3c5113
- [x] REFACTOR skip: minimal enum insertion, no structural change warranted

### Scenario: A feature at scenario-gate advances one step into plan-implementation

- [x] RED skip: behavior shipped with canonical-order GREEN ea3c5113; assertion added as regression pin
- [x] GREEN 21570ca2
- [x] REFACTOR skip: assertion-only pin

### Scenario: Jumping from scenario-gate straight to implement is denied as a skipped phase

- [x] RED skip: behavior shipped with canonical-order GREEN ea3c5113; assertion added as regression pin
- [x] GREEN 21570ca2
- [x] REFACTOR skip: assertion-only pin

### Scenario: A justified skip past plan-implementation is accepted

- [x] RED skip: uncapturable pre-build — over-blocking guard, passed today by design (#928); pinned post-enum
- [x] GREEN 21570ca2
- [x] REFACTOR skip: assertion-only pin

### Scenario: A jump from intake to done names all five skipped phases

- [x] RED 82aa9ad0
- [x] GREEN ea3c5113
- [x] REFACTOR skip: shared slice-1 loop, no structural change

### Scenario: Stopping at plan-implementation without the scenario ledger is blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stopping mid-planning without a plan yet is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

_RED evidence: uncapturable pre-build — over-blocking guard; passes today by design (#928 convention)._

### Scenario: A feature commit at plan-implementation without a ledger is reported at the boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Splitting guidance is remapped to the planning phase

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.SM1.R4 — the phase contract runs on current harnesses including cloud surfaces

### Scenario: The phase contract carries no interactive-only dependencies

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.SM1.R2 — the phase doc ships with full cross-harness parity

### Scenario: The planning phase doc ships to all three harnesses

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementation-phase.SM1.R3 — the decomposition-retirement ADR is superseded on the record

### Scenario: The architecture record supersedes the decomposition retirement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
