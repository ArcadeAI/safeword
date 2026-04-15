# Feature Spec: Stateful BDD Flow

**Feature**: Agent knows where it is in the BDD workflow at all times and acts accordingly.

**Status**: ❌ Not Started

---

## Overview

Implement a stateful BDD workflow where the agent:

1. Automatically detects features and applies BDD flow
2. Tracks current phase in a ticket
3. Progresses through phases with appropriate gates
4. Uses TDD as the inner loop for implementation

---

## Design Decisions

### State Storage: Phase in Ticket, Progress in Artifacts

**Coarse state** in ticket frontmatter:

```yaml
phase: implement
```

**Fine-grained progress** in existing artifacts:

- Test-definitions file: `[x]`/`[ ]` markers show which tests done
- Work log: Timestamped entries show what was last worked on

**Resume logic:**

1. Read phase from ticket
2. Find first unchecked item in test-definitions
3. Check work log for context on last session
4. Continue

**Why:** Robust against sync issues. Agent re-analyzes reality on resume (like a human would). No fragile sub-step state that can go stale.

### Scope: Phases 3-7

Agent enforces phases 3-7. Light context check for 0-2. Human handles 8-9.

| Phase | Name                    | Ticket `phase:` value | Agent Role                                  |
| ----- | ----------------------- | --------------------- | ------------------------------------------- |
| 0-2   | Intake, Problem, Scope  | `intake`              | Light check; inline recovery if missing     |
| 3     | Define Behavior         | `define-behavior`     | Write Given/When/Then scenarios             |
| 4     | Scenario Quality Gate   | `scenario-gate`       | Validate testability                        |
| 5     | Technical Decomposition | `decomposition`       | Map to components, test strategy            |
| 6     | Implement               | `implement`           | Outside-in TDD (E2E first, unit TDD inside) |
| 7     | Done                    | `done`                | Stability check, tag regression             |
| 8-9   | Release, Post-release   | (human domain)        | Human domain                                |

### Unified Implementation: Outside-In TDD

**Key insight:** E2E and unit tests are not separate phases. They're interleaved.

**Core principle:** Design emerges from tests. Write E2E tests assuming ideal APIs exist, then discover what you actually need through the TDD loop. Defer implementation decisions as long as possible.

**Walking Skeleton (once per feature):**

Before first scenario, build the thinnest possible slice proving architecture works end-to-end:

- Form submits → API receives → returns response → UI updates
- No real logic, no validation - just proving the pipes connect
- This becomes the foundation for all scenarios

**For each scenario:**

1. **E2E test (RED)** — Write test from scenario, fails because nothing exists
2. **TDD loop** — Build pieces until E2E can pass (unit and/or integration tests)
3. **E2E test (GREEN)** — Scenario now works end-to-end
4. **REFACTOR** — Clean up E2E, integration, and unit code
5. **Next scenario**

**Test layer guidance:**

- **Unit tests** — Single functions, pure logic, no external dependencies
- **Integration tests** — Components talking to each other, database calls, API boundaries
- **E2E tests** — Full user journey through the system

Agent chooses appropriate layer based on what's being built. Not everything needs all three layers.

**Mocking strategy:**

- **Unit tests** — Mock external dependencies (APIs, databases, file system)
- **Integration tests** — Use real components, mock only external services
- **E2E tests** — Real everything (or test doubles for third-party services only)

Start with mocks in unit/integration tests. The E2E test proves the real system works.

### Behavior-First Testing at All Levels

All work is behavior-driven. Depth scales with complexity.

| Level   | Scenario Thinking                              | Test Source                       |
| ------- | ---------------------------------------------- | --------------------------------- |
| patch   | None - no behavior change                      | Existing tests                    |
| task    | Quick - "What user behavior does this affect?" | 2-3 scenarios in spec             |
| feature | Full BDD - discovery loop, Given/When/Then     | Scenario-derived test definitions |

**Task Rule:** If a user would notice the bug/change, write an E2E test. Otherwise, unit test is fine.

### Entry Trigger: Smart Detection + Announce

Agent detects feature → BDD, task/patch → TDD. Announces in teammate voice.

```
"Starting feature work — I'll define behaviors first, then build with TDD."
```

### Skill Relationship: BDD Orchestrates, TDD Inner Loop

