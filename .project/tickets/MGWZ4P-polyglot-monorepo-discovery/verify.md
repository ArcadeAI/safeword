# Verify: polyglot monorepo discovery (MGWZ4P)

## Verify checklist

**Test suite:** ✅ 38 monorepo unit tests + 78 architecture unit tests
(monorepo/skeleton/fingerprint) green. 6 new/reframed discovery tests (U1–U7;
three prior "package.json wins over go.work/Cargo/uv" tests reframed as union —
the bug they encoded — plus U2 compose, U4 dedupe, U6 all-managers, U7 over-broad
glob).
**Gherkin:** ✅ 2 new polyglot scenarios pass; 46 architecture scenarios green
together (incl. the preserved "package.json wins over pnpm" precedence in
monorepo-coverage-honesty).
**Build:** ✅ CLI builds; dogfood `architecture --check` exits 0 (this repo is
JS-only, so union == JS-only == unchanged — proves no regression on a single-manager
repo).
**Lint:** ✅ eslint clean (renamed `relativeDir`/`extDirectory` per unicorn).
**Typecheck:** ✅ no new errors in the changed files (pre-existing TS6059 rootDir
notes unchanged).
**Scenarios:** All R/G/R confirmed — the .feature scenarios and U1/U2/U6 were RED
against the first-match code for the right reason (only the first manager's
packages listed), GREEN after the union.
**Dep drift:** ✅ zero new dependencies (pure logic change in discoverLeafDirectories).
**Reconcile:** the implementation matches the refined spec design — JS-precedence
(`detectWorkspaces ?? detectPnpmWorkspaces`) **then** cross-ecosystem union
(`go.work` + Cargo + uv) via `.filter(present).flat()`, with the existing leaf
`Set` collapsing same-dir overlaps. No new module; the per-leaf
`hasRecognizedManifest` keep-guard is untouched, so the ZRW21K "never
false-complete" property is structurally preserved.

## Evidence

- **Independent scenario-gate review** (fresh context, `/review-spec`):
  PASS-WITH-NITS. Confirmed both scenarios load-bearing RED, determinism clean,
  design sound (JS-precedence-then-cross-ecosystem-union correctly supersedes the
  intake's naive "union all + dedupe"). Its one load-bearing nit — D1(f) (JS +
  multiple non-JS, where precedence and union compose) was claimed in the ledger
  but untested — was addressed with **U6** (all-managers-compose); the
  over-broad-glob pin became **U7**. Findings #3 (dedupe/precedence are unit-only)
  accepted per the test pyramid. Stamp recorded.
- **Behavior change, intentional & documented:** the prior three "package.json
  wins over go.work/Cargo/uv" unit tests asserted the coverage-honesty bug as if
  intended; they are reframed as union with MGWZ4P comments. The JS-vs-JS
  precedence (package.json over pnpm) is preserved and still tested both unit and
  black-box.
- **Coverage honesty:** AC1/AC2 + U1/U2/U6 collectively prove no present
  cross-ecosystem manager's packages are silently dropped — the guarantee now
  holds at the discovery layer, not just the marker layer.

## Scope honesty

Per ticket out_of_scope: per-leaf polyglot extraction (already worked), new
language packs, and nested/recursive workspaces are untouched. The AXRC4D
reconcile feature (which consumes the generated doc) now has complete discovery
to build on — the documented dependency is satisfied.
