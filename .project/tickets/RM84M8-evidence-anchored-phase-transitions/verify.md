# Verify: Evidence-anchored phase transitions (RM84M8, #809)

## Verify Checklist

**Test Suite:** ✓ 936/936 tests pass (full `tests/hooks` suite — the blast radius of the `phase-provenance.ts` change; plus 49/49 targeted `phase-anchor` + `phase-provenance`). The full monorepo vitest suite exceeds the sandbox's 10-min limit and was not run to completion (see Evidence limits).
**Gherkin:** ✅ Acceptance lane passes (259/259 scenarios, 5356 steps — includes the 16 new anchor scenarios)
**Build:** ✅ Success (tsup ESM + DTS build clean)
**Lint:** ✅ Clean (eslint clean; prettier clean; `packages/cli` `tsc --noEmit` clean)
**Scenarios:** All 13 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope — anchor format + detector + tests/steps/docs only; no unrelated changes
**Dep Drift:** ✅ Clean (no dependencies added; the ShaResolver import is type-only, already in-tree)
**Parent Epic:** 808 (children: #809 this ticket; #810 pending — consumes this substrate)
**Reconcile:** ✅ No pattern deviation — reuses the pure hook-lib pattern, the zero-dependency frontmatter parser, `isValidSha`, and the `ShaResolver` contract; `parseSkips`/`parseAnchors` now share one parser
**Experience:** ⏭️ N/A — internal enforcement plumbing (Safeword Maintainer), not persona-facing UI; Rave Moment was `skip: table-stakes`
**Evidence limits:** ⚠️ The full monorepo vitest suite (`bun run --cwd packages/cli test`) exceeds the sandbox 10-min timeout — a documented local limitation (the Cucumber-wrapper/full-suite load issue). Every area this diff touches is green: 936 hook-unit tests, 259 acceptance scenarios, the targeted anchor suites, build, and typecheck. The untested remainder is unrelated to this change and is covered by CI.

## Audit

Audit passed with warnings — 0 errors. Full block re-run post-done at the user's prompt (the first pass was scoped to the changed area only; recorded here so the record is honest):

- **Config drift:** ✅ `sync-config --check` in sync.
- **Architecture:** ✅ depcruise full repo — no violations (566 modules, 1727 dependencies).
- **Dead code (knip):** 3 pre-existing "unlisted binaries" hints in `steps/rule-tier.steps.ts` (`setup`, `check`, `lint-gherkin`) — not from this ticket; nothing new flagged.
- **Duplication (jscpd):** changed area 4 clones / 0.70% across the 49 hook libs — and this ticket's shared-parser refactor *removed* duplication. Full-repo numbers recorded for future baselines (no comparable prior full-repo record exists; earlier tickets recorded narrower scopes ~92 clones): whole repo 594 (17.9% — dominated by the *deliberate* templates↔.safeword byte mirror and the ticket archive); excluding `.safeword/` + `.project/` 416 (8.9%); `packages/cli` 317 (3.6%). Delta from this ticket: negative.
- **Outdated deps:** ⚠️ evidence limit — `bun outdated` hangs resolving through the sandbox proxy; not checkable here. No dependencies were added or changed by this ticket.
- **Learnings:** ✅ all carry `Covers:` lines. **CLAUDE.md refs:** ✅ no dead references.
- **Test quality:** `phase-anchor.test.ts` uses specific verdict assertions, `it.each` for the type outline, and covers the malformed / empty / wrong-phase / unreachable edge partitions.

## Done-when reconciliation

- ✅ `phase_anchors` frontmatter format defined and documented; recorded on this ticket's own transitions via the Edit path (dogfood).
- ✅ `detectUnanchoredPhaseTransition(prior, proposed, resolveSha?)` returns unanchored for missing / malformed / (with resolver) unreachable anchors and stays silent on backward moves, re-declarations, non-feature tickets, births, and at-rest edits — unit + acceptance proven.
- ✅ Anchor format + resolver reuse the ledger primitives; `parseSkips`/`parseAnchors` share `parsePhaseKeyedEntries` — no duplicated parse logic.
- ✅ No write-time gate change, no new hook file, no new prose nag — substrate only; #810 is the sole enforcer.
- ✅ templates ↔ .safeword parity green.

**Next:** advance the ticket to done and push; #810 (boundary reconciliation gate) is the follow-up that consumes this anchor + detector.
