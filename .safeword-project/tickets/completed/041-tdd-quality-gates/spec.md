# Feature Spec: TDD Inner-Loop Quality Gates (#041)

**Feature**: Quality review gates at each TDD sub-phase boundary (RED, GREEN, REFACTOR), detected via sub-checkboxes in test-definitions.md — folding the current refactor gate into a unified `tdd:` gate namespace.

**Status**: ❌ Not Started (0/3 stories complete)

---

## Technical Constraints

### Performance

- [ ] PostToolUse adds test-definitions.md file watching (same pattern as ticket.md — negligible overhead)
- [ ] Parsing sub-checkboxes is ~10-15 lines, runs only when test-definitions.md is edited

### Compatibility

- [ ] Existing refactor gate behavior preserved (relocated from commit-prefix to test-definitions.md detection)
- [ ] Phase gate behavior unchanged
- [ ] LOC gate coexists (LOC doesn't override `tdd:` gates, same as current refactor guard)

### Dependencies

- [ ] Claude Code >= v2.1.9 (required for `additionalContext` in PreToolUse hooks)
- [ ] Must use `additionalContext` field in PreToolUse deny output (per Claude Code docs)
- [ ] Review content must live in skill files (no inline content in hooks — prevents drift)

---

## Story 1: Test-definitions.md sub-checkboxes and TDD step detection

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

**Resume/stale state:** Uses the same pattern as phase gates — compare to `lastKnownTddStep`, fire gate on mismatch. On resume or ticket switch, a gate may fire even though no transition just happened. This is intentional: it serves as an orientation checkpoint ("review where this scenario is before continuing"). Consistent with phase gate behavior.

---

## Story 2: `additionalContext` in deny output + `tdd:` gate namespace + commit-prefix removal

**As a** hook system
**I want to** use `additionalContext` for action guidance, rename gates to the `tdd:` namespace, and remove commit-prefix detection
**So that** Claude reliably receives skill instructions, TDD gates are explicitly named, and detection comes from one source

**Acceptance Criteria**:

- ❌ `deny()` in PreToolUse accepts optional `additionalContext` parameter
- ❌ Output JSON includes `additionalContext` field when provided
- ❌ Existing `gate: 'refactor'` renamed to `gate: 'tdd:refactor'`
- ❌ Phase gate uses `additionalContext` for `/quality-review` instruction (fix from 66025ea)
- ❌ All `tdd:` gates use `additionalContext` for `/tdd-review` instruction
- ❌ LOC gate guard updated: `state.gate !== 'refactor'` → `!state.gate?.startsWith('tdd:')`
- ❌ Remove `feat:` → `refactor` gate logic from PostToolUse commit detection block
- ❌ TDD gates now fire exclusively from test-definitions.md sub-checkbox changes (Story 1)
- ❌ Commit still clears any active gate (existing behavior preserved)
- ❌ PreToolUse handles all `tdd:` gates with single code path (interpolated step name)
- ❌ Existing tests updated for new gate name, `additionalContext` field, and removed commit detection
- ❌ Both project hook and template hook updated identically

**Implementation Status**: ❌ Not Started
**Tests**: `packages/cli/tests/integration/quality-gates.test.ts`

**Notes**: This story combines the old Stories 1 and 3. Implementation order: build Story 1 (test-definitions.md detection) first so both detection systems coexist temporarily, then apply this story to rename + remove commit detection in one step. No regression window because old detection stays until new detection is proven.

---

## Story 3: `/tdd-review` skill + TDD.md updates

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

**Completed**: 0/3 stories (0%)
**Remaining**: 3/3 stories (100%)

### Phase 1: Detection ❌

- Story 1: Test-definitions.md sub-checkboxes and TDD step detection

### Phase 2: Namespace + Cleanup ❌

- Story 2: `additionalContext` + `tdd:` namespace + commit-prefix removal

### Phase 3: Review ❌

- Story 3: `/tdd-review` skill + TDD.md updates

**Implementation order**: Story 1 first (adds new detection alongside existing). Then Story 2 (renames gates, adds `additionalContext`, removes old detection). Then Story 3 (skill + instructions).

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
**Why:** Per Claude Code docs (v2.1.9+), `additionalContext` is the designed mechanism for "what to do instead." `permissionDecisionReason` explains WHY blocked. Both are shown to Claude on deny.
**Trade-off:** Requires updating deny function interface. Minor refactor.

### Decision 4: Single `/tdd-review` skill as source of truth

**What:** One skill handles all TDD step reviews, adapting depth by step.
**Why:** Prevents drift — hooks reference skill by name, skill owns content. Same pattern as phase gate `/quality-review`.
**Trade-off:** Skill must determine which step from context. Slightly complex skill, simpler hooks.

### Decision 5: Sub-checkboxes per scenario in test-definitions.md

**What:** Each scenario gets three sub-items: `- [ ] RED`, `- [ ] GREEN`, `- [ ] REFACTOR`.
**Why:** Visible progress per scenario, serves as both human documentation and machine-readable state. "Living documentation" pattern — the artifact is always current because updating it is what triggers the gates. The act of tracking IS the detection mechanism.
**Trade-off:** Adds 3 lines per scenario to test-definitions.md. Template change required. Claude must update sub-checkboxes at each TDD step (but this is what makes detection work — the overhead IS the feature).

### Decision 6: Implementation order — detection first, then rename+remove

**What:** Build test-definitions.md detection (Story 1) before renaming gates and removing commit-prefix detection (Story 2).
**Why:** Avoids regression — old `feat:` detection stays active until new detection is proven. Both systems coexist briefly during Story 1, then Story 2 removes the old one. No window where refactor gate doesn't exist.
**Trade-off:** Temporary dual detection during Story 1. Acceptable since Story 2 immediately follows.

### Decision 7: Single PreToolUse code path for all `tdd:` gates

**What:** Handle all `tdd:` gates with one code block using `startsWith('tdd:')` and interpolated step name.
**Why:** Avoids per-step branching in hooks. The `/tdd-review` skill handles step-specific guidance — the hook just says which step and references the skill. Testing 2 of 3 variants provides sufficient coverage for a single code path.
**Trade-off:** Step-specific messaging lives in the skill, not the hook. Consistent with the "no inline content in hooks" constraint.
