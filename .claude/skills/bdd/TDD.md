# Phase 6: Implementation (TDD)

**Entry:** Agent enters `implement` phase. Begin TDD for the first unchecked scenario.

## Iron Laws

1. **NO IMPLEMENTATION UNTIL TEST FAILS FOR THE RIGHT REASON** — behavior missing, not syntax error
2. **ONLY WRITE CODE THE TEST REQUIRES** — GREEN is minimal, REFACTOR adds quality

## Test Scope

Start with the most constraining test — usually E2E or integration. Prefer the highest scope that covers the behavior with acceptable feedback speed.

### Walking Skeleton (first scenario only)

If no E2E infrastructure exists, build skeleton first: thinnest slice proving architecture works (form → API → response → UI, no real logic).

## For Each Scenario: RED → GREEN → REFACTOR

Pick first unchecked scenario from test-definitions. Cycle through RED (failing test, commit) → GREEN (minimal code to pass, commit) → REFACTOR (if needed, commit). Mark checkboxes in test-definitions.md after each step.

**Evidence before claims:** Show test output, don't just claim "tests pass". Run FULL suite at GREEN to catch regressions.

### Red Flags — STOP:

| Flag                    | Action                                        |
| ----------------------- | --------------------------------------------- |
| Test passes immediately | Rewrite — you're testing nothing              |
| Syntax error            | Fix syntax, not behavior                      |
| Wrote implementation    | Delete it, return to test                     |
| Multiple tests at once  | Pick ONE                                      |
| Tautological test       | Assert on behavior, not implementation mirror |

### Refactor Decision

Assess: duplication, unclear naming, excessive length? If yes, refactor (small changes directly, structural changes via `/refactor`). If no, proceed to next scenario.

All scenarios complete → proceed to Phase 7.
