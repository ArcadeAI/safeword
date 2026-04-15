# Test Definitions: TDD Inner-Loop Quality Gates (Issue #041)

**Feature**: Quality review gates at each TDD sub-phase boundary, detected via sub-checkboxes in test-definitions.md

**Related Issue**: #041
**Test File**: `packages/cli/tests/integration/quality-gates.test.ts`
**Total Tests**: 14 (0 passing, 0 not implemented)

---

## Test Suite 1: `additionalContext` in deny output

PreToolUse deny function supports `additionalContext` field alongside `permissionDecisionReason`.

### Scenario 1: deny with additionalContext includes both fields in output ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** a PreToolUse hook that calls `deny()` with reason AND additionalContext
**When** the hook output JSON is parsed
**Then** `hookSpecificOutput` contains both `permissionDecisionReason` and `additionalContext` fields

**Steps**:

1. Call `deny("Gate active", "Run /tdd-review")` in PreToolUse hook
2. Parse stdout JSON

**Expected**:

- `permissionDecisionReason` is `"Gate active"`
- `additionalContext` is `"Run /tdd-review"`
- `permissionDecision` is `"deny"`

---

### Scenario 2: deny without additionalContext omits the field ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** a PreToolUse hook that calls `deny()` with reason only (no additionalContext)
**When** the hook output JSON is parsed
**Then** `hookSpecificOutput` contains `permissionDecisionReason` but NOT `additionalContext`

**Steps**:

1. Call `deny("LOC threshold exceeded")` (no second parameter)
2. Parse stdout JSON

**Expected**:

- `permissionDecisionReason` is `"LOC threshold exceeded"`
- `additionalContext` key is absent from output
- Existing LOC gate behavior unchanged

---

## Test Suite 2: `tdd:` gate namespace + commit-prefix removal

Refactor gate renamed, LOC guard updated, `feat:` commit detection removed.

### Scenario 3: LOC gate does not override `tdd:` gates ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** a `tdd:refactor` gate is active AND LOC exceeds threshold
**When** PostToolUse runs
**Then** `gate` stays `tdd:refactor` (LOC gate does not override)

**Steps**:

1. Set state with `gate: 'tdd:refactor'`, LOC at 500
2. Run PostToolUse

**Expected**:

- `state.gate` remains `'tdd:refactor'`

---

### Scenario 4: `feat:` commit no longer sets refactor gate ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `lastKnownPhase` is `implement` and a `feat:` commit just happened
**When** PostToolUse runs
**Then** no gate is set from the commit message

**Steps**:

1. Set state with `lastKnownPhase: 'implement'`, stale commit hash
2. Create a `feat: scenario` commit
3. Run PostToolUse (no test-definitions.md edit)

**Expected**:

- `state.gate` is `null`

---

### Scenario 5: PreToolUse blocks with `additionalContext` for `tdd:refactor` gate ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `gate` is `tdd:refactor` and HEAD matches last commit
**When** PreToolUse runs for an Edit tool
**Then** deny includes reason about TDD phase AND `additionalContext` referencing `/tdd-review`

**Steps**:

1. Set state with `gate: 'tdd:refactor'`, matching HEAD
2. Run PreToolUse with tool_name `Edit`

**Expected**:

- Permission decision is `deny`
- Reason contains `SAFEWORD` and `refactor`
- `additionalContext` contains `/tdd-review`

---

## Test Suite 3: Phase gate `additionalContext` fix

Phase gate uses `additionalContext` for `/quality-review` instruction instead of embedding in reason.

### Scenario 6: phase gate uses `additionalContext` for skill reference ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `gate` is `phase:implement` and HEAD matches
**When** PreToolUse runs for an Edit tool
**Then** deny reason describes the phase, `additionalContext` references `/quality-review`

**Steps**:

1. Create `.claude/skills/bdd/TDD.md` with known content
2. Set state with `gate: 'phase:implement'`, matching HEAD
3. Run PreToolUse with tool_name `Edit`

**Expected**:

- Reason contains `SAFEWORD` and `implement`
- Reason contains phase file content (TDD Guide)
- `additionalContext` contains `/quality-review`

---

## Test Suite 4: Test-definitions.md sub-checkbox detection

PostToolUse watches test-definitions.md and sets TDD gates based on sub-checkbox state changes.

### Scenario 7: RED checkbox marked sets `tdd:green` gate ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `lastKnownPhase` is `implement` and test-definitions.md has a scenario with `[x] RED` and `[ ] GREEN`
**When** PostToolUse fires after editing test-definitions.md
**Then** `gate` is set to `tdd:green`

**Steps**:

