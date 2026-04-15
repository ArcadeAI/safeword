# YAML Parsing & Quality Gates: Learnings from Ticket 025

Covers: YAML failsafe schema for preserving leading-zero IDs, quality-state.json gotchas, ticket hierarchy navigation edge cases.

> Extracted from hierarchy navigation implementation (February 2026)

---

## YAML Failsafe Schema for Ticket IDs

**Problem:** Default YAML parsing converts `001` → integer `1`. When ticket frontmatter has `parent: 001` (unquoted), `parseYaml()` returns `1`, and `String(1)` = `'1'` — which can't find directory `001-epic/`.

**Root cause:** YAML 1.2 core schema treats `001` as an octal-like integer.

**Solution:**

```typescript
import { parse as parseYaml } from 'yaml';
const parsed = parseYaml(text, { schema: 'failsafe' });
```

Failsafe schema treats ALL scalars as strings. No type coercion.

**Trade-off:** Must handle `'null'` string explicitly since failsafe doesn't parse YAML null:

```typescript
const isNull = (value: unknown) => value === undefined || value === 'null' || value === '';
```

**Real codebase formats discovered:**

- `parent: 001` (unquoted — breaks default YAML)
- `parent: '013'` (quoted — works with any schema)
- `children: ['013a', '013b']` (quoted strings)
- `children: [6, 7, 8]` (unquoted numbers — failsafe returns `['6', '7', '8']`)

---

## ESLint unicorn/prevent-abbreviations

**Impact:** Affects public API names, not just local variables.

Common renames required:

| Before               | After                      |
| -------------------- | -------------------------- |
| `projectDir`         | `projectDirectory`         |
| `ticketsDir`         | `ticketsDirectory`         |
| `tmpDir`             | `temporaryDirectory`       |
| `currentDir`         | `currentDirectory`         |
| `resolveTicketDir()` | `resolveTicketDirectory()` |

**Lesson:** Rename functions/variables BEFORE writing tests that import them. Renaming after tests are written causes cascading changes.

---

## Quality Gate Workflow

### Phase Reminders (no longer a gate)

- Phase and TDD step are derived from ticket files at read time (not cached in state)
- Prompt hook shows phase-specific reminder each turn via `getTicketInfo()` + `deriveTddStep()`
- No blocking — guidance only. Commit after phase transitions is still best practice.

### LOC Gate

- Fires around ~400 lines of code since last commit
- Blocks further writes until you commit
- **Action:** Plan commits to stay under the threshold; don't accumulate large diffs

### Cumulative Artifact Check

- Feature tickets at `scenario-gate+` phases require `test-definitions.md` to exist
- Integration tests that create feature tickets at `done` phase must create this file
- Missing it causes the done gate to fail with "missing artifact" error

---

## Pre-commit Hook + Unstaged Files

**Problem:** `lint-staged` runs ESLint on staged files. If a staged file imports from an unstaged file with lint errors, the hook fails even though the unstaged file isn't being committed.

**Solution:** `git reset HEAD <problematic-file>` to unstage it, commit the clean file first, then fix and stage the problematic file separately.

---

## Test Suite Execution

- Full vitest suite uses `maxWorkers: 1` (sequential) — can take several minutes
- Hangs when run from project root with `bunx vitest run` — must run from `packages/cli/`
- Targeted test files (`bunx vitest run tests/hooks/hierarchy.test.ts`) work from anywhere
- Always kill lingering vitest processes before re-running: `pgrep -f vitest | xargs kill`

---

_Last updated: February 24, 2026_
