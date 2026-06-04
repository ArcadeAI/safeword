# Verify — 9EA27P (require spec.md for features)

## Verify Checklist

**Test Suite:** ✓ 2486/2486 tests pass (1 skipped) — full suite on fresh dist (`bun run build && bun run test`)
**Build:** ✅ Success — tsup ESM + DTS
**Lint:** ✅ Clean — `eslint src tests && tsc --noEmit`, exit 0
**Scenarios:** ⏭️ N/A — task (no test-definitions.md; tasks carry no scenarios)
**Dep Drift:** ✅ Clean — no dependency changes (`package.json` untouched)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the new feature-only deny mirrors the adjacent `dimensions.md` gate's `meta.type === 'feature'` shape; no new pattern introduced.

**Audit:** Audit passed (not gate-required for tasks; run for hygiene). depcruise ✔ no violations (2398 modules); jscpd 0.58% (the refactor _reduced_ duplication); knip flags nothing in changed files — the 8 unused deps + 3 unused exports are pre-existing baseline (hook-template false-positives per project memory).

## Done-when evidence

- **Feature + no `spec.md` → denied**, naming the missing `spec.md` and the `skip:` valve — `jtbd-gate.test.ts` (two inverted grandfather tests, both assert `expectHookDeny(…, 'spec.md')`). ✓
- **Feature with real JTBDs/ACs or a `skip:` still passes** — `jtbd-gate.test.ts` (resolving JTBD + AC) and `quality-gates.test.ts` 9.3/9.8/9.11 (now carry a `spec.md` skip). ✓
- **Tasks and patches unaffected** — `quality-gates.test.ts` 9.9 (task, no dimensions/spec → allowed). ✓
- **Grandfather tests inverted; `templates/` ↔ `.safeword/` byte-identical; full suite green; parity green** — all confirmed (`diff` identical; 2486/2486). ✓

## Regression proof

Baseline full-suite diff (clean `main` vs branch) isolated the _only_ delta to the 3 `quality-gates` fixtures, now fixed. The earlier "174 failures" were a stale-`dist` artifact (integration tests run the built CLI), not environmental — fresh build → 0 failures.

Ready to mark done.
