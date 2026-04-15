# Phase 5: Technical Decomposition

**Entry:** Agent enters `decomposition` phase (after scenarios validated)

**Optional:** Skip if the architecture is clear from the converged proposal and the agent can sequence work naturally.

## Analyze Scenarios

1. **Identify components** — What parts of the system does each scenario touch?
   - UI components
   - API endpoints
   - Data models
   - Business logic modules

2. **Assign test layers** — Prefer the highest scope that covers the behavior with acceptable feedback speed.
   - Pure function with many edge cases → unit test
   - Component boundaries, database, API → integration test
   - User-facing features, multi-module cooperation → E2E test

3. **Create task breakdown** — Order tasks so each builds on what's already working. Avoid building layers that depend on unfinished layers.

4. **Present to user** — Show components, test layers, task order

### Concrete example

**Context:** Feature has 4 validated scenarios for a `--verbose` flag on lint: (1) shows per-file results, (2) shows passing files, (3) shows warnings, (4) errors when no linter found.

**Agent:**

> Breaking this into 3 tasks:
>
> | Task                                   | Scenarios          | Test type   | Depends on |
> | -------------------------------------- | ------------------ | ----------- | ---------- |
> | 1. Add `--verbose` flag parsing to CLI | — (infrastructure) | integration | nothing    |
> | 2. Verbose output formatter            | Scenarios 1, 2, 3  | integration | Task 1     |
> | 3. Error handling for missing linter   | Scenario 4         | unit        | Task 1     |
>
> Tasks 2 and 3 are independent after Task 1. Test type is integration for the formatter because it needs real linter output, unit for the error path since it's a pure check.

**User:** "Looks right, go."

**Result:** Task breakdown documented → proceed to implement.

## Complex Features

Features with 3+ components, new tech choices, or schema changes may warrant documentation first:

- Feature-level decisions → `.safeword/guides/design-doc-guide.md`
- Cross-cutting choices → `.safeword/guides/architecture-guide.md`

## Phase 5 Exit (REQUIRED)

Before proceeding to Phase 6:

1. Task breakdown documented in ticket
2. **Update frontmatter:** `phase: implement`
3. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 5 - Decomposed into {N} tasks
   ```
