# Phase 6: Implementation (TDD)

**Entry:** Agent enters `implement` phase (after decomposition complete)

**Iron Law:** NO IMPLEMENTATION UNTIL TEST FAILS FOR THE RIGHT REASON

Begin TDD for the first unchecked scenario.

## Test Scope

Start with the most constraining test — usually E2E or integration. Prefer the highest scope that covers the behavior with acceptable feedback speed.

## Walking Skeleton (first scenario only)

If no E2E infrastructure exists, build skeleton first:

- Thinnest slice proving architecture works
- Form → API → response → UI (no real logic)

## For Each Scenario: RED → GREEN → REFACTOR

### 6.1 RED - Write Failing Test

1. Pick first unchecked scenario from test-definitions
2. Write a failing test for that behavior — state test type choice, must fail for the right reason (missing behavior, not syntax)
3. Mark `[x] RED` in test-definitions.md, commit: `test: [scenario name]`

**Red Flags → STOP:**

| Flag                    | Action                                        |
| ----------------------- | --------------------------------------------- |
| Test passes immediately | Rewrite — you're testing nothing              |
| Syntax error            | Fix syntax, not behavior                      |
| Wrote implementation    | Delete it, return to test                     |
| Multiple tests at once  | Pick ONE                                      |
| Tautological test       | Assert on behavior, not implementation mirror |

### 6.2 GREEN - Minimal Implementation

**Iron Law:** ONLY WRITE CODE THE TEST REQUIRES

1. Write minimal code to pass test. If you wrote more than the test requires, delete the excess. GREEN is minimal — REFACTOR adds quality.
2. Run test → verify passes
3. Run FULL test suite → verify no regressions
4. Mark `[x] GREEN` in test-definitions.md
5. Commit: `feat: [scenario name]`

**Evidence before claims:** Show test output, don't just claim "tests pass".

### 6.3 REFACTOR - Clean Up & Iterate

Assess: is there duplication, unclear naming, or excessive length? If yes, refactor. If not, proceed.

For small changes (rename, extract helper), refactor directly. For structural changes, run `/refactor`.

Before marking scenario complete:

1. **Confirm refactor status** (say one of these):
   - "Refactored: [what improved]" + show refactor commit
   - "No refactoring needed: code is clean"
2. Mark `[x] REFACTOR` in test-definitions.md
3. Commit and proceed to next scenario (first with unchecked `[ ] RED`)
4. All done → proceed to Phase 7
