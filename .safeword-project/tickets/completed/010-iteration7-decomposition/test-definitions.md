# Test Definitions: Iteration 7 - Decomposition at Checkpoints

**Ticket:** 010-iteration7-decomposition
**Created:** 2026-01-07

---

## Entry Checkpoint (Before Phase 3)

### Story Counting & Detection

- [x] **Scenario 1:** Single user story detected as feature
  - Given user request "Add password reset"
  - When agent analyzes request
  - Then detects 1 user story
  - And proceeds as feature (no split suggestion)

- [x] **Scenario 2:** Two parallel stories suggest split into 2 features
  - Given user request "Add password reset and email verification"
  - When agent analyzes request
  - Then detects 2 independent user stories
  - And suggests splitting into 2 feature tickets

- [x] **Scenario 3:** Two coupled stories stay as single feature
  - Given user request "Add login with remember me"
  - When agent analyzes request
  - Then detects 2 coupled stories (shared session state)
  - And proceeds as single feature with 2 journeys

- [x] **Scenario 4:** Three+ stories or vague scope triggers epic
  - Given user request "Add user authentication"
  - When agent analyzes request
  - Then detects 3+ stories (login, logout, session, register...)
  - And suggests creating epic with feature children

- [x] **Scenario 5:** Vague scope words trigger epic suggestion
  - Given user request contains "system", "platform", or "entire"
  - When agent analyzes request
  - Then suggests epic regardless of story count

### Existing Ticket Promotion

- [x] **Scenario 6:** Existing feature ticket promoted to epic on split
  - Given ticket 015 exists with type: feature
  - And Entry checkpoint detects 2+ features needed
  - When user accepts split
  - Then ticket 015 type changes to epic
  - And children array added with new ticket IDs
  - And work log shows "Promoted to epic, split into N features"

- [x] **Scenario 7:** Child tickets created with parent link
  - Given ticket 015 promoted to epic
  - When child tickets created
  - Then each child has parent: 015
  - And each child has phase: intake
  - And agent asks "Which feature should we start with?"

### User Override

- [x] **Scenario 8:** User can decline split suggestion
  - Given agent suggests splitting into 2 features
  - When user selects "Keep as single feature"
  - Then agent proceeds with original scope
  - And no new tickets created

---

## Phase 3 Checkpoint (After Scenarios Drafted)

- [x] **Scenario 9:** >15 scenarios triggers split suggestion
  - Given feature has 16+ scenarios drafted
  - When Phase 3 completes
  - Then agent suggests splitting by user journey
  - And shows proposed scenario groupings

- [x] **Scenario 10:** 3+ distinct scenario clusters triggers split
  - Given feature has scenarios in 3+ unrelated groups
  - When Phase 3 completes
  - Then agent suggests splitting by cluster
  - And each cluster becomes separate feature

- [x] **Scenario 11:** Phase 3 split creates features at scenario-gate phase
  - Given user accepts Phase 3 split
  - When child features created
  - Then each child has phase: scenario-gate
  - And scenarios redistributed to children

---

## Phase 5 Checkpoint (After Task Breakdown)

- [x] **Scenario 12:** >20 tasks triggers split suggestion
  - Given decomposition produces 21+ tasks
  - When Phase 5 completes
  - Then agent suggests splitting by component/layer
  - And shows proposed task groupings

- [x] **Scenario 13:** 5+ major components triggers split
  - Given decomposition touches 5+ major components
  - When Phase 5 completes
  - Then agent suggests splitting by component
  - And each component becomes implementation slice

- [x] **Scenario 14:** Phase 5 split creates slices in test-definitions
  - Given user accepts Phase 5 split
  - When split executed
  - Then test-definitions gets "## Implementation Slices" section
  - And each slice has its own subsection with scenarios

---

## Phase 6 Checkpoint (Before TDD Cycle)

- [x] **Scenario 15:** >10 tests per slice triggers split
  - Given implementation slice has 11+ tests planned
  - When Phase 6 begins
  - Then agent suggests breaking into smaller slices
  - And shows proposed slice boundaries

- [x] **Scenario 16:** Phase 6 split adds sections, not tickets
  - Given user accepts Phase 6 split
  - When split executed
  - Then test-definitions gets additional slice sections
  - And no new tickets created (lightweight)

---

## TDD Loop Checkpoint (During RED/GREEN)

- [x] **Scenario 17:** >5 unit tests for single E2E triggers split
  - Given E2E scenario requires 6+ unit/integration tests
  - When agent detects during TDD loop
  - Then agent suggests breaking E2E into intermediate steps
  - And shows proposed E2E breakdown

- [x] **Scenario 18:** TDD split creates intermediate E2E tests
  - Given user accepts TDD loop split
  - When split executed
  - Then intermediate E2E tests added to test file
  - And each intermediate step gets its own commit

---

## Split UX

- [x] **Scenario 19:** Split suggestion shows summary first
  - Given any checkpoint triggers split
  - When agent presents suggestion
  - Then shows brief summary (threshold breached, recommended action)
  - And offers [Accept] [See details] [Proceed anyway]

- [x] **Scenario 20:** Details show proposed structure
  - Given user selects "See details"
  - When details displayed
  - Then shows tree of proposed artifacts
  - And shows which scenarios/tasks go where

---

## Examples in Skill (Research-Backed)

- [x] **Scenario 21:** BDD skill includes 2-3 epic examples
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Entry checkpoint section
  - Then contains 2-3 examples of epic-level requests
  - And each example shows why it's an epic

- [x] **Scenario 22:** BDD skill includes 2-3 feature examples
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Entry checkpoint section
  - Then contains 2-3 examples of feature-level requests
  - And each example shows why it's a feature

- [x] **Scenario 23:** BDD skill includes chain-of-thought template
  - Given safeword-bdd-orchestrating/SKILL.md
  - When reading Entry checkpoint section
  - Then contains reasoning template for story counting
  - And template includes: count stories, check examples, assess depth

---

## Edge Cases

- [x] **Scenario 24:** No ticket exists at Entry checkpoint
  - Given user request without existing ticket
  - When Entry checkpoint triggers epic split
  - Then agent creates epic ticket first
  - Then creates child feature tickets
  - And links them properly

- [x] **Scenario 25:** Split declined but threshold still breached later
  - Given user declined split at Entry
  - And Phase 3 now has 20 scenarios
  - When Phase 3 checkpoint runs
  - Then agent re-suggests split (different checkpoint)
  - And mentions previous decline

---

**Total Scenarios:** 25
**Checkpoints Covered:** Entry (8), Phase 3 (3), Phase 5 (3), Phase 6 (2), TDD Loop (2), UX (2), Examples (3), Edge Cases (2)
