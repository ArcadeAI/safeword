# Verify: Python language pack (HWSEPV)

## Verify Checklist

**Test Suite:** ✅ Full suite green on a fresh build — 3562 passed / 5 skipped (243 files, VITEST_EXIT=0). 18 new unit tests (toml 9, pyproject 6, skeleton 4 — plus monorepo 5 + fingerprint 3 augmentations).
**Gherkin:** ✅ 7 new Python scenarios pass; 27 architecture scenarios green together (7 Python + 6 Rust + 7 Go + 7 monorepo), 0 failures.
**Build:** ✅ Success (dogfood `--check` exits 0).
**Lint:** ✅ Clean (eslint per-file; string-parse TOML reads avoid dynamic-RegExp, complexity under bar).
**Scenarios:** All 7 scenarios R/G/R (83f7904).
**Dep Drift:** ✅ Clean — zero new dependencies (pyproject.toml + PEP 508 parsed by hand).
**Parent Epic:** WBM8JE (per-language extractors); third/final slice after ZD70P1 (Go), YKFA5X (Rust).
**Reconcile:** ✅ No pattern deviation — uv plugs into `discoverLeafDirectories` via the `??` chain, `extractSkeleton` via a manifest-keyed branch, the fingerprint dependency set. The anticipated `toml.ts` extraction shipped (cargo refactored to delegate — its 15 tests stayed green); impl-plan reconciled to **implemented**.

## Evidence

- **Independent scenario-gate review** (fresh context, `/review-spec`): PASS-WITH-NITS. Verified every scenario RED today for a NEW-behavior reason (scenario 1's load-bearing RED is the `db.py` file; flat-layout/uv discovery/pyproject deps are the others). Applied the one Python-specific nit (pinned scenario 2's Given to a package _dir_ + a module _file_ so both flat-layout branches run); kept the drift scenario consistent with Go/Rust.
- **Shared TOML reader + Python parser** — verified by unit + black-box fixtures:
  - **toml.ts:** generalized from the twice-reviewed Cargo reader (table-scoped, comment-aware `readTomlTableArray`/`readTomlTableString`). Fixed the array close-bracket detection to skip a `]` inside a quoted value, so Python extras (`foo[extra]`) AND Cargo char-class globs parse correctly. cargo-manifest now delegates to it — 0 clone, its 15 tests stayed green.
  - **pyproject-manifest.ts:** PEP 621 `[project] name`/`dependencies` (PEP 508 distribution-name extraction) + `[tool.uv.workspace] members` (uv syntax verified against uv docs this session).
  - **Extraction:** `extractSkeleton` dispatches on `pyproject.toml` — src-layout (src/ packages + `src/*.py`) and flat-layout (root `__init__.py` dirs + root `*.py`, excluding tooling/dunder), dispatched before the TS src-dir path so `*.py` modules aren't lost; TS/Go/Rust branches unchanged.
  - **Discovery/identity/fingerprint:** `detectUvWorkspace` is the fifth `??` source; the keep-predicate accepts pyproject-only dirs; identity from `[project] name`; PEP 508 names join the shape set (proven black-box via `architecture --check` going stale).
- **Audit:** 0 errors / 1 accepted warning — config in sync, depcruise 0 violations (173 modules, no cycles), no new dead code, zero new deps. The one jscpd clone is the import boilerplate shared by the three sibling step files (Go/Rust/Python) — benign, not logic, same accepted case as YKFA5X.
- **Suite-failure diagnosis:** a first full-suite run flagged 4 failures — all environmental, none from Python code: 3 `check`/blocked_on tests needed a `dist` rebuild (the test documents this at line 440), and the cucumber dogfood was a concurrency flake (passes 18/18 standalone). A clean-build re-run is fully green; CI builds first, so neither affects CI.
- **Dogfood:** this JS repo's `architecture --check` exits 0 with zero doc changes — the Python pack is a pure addition (no pyproject.toml here), no JS/TS/Go/Rust regression.

## Scope honesty

Per ticket.md out_of_scope: Poetry `[tool.poetry]` / `requirements.txt` / `setup.py` (PEP 621 is the modern standard; a Poetry-only project degrades to basename identity + empty deps), PEP 420 namespace packages (no `__init__.py`), module nesting, and the cross-language LanguagePack registry refactor (deferred to a dedicated post-4-packs ticket — now actionable, all four packs exist).

## Quality-review cycle (done-gate, ≥2-loop ticket)

