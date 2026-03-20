# Phase 6: Implementation (TDD)

**Entry:** Agent enters `implement` phase (after decomposition complete)

**Iron Law:** NO IMPLEMENTATION UNTIL TEST FAILS FOR THE RIGHT REASON

Announce: "Entering implementation. TDD mode for each scenario."

## Outside-In Test Layering

1. **E2E first** — Prove user-facing behavior works end-to-end
2. **Integration** — Test component boundaries with real dependencies
3. **Unit** — Test isolated logic, mock only when necessary

## Walking Skeleton (first scenario only)

If no E2E infrastructure exists, build skeleton first:

- Thinnest slice proving architecture works
- Form → API → response → UI (no real logic)

## For Each Scenario: RED → GREEN → REFACTOR

### 6.1 RED - Write Failing Test

**Before writing:** Load the testing skill and read `.safeword/guides/testing-guide.md` for test type selection, behavioral testing principles, and anti-patterns. Both sources apply — the skill for iron laws and patterns, the guide for the type hierarchy and bug detection matrix.

1. Pick ONE test from test-definitions (first scenario with unchecked `[ ] RED`)
2. **Announce test type:** "Test type: [unit/integration/E2E/eval] because [reason]" (use testing guide's decision tree)
3. Write test code (from Given/When/Then), following testing skill's iron laws
4. Run test → verify fails for RIGHT reason (behavior missing, not syntax)
5. Mark `[x] RED` in test-definitions.md (triggers tdd:green quality gate)
6. Commit: `test: [scenario name]`

**Red Flags → STOP:**

| Flag                    | Action                           |
| ----------------------- | -------------------------------- |
| Test passes immediately | Rewrite - you're testing nothing |
| Syntax error            | Fix syntax, not behavior         |
| Wrote implementation    | Delete it, return to test        |
| Multiple tests at once  | Pick ONE                         |

### 6.2 GREEN - Minimal Implementation

**Iron Law:** ONLY WRITE CODE THE TEST REQUIRES

1. Write minimal code to pass test
2. Run test → verify passes
3. Run FULL test suite → verify no regressions
4. Mark `[x] GREEN` in test-definitions.md (triggers tdd:refactor quality gate)
5. Commit: `feat: [scenario name]`

**Evidence before claims:** Show test output, don't just claim "tests pass".

### 6.3 REFACTOR - Clean Up

Run `/refactor` for cleanup after GREEN. It handles:

- Duplication extraction
- Name clarity
- Function length
- Magic values

### 6.4 Mark & Iterate

Before marking scenario complete:

1. **Confirm refactor status** (say one of these):
   - "Refactored: [what improved]" + show refactor commit
   - "No refactoring needed: code is clean"
2. Mark `[x] REFACTOR` in test-definitions.md (triggers tdd:red quality gate)
3. Commit and proceed to next scenario
4. Return to 6.1 for next scenario (first with unchecked `[ ] RED`)
5. All done → proceed to Phase 7
