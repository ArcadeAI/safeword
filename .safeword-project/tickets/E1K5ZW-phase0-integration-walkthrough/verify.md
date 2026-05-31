# Verify: E1K5ZW — Phase 0 end-to-end worked example + demo

## Verify Checklist

**Test Suite:** ✓ 209/209 tests pass (gate subset: `bun run test:done` — hooks + schema) + 11/11 ticket demo (`phase0-walkthrough.test.ts`) + 13/13 parity. Full 12-min `bun run test` intentionally skipped per the task's shared-tree contention guidance; the diff touches docs + one test only (no source).
**Build:** ✅ Success (`bun run build` — ESM + DTS)
**Lint:** ✅ Clean (eslint + prettier + markdownlint via lint-staged at commit; re-verified on changed files)
**Scenarios:** All 0 scenarios marked complete — ⏭️ task ticket, no test-definitions.md (the demo IS the test artifact)
**Dep Drift:** ⏭️ Skipped — no ARCHITECTURE.md; no dependency changes in this diff
**Parent Epic:** DZ2NM5 (siblings: 9/9 done with this ticket)

Audit passed — 0 errors, 0 warnings (architecture, dead code, doc dead-refs, test quality all clean; heavyweight mutating/network checks skipped as disproportionate to a docs+test diff).

## What shipped

Closes DZ2NM5's two epic-level integration deliverables:

1. **Worked example** — `DISCOVERY.md` "Worked example: Phase 0 end to end" capstone replaces the engineering-scope-only `--verbose` example. One feature (`oauth-flow` / Platform Operator) threaded through all four artifacts: persona ref → JTBD ("When I…, I want…, so I can…") → AC under the JTBD → engineering Scope/Out-of-Scope/Done-When → numbered Phase-3 scenario `oauth-flow.PO1.AC1.<name>` + `safeword check` coverage advisory. B0JZQN's sub-phase gates shown at each transition (JTBD gate / AC gate / Scope gate).
2. **SAFEWORD.md narrative** — Clarify exit reordered into one arc (personas → JTBD → AC → scope → scenario lineage/coverage), with the `personas.md` anchor added and a pointer to the worked example.
3. **End-to-end demo** — `tests/integration/phase0-walkthrough.test.ts` drives the real `pre-tool-quality` hook + `safeword check` over one ticket: spec.md scaffold → JTBD/AC gates (deny without AC, allow with all four artifacts) → numbered scenarios → coverage report (AC2 uncovered, then clears once covered). Plus a `describe.each` doc-presence guard over canonical + dogfood DISCOVERY.md asserting the walkthrough exercises all four artifact types, the lineage scheme, and the gates.

Canonical `templates/` and the `.claude/` + `.safeword/` mirrors kept byte-identical (parity test green).

## Done-when check (from ticket)

- ✓ DISCOVERY.md has a worked example exercising all four artifact types in one walkthrough.
- ✓ SAFEWORD.md Phase 0 narrative reflects the merged flow.
- ✓ An e2e test demonstrates the flow end-to-end and is green (11/11).
- ✓ Gate subset + lint + build green; mirrors synced.
- ✓ With this done, DZ2NM5 is 9/9 — its epic-level done-when is satisfied.

Ready to mark done.
