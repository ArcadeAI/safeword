# Phase 7: Done Gate

**Entry:** All scenarios marked `[x]` in test-definitions

## Step 1: Cross-Scenario Refactoring

Run `/refactor` across all files changed in this ticket:

```bash
# Show all files changed for this ticket (scope for /refactor)
git diff main --name-only
```

Look for patterns only visible after all scenarios are implemented:

- Duplicate setup code → shared fixture
- Similar assertions → custom matcher
- Repeated mocks → mock factory
- Copy-pasted logic → shared module

Only refactor if clear wins exist. Don't gold-plate.

## Step 2: Flake Detection (if flakes suspected)

If the test suite has known intermittent failures, run multiple times:

```bash
for i in {1..3}; do bun test || echo "FLAKE DETECTED on run $i"; done
```

Investigate any inconsistent failures before proceeding.

## Step 3: Run /verify

Runs tests, build, lint, scenario validation, and dependency drift check. Generates required evidence patterns.

## Step 4: Run /audit

Checks architecture, dead code, duplication, outdated deps. Generates required audit evidence.

**Both `/verify` and `/audit` evidence required** — stop hook validates all three patterns:

- `✓ X/X tests pass` — proves test suite ran
- `All N scenarios marked complete` — proves scenarios checked
- `Audit passed` — proves /audit ran

## Step 5: BDD Compliance Self-Check

Review your work against the BDD phases. Fill in specifics (not just checkmarks):

```
## BDD Compliance Check
- [ ] Phases 0-2: Discovery — [what was found/decided]
- [ ] Phase 3: Scenarios — [N scenarios in Given/When/Then]
- [ ] Phase 4: Validated with user — [how/when]
- [ ] Phase 5: Decomposed — [N tasks with test layers]
- [ ] Phase 6: RED→GREEN→REFACTOR per scenario — [N scenarios, N commits]
- [ ] Phase 7: Refactor→Verify→Audit — [results summary]
- [ ] Phase transitions committed before each phase
```

Flag any phases that were skipped or done out of order.

## Step 6: Parent Epic (if applicable)

If ticket has `parent:` field:

1. Add completion entry to parent's work log
2. If all `children:` done → update parent `status: done`

## Step 7: Final Commit

1. Update ticket: `phase: done`, `status: done`
2. Commit: `feat(scope): [summary]`