`/quality-review` with primary-source research (PEP 508 / pyproject spec, fetched this
session) + an independent fresh-context reviewer found **one critical silently-wrong
bug** the unit/BDD suites missed (every fixture used a clean dep string):

- **`stripTomlComment` cut at the first `#` even inside a quoted value.** A PEP 508 URL
  dependency (`"pkg @ git+https://…#egg=pkg"` — documented modern direct-reference
  syntax) broke the quote, so the multi-line `[project] dependencies` array truncated
  and later entries (e.g. `numpy`) silently vanished from the fingerprint shape set —
  drift in them would never be caught. Breaches the slice's own "never silently wrong" bar.

**Fix:** made `stripTomlComment` quote-aware (only cuts a `#` outside a quoted string,
reusing the `topLevelCloseBracket` per-line quote-state machine). Three regression tests
(multi-line array with a `#egg=` url dep; `name = "a#b"`; trailing comment after a quoted
value), RED before and GREEN after. Cargo's 15 tests stay green; independent re-review
verdict **APPROVE** (fix verified by reproducing the original failing inputs). The reviewer
also confirmed the cargo refactor is behavior-preserving — and its new exact-key match is
itself a latent bug fix (the old unanchored regex matched `exclude-members` as `members`).

## Audit

Audit passed — 0 errors, 1 accepted warning (import-boilerplate clone). No circular
dependencies or layer violations, no new dead code, no logic duplication, config in
sync, zero new dependencies, test quality verified.

## Quality-review pass 3 (done-gate)

A third independent fresh-context pass (broad — extraction + 5-language dispatch +
regression) returned NEEDS DISCUSSION on one real common-case mis-dispatch: a
maturin/pyo3 native-extension project (both a `pyproject.toml` and a `Cargo.toml` at
root — pydantic-core, cryptography, polars, ruff, orjson, tokenizers) was routed to the
Rust extractor (Cargo checked first), silently dropping its `src/*.py` modules. Fixed by
checking `pyproject.toml` before `Cargo.toml`; one regression test; pure Rust / pure
Python unaffected. Independent re-review **APPROVE** (verified by re-running the
fixtures). Three quality-review passes, three real silent-wrong bugs found and fixed
(buried-AC misframe in scenario-gate; the PEP 508 `#`-in-url drop; this maturin
mis-dispatch) — the parser and dispatch are now hardened against the common Python shapes.

## Quality-review pass 4 (post-rebase onto v0.58.0; two parallel fresh reviewers)

After rebasing the branch onto the latest main and opening PR #544, a fresh full-diff
quality-review ran two independent reviewers in parallel (diversity lens: parser
spec-correctness vs dispatch/regression).

- **Parser reviewer — APPROVE.** Verified `readPyprojectDependencies` (`/^[\w.-]+/`),
  `[project]` table-scoping (optional-dependencies subtable correctly NOT misread), and the
  TOML subset against primary sources fetched this session (PEP 508, PEP 503/name-norm,
  PEP 621, uv workspace docs). Every out-of-subset input fails honestly (undefined/[]),
  never silently wrong. One NOTE: the scope/impl-plan text claimed `optional-dependencies`
  join the fingerprint, but the code reads only `[project] dependencies` and the closing
  log defers it — a self-contradiction in the ticket. **Reconciled** the ticket.md scope
  line and impl-plan step 1 to state optional-dependencies is deferred (it is a table of
  extra→array, a different shape); the omission is honest, not silently wrong.

- **Dispatch reviewer — NEEDS DISCUSSION → fixed.** Found a real silent **regression**
  the prior three passes missed (verified by checking out the pre-HWSEPV baseline and
  executing it): the maturin fix made the pyproject branch win **unconditionally**, so a
  Go service (`go.mod` + `cmd/`/`internal/`) or a Rust crate (`src/*.rs`) that merely
  carries a stray `pyproject.toml` (helper scripts / ruff config) returned an empty
  skeleton instead of its real layout — breaching the ticket's "Go/Rust unchanged"
  guarantee, and untested (the only mixed test had a `.py` module). **Fix:** the pyproject
  branch now returns `pythonModuleNodes` only when non-empty, else falls through to the
  Cargo → src/ → go.mod chain — genuine maturin (has `src/*.py`) still wins; stray-pyproject
  Go/Rust projects keep their byte-for-byte layout. Two regression tests added (RED before
  the fix, GREEN after): `{go.mod + cmd/internal + pyproject}` → `['cmd','internal']`;
  `{Cargo + src/parser.rs + pyproject}` → `['parser']`. The maturin test stays green.
