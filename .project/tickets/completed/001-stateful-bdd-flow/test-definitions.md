# Test Definitions: Stateful BDD Flow

**Spec**: `.safeword-project/specs/feature-stateful-bdd-flow.md`
**Ticket**: `.safeword-project/issues/001-stateful-bdd-flow.md`

---

## Iteration 1: Walking Skeleton (Detection + Announcement)

### Suite 1: Work Level Detection

#### Scenario 1.1: Detect feature-level work ✅

**Given** user says "add dark mode toggle"
**When** agent analyzes the request
**Then** agent detects `feature` level (3+ files, new state, multiple flows)

#### Scenario 1.2: Detect task-level work ✅

**Given** user says "fix the login error message"
**When** agent analyzes the request
**Then** agent detects `task` level (1-2 files, 1 E2E test sufficient)

#### Scenario 1.3: Detect patch-level work ✅

**Given** user says "fix typo in README"
**When** agent analyzes the request
**Then** agent detects `patch` level (trivial change)

---

### Suite 2: Announcement with Override

#### Scenario 2.1: Feature announcement ✅

**Given** agent detects feature-level work
**When** agent announces
**Then** agent says "Feature. Defining behaviors first. `/tdd` to override."

#### Scenario 2.2: Task announcement ✅

**Given** agent detects task-level work
**When** agent announces
**Then** agent says "Task. Writing tests first. `/bdd` to override."

#### Scenario 2.3: Patch announcement ✅

**Given** agent detects patch-level work
**When** agent announces
**Then** agent says "Patch. Fixing directly."

---

### Suite 3: Override Commands

#### Scenario 3.1: /bdd forces BDD flow ✅

**Given** agent detected task-level work
**When** user runs `/bdd`
**Then** agent switches to BDD flow (Phase 0-2 context check)

#### Scenario 3.2: /tdd forces TDD flow ✅

**Given** agent detected feature-level work
**When** user runs `/tdd`
**Then** agent skips BDD phases, goes directly to TDD

---

### Suite 4: Skill Skeleton

#### Scenario 4.1: safeword-bdd-orchestrating skill exists ✅

**Given** safeword project is initialized
**When** agent invokes safeword-bdd-orchestrating skill
**Then** skill file exists at `packages/cli/templates/skills/safeword-bdd-orchestrating/SKILL.md`

#### Scenario 4.2: BDD skill hands off to TDD ✅

**Given** agent is in safeword-bdd-orchestrating skill
**And** detection complete
**When** no BDD phases implemented yet (Iteration 1)
**Then** skill delegates to safeword-tdd-enforcing

---

## Summary

**Iteration 1 Total**: 10 scenarios

- ✅ Passing: 10
- ❌ Not Implemented: 0

---

## Iteration 2: Phase Tracking + Resume (Stories 9, 11 partial)

### Suite 5: Ticket Phase Field

#### Scenario 5.1: Ticket template includes phase field ✅

**Given** safeword project is initialized
**When** agent creates a new feature ticket
**Then** ticket frontmatter includes `phase: intake` field

#### Scenario 5.2: Phase transitions are valid ✅

**Given** a feature ticket exists
**When** agent updates phase
**Then** phase value is one of: `intake`, `define-behavior`, `scenario-gate`, `decomposition`, `implement`, `done`

#### Scenario 5.3: BDD skill reads current phase ✅

**Given** a feature ticket with `phase: implement`
**When** agent resumes work on the feature
**Then** agent reads phase from ticket frontmatter

---

### Suite 6: Resume Logic

#### Scenario 6.1: Resume from ticket reference ✅

**Given** user opens or mentions a feature ticket
**When** agent starts session
**Then** agent reads ticket and identifies current phase

#### Scenario 6.2: Resume finds first unchecked scenario ✅

**Given** ticket at `phase: implement`
**And** test-definitions has 3 scenarios (2 checked, 1 unchecked)
**When** agent resumes
**Then** agent starts at first unchecked scenario

#### Scenario 6.3: Resume checks work log for context ✅

**Given** ticket with work log entries
**When** agent resumes
**Then** agent mentions last session's activity for continuity

#### Scenario 6.4: Resume at intake when no progress ✅

**Given** ticket at `phase: intake`
**And** no test-definitions file exists
**When** agent resumes
**Then** agent starts context check (Phase 0-2)

---

### Suite 7: Phase Updates

#### Scenario 7.1: BDD skill updates phase on transition ✅

**Given** agent completes Phase 3 (scenarios drafted)
**When** scenarios are validated
**Then** ticket phase updates to `scenario-gate`

#### Scenario 7.2: Work log records phase transitions ✅

**Given** agent transitions from `intake` to `define-behavior`
**When** phase update completes
**Then** work log includes timestamped entry

---

### Suite 8: Skill Handoff with Phase

#### Scenario 8.1: BDD sets phase before TDD handoff ✅

**Given** agent is in BDD skill at Phase 5 complete
**When** agent hands off to TDD
**Then** ticket phase is set to `implement`

#### Scenario 8.2: TDD updates phase on completion ✅

**Given** agent is in TDD skill (inside BDD flow)
**And** all E2E scenarios pass
**When** TDD completes
**Then** ticket phase is set to `done`

---

## Summary

**Iteration 2 Total**: 11 scenarios

- ✅ Passing: 11
- ❌ Not Implemented: 0

