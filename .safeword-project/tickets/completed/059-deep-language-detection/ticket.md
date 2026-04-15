---
id: 059
type: task
phase: done
status: done
created: 2026-03-28T01:48:00Z
last_modified: 2026-03-28T01:48:00Z
---

# Deep language detection: recursive scanning for monorepo marker files

**Problem:** `existsShallow`/`findShallow` scan root + 1 level deep for language marker files. Monorepos with `category/project/marker` layout (e.g., `apps/engine/go.mod`) are missed because markers live at depth 2+. Discovered on arcade-monorepo where all `go.mod` and `pyproject.toml` files are at depth 2.

**Solution:** Replace depth-1 scan with recursive scanning using existing `SUBDIRECTORY_EXCLUDE` list and depth cap of 10.

## Changes

| File                                    | Change                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `utils/fs.ts`                           | Replace `existsShallow`/`findShallow` with `existsInTree`/`findInTree` (recursive, max depth 10) |
| `utils/project-detector.ts`             | Update imports                                                                                   |
| `commands/upgrade.ts`                   | Update imports                                                                                   |
| `packs/python/index.ts`                 | Update imports                                                                                   |
| `packs/golang/index.ts`                 | Update imports                                                                                   |
| `packs/rust/index.ts`                   | Update imports                                                                                   |
| `packs/dbt/index.ts`                    | Update imports                                                                                   |
| `tests/utils/shallow-detection.test.ts` | Flip depth>1 test, add depth 2/3 tests, add nested exclusion tests                               |

## Design notes

- Deprecated aliases `existsShallow`/`findShallow` kept for backwards compat
- Root-first priority preserved (root match wins over nested)
- `hasShellScripts` in project-detector.ts already uses recursive scanning (depth 4) as precedent
- Boolean detection sufficient — first-found return value is fine
- ~1,200 non-excluded directories in arcade-monorepo — trivial perf cost
