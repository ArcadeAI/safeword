# 9P3VVH — Verify (patch)

Worktree-robust `.husky/pre-commit` lint-staged resolution.

## Verify Checklist

**Test Suite:** ✓ unaffected — change is to `.husky/pre-commit` (dev-infra, not
product/test code); last full run green (2199 pass / 1 skip) and no product or
test files changed since.
**Build:** N/A — no source change.
**Lint:** ✓ N/A — shell hook; lint-staged `*.sh` glob doesn't match the
extensionless `.husky/pre-commit`.
**Behavioral proof:** ✓ Self-validating. The fix commit (`4112dce4`) and the
close commit (`c7d6cbd1`) were both created **without** the manual
`PATH="$PWD/node_modules/.bin:$PATH"` prefix, and the hook resolved
`lint-staged` unaided (`→ lint-staged could not find any staged files matching
configured tasks`). Before the fix, bare `lint-staged` failed in this worktree.

## What changed

`.husky/pre-commit:40` now calls `node_modules/.bin/lint-staged` (the explicit
relative path the line-35 guard already validates) instead of the
PATH-dependent bare `lint-staged`. Root cause: husky's `_/h` prepends a
_relative_ `node_modules/.bin` to PATH; with `core.hooksPath=.husky/_` in the
main repo's config, that entry doesn't resolve when committing from a worktree.

Patch — no scenarios/audit required by the done gate (feature-only).