- **safeword-bdd** (new): Phases 0-5, 7 (full outer loop)
- **safeword-tdd-enforcing** (updated): Phase 6 with "outside-in" mode for features, standalone for tasks/patches
- **safeword-brainstorming → discovery** (refactored): Becomes Phase 0-2 within BDD

### Decomposition: Fractal Checkpoints

Agent checks for decomposition at 5 checkpoints. Same logic at each level, different thresholds.

**Structure:**

- Epic ticket → multiple feature specs (one-to-many, linked via `children:` frontmatter)
- Feature ticket → one feature spec (one-to-one)
- Stories live inside specs as sections

**Checkpoints, Triggers, and Artifacts:**

| Checkpoint | When                    | Trigger                                                                                                   | Action                       | Artifacts Created                                      |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Entry      | Before Phase 3          | Multiple distinct outcomes, cross-cutting concerns, multiple personas, vague scope ("system", "platform") | Split into epic + features   | Epic spec + N feature specs, linked via `children:`    |
| Phase 3    | After scenarios drafted | >15 scenarios, 3+ distinct clusters, different personas                                                   | Split by user journey        | Separate feature specs per journey/persona             |
| Phase 5    | After task breakdown    | >20 tasks, 5+ major components                                                                            | Split by component/layer     | Separate implementation slices in test-definitions     |
| Phase 6    | Before TDD cycle        | >10 tests per slice                                                                                       | Break into smaller slices    | Separate test-definition sections, independent commits |
| TDD Loop   | During RED/GREEN cycle  | >5 unit/integration tests for single E2E                                                                  | Break E2E into smaller steps | Intermediate E2E tests, separate commit per step       |

**What each split produces:**

- **Entry → Epic split:** Parent epic spec with `children:` links, child feature specs with `parent:` link. Each child is independently schedulable.
- **Phase 3 → Journey split:** Separate feature specs per user journey. Original becomes epic or is replaced.
- **Phase 5 → Component split:** Test-definitions file gets sections per component. Each section can be implemented independently.
- **Phase 6 → Slice split:** Large slices become multiple smaller slices in test-definitions. Each slice = one PR-able unit.
- **TDD Loop → Step split:** Single E2E scenario broken into intermediate E2E checkpoints. Each checkpoint = commit. _(Implementation note: Add concrete example to testing-guide showing before/after of splitting a large E2E into intermediate checkpoints.)_

**Epic Detection Heuristic:** If you can't describe it in one "As a [user] I want [thing] so that [value]" → it's probably an epic.

**Decomposition is suggested, not mandatory.** Agent proposes split, user decides. Agent can proceed with large scope if user insists (their funeral).

**Bidirectional:** Promotion works in reverse—if implementation reveals feature-level complexity, promote upward and create appropriate artifacts (task → story, story → feature).

### Decision Calibration: Thresholds vs Judgment

| Decision Type             | Examples                                          | Approach                                  |
| ------------------------- | ------------------------------------------------- | ----------------------------------------- |
| **Hard gates**            | Test must fail before GREEN, pass before REFACTOR | No exceptions, ever                       |
| **Calibrated thresholds** | >15 scenarios, >20 tasks, >10 tests               | Triggers suggestion, user can override    |
| **Judgment calls**        | "Is this an epic?", "Is scope clear enough?"      | State reasoning, ask if genuinely unclear |

**Agent rules:**

- **Hard gates:** Never bypass. These protect correctness.
- **Thresholds:** Flag and suggest split. Proceed if user says "continue anyway."
- **Judgment:** Make a call, state reasoning briefly. Only ask if two options seem equally valid.

### Proactivity Calibration

Research shows AI suggestions are least disruptive during debugging/refactoring, most disruptive during implementation.

| Phase          | Agent Stance | Rationale                                          |
| -------------- | ------------ | -------------------------------------------------- |
| 0-5 (Planning) | Proactive    | User wants ideas, edge cases, questions            |
| 6 (Implement)  | Reactive     | Heads-down work; execute TDD loop, don't interrupt |
| 7 (Done)       | Proactive    | Cleanup suggestions and audit findings welcome     |

**Phase 6 exceptions** (be proactive for):

- Test failures requiring debugging
- Decomposition triggers (>5 tests per E2E)
- Stuck detection (3+ failed attempts)
- Scope creep detection

