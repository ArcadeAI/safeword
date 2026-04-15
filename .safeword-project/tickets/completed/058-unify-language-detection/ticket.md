---
id: 058
type: bug
phase: done
status: done
created: 2026-03-27T20:17:00Z
last_modified: 2026-03-27T20:17:00Z
---

# Unify language detection: single source of truth for pack detection

**Goal:** Eliminate the dual detection paths that have already caused a real bug (Python `requirements.txt` not detected by pack registration) and prevent future drift as we add the SQL pack.

**Bug:** A Python project with only `requirements.txt` (no `pyproject.toml`) gets config files generated (`.safeword/ruff.toml`, `ruff.toml`) because `project-detector.ts` checks both markers — but the Python pack is never registered in `installedPacks` because `pythonPack.detect()` only checks `pyproject.toml`.

**Root cause:** Two independent `detectLanguages()` functions exist:

| Function            | Location              | Returns                | Used by                                    |
| ------------------- | --------------------- | ---------------------- | ------------------------------------------ |
| `detectLanguages()` | `project-detector.ts` | `Languages` object     | Config file generators via `ctx.languages` |
| `detectLanguages()` | `registry.ts`         | `string[]` of pack IDs | Pack registration via `installPack()`      |

Both scan marker files but can diverge — and Python already has.

## Design: Option D — Pack detect() is the source, project-detector calls it

Packs own their detection logic (self-contained, follows the LANGUAGE_PACK_SPEC). `project-detector.ts` builds the `Languages` object by calling each pack's `detect()` method:

```typescript
// project-detector.ts
import { LANGUAGE_PACKS } from '../packs/registry.js';

export function detectLanguages(cwd: string): Languages {
  return {
    javascript: LANGUAGE_PACKS.typescript?.detect(cwd) ?? false,
    python: LANGUAGE_PACKS.python?.detect(cwd) ?? false,
    golang: LANGUAGE_PACKS.golang?.detect(cwd) ?? false,
    rust: LANGUAGE_PACKS.rust?.detect(cwd) ?? false,
    dbt: LANGUAGE_PACKS.dbt?.detect(cwd) ?? false,
  };
}
```

`registry.ts`'s `detectLanguages()` already calls `pack.detect()` — so both paths now share the same detection logic. One source of truth.

### Also fix the Python bug

Update `pythonPack.detect()` to check both `pyproject.toml` and `requirements.txt`:

```typescript
detect(cwd: string): boolean {
  return existsShallow(cwd, 'pyproject.toml') || existsShallow(cwd, 'requirements.txt');
}
```

This aligns with what `project-detector.ts` already does today, and is the correct behavior regardless of the unification.

## File changes

| File                                    | Change                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `utils/project-detector.ts`             | `detectLanguages()` calls pack `detect()` methods instead of duplicating checks |
| `packs/python/index.ts`                 | `detect()` adds `requirements.txt` check                                        |
| `tests/utils/shallow-detection.test.ts` | Add test: requirements.txt-only project detected as Python                      |
| `tests/integration/`                    | Add test: both detection paths agree for every language                         |

**Total blast radius:** 2 source files + 2 test files. The `Languages` interface and all consumers remain unchanged.

## Interaction with 057 (SQL pack)

When the SQL pack broadens `detect()` to check multiple markers (dbt, sqlc, Flyway, etc.), the unification ensures those markers are automatically reflected in `ctx.languages.sql` without duplicating checks in `project-detector.ts`. This should land before or alongside 057.
