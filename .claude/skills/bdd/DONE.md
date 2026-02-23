# Phase 7: Done Gate

**Entry:** All scenarios marked `[x]` in test-definitions

## Required Checks (run /done to automate)

- [ ] All scenarios `[x]` in test-definitions
- [ ] Full test suite passes
- [ ] Build succeeds
- [ ] Lint passes
- [ ] Run `/audit` — no errors (warnings OK)

## Flake Detection

Run tests multiple times (3x recommended):

```bash
for i in {1..3}; do bun test || echo "FLAKE DETECTED on run $i"; done
```

Investigate any inconsistent failures before marking done.

## Cross-Scenario Refactoring

After all scenarios pass, run `/refactor` to look for cleanup:

- Duplicate setup code → shared fixture
- Similar assertions → custom matcher
- Repeated mocks → mock factory
- Copy-pasted logic → shared module

Only refactor if clear wins exist. Don't gold-plate.

## Parent Epic (if applicable)

If ticket has `parent:` field:

1. Add completion entry to parent's work log
2. If all `children:` done → update parent `status: done`

## Final Commit

1. Update ticket: `phase: done`, `status: done`
2. Commit: `feat(scope): [summary]`