### Context Management

Agent manages context window to avoid "context rot" (degraded recall as tokens increase).

**Per-phase context loading:**

- Phase start: Load only phase-relevant artifacts, not full history
- Work log: Summarize previous sessions, don't replay verbatim
- Test definitions: Load current slice only, not all scenarios

**Observation masking:**

- Tool outputs (grep, file reads): Summarize if >2k tokens
- Previous phases: Reference by artifact path, don't inline content

**Pre-rot threshold:**

- Begin aggressive summarization when context exceeds ~100k tokens
- Effective context window degrades well before advertised limits (~256k)
- Don't wait for API errors—proactively compact before quality degrades

_(Implementation note: Detailed context strategies go in llm-prompting-guide, not skills.)_

---

## Technical Constraints

### Compatibility

- [ ] Works with existing ticket system
- [ ] Works with existing spec/test-definitions structure
- [ ] TDD skill remains usable standalone for tasks/patches

### Dependencies

- [ ] Ticket template needs `type: bdd-feature` and `phase:` fields
- [ ] TDD skill updated with Test List, Micro-Design, Spike sections ✅

---

## Story 1: Smart Detection and Announcement

**As a** user
**I want** the agent to detect features automatically
**So that** I don't have to learn or invoke BDD explicitly

**Work levels:**

| Level   | Name           | Meaning                   | Process    |
| ------- | -------------- | ------------------------- | ---------- |
| patch   | Quick fix      | Typo, config, trivial bug | Direct fix |
| task    | Bounded work   | Single observable change  | TDD        |
| feature | New capability | Multiple scenarios needed | BDD        |

**Detection Algorithm:**

```
Is this explicitly a bug fix, typo, or config change?
├─ Yes → patch (direct fix, no test unless regression-prone)
└─ No ↓

Does request mention "feature", "add", "implement", "support", "build"?
├─ No → task (TDD with E2E test)
└─ Yes ↓

Will it require 3+ files AND (new state OR multiple user flows)?
├─ Yes → feature (BDD)
└─ No / Unsure ↓

Can ONE E2E test cover the observable change?
├─ Yes → task (TDD with E2E test)
└─ No → feature (BDD)

Fallback: task with announcement. User can `/bdd` to override.
```

**Detection signals:**

| Signal        | task (TDD)                | feature (BDD)                   |
| ------------- | ------------------------- | ------------------------------- |
| Files touched | 1-2 files                 | 3+ files                        |
| Test count    | 1 E2E test sufficient     | Multiple scenarios needed       |
| State changes | None or trivial           | New state machine / transitions |
| User flows    | Single path               | Multiple paths / branching      |
| Edge cases    | Obvious (null, empty)     | Requires discovery              |
| Keywords      | "change", "fix", "update" | "add", "implement", "feature"   |

**Examples:**

| Request                      | Signals                           | Level   |
| ---------------------------- | --------------------------------- | ------- |
| "Change button color to red" | 1 file, 1 test, no state          | task    |
| "Add dark mode toggle"       | 3+ files, new state, user prefs   | feature |
| "Fix login error message"    | 1-2 files, 1 test                 | task    |
| "Add user authentication"    | Many files, state machine, flows  | feature |
| "Update API response format" | 1-2 files, 1 E2E test             | task    |
| "Add shopping cart"          | Many files, state, multiple flows | feature |

**Announcement behavior:**

- **Always announce detection** with override hint
- patch: "Patch. Fixing directly."
- task: "Task. Writing tests first. `/bdd` to override."
- feature: "Feature. Defining behaviors first. `/tdd` to override."

**Acceptance Criteria**:

- [ ] Agent detects feature-level work from request using algorithm above
- [ ] Agent always announces detection level with override hint
- [ ] task/patch work goes to TDD directly (no BDD phases)
- [ ] feature work enters BDD flow (Phase 0-2 context check first)
- [ ] Power user can override with `/bdd` or `/tdd` command

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 2: Context Check and Recovery

**As a** user
**I want** the agent to check for context and recover gracefully
**So that** I can start working even with incomplete specs

**Acceptance Criteria**:

- [ ] Agent checks: Does spec exist? Has goal/scope?
- [ ] If missing: Quick interview (3-4 questions)
- [ ] Creates spec from answers
- [ ] Proceeds to discovery offer

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 3: Discovery Loop

**As a** user
**I want** the option to spitball edge cases before implementation
**So that** I catch issues early without being forced through bureaucracy

**Acceptance Criteria**:

- [ ] Agent offers: "Want to spitball before we dive in?"
- [ ] If yes: 2-3 PM-style questions per round
- [ ] Progressive depth rounds: User Experience → Failure Modes → Boundaries → Scenarios → Stakeholders/Regret
- [ ] User can say "ready" at any point to proceed
- [ ] Discovery captured in spec

**Notes**: Question framework defined in AGENTS.md "PM-Style Questions" section.

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 4: Phase 3 - Define Behavior

**As a** user
**I want** the agent to draft Given/When/Then scenarios
**So that** I have testable behavior definitions

**Acceptance Criteria**:

- [ ] Agent drafts scenarios based on context
- [ ] Covers: happy path, failure modes, edge cases
- [ ] User can add/modify/remove scenarios
- [ ] Scenarios saved to test-definitions file
- [ ] Ticket phase updated to `scenario-gate`

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 5: Phase 4 - Scenario Quality Gate

**As a** user
**I want** scenarios validated before implementation
**So that** I don't build untestable behaviors

**Acceptance Criteria**:

- [ ] Agent checks: Atomic? Observable? Deterministic?
- [ ] Reports issues if any
- [ ] User approves scenarios
- [ ] Ticket phase updated to `decomposition`

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 6: Phase 5 - Technical Decomposition

**As a** user
**I want** scenarios broken into technical tasks
**So that** I have a clear implementation path

**Acceptance Criteria**:

- [ ] Agent identifies components/seams
- [ ] Agent proposes test layers (unit, integration, BDD)
- [ ] Creates task breakdown
- [ ] Ticket phase updated to `implement`

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 7: Phase 6 - Implement (Outside-In TDD)

**As a** user
**I want** implementation to follow outside-in TDD discipline
**So that** code is tested at both E2E and unit levels

**The Outside-In Loop:**

```
0. Walking Skeleton   ← Thinnest slice proving architecture (once)
   └─ E2E: form → API → response → UI (no logic)

Per scenario:
1. E2E test (RED)     ← Scenario becomes test, fails
2. TDD loop           ← Build pieces until E2E can pass
   ├─ RED   (unit or integration, mocked as needed)
   ├─ GREEN
   ├─ REFACTOR
   └─ Repeat for each piece
3. E2E test (GREEN)   ← Scenario now works (real everything)
4. REFACTOR           ← Clean up all test layers
5. Next scenario
```

**Acceptance Criteria**:

- [ ] Walking skeleton built first (architecture proven end-to-end)
- [ ] For each scenario: E2E test written first (RED)
- [ ] TDD cycles (unit/integration) build implementation until E2E passes
- [ ] Mocks used in unit/integration, real dependencies in E2E
- [ ] REFACTOR after each E2E goes green
- [ ] All scenarios have passing E2E tests
- [ ] Test fixtures/data created for realistic scenarios
- [ ] Ticket phase updated to `done`

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 8: Phase 7 - Done

**As a** user
**I want** the feature properly closed out
**So that** it's regression-ready and traceable

**Holistic Refactor:**

After all scenarios pass, step back and look at the whole:

| Look For                     | Action                                       |
| ---------------------------- | -------------------------------------------- |
| Duplication across scenarios | Extract shared helpers, fixtures, components |
| Naming inconsistencies       | Unify terminology across tests and code      |
| Test organization            | Group related tests, extract page objects    |
| Dead code                    | Remove scaffolding, unused branches          |
| Architecture drift           | Ensure implementation matches Phase 5 design |

Run `/verify` to check documentation matches reality.
Run `/audit` to catch dead code and issues.

**`/verify` command scopes:**

| Scope    | What it checks                      | Files                                                                                                                                  |
| -------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `arch`   | Architecture docs match code        | `ARCHITECTURE.md`, design docs                                                                                                         |
| `agents` | Agent instructions match workflow   | All `AGENTS.md` in tree, `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.cursor/rules/`, `.cursor/commands/` |
| `readme` | README is current                   | `README.md`, `CONTRIBUTING.md`                                                                                                         |
| `site`   | Website matches source (if present) | `packages/website/`, `docs/`                                                                                                           |
| (no arg) | All of the above                    | Everything                                                                                                                             |

