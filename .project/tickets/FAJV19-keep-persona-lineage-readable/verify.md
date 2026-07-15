# Verification: Keep persona lineage readable for builders

## Verify Checklist

**Test Suite:** ✓ 5211/5211 tests pass (CI, node 22.22.3 + node 24, on head 58f80d79)
**Gherkin:** ✅ Acceptance lane passes — 432 scenarios (429 passed, 3 skipped); 11,557 steps (11,553 passed, 4 skipped)
**Build:** ✅ Success — tsup ESM + DTS
**Lint:** ✅ Clean — eslint, lint-gherkin, and `tsc --noEmit` all green
**Scenarios:** All 34 scenarios marked complete
**PR Scope:** ✅ Accepted scope expansion — see "Scope decision" below
**Dep Drift:** ✅ Clean — only dev-tooling bumps (@cucumber/cucumber, eslint, tsx); no new architectural dependency
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the CLI/hook derivation duplication is the established deployed-runtime boundary from `persona-gate-code-derivation (G9BXE9)`, recorded under "Known deviations" in design.md and pinned by table-driven parity tests
**Experience:** ✅ No new friction for existing personas — walk recorded below
**Evidence limits:** ⚠️ Local full-suite contention produced 5 non-reproducing failures; see Evidence — not product evidence

Audit passed — 0 errors, 0 warnings. Config in sync; dependency-cruiser found no violations (613 modules, 1,922 dependencies); knip reported no findings (independently confirming the stale `gh` ignore was safe to remove — no re-flag, no W005 hint); all learnings carry `Covers:`; no empty domain docs (personas 3, surfaces 7, glossary 27 entries). Clones: 434 (8.47%) [repo minus .safeword,.project] vs 431 (8.09%) at the same scope in the prior audit — +3, consistent with the added persona policy and its tests. All packages up to date.

## Scope decision

PR #1053 intentionally carries three tickets plus maintenance, accepted by the project owner on 2026-07-14:

- **FAJV19** (this feature) — canonical persona-code derivation.
- **EKK1HA** (task) — cleanup-zombies macOS `/private/var` vs `/var` path aliasing.
- **VNNM1N** (task) — Rust lint-hook proof; `realpathSync` project-root normalization.
- **Audit maintenance** (no ticket) — removed the stale knip `gh` ignore; dev-dep patches (@cucumber/cucumber ^13.1, eslint ^10.7, tsx ^4.23.1).

EKK1HA and VNNM1N are required supporting cleanup, not piggybacking: they fix the exact two failures this ticket's earlier verification pass reported as blocking (`rust-golden-path.test.ts` Scenario 10 and cleanup-zombies process discovery). Both root-cause to the same macOS logical-vs-physical path bug. All three tickets close in this PR.

## Evidence

- **Test suite:** CI is the authoritative signal — the full suite passes on both node 22.22.3 and node 24 for head `58f80d79`. The local full-suite run showed 5 failures in `tests/integration/cursor-stop-review.test.ts` (5,206 passed / 5 failed / 5 skipped), all sharing one root: `existsSync(stateFile)` false because the hook subprocess was starved under parallel load. That file passes **6/6 in isolation** on the same tree, and CI passes it on the same SHA. Isolation-recovery plus CI green classifies these as local contention artifacts, not product failures. The git-init preflight reported no sandbox limitation, so these are not the known temp-dir symptom either.
- **Gherkin:** the amended acceptance lane covers automatic 3–4, explicit 2–4, and persisted 5–6 character behavior end-to-end.
- **Typecheck:** `tsc --noEmit` clean from `packages/cli`.
- **Parity (the ticket's riskiest assumption):** verified byte-identical across every shipped pair — `.safeword/hooks/lib/jtbd.ts` ↔ `templates/hooks/lib/jtbd.ts`, the same for `lint.ts` and `cleanup-zombies.sh`, the spec template, and the 3-way BDD skill trio (`.agents/` ↔ `.claude/` ↔ `templates/`). The hook's `derivePersonaCode` mirrors the CLI implementation exactly.
- **Backward compatibility:** explicit 2–6 character codes still validate and resolve; `resolveLegacyPersonaAliases` reconstructs pre-canonical codes so existing JTBD references (e.g. `SM`) keep resolving. No historical lineage rewritten.
- **Test quality:** 9 changed test files reviewed. Assertions are specific (exact resolved codes, exact template strings, bounded regexes); the 3-way installed-asset parity is table-driven via `it.each`; no weak existence assertions, no sleeps or arbitrary timeouts.

## Experience Walk

Walked Technical Builder through authoring a persona and carrying its code into JTBD/Gherkin lineage. New steps vs before = 0 for existing personas (explicit codes resolve unchanged) and for ordinary new names (`## Platform Operator` → `PLO` automatically).

Worst step — the one most likely to make a builder bounce: a name too short to yield a canonical code (e.g. `## S3`) now **fails** `safeword check` where it previously derived a code silently. That is +1 step for that author: go back and write `## S3 Operator (S3O)`. This is intentional and spec'd (`done_when`: "produces a clear validation error when the name cannot yield a conformant code"), and the message names the line and the exact 2–4 letter fix — a deliberate trade-off with an actionable exit, not an unintended dead-end.

Peak lens: N/A — spec.md declares `Rave Moment: skip: table-stakes`.
