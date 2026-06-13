# Verify — Ticket W9GPE7: Decomposition-phase removal

## Verify Checklist

**Test Suite:** ✓ 2386/2386 tests pass (1 pre-existing skip; full suite, dist rebuilt; −8 vs prior run = the removed decomposition test coverage)
**Build:** ✅ Success (tsup ESM + DTS, via pretest)
**Lint:** ✅ Clean (eslint src+tests 0 warnings; typecheck 0 errors)
**Scenarios:** ⏭️ N/A — task (no test-definitions.md; coverage is the existing suite — quality.test.ts, skill-cursor-pairs parity, phase-enum consumers)
**Dep Drift:** ✅ Clean (subtractive change — no dependency additions)
**Parent Epic:** EECVXB (bdd-chain-hardening)
**Reconcile:** ✅ No pattern deviation — purely subtractive (removed an enum member + deprecated files); introduced no new pattern

## Audit

**Architecture:** ✅ No circular deps, no layer violations (depcruise: 122 modules, 351 deps)
**Dead refs:** ✅ No live reference to the deleted `DECOMPOSITION.md` / `bdd-decomposition.mdc` (only the historical `schema.ts` removed-files cleanup entries remain, by design)
**Dead code:** ✅ Removal orphaned nothing — `BddPhase`/`PHASE_EVIDENCE` still consumed; knip's standing "unused deps/exports" are pre-existing, none in the changed area
**Doc drift:** Fixed — `ARCHITECTURE.md` ADR Implementation row updated from "staged removal (follow-up)" to "completed (W9GPE7)"
**Learning files:** ✅ All carry `Covers:` line
**Parity:** ✅ 116 pairs in sync (−2: the deleted skill doc + Cursor rule)

Errors: 0 | Warnings: 0 (knip's pre-existing unused-deps/exports are out of scope — subtractive change added none)

Audit passed

## Done-when coverage

- `decomposition` gone from every **active phase list** — `BddPhase` + `PHASE_EVIDENCE` (`lib/quality.ts`), `prompt-questions.ts`, `stop-quality.ts` `phasesRequiringTestDefs`, `quality.test.ts`, `skill-cursor-pairs` fixture, `schema.ts`, `bdd/SKILL.md` + `SPLITTING.md` tables, `quality-review/SKILL.md`, `ticket-system/SKILL.md`, `ticket-template.md` ✓
- Deprecated files deleted: `DECOMPOSITION.md` + `bdd-decomposition.mdc` (both template + dogfood copies) ✓
- Full suite + parity + typecheck green ✓
- No ticket parks at the phase (153 is `done`) ✓
- Historical ADR-citing prose kept in `DISCOVERY.md` / `SCENARIOS.md` (per rescope decision; "Done when" softened to active-phase-lists) ✓

**Next:** Mark W9GPE7 done, then open the branch PR for `frosty-murdock-58ba0d`.