Usage: `/verify`, `/verify arch`, `/verify agents`, etc.

**Note:** Claude Code supports positional args (`$1`). Cursor CLI currently ignores args (bug as of Nov 2025). Cursor users use `/verify` without args to check all.

**Acceptance Criteria**:

- [ ] Holistic refactor completed (cross-scenario cleanup)
- [ ] `/verify` passes (all docs match implementation)
- [ ] `/audit` passes (no dead code, no new issues)
- [ ] E2E scenarios tagged (@smoke, @regression)
- [ ] Stability verified (run 3x, no flakes)
  - If flakes detected: Isolate, debug with `/debugging`, fix before proceeding
  - Common causes: Race conditions, timing dependencies, test pollution
- [ ] Ticket linked to PR and scenarios
- [ ] Ticket status updated to `done`

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 9: State Persistence Across Sessions

**As a** user
**I want** the agent to resume where it left off
**So that** I can work on features across multiple sessions

**Resume Logic** (see Design Decisions → State Storage):

1. Read `phase:` from ticket frontmatter
2. Find first unchecked item in test-definitions
3. Check work log for last session context
4. Continue from there

**Session Start Trigger:** Agent reads ticket when user references it (opens, mentions filename, or asks about status). Not automatic on every session—that would be noisy.

**Acceptance Criteria**:

- [ ] Agent reads ticket when user references it
- [ ] Resumes at current phase using resume logic above
- [ ] Work log shows session history
- [ ] No lost context between sessions

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 10: Decomposition at Checkpoints

**As a** user
**I want** the agent to suggest splitting large work
**So that** I don't end up with unmanageable scope

**Acceptance Criteria**:

- [ ] Entry checkpoint: Detects epic-level requests → creates epic + feature specs
- [ ] Phase 3 checkpoint: Flags >15 scenarios or 3+ clusters → splits by journey
- [ ] Phase 5 checkpoint: Flags >20 tasks or 5+ components → splits by component
- [ ] Phase 6 checkpoint: Flags >10 tests per slice → breaks into smaller slices
- [ ] TDD Loop checkpoint: Flags >5 unit/integration tests per E2E → breaks E2E into steps
- [ ] Agent proposes split with rationale and shows what artifacts will be created
- [ ] User can accept or override ("proceed anyway")
- [ ] If accepted: Creates appropriate artifacts per checkpoint level
- [ ] Post-split: Tickets created for each child feature with `parent:`/`children:` links
- [ ] Post-split: Each child restarts at checkpoint-appropriate phase (see table)

**Checkpoint Restart Points:**

| Checkpoint | What's Split             | Restart From | Why                                     |
| ---------- | ------------------------ | ------------ | --------------------------------------- |
| Entry      | Epic → features          | Phase 0      | New features need their own discovery   |
| Phase 3    | Feature → journeys       | Phase 4      | Scenarios exist, validate regrouped set |
| Phase 5    | Feature → components     | Phase 6      | Decomposition done, start implementing  |
| Phase 6    | Slice → smaller slices   | Phase 6      | Stay in implementation                  |
| TDD Loop   | E2E → intermediate steps | Phase 6      | Stay in TDD loop                        |

**Post-Split Protocol:**

When user accepts a split:

1. **Create artifacts** — Parent spec + child specs with bidirectional links
2. **Create tickets** — One ticket per child, each with:
   - `parent:` linking to parent ticket
   - `phase:` set to restart point from table above
   - Parent ticket gets `children:` array linking to all child tickets
3. **Commit** — "chore: split [name] into N [features|slices]"
4. **Ask** — "Which [feature|slice] should we start with?"
5. **Resume** — Selected child continues from its restart phase

**Example: Entry checkpoint split (Epic → features)**

```
Epic Ticket: 001-stateful-bdd
├── status: in_progress
├── children: [002, 003, 004]
│
├── Feature Ticket: 002-detection-phase
│   ├── phase: intake          ← Phase 0 (Entry split)
│   └── parent: 001
│
├── Feature Ticket: 003-scenario-phase
│   ├── phase: intake          ← Phase 0 (Entry split)
│   └── parent: 001
│
└── Feature Ticket: 004-implement-phase
    ├── phase: intake          ← Phase 0 (Entry split)
    └── parent: 001
```

