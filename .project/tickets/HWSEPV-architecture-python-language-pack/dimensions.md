# Dimensions: Python language pack (HWSEPV)

| Dimension          | Partitions                                                                                          | Source      |
| ------------------ | --------------------------------------------------------------------------------------------------- | ----------- |
| Project shape      | src-layout single package · flat-layout single package · uv workspace · JS-rooted monorepo + Python | TB1, TB2    |
| Source layout      | `src/` present (src-layout) · no `src/`, packages at root (flat-layout)                             | TB1.AC1/AC2 |
| Module kind        | `__init__.py` package dir · top-level `*.py` module · tooling/dunder file (excluded)                | TB1.AC2     |
| Discovery source   | `[tool.uv.workspace] members` · package.json/pnpm/go.work/Cargo · none                              | TB1.AC3     |
| Fingerprint input  | `[project] dependencies` PEP 508 names · package.json/go.mod/Cargo deps                             | TB2.AC1     |
| Regression surface | JS single-repo output · JS leaf in a polyglot monorepo (must be unchanged)                          | TB2.AC2/AC3 |

## Partition → scenario mapping

- src-layout × pyproject → TB1.AC1 (module doc lists src/ top-level modules).
- flat-layout × pyproject → TB1.AC2 (lists root `__init__.py` dirs + `*.py`, excludes tooling/dunder).
- uv workspace × members → TB1.AC3 (root index + Python leaf doc).
- single package with no recognized modules → "not introspected" honesty edge (TB1.AC1).
- JS-rooted monorepo × (src + pyproject) → TB2.AC2 (both introspected).
- single-repo × src (JS) → TB2.AC3 (JS module doc unchanged — regression guard).
- `[project] dependencies` add/remove → TB2.AC1, BLACK-BOX: the dependency set feeds the
  shape-fingerprint, written into the doc frontmatter and surfaced by `architecture --check`,
  so adding a dep makes the doc go stale. A unit test pins the PEP 508 name extraction beneath it.

## Boundary notes

- **Extraction precedence:** dispatch on `pyproject.toml` — src-layout uses `src/` modules,
  flat-layout uses root `__init__.py` dirs + root `*.py`. Tooling files (`setup.py`,
  `conftest.py`, `noxfile.py`) and dunder files (`__init__.py`, `__main__.py`) are excluded.
  TS `src/`-dir, Go (`go.mod`), and Rust (`Cargo.toml`) branches are unchanged.
- **Discovery precedence:** `package.json workspaces` ?? pnpm ?? `go.work` ?? Cargo ??
  `[tool.uv.workspace]`. A JS-rooted monorepo with a Python package still discovers it
  (keep-predicate gains `pyproject.toml`).
- **Identity:** name = `[project] name` (PEP 621), fallback directory basename.
- **Dependency names:** the leading distribution name of each PEP 508 specifier (`requests>=2.0`
  → `requests`; `foo[extra]>=1; python_version<"3.9"` → `foo`), versions/extras/markers stripped.
- **Out of scope here:** Poetry `[tool.poetry]` / `requirements.txt` / `setup.py`, PEP 420
  namespace packages (no `__init__.py`), module nesting, and the cross-language LanguagePack
  registry refactor (its own post-4-packs ticket).
