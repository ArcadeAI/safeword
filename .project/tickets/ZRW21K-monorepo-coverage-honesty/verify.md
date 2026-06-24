# Verify: Monorepo coverage honesty (ZRW21K)

## Verify Checklist

**Test Suite:** ✓ green with a fresh build (see note) — 5 new unit tests + the full architecture set pass
**Gherkin:** ✅ 7 new monorepo-coverage scenarios pass; full acceptance lane green
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + gherkin + tsc --noEmit; `detectPnpmWorkspaces` refactored under the complexity bar, regex hardened against backtracking)
**Scenarios:** All 7 scenarios R/G/R (15702b4)
**Dep Drift:** ✅ Clean (no new deps — dependency-free pnpm parse)
**Parent Epic:** QD5DTT (architecture state docs); surfaced by the monorepo /quality-review
**Reconcile:** ✅ No pattern deviation — pnpm plugs into `discoverLeafDirectories` via `??` (the shared `detectWorkspaces` is untouched, a deliberate scope guard documented in impl-plan.md "Known deviations"); the `introspected` flag mirrors the existing model/fingerprint shape.

## Evidence

- **Independent scenario-gate review** (fresh context, `/review-spec`): BLOCK on the first cut — the "not introspected" marker wasn't proven distinct from the existing `PURPOSE_PLACEHOLDER`, which is the ticket's whole point. Reworked to 7 scenarios (marker asserted + placeholder excluded, mixed-layout contrast, precedence with both config files, graceful flow-style fallback, content-level single-repo regression); re-review PASS.
- **pnpm discovery** — `discoverLeafDirectories` falls back to a dependency-free `pnpm-workspace.yaml` block-list parse; `package.json workspaces` stays authoritative via `??`. Verified by unit + a real pnpm fixture: a pnpm monorepo now yields the root index + leaf docs (probed live).
- **Un-introspected marker** — a package with an empty skeleton renders `⚠ not introspected — no recognized source layout`, never the prose placeholder, proven distinct in a mixed monorepo. The flag feeds `monorepoFingerprint`, so the marker can't go stale when a package gains/loses a `src/` tree (unit test pins the fingerprint move).
- **Audit:** 0 errors / 0 warnings — depcruise 0 violations (158 modules), config in sync, 0 jscpd clones, no dead code.
- **Dogfood:** this repo's root index re-rendered (the fingerprint now carries introspection status); `safeword architecture --check` exits 0.

## Note on the suite

A first local full-suite run flagged one failure (`setup-templates` broken-link
check for `.safeword/guides/cold-start-check.md`). Root cause: a **stale `dist/`**
predating the `cold-start-check` guide that landed on `main` via #348 — the test
runs the built CLI, and the stale build installed an old template set. A clean
rebuild makes the test pass (6/6); CI always builds first, so this never affected
CI. Not a code issue and unrelated to ZRW21K (no involved file was touched).
Final full suite re-run on a fresh build confirms green.

## Audit

Audit passed — 0 errors, 0 warnings. No circular dependencies or layer violations,
no dead code, no duplication, config in sync, test quality verified.
