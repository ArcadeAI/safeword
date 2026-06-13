---
id: 097
type: task
phase: done
status: done
created: 2026-03-30T02:20:00Z
last_modified: 2026-03-30T02:20:00Z
---

# Pre-Push Test Gate

**Goal:** Add a git pre-push hook that runs the test suite before allowing push to main.

**Why:** Schema changes in one session broke 3 tests caught only after push in CI. A pre-push hook prevents broken tests from reaching main.

## Design Considerations

- Full suite takes 10+ minutes (`maxWorkers: 1`, 72 test files) — too slow for every push
- Could run a targeted subset: schema tests + reconcile tests + integration tests (~60s)
- Should be skippable with `--no-verify` for emergencies
- Husky already installed (used for pre-commit lint-staged)

## Proposed Implementation

Add to `.husky/pre-push`:

```bash
#!/bin/sh
cd packages/cli
# Run schema, reconcile, and setup tests (~60s) — catches most drift
bunx vitest run tests/schema.test.ts tests/reconcile.test.ts tests/commands/ tests/integration/golden-path.test.ts
```

Or: only run tests when `schema.ts` was modified in the commits being pushed:

```bash
#!/bin/sh
if git diff origin/main...HEAD --name-only | grep -q "schema.ts"; then
  echo "schema.ts changed — running test gate..."
  cd packages/cli && bunx vitest run tests/schema.test.ts tests/commands/ tests/integration/golden-path.test.ts
fi
```

## Trade-offs

| Approach                          | Speed            | Coverage                     | Friction |
| --------------------------------- | ---------------- | ---------------------------- | -------- |
| Full suite on every push          | 10+ min          | Complete                     | High     |
| Targeted subset on every push     | ~60s             | Partial (catches most drift) | Low      |
| Tests only when schema.ts changed | ~60s conditional | Targeted                     | Minimal  |
| No pre-push hook (current)        | 0s               | None locally                 | Zero     |

## Work Log

- 2026-03-30T02:20:00Z Created: from CI failure investigation — complement to ticket 096 (stop hook reminder)

---
