---
id: B8GCC1
slug: protect-advanced-workspace-glob-fallback
type: task
phase: implement
status: in_progress
created: 2026-06-15T20:50:56.371Z
last_modified: 2026-06-15T20:55:46Z
---

# Protect advanced workspace glob fallback

**Goal:** Lock in the dependency readiness hook's conservative fallback for unsupported advanced Bun workspace glob syntax.

**Why:** Future refactors should not accidentally narrow tracked workspace manifests and falsely report dependencies ready when Bun supports a broader glob language than this hook implements.

**Type:** Improvement

**Scope:** Add targeted regression coverage for unsupported advanced Bun workspace glob patterns such as `{}` and `[]`, proving the hook over-tracks package manifests instead of under-tracking them. Keep the test in the existing dependency-readiness test suite.

**Out of Scope:** Implementing full Bun glob syntax, adding a runtime glob dependency to hook code, changing recursive `**` or simple negative workspace behavior, or modifying dependency bootstrap user-facing messages.

**Done When:**

- [x] Unsupported advanced positive workspace patterns include all package manifests under the static scan base.
- [x] Unsupported advanced negative workspace patterns do not exclude manifests, preserving the no-false-ready bias.
- [x] Dependency readiness tests pass.

**Tests:**

- [x] CHARACTERIZATION: Add a unit test proving unsupported advanced positive and negative workspace globs are conservatively over-tracked.
- [x] GREEN: Existing implementation satisfies the test; no production code change needed.
- [x] REFACTOR: Keep the test readable and local to related workspace glob coverage.

## Figure-It-Out Decision

Recommend adding a table-driven regression test only. Current Bun docs support full workspace glob syntax, including `?`, `[]`, `{}`, `!`, `*`, and `**`, but this PR intentionally implements a no-dependency common subset for a hot hook and defaults unsupported positive patterns to match-all within their scan base. Implementing full advanced glob support now would add complexity without improving the original safety property.

**Next:** Add the regression test in `packages/cli/tests/hooks/dependency-readiness.test.ts`.

## Work Log

- 2026-06-15T20:50:56.371Z Started: Created ticket B8GCC1
- 2026-06-15T20:51:06Z Scoped: Rebased PR branch onto `origin/main`; revalidated that main has no unsupported advanced glob fallback coverage.
- 2026-06-15T20:51:06Z Figure-it-out: Current Bun docs confirm advanced glob syntax; chose coverage-only follow-up to lock the conservative over-tracking contract without adding hook runtime dependencies.
- 2026-06-15T20:55:46Z Implemented: Added regression coverage for unsupported brace positive and character-class negative workspace patterns.
- 2026-06-15T20:55:46Z Verified: `bun run --cwd packages/cli test tests/hooks/dependency-readiness.test.ts` passed 49/49, adjacent hook/schema suite passed 84/84, `bun run --cwd packages/cli lint` clean, and `bun run --cwd packages/cli test:release` passed 7/7.
- 2026-06-15T20:55:46Z Verify blocked: `/verify` invocation recorder fallback failed with `Missing CLAUDE_SESSION_ID` in Codex, so `verify.md` was not hand-written and ticket status remains `in_progress`.