1. Write test-definitions.md with one scenario: `[x] RED`, `[ ] GREEN`, `[ ] REFACTOR`
2. Set state with `lastKnownPhase: 'implement'`, `lastKnownTddStep: null`
3. Run PostToolUse with file path pointing to test-definitions.md

**Expected**:

- `state.gate` equals `'tdd:green'`
- `state.lastKnownTddStep` updated

---

### Scenario 8: GREEN checkbox marked sets `tdd:refactor` gate ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `lastKnownPhase` is `implement` and test-definitions.md has `[x] RED`, `[x] GREEN`, `[ ] REFACTOR`
**When** PostToolUse fires after editing test-definitions.md
**Then** `gate` is set to `tdd:refactor`

**Steps**:

1. Write test-definitions.md with: `[x] RED`, `[x] GREEN`, `[ ] REFACTOR`
2. Set state with `lastKnownPhase: 'implement'`, `lastKnownTddStep: 'red'`
3. Run PostToolUse

**Expected**:

- `state.gate` equals `'tdd:refactor'`

---

### Scenario 9: REFACTOR checkbox marked sets `tdd:red` gate ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `lastKnownPhase` is `implement` and test-definitions.md has all three checked for scenario 1, and scenario 2 exists unchecked
**When** PostToolUse fires after editing test-definitions.md
**Then** `gate` is set to `tdd:red` (review completed scenario before next)

**Steps**:

1. Write test-definitions.md with scenario 1 all `[x]`, scenario 2 all `[ ]`
2. Set state with `lastKnownPhase: 'implement'`, `lastKnownTddStep: 'green'`
3. Run PostToolUse

**Expected**:

- `state.gate` equals `'tdd:red'`

---

### Scenario 10: no gate when TDD step unchanged ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** test-definitions.md is edited but no sub-checkbox state changed
**When** PostToolUse fires
**Then** no TDD gate is set

**Steps**:

1. Write test-definitions.md with `[x] RED`, `[ ] GREEN`, `[ ] REFACTOR`
2. Set state with `lastKnownTddStep` matching current step
3. Run PostToolUse (simulating a text-only edit)

**Expected**:

- `state.gate` is `null`

---

### Scenario 11: TDD detection only during implement phase ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `lastKnownPhase` is `decomposition` (not implement)
**When** PostToolUse fires after editing test-definitions.md with changed checkboxes
**Then** no TDD gate is set

**Steps**:

1. Write test-definitions.md with `[x] RED`, `[ ] GREEN`, `[ ] REFACTOR`
2. Set state with `lastKnownPhase: 'decomposition'`
3. Run PostToolUse

**Expected**:

- `state.gate` is `null`

---

### Scenario 12: non-ticket test-definitions.md edit is ignored ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** a file named `test-definitions.md` outside the tickets directory is edited
**When** PostToolUse fires
**Then** no TDD gate is set

**Steps**:

1. Run PostToolUse with file path `docs/test-definitions.md` (not in tickets dir)

**Expected**:

- `state.gate` is `null`

---

### Scenario 13: all-checked scenario with no next scenario fires no gate ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** test-definitions.md has only one scenario and all three sub-checkboxes are `[x]`
**When** PostToolUse fires
**Then** no gate is set (all work complete)

**Steps**:

1. Write test-definitions.md with single scenario, all `[x]`
2. Run PostToolUse

**Expected**:

- `state.gate` is `null`

---

### Scenario 14: PreToolUse blocks with step-appropriate message for `tdd:green` ❌

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Given** `gate` is `tdd:green` and HEAD matches
**When** PreToolUse runs for an Edit tool
**Then** deny reason references entering GREEN phase, `additionalContext` references `/tdd-review`

**Steps**:

1. Set state with `gate: 'tdd:green'`, matching HEAD
2. Run PreToolUse with tool_name `Edit`

**Expected**:

- Permission decision is `deny`
- Reason contains `SAFEWORD` and `green`
- `additionalContext` contains `/tdd-review`

---

## Summary

**Total**: 14 scenarios
**Passing**: 0 (0%)
**Not Implemented**: 14 (100%)

### Coverage by Story

| Story                                  | Scenarios | Status |
| -------------------------------------- | --------- | ------ |
| Story 1: sub-checkbox detection        | 7-13      | ❌ 0%  |
| Story 2: additionalContext + tdd: + rm | 1-6, 14   | ❌ 0%  |
| Story 3: /tdd-review skill             | N/A       | ❌ 0%  |

---

## Test Execution

```bash
# Run all quality gate tests
cd packages/cli && npx vitest run tests/integration/quality-gates.test.ts

# Run specific scenario
cd packages/cli && npx vitest run tests/integration/quality-gates.test.ts -t "scenario name"
```

---

**Last Updated**: 2026-03-19
