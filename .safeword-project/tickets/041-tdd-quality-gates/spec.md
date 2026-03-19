# Feature Spec: TDD Inner-Loop Quality Gates (#041)

**Feature**: Quality review gates at each TDD sub-phase boundary (RED, GREEN, REFACTOR), detected via sub-checkboxes in test-definitions.md — folding the current refactor gate into a unified `tdd:` gate namespace.

**Status**: ❌ Not Started (0/4 stories complete)

---

## Technical Constraints

### Performance

- [ ] PostToolUse adds test-definitions.md file watching (same pattern as ticket.md — negligible overhead)
- [ ] Parsing sub-checkboxes is ~10-15 lines, runs only when test-definitions.md is edited

### Compatibility

- [ ] Existing refactor gate behavior preserved (renamed `tdd:refactor`, same trigger logic relocated)
- [ ] Phase gate behavior unchanged
- [ ] LOC gate coexists (LOC doesn't override `tdd:` gates, same as current refactor guard)

### Dependencies

- [ ] Claude Code >= v2.1.9 (required for `additionalContext` in PreToolUse hooks)
- [ ] Must use `additionalContext` field in PreToolUse deny output (per Claude Code docs)
- [ ] Review content must live in skill files (no inline content in hooks — prevents drift)

---

## Story 1: `additionalContext` in deny output + `tdd:` gate namespace

**As a** hook system
**I want to** use `additionalContext` for action guidance and rename gates to the `tdd:` namespace
**So that** Claude reliably receives skill instructions and TDD gates are explicitly named

**Acceptance Criteria**:

- ❌ `deny()` in PreToolUse accepts optional `additionalContext` parameter
- ❌ Output JSON includes `additionalContext` field when provided
- ❌ Existing `gate: 'refactor'` renamed to `gate: 'tdd:refactor'`
- ❌ Phase gate uses `additionalContext` for `/quality-review` instruction (fix from 66025ea)
- ❌ Refactor gate uses `additionalContext` for `/tdd-review` instruction
- ❌ LOC gate guard updated: `state.gate !== 'refactor'` → `!state.gate?.startsWith('tdd:')`
- ❌ Existing tests updated for new gate name and `additionalContext` field
- ❌ Both project hook and template hook updated identically

**Implementation Status**: ❌ Not Started
**Tests**: `packages/cli/tests/integration/quality-gates.test.ts`

---

## Story 2: Test-definitions.md sub-checkboxes and TDD step detection

**As a** quality gate system
**I want to** detect TDD step transitions by watching sub-checkboxes in test-definitions.md
**So that** gates fire based on the artifact (single source of truth), not commit message conventions

**Acceptance Criteria**:

- ❌ Test-definitions template updated with RED/GREEN/REFACTOR sub-checkboxes per scenario:

  ```markdown
  ### Scenario 1: Login validation

  - [ ] RED
  - [ ] GREEN
  - [ ] REFACTOR
  ```

- ❌ PostToolUse watches `test-definitions.md` in ticket directories (same pattern as ticket.md)
- ❌ Parses sub-checkboxes to find the active scenario (first with mixed checked/unchecked)
- ❌ Determines which step just completed (last `[x]` in the active scenario's sub-items)
- ❌ RED marked `[x]` → sets `gate: 'tdd:green'` (review test before implementing)
- ❌ GREEN marked `[x]` → sets `gate: 'tdd:refactor'` (review implementation before refactoring)
- ❌ REFACTOR marked `[x]` → sets `gate: 'tdd:red'` (review completed scenario before next)
- ❌ QualityState gains `lastKnownTddStep` field to detect transitions (same pattern as `lastKnownPhase`)
- ❌ Only active when `lastKnownPhase === 'implement'`
- ❌ All three gates reference `/tdd-review` via `additionalContext`

**Implementation Status**: ❌ Not Started
**Tests**: `packages/cli/tests/integration/quality-gates.test.ts`

**Notes**: Detection logic: find first scenario where at least one sub-checkbox is `[x]` and at least one is `[ ]`. The count of checked items tells you the step: 1 checked = RED done, 2 checked = GREEN done. All 3 checked = scenario complete, move to next. If no mixed scenario found, no gate fires (either all done or none started).

**Resume/stale state:** Uses the same pattern as phase gates — compare to `lastKnownTddStep`, fire gate on mismatch. On resume or ticket switch, a gate may fire even though no transition just happened. This is intentional: it serves as an orientation checkpoint ("review where this scenario is before continuing"). Consistent with phase gate behavior (we saw this fire on ticket 041 creation — useful, not a bug).

---

## Story 3: Remove commit-prefix detection for refactor gate

**As a** quality gate system
**I want to** remove the `feat:` commit detection that currently sets the refactor gate
**So that** TDD step detection comes from one source (test-definitions.md), not two

**Acceptance Criteria**:

- ❌ Remove `feat:` → `refactor` gate logic from PostToolUse commit detection block
- ❌ TDD gates now fire exclusively from test-definitions.md sub-checkbox changes
- ❌ Commit still clears any active gate (existing behavior preserved)
- ❌ Existing refactor gate tests rewritten to use sub-checkbox detection instead
- ❌ Both project hook and template hook updated

**Implementation Status**: ❌ Not Started
**Tests**: `packages/cli/tests/integration/quality-gates.test.ts`

**Notes**: This is a clean removal — the `feat:` detection block (lines 114-120 in post-tool-quality.ts) gets deleted. The refactor gate behavior is now handled by Story 2's GREEN checkbox detection. Tests that set `gate: 'refactor'` in state are rewritten to trigger via test-definitions.md edits.

---

## Story 4: `/tdd-review` skill + TDD.md updates

**As a** developer using BDD workflow
**I want** a step-aware TDD review skill and updated TDD instructions
**So that** review depth matches the TDD step and Claude knows to update sub-checkboxes

**Acceptance Criteria**:

- ❌ New skill: `.claude/skills/tdd-review/SKILL.md`
- ❌ Skill detects which step is next from the gate message context
- ❌ GREEN review (RED just completed): "Review test quality — atomic? right assertions? testing behavior?"
- ❌ REFACTOR review (GREEN just completed): "Review implementation — minimal? correct? Run /refactor"
- ❌ RED review (REFACTOR just completed): "Review completed scenario — run /quality-review for ecosystem check"
- ❌ Review depth: lightweight for GREEN, moderate for REFACTOR, full for RED
- ❌ TDD.md updated: after each RED/GREEN/REFACTOR step, instruct Claude to mark the corresponding `[x]` in test-definitions.md
- ❌ Test-definitions feature template updated with sub-checkbox format

**Implementation Status**: ❌ Not Started
**Tests**: N/A (skill and instruction files)

---

## Summary

**Completed**: 0/4 stories (0%)
**Remaining**: 4/4 stories (100%)

### Phase 1: Foundation ❌

- Story 1: `additionalContext` + `tdd:` gate namespace

### Phase 2: Detection ❌

- Story 2: Test-definitions.md sub-checkboxes and TDD step detection
- Story 3: Remove commit-prefix detection for refactor gate

### Phase 3: Review ❌

- Story 4: `/tdd-review` skill + TDD.md updates

**Next Steps**: Story 1 first (foundation), then Stories 2+3 together (swap detection mechanism), then Story 4 (skill + instructions).

---

## Key Decisions

### Decision 1: Artifact-based detection over commit-prefix detection

**What:** Detect TDD step transitions by parsing sub-checkboxes in test-definitions.md, not by reading commit message prefixes.
**Why:** Single source of truth — the artifact shows TDD progress visually AND drives gate detection. No sync between commit conventions and state. Same detection pattern as phase gates (file edit → parse content → compare to last known → set gate). Creates a rich audit trail per scenario.
**Trade-off:** Slightly more complex parsing than a single regex on commit messages (~15 lines vs ~3 lines). Claude must update test-definitions.md at each TDD step (additional file edit). Acceptable because Claude already updates this file to mark scenarios complete.

### Decision 2: Fold refactor gate into `tdd:` namespace

**What:** Rename `gate: 'refactor'` to `gate: 'tdd:refactor'`. Add `tdd:green` and `tdd:red`. Remove `feat:` commit detection.
**Why:** The refactor gate IS a TDD gate. Moving detection from commit prefixes to test-definitions.md means the old `feat:` detection is replaced, not supplemented. One system, not two.
**Trade-off:** Breaking change to gate name and detection mechanism. Tests need rewriting. No external consumers.

### Decision 3: `additionalContext` for action guidance

**What:** Use `additionalContext` field in deny output to guide Claude toward skills.
**Why:** Per Claude Code docs, `additionalContext` is the designed mechanism for "what to do instead." `permissionDecisionReason` explains WHY blocked.
**Trade-off:** Requires updating deny function interface. Minor refactor.

### Decision 4: Single `/tdd-review` skill as source of truth

**What:** One skill handles all TDD step reviews, adapting depth by step.
**Why:** Prevents drift — hooks reference skill by name, skill owns content. Same pattern as phase gate `/quality-review`.
**Trade-off:** Skill must determine which step from context. Slightly complex skill, simpler hooks.

### Decision 5: Sub-checkboxes per scenario in test-definitions.md

**What:** Each scenario gets three sub-items: `- [ ] RED`, `- [ ] GREEN`, `- [ ] REFACTOR`.
**Why:** Visible progress per scenario, serves as both human documentation and machine-readable state. "Living documentation" pattern — the artifact is always current because updating it is what triggers the gates. The act of tracking IS the detection mechanism.
**Trade-off:** Adds 3 lines per scenario to test-definitions.md. Template change required. Claude must update sub-checkboxes at each TDD step (but this is what makes detection work — the overhead IS the feature).
