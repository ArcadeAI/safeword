---
id: HWSEPV
slug: architecture-python-language-pack
type: feature
phase: intake
status: in_progress
created: 2026-06-24T05:31:11.433Z
last_modified: 2026-06-24T05:35:00.000Z
scope:
  - Python package extraction — extractSkeleton, when a directory has a `pyproject.toml`, lists the top-level modules of the importable package: src-layout (`src/` present) lists `src/` subpackages AND top-level `src/*.py` files; flat-layout (no `src/`) lists root directories that contain an `__init__.py` AND top-level `*.py` modules — excluding tooling files (setup.py, conftest.py, noxfile.py) and dunder files (__init__.py, __main__.py)
  - uv-workspace discovery — detectUvWorkspace parses `[tool.uv.workspace] members = [globs]` from the root pyproject.toml (TOML, reusing the Cargo TOML-subset machinery), appended to the `??` discovery chain after JS / Go / Cargo
  - Generalized leaf predicate — discoverLeafDirectories keeps a discovered directory that has a recognized manifest (`package.json` OR `go.mod` OR `Cargo.toml` OR `pyproject.toml`)
  - Python dependency fingerprint — the shape-fingerprint's dependency set includes the `[project] dependencies` (and `optional-dependencies`) PEP 508 specifier NAMES (the leading distribution name, version/extras/markers stripped), so Python dependency drift moves the package's fingerprint
  - Python package identity — a package's name comes from its `[project] name` (PEP 621; fallback: directory basename), mirroring JS `name` / Go `module` / Cargo `[package] name`
  - Tests (unit + black-box BDD over real Python fixtures: src-layout single package, flat-layout package, uv workspace, mixed JS+Python monorepo) and a no-regression guarantee for JS/TS/Go/Rust repos
out_of_scope:
  - Poetry-style `[tool.poetry] name` / `[tool.poetry.dependencies]` (a TABLE, not PEP 508 strings) and `requirements.txt` — PEP 621 `[project]` is the modern standard; Poetry/requirements are a noted follow-up (a Poetry-only project falls back to basename identity + empty deps, honestly)
  - Legacy `setup.py` / `setup.cfg` projects with no pyproject.toml — out (no manifest to key on; stays "not introspected")
  - Module CONTENTS / nesting — only the TOP-level packages/modules are listed; a package's internal submodule tree is out (consistent with Go/Rust)
  - PEP 420 implicit namespace packages (a dir with no `__init__.py`) in flat-layout — only `__init__.py`-bearing dirs are listed as packages
  - The cross-language LanguagePack registry refactor (the Generalize-the-Mechanism consolidation of discovery/identity/deps/extraction across JS/Go/Rust/Python) — deferred to a dedicated refactor ticket AFTER all four packs exist (rule-of-N: abstract against the complete set), tracked as an assessment trigger
  - Changing the JS/TS/Go/Rust discovery, extraction, or fingerprint behavior in any observable way (pure addition; regression-guarded)
done_when:
  - A src-layout Python project (pyproject.toml + src/<pkg>/) produces an architecture doc listing its top-level modules — today it produces nothing or only the bare src/ dir
  - A flat-layout Python project (pyproject.toml + <pkg>/ with __init__.py at root) produces a doc listing its top-level packages/modules — today it produces nothing
  - A uv workspace produces a root index + a colocated leaf doc per member package that has modules — the same shape an npm/pnpm/go.work/Cargo monorepo gets
  - A dependency added to or removed from a package's `[project] dependencies` moves that package's shape-fingerprint (drift is caught)
  - A mixed JS+Python monorepo introspects both; the JS packages are byte-identical to today
  - JS/TS, Go, and Rust behavior is unchanged (no regression); `safeword architecture --check` still passes on this repo
  - All scenarios in features/architecture-python-language-pack.feature pass via the BDD lane; full suite green
---

# Python language pack — pyproject discovery, package extraction, dependency fingerprint

**Goal:** Teach the generated architecture doc to introspect **Python** projects —
src-layout and flat-layout single packages, and uv workspaces — so a package gets real
structural extraction (its top-level modules) and dependency-drift detection, instead
of the "not introspected" marker. Third and final WBM8JE language pack.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Parent epic

Third slice of **WBM8JE**, after ZD70P1 (Go) and YKFA5X (Rust). pyproject.toml is
**TOML**, like Cargo.toml — so the discovery/identity/dependency reads reuse the
`cargo-manifest.ts` TOML-subset machinery (the strongest reuse yet). With four packs
complete after this, the **LanguagePack registry refactor** (the cross-language
consolidation deferred since ZD70P1) becomes the right next step — its own ticket,
abstracting against the full language set.

## Resolved design (modern Python standard; verify uv syntax at implement)

Verified PEP 621 this session (packaging.python.org): `[project] name` (string) and
`dependencies` (an array of PEP 508 specifier strings, e.g. `["requests>=2.0", "numpy"]`).

1. **Extraction** — `extractSkeleton` dispatches on `pyproject.toml`: src-layout →
   `src/` subpackages + `src/*.py`; flat-layout (no src/) → root dirs with `__init__.py`
   - root `*.py`, minus tooling/dunder files. Top-level only (nesting out, like Go/Rust).
2. **Discovery** — `detectUvWorkspace` reads `[tool.uv.workspace] members` (TOML), the
   modern Python monorepo standard, last in the `??` chain.
3. **Fingerprint** — the `[project] dependencies` PEP 508 strings, reduced to the leading
   distribution name (strip version/extras/markers), join the dependency set.

**Rejected:** Poetry/`requirements.txt` as the primary source (PEP 621 `[project]` is the
standard; Poetry is a tool-table follow-up); a Python-import/AST walk (heavy, needs an
interpreter — directory conventions stay deterministic and dependency-free); doing the
LanguagePack registry refactor inside this slice (rule-of-N — abstract after all four).

## Open questions

- **uv `[tool.uv.workspace] members` exact syntax** — assumed `members = ["packages/*"]`
  (glob array, like Cargo); verify against uv docs at implement-time before relying on it.
- **flat-layout module granularity** — resolved: top-level `__init__.py` dirs + top-level
  `*.py`, excluding tooling files. Namespace packages (no `__init__.py`) are out-of-scope.

## Work Log

- 2026-06-24T05:31:11Z Started: Created ticket HWSEPV.
- 2026-06-24T05:35:00Z Intake: sliced WBM8JE → Python pack (final). pyproject.toml is
  TOML → reuse cargo-manifest machinery. Verified PEP 621 [project] name/dependencies.
  Resolved forks: target uv workspaces + PEP 621 (modern standard), src+flat layout
  extraction, PEP 508 name extraction for deps; Poetry/requirements/setup.py + the
  registry refactor scoped out (the refactor to its own post-4-langs ticket). Next:
  define-behavior. One open item: verify uv workspace TOML syntax at implement.