Parent completes when all children reach `done`.

**Notes**: Decomposition is suggested, not mandatory. User controls depth. See "Decision Calibration" for threshold vs judgment rules.

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 11: Skill & Command Structure

**As a** user
**I want** explicit commands to override workflow detection
**So that** I can force BDD or TDD when the agent guesses wrong

**Commands:**

| Command          | Purpose                                 | When to Use                              |
| ---------------- | --------------------------------------- | ---------------------------------------- |
| `/bdd`           | Force BDD flow for current task         | Task that should be feature              |
| `/tdd`           | Force TDD flow, skip BDD phases         | Feature user wants to implement directly |
| `/verify`        | Check docs match implementation         | Phase 7 (Done) or anytime                |
| `/verify-schema` | Check all templates have schema entries | After creating new templates             |
| `/audit`         | Find dead code and technical debt       | Phase 7 (Done) or anytime                |

**Skills:**

| Skill                    | Phases                           | Status   |
| ------------------------ | -------------------------------- | -------- |
| `safeword-bdd`           | 0-5, 7 (orchestrator)            | New      |
| `safeword-tdd-enforcing` | 6 (outside-in mode for features) | Update   |
| `safeword-discovery`     | 0-2 (renamed from brainstorming) | Refactor |

**Skill Handoff (BDD ↔ TDD):**

```
safeword-bdd (Phase 5)
    │
    ├─ Updates ticket: phase: implement
    ├─ Invokes safeword-tdd-enforcing with outside-in mode
    │
    └─ safeword-tdd-enforcing (Phase 6)
           │
           ├─ Runs TDD loop per scenario
           ├─ Updates test-definitions with ✅ as scenarios pass
           │
           └─ When all scenarios done:
                  ├─ Updates ticket: phase: done
                  └─ Returns control to safeword-bdd for Phase 7
```

**Skill file locations:**

```
packages/cli/templates/skills/
├── safeword-bdd-orchestrating/SKILL.md # New: BDD orchestrator
├── safeword-tdd-enforcing/SKILL.md     # Update: add outside-in mode
├── safeword-discovery/SKILL.md         # Refactor: from brainstorming
└── ...existing skills...
```

**Acceptance Criteria**:

- [ ] `/bdd` command forces BDD flow regardless of detection
- [ ] `/tdd` command forces TDD flow, skips BDD phases
- [ ] `/verify` command checks docs match implementation
- [ ] `/verify-schema` command runs schema tests, reports orphaned templates
- [ ] `/audit` command finds dead code and technical debt
- [ ] `safeword-bdd` skill orchestrates phases 0-5, 7
- [ ] `safeword-tdd-enforcing` has "outside-in" mode for features
- [ ] `safeword-discovery` replaces brainstorming as Phase 0-2

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Story 12: Phase-Aware Quality Review

**As a** user
**I want** quality review to ask phase-appropriate questions
**So that** I get relevant feedback whether I'm in scenarios or implementation

**Problem:** Current quality-review hook asks technical questions ("our stack", "latest docs") that aren't relevant during scenario definition (Phase 3-4) or discovery (Phase 0-2).

**Phase-specific review focus:**

| Phase             | Review Focus                | Example Questions                                  |
| ----------------- | --------------------------- | -------------------------------------------------- |
| 0-2 (Discovery)   | Completeness, clarity       | "Are edge cases covered?", "Is scope clear?"       |
| 3-4 (Scenarios)   | Testability, atomicity      | "Is this observable?", "Is this deterministic?"    |
| 5 (Decomposition) | Architecture, test strategy | "Right test layer?", "Missing components?"         |
| 6 (Implement)     | Technical correctness       | "Latest docs?", "Security issues?", "Performance?" |
| 7 (Done)          | Completeness, cleanup       | "Dead code?", "Flaky tests?", "Docs updated?"      |

**Acceptance Criteria**:

- [ ] Quality review hook reads current phase from ticket
- [ ] Review prompts adapted per phase
- [ ] Phase 3-4: Focus on scenario quality, not code
- [ ] Phase 6: Current technical review (stack, docs, security)
- [ ] Phase 7: Holistic cleanup review

