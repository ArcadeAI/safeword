---
id: '131'
type: task
phase: done
status: done
created: 2026-04-16T16:26:00Z
last_modified: 2026-04-16T21:10:00Z
scope:
  - Move 11 helper functions from describe blocks to module scope in hooks.test.ts
  - Fix slow regex by anchoring with literal prefix
  - Replace hardcoded /tmp path with temp directory variable
  - Add targetDirectory parameter to runLintHook (closes over projectDirectory)
out_of_scope:
  - Disabling any lint rules
  - Changes to hook behavior or test logic
done_when:
  - 0 ESLint errors in hooks.test.ts
  - 49/49 tests pass
---

# Fix 11 ESLint errors in hooks.test.ts

**Goal:** Clean up the remaining 11 ESLint errors in `packages/cli/tests/integration/hooks.test.ts`. Originally Part 4 of ticket #109 (which specified 19 errors — 8 were fixed in earlier sessions, 11 remain).

**Why:** These lint errors fire on every pre-commit lint-staged run for this file. Clearing them removes noise and unblocks clean commits.

## Remaining errors (11)

### Fix 1: Slow regex (1 error — `sonarjs/slow-regex`, line 286)

```typescript
// Old:
expect(output).toMatch(/\w+, \w+ \d{1,2}, \d{4}/);
// New:
expect(output).toMatch(/[A-Za-z]+, [A-Za-z]+ \d{1,2}, \d{4}/);
```

### Fix 2: Hardcoded `/tmp` path (1 error — `sonarjs/publicly-writable-directories`, line 947)

```typescript
// Old:
input: JSON.stringify({ transcript_path: '/tmp/fake.jsonl' }),
// New:
input: JSON.stringify({ transcript_path: nodePath.join(nonSafewordDirectory, 'fake.jsonl') }),
```

### Fix 3: Move 11 functions to module scope (9 initial + 2 newly exposed — `unicorn/consistent-function-scoping`)

Move these from inside `describe` blocks to a `// Test helpers` section between `afterAll` and first `describe`:

1. `createTicketContent` — pure, move as-is
2. `clearIssuesDirectory` — pure, move as-is
3. `createChangesTranscript` — pure, move as-is
4. `createMockTranscript` — pure, move as-is
5. `createMultiMessageTranscript` — pure, move as-is
6. `runStopHook` — pure, move as-is
7. `parseStopOutput` — pure, move as-is
8. `runLintHook` — closes over `projectDirectory`, add `targetDirectory: string` parameter, update 3 call sites
9. `runPostToolLint` — pure (already accepts `cwd`), move as-is
10. `setupIssuesDirectory` — newly flagged after #3 moved, pure, move as-is
11. `runStopHookForPhase` — newly flagged after #3 moved, pure, move as-is

## Relationship to other tickets

- **Ticket #109** (replace best practices wording): Originally scoped Part 4 of this ticket. Parts 1-3 are complete. Splitting out to keep 109 closeable without coupling to lint cleanup.

## Work Log

- 2026-04-16T16:26:00Z Created: split from ticket #109 Part 4. 8 of original 19 errors already fixed in earlier sessions.
- 2026-04-16T21:06:00Z Complete: 11 functions moved to module scope (10 as-is, 1 with param change), slow regex fixed, /tmp path replaced. 0 lint errors, 49/49 tests pass. /verify + /audit passed.
