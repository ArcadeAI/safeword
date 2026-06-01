# Implement: Outside-in TDD

**Entry:** Agent enters `implement` phase. Begin TDD for the first unchecked scenario.

## Iron Laws

1. **NO IMPLEMENTATION UNTIL TEST FAILS FOR THE RIGHT REASON** — behavior missing, not syntax error
2. **ONLY WRITE CODE THE TEST REQUIRES** — GREEN is minimal, REFACTOR adds quality

## Test Scope

Start with the most constraining test — usually E2E or integration. Prefer the highest scope that covers the behavior with acceptable feedback speed.

### Walking Skeleton (first scenario only)

If no E2E infrastructure exists, build skeleton first: thinnest slice proving architecture works (form → API → response → UI, no real logic).

## For Each Scenario: RED → GREEN → REFACTOR

Pick first unchecked scenario from test-definitions. Cycle through RED (failing test, commit) → GREEN (minimal code to pass, commit) → REFACTOR (if needed, commit).

### Checkbox Format Contract

Mark **ONE checkbox per edit, commit after each step.** The prompt hook and quality gates parse these checkboxes — multi-checkbox edits skip quality reviews.

**Correct format** (matches template exactly):

```markdown
## Scenario: User logs in

Given a registered user
When they submit valid credentials
Then they see the dashboard

- [x] RED abc1234
- [x] GREEN def5678
- [x] REFACTOR skip: no structural improvement needed
```

**Annotation rule (enforced by hook):** every `[x]` transition must carry either a commit SHA (proving which commit did that step) or `skip: <non-empty reason>` (a deliberate, auditable omission). Bare `[x]` without an annotation is blocked at the write-time hook. Pre-existing bare `[x]` from before this rule shipped is silently allowed — the validation is forward-looking only.

At the bottom of `test-definitions.md`, add one feature-level row for the cross-scenario refactor pass (same annotation rule applies):

```markdown
## Feature-level cross-scenario refactor

- [x] cross-scenario <sha> # or `skip: <reason>`
```

**Invalid — do NOT:**

- `- [x] Red` / `- [x] green` — use ALL CAPS: `RED`, `GREEN`, `REFACTOR`
- Mark `RED` and `GREEN` in the same edit — one checkbox per edit, commit between
- `- [x] RED` with no SHA and no `skip:` — blocked at write-time
- `- [x] REFACTOR skip:` with empty or whitespace-only reason — blocked at write-time
- Reuse the same SHA across two steps in one scenario — caught at the done-gate (each step needs its own distinct commit)
- Modify test files in a REFACTOR commit — blocked at commit-time (test changes during cleanup are behavior changes in disguise)
- Add extra checkboxes like `- [ ] REVIEW` — only RED/GREEN/REFACTOR

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

All scenarios complete → proceed to verify.