---

## Iteration 3: Scenarios - Phase 3 & 4 (Stories 4, 5)

### Suite 9: Phase 3 - Draft Scenarios

#### Scenario 9.1: Agent drafts scenarios from spec ✅

**Given** agent is at `phase: define-behavior`
**And** a feature spec exists with goal/scope
**When** agent drafts scenarios
**Then** scenarios are written in Given/When/Then format
**And** scenarios cover happy path, failure modes, edge cases

#### Scenario 9.2: Scenarios saved to test-definitions file ✅

**Given** agent has drafted scenarios
**When** scenarios are finalized
**Then** scenarios are saved to `.safeword-project/test-definitions/feature-{slug}.md`
**And** each scenario has checkbox `[ ]` for implementation tracking

#### Scenario 9.3: User can modify scenarios ✅

**Given** agent has drafted scenarios
**When** user requests changes (add, remove, modify)
**Then** agent updates scenarios accordingly
**And** confirms changes with user

#### Scenario 9.4: Phase updates after scenarios drafted ✅

**Given** agent has drafted scenarios
**And** user approves scenario list
**When** draft phase completes
**Then** ticket phase updates to `scenario-gate`

#### Scenario 9.5: Create missing spec/ticket before drafting ✅

**Given** agent detected feature-level work
**And** no spec or ticket exists for the feature
**When** agent enters Phase 3 (define-behavior)
**Then** agent creates minimal spec (goal, scope) first
**And** agent creates ticket with `phase: define-behavior`
**And** then proceeds to draft scenarios

---

### Suite 10: Phase 4 - Scenario Quality Gate

#### Scenario 10.1: Agent validates scenario atomicity ✅

**Given** agent is at `phase: scenario-gate`
**When** agent reviews scenarios
**Then** agent checks each scenario tests ONE behavior
**And** flags scenarios that combine multiple behaviors

#### Scenario 10.2: Agent validates scenario observability ✅

**Given** agent is at `phase: scenario-gate`
**When** agent reviews scenarios
**Then** agent checks each scenario has observable outcome
**And** flags scenarios with internal-only state changes

#### Scenario 10.3: Agent validates scenario determinism ✅

**Given** agent is at `phase: scenario-gate`
**When** agent reviews scenarios
**Then** agent checks each scenario produces same result on repeated runs
**And** flags scenarios with time/random dependencies

#### Scenario 10.4: Agent reports validation issues ✅

**Given** agent has found scenario quality issues
**When** validation completes
**Then** agent presents issues grouped by type (atomicity, observability, determinism)
**And** suggests fixes for each issue

#### Scenario 10.5: User approves validated scenarios ✅

**Given** all scenarios pass quality gate (or issues are acknowledged)
**When** user approves scenarios
**Then** ticket phase updates to `decomposition`

---

## Summary

**Iteration 3 Total**: 10 scenarios

- ✅ Passing: 10
- ❌ Not Implemented: 0

---

## Iteration 4: Discovery - Phase 0-2 (Stories 2, 3)

### Suite 11: Context Check (Story 2)

#### Scenario 11.1: No spec triggers context questions ✅

**Given** no spec exists
**When** feature detected
**Then** agent asks context questions (goal, scope, out-of-scope)

#### Scenario 11.2: Incomplete spec triggers missing field questions ✅

**Given** spec exists but incomplete (missing goal OR scope)
**When** agent reads spec
**Then** agent asks only for missing fields

#### Scenario 11.3: User answers create/update spec ✅

**Given** agent asked context questions
**When** user provides answers
**Then** spec file created/updated with answers

---

### Suite 12: Discovery Loop (Story 3)

#### Scenario 12.1: Complete spec triggers discovery offer ✅

**Given** spec has goal AND scope (from any source)
**When** context check completes
**Then** agent offers "Want to spitball?"

#### Scenario 12.2: Declining discovery transitions to define-behavior ✅

**Given** discovery offered
**When** user declines or says "ready"
**Then** ticket phase set to `define-behavior`

#### Scenario 12.3: Accepting discovery triggers PM questions ✅

**Given** user accepts discovery
**When** round starts
**Then** agent asks 2-3 PM-style questions

#### Scenario 12.4: Discovery answers captured in spec ✅

**Given** user answered questions
**When** round completes
**Then** insights captured in spec Discovery section

#### Scenario 12.5: Under max rounds offers another round ✅

**Given** discovery round complete
**When** under max rounds (5)
**Then** agent offers "Another round or ready?"

#### Scenario 12.6: Max rounds auto-transitions ✅

**Given** discovery round complete
**When** at max rounds (5)
**Then** ticket phase set to `define-behavior`

---

## Summary

**Iteration 4 Total**: 9 scenarios

- ✅ Passing: 9
- ❌ Not Implemented: 0

---

## Future Iterations

Per snowflake order in ticket:

- Iteration 5: Implementation (Stories 6, 7, 8, 11) - Phase 5-7 decomposition + outside-in TDD + done
- Iteration 6: Decomposition at Checkpoints (Story 10) - fractal splitting
- Iteration 7: Phase-aware quality (Story 12) - ✅ DONE (implemented in stop hook)

## Cleanup & Consolidation (Post-Feature)

- Evaluate `.safeword-project/` directory - rename, remove, or formalize in schema
- Cross-platform skill single-source-of-truth (Issue #002)