**Artifact Check**: [ ] Skills [ ] Guides [ ] Hooks [ ] Commands [ ] Subagents

**Implementation Status**: ❌ Not Started

---

## Out of Scope (v1)

- Phases 8-9 (Release Readiness, Post-release) — human domain
- Full Phase 0-2 enforcement — light check only
- Cloud sync / multi-machine state — local-first for now
- Dashboard / reporting UI — CLI only
- Gherkin syntax (see Future: Gherkin Adoption below)
- Question & proposal persistence across quality-review loops (deferred to later phase)

---

## Future: Gherkin Adoption

**Status:** Deferred to post-v1

**Why deferred:** v1 uses markdown test-definitions for scenarios. Gherkin adds executable specs and validation, but also tooling complexity. Ship v1, evaluate need based on real usage.

### What Gherkin Would Give Us

| Benefit                      | Description                                                 | Who Benefits                 |
| ---------------------------- | ----------------------------------------------------------- | ---------------------------- |
| **Step reuse**               | `Given a logged-in user` defined once, used in 20+ features | Agent (less code to write)   |
| **Parser validation**        | Syntax errors caught before test run                        | Agent (faster feedback)      |
| **Undefined step detection** | Cucumber warns when step has no implementation              | Agent (knows what to build)  |
| **Scenario-level reporting** | "Feature X: 3/5 scenarios passing"                          | Human (progress visibility)  |
| **Living documentation**     | Feature files readable by non-technical stakeholders        | Human (shared understanding) |

### Recommended Tooling

Choose runner based on test layer:

