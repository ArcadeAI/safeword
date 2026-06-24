# Verify: Go language pack (ZD70P1)

## Verify Checklist

**Test Suite:** ✅ Full suite green against merged `main` — 3387 passed / 5 skipped (225 files, VITEST_EXIT=0). 43 new unit tests (skeleton 11, fingerprint 10, monorepo 22).
**Gherkin:** ✅ 7 new Go scenarios pass; full acceptance lane green (156 scenarios, 0 failures).
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + gherkin; the two block-parsers refactored under the complexity bar, regexes literal/linear)
**Scenarios:** All 7 scenarios R/G/R (8677fe9)
**Dep Drift:** ✅ Clean — zero new dependencies (Go parsing is dependency-free hand-parsing)
**Parent Epic:** WBM8JE (per-language extractors); itself out-of-scope of QD5DTT
**Reconcile:** ✅ No pattern deviation — go.work plugs into `discoverLeafDirectories` via the `??` chain (shared `detectWorkspaces` untouched, the same scope guard ZRW21K used for pnpm); Go extraction reuses `extractSkeleton`'s directory-enumeration shape; Go fingerprint joins the existing dependency-name set. impl-plan reconciled to **implemented** (all six Decisions held).

## Evidence

- **Independent scenario-gate review** (fresh context, `/review-spec`): BLOCK on the first cut — three real findings: (1) the dependency-drift AC (TB2.AC1) was wrongly buried in a unit test on a false "not observable in the doc" premise — the fingerprint IS written to the doc frontmatter (architecture-document.ts:331/:370) and surfaced by `architecture --check`; (2) the unreadable-go.work scenario was vacuously green (passed against current no-go.work code); (3) the flat-Go marker scenario lacked the placeholder-distinctness assertion that blocked ZRW21K. All three reworked (black-box "goes stale" scenario added, scenario reworked to prove partial-skip survival, distinctness assertion restored); re-review **PASS**.
- **Three-axis extraction** — verified by unit + black-box fixtures:
  - **Extraction:** `extractSkeleton` reads a Go layout (`cmd`/`internal`/`pkg`) when a `go.mod` is present and no `src/` tree exists; `src/` stays authoritative (TS byte-identical). Fixes single-repo Go AND monorepo Go leaves with one change; flat Go → empty skeleton (honest "not introspected").
  - **Discovery:** `detectGoWork` (dependency-free `use` block + single-line parse, one bad entry skipped not fatal) is the third source after package.json workspaces / pnpm; keep-predicate generalized to package.json OR go.mod; Go identity from the `go.mod` `module` directive.
  - **Fingerprint:** `go.mod` `require` module paths (keys, not versions) join the dependency set, so Go dep drift moves `shapeFingerprint` — proven black-box via `architecture --check` going stale.
- **Audit:** 0 errors / 0 warnings — config in sync, depcruise 0 violations (158 modules, no cycles), jscpd 0 clones, no new dead code (knip), zero new deps, test quality clean.
- **Refactor (verify phase):** `/audit` jscpd flagged the new block parsers + the duplicated `DEPENDENCY_SECTIONS` loop; extracted `manifest-block.ts` (`readDelimitedBlock`) and `manifest-dependencies.ts` (`dependencySectionNames`), imported by fingerprint + monorepo (and the ZRW21K step lane reuses the shared fixture helpers). Behavior-preserving — 43 unit + 14 architecture BDD scenarios green after.
- **Dogfood:** this TS repo's `architecture --check` exits 0 with zero doc changes — the Go pack is a pure addition, no JS/TS regression.

## Scope honesty

Per ticket.md out_of_scope, the following are explicit limitations of this slice (each an honest omission, not silent): inter-package Go dependency edges in the root index, both-config-at-root polyglot (JS wins the `??` chain), `go.mod` `replace` / build tags / sub-modules, and Rust/Python (separate WBM8JE slices). A flat single-package Go module (no cmd/internal/pkg) stays the honest "not introspected" marker.

## Quality-review cycle (done-gate, ≥2-loop ticket)

`/quality-review` with primary-source research (go.dev/ref/mod, fetched this session)

- an independent fresh-context reviewer found **two critical parser bugs** the
  unit/BDD suites missed because every fixture used a single block:

* **C1 (HIGH) — multi-block `require` dropped.** `readDelimitedBlock` read only the
  FIRST `keyword ( … )` block. `go mod tidy` (Go 1.17+) writes indirect deps into a
  SECOND `require ( … )` block, so all indirect-dep drift went undetected — defeating
  the headline "Go dep drift is caught" AC. Same root cause for two `use ( … )`
  blocks in go.work (C2).
* **Trailing-comment `use` dropped.** `normalizeUseTarget` rejected any entry with
  whitespace, so the idiomatic `use ./svc // comment` (go.dev's own example) was
  silently dropped → Go monorepo invisible.

**Fix (one surgical change each, TDD):** `readDelimitedBlock` rewritten to collect
every matching block and terminate on any `)`-prefixed line (covers `) // comment`);
`normalizeUseTarget` strips a trailing `//` comment before the junk check. Three
regression tests added (two-block go.mod fingerprint move; two-`use`-block discovery;
trailing-comment `use`), each confirmed RED before the fix and GREEN after. Lint +
typecheck clean; 14 architecture BDD scenarios green; independent re-review verdict
**APPROVE** (no new defect; multi-block state machine verified against opener-inside-block,
nested-paren, `)`-leading-entry, and require-vs-replace-bleed vectors).

## Audit

Audit passed — 0 errors, 0 warnings. No circular dependencies or layer violations,
no dead code, no duplication, config in sync, zero new dependencies, test quality
verified.
