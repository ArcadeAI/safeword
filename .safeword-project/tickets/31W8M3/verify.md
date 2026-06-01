# Verify — 31W8M3 (Acceptance Criteria layer)

## Verify Checklist

**Test Suite:** ✓ 2270/2270 tests pass (1 skipped) — full suite, 137 files, exit 0
**Build:** ✅ Success (`tsup` DTS build)
**Lint:** ✅ Clean (`eslint .` + `tsc --noEmit`)
**Scenarios:** All 8 scenarios marked complete (RED→GREEN distinct SHAs; cross-scenario row present)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** DZ2NM5 (bdd-phase-zero-merge) — 4/8 children done; this close makes 5/8

## Evidence

- AC gate logic — `parseAcsByJtbd` + `evaluateAcGate` in `lib/jtbd.ts` (walk JTBD blocks, count `#### AC` headings, per-JTBD `skip:` valve, HTML-comment-skip). 7 unit tests (`tests/hooks/ac-gate.test.ts`), RED via stub → GREEN.
- Wired spec.md-routed into `pre-tool-quality.ts` after the JTBD gate; 6 integration tests (`tests/integration/jtbd-gate.test.ts`, 3 JTBD + 3 AC).
- Authoring surfaces: spec-template AC example, DISCOVERY "Author Acceptance Criteria" sub-step (capability-not-impl coaching, split-test, pause-confirm), SCENARIOS scenario→AC linkage, SAFEWORD Clarify mention.
- **/quality-review caught a real bug:** a per-JTBD AC `skip:` leaked into `parseJtbdSection`'s section-skip and short-circuited persona resolution. Fixed (b923a402) — `skip:` counts as the section skip only before the first `###` JTBD heading; regression test added.
- 31W8M3's own spec.md rewritten from a JTBD-skip to a real DEV JTBD + 2 ACs (personas.md is bootstrapped) — passes both gates, dogfoods the layer.
- Templates synced template ↔ `.safeword/` / `.claude/`; parity contracts in sync.

Ready to mark done.