| Layer      | Tool                                                          | Why                                    |
| ---------- | ------------------------------------------------------------- | -------------------------------------- |
| E2E (UI)   | [playwright-bdd](https://github.com/vitalets/playwright-bdd)  | Gherkin → Playwright, browser testing  |
| Unit/Integ | [vitest-cucumber](https://github.com/amiceli/vitest-cucumber) | Gherkin in Vitest, no browser overhead |
| Validation | [gherkin-lint](https://www.npmjs.com/package/gherkin-lint)    | Syntax checking, step validation       |

**E2E scenarios (browser required):**

```bash
npm install -D playwright-bdd @playwright/test
npx bddgen          # Generate tests from .feature files
npx playwright test # Run generated tests
```

**Unit/integration scenarios (no browser):**

```bash
npm install -D @amiceli/vitest-cucumber
npx @amiceli/vitest-cucumber --feature <path> --spec <path>  # Generate spec
npx vitest                    # Run tests
```

**Validation (both layers):**

```bash
npm install -D gherkin-lint
npx gherkin-lint features/**/*.feature
```

Rules to enable: `no-undefined-steps`, `no-unused-variables`, `no-duplicate-tags`

### Step Discovery Protocol (for Agent)

**Before writing any new step:**

1. Search existing step files: `grep -rE "Given|When|Then" features/step_definitions/`
2. If similar step exists → reuse it (possibly with parameters)
3. If no match → write new step

**Step file organization (by domain):**

```
features/
├── e2e/                      # Browser-required scenarios
│   └── step_definitions/
│       ├── auth.steps.ts
│       └── navigation.steps.ts
├── unit/                     # Non-UI scenarios
│   └── step_definitions/
│       ├── validation.steps.ts
│       └── calculation.steps.ts
└── shared/                   # Reusable across both
    └── common.steps.ts
```

**Step reuse across features (the hard problem):**

The step discovery problem exists with or without Gherkin. Gherkin makes it explicit via grep patterns. Three months from now, agent building new feature:

1. Run step discovery protocol
2. Find `Given a logged-in user` in `e2e/step_definitions/auth.steps.ts`
3. Reuse instead of rewriting

### Validation Commands

| Command                                    | Purpose             | When to Run           |
| ------------------------------------------ | ------------------- | --------------------- |
| `npx gherkin-lint features/`               | Syntax + formatting | Pre-commit hook       |
| `grep -rE "Given\|When\|Then" .`           | List all steps      | Before writing steps  |
| `npx bddgen && npx playwright test --list` | Check E2E coverage  | Before implementation |

### Migration Path (v1 → Gherkin)

1. **Phase 3 output stays markdown** (v1) — Scenarios in test-definitions as `- [ ] Given/When/Then`
2. **Add .feature files** (post-v1) — Convert markdown scenarios to Gherkin syntax
3. **Categorize by layer** — E2E vs unit/integration scenarios
4. **Generate step stubs** — Use appropriate tool per layer
5. **Deprecate markdown scenarios** — Feature files become source of truth

### Research Notes

**LLM + Gherkin effectiveness:**

- Industrial study: 95% of LLM-generated Gherkin scenarios rated "helpful"
- LLMs handle structured formats well
- Main challenge is step discovery (protocol above addresses this)

**Tool selection rationale:**

- playwright-bdd: Best for E2E, runs on Playwright runner (not CucumberJS)
- vitest-cucumber: Best for unit/integration, integrates with existing Vitest setup
- Both share same Gherkin syntax, steps can be conceptually similar

**Non-JS codebases:**

For Go, Python, or other languages, use native Cucumber runners instead:

| Language | Tool                                                       | Notes                        |
| -------- | ---------------------------------------------------------- | ---------------------------- |
| Go       | [godog](https://github.com/cucumber/godog)                 | Official Cucumber for Go     |
| Python   | [pytest-bdd](https://github.com/pytest-dev/pytest-bdd)     | Integrates with pytest       |
| Python   | [behave](https://github.com/behave/behave)                 | Standalone, more traditional |
| Ruby     | [cucumber-ruby](https://github.com/cucumber/cucumber-ruby) | The original Cucumber        |
| Java     | [cucumber-jvm](https://github.com/cucumber/cucumber-jvm)   | Official Java implementation |

E2E tests via HTTP are language-agnostic—Playwright can test any backend. Use native runners for unit/integration tests in the target language.

---

## Summary

**Completed**: 0/12 stories (0%)
**Remaining**: 12/12 stories (100%)

### Foundation

- Story 1: Smart Detection
- Story 2: Context Check
- Story 9: State Persistence

### Cross-Cutting

- Story 10: Decomposition at Checkpoints
- Story 11: Skill & Command Structure
- Story 12: Phase-Aware Quality Review

### BDD Outer Loop

- Story 3: Discovery Loop
- Story 4: Define Behavior
- Story 5: Scenario Quality Gate

### Implementation

- Story 6: Technical Decomposition
- Story 7: Outside-In TDD (merged E2E + unit)
- Story 8: Done

### Skill/Guide Alignment

Refactor existing skills and guides to integrate with BDD flow:

| Skill/Guide       | Target Phase                | Action                                                                      |
| ----------------- | --------------------------- | --------------------------------------------------------------------------- |
| brainstorming     | **→ discovery** (Phase 0-2) | Refactor: becomes context check + discovery loop within BDD                 |
| tdd-enforcing     | Phase 6                     | Add "outside-in" mode for features, keep standalone for tasks/patches       |
| debugging         | Phase 6 (when stuck)        | Minor: add phase context                                                    |
| refactoring       | Phase 6 (REFACTOR step)     | Minor: add phase context                                                    |
| quality-reviewing | Phase 4 + Phase 7           | Refactor: scenario gate mode + done checklist mode                          |
| writing-plans     | Phase 5 output              | Evaluate: may merge into BDD Phase 5                                        |
| planning-guide    | Phases 0-5                  | Update: add phase mapping                                                   |
| testing-guide     | Phase 6                     | Update: add outside-in TDD section                                          |
| llm-guide         | All phases                  | Update: add context management section (observation masking, summarization) |

**Key Insight:** Skills should be _implementations of BDD phases_, not separate workflows that happen to hand off.

**Major Refactors:**

- [ ] **brainstorming → discovery**: Rename and integrate as Phase 0-2 implementation
- [ ] **tdd-enforcing**: Add outside-in mode (E2E first, unit TDD inside)
- [ ] **quality-reviewing**: Add modes for Phase 4 (scenario gate) vs Phase 7 (done checklist)

**Minor Updates:**

- [ ] Add BDD phase references to debugging, refactoring
- [ ] Update planning-guide with phase mapping
- [ ] Update testing-guide with outside-in TDD section
- [x] Update llm-guide with context management section ✅

**Next Steps**: Create safeword-bdd skill skeleton, update ticket template
