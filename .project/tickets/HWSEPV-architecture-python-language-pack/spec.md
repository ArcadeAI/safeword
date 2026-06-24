# Spec: Python language pack — pyproject discovery, package extraction, dependency fingerprint

## Intent

Teach the generated architecture state-doc to introspect Python projects — a
src-layout or flat-layout single package and a uv workspace — so a package gets real
structural extraction (its top-level modules) and dependency-drift detection, rather
than the honest-but-empty "not introspected" marker. Third and final WBM8JE language
pack; the strongest reuse of the existing seam (pyproject.toml is TOML, like Cargo.toml).

## Intake Brief

- **Requested by:** WBM8JE epic completion (the user, after ZD70P1/Go and YKFA5X/Rust) —
  the last of the three deferred language packs.
- **Cost of inaction:** A Python project (single package or uv workspace) gets no
  architecture doc, or — in a mixed JS+Python monorepo — its Python packages stay marked
  "not introspected." The polyglot promise reads as "no dynamic languages."
- **Reversibility:** Two-way door. Pure addition behind the existing manifest-keyed seam;
  JS/TS/Go/Rust behavior is regression-guarded and unchanged. No data-model or public-API
  change — the doc format and fingerprint inputs only gain Python entries.

## References

- Parent epic **WBM8JE**; siblings **ZD70P1** (Go) and **YKFA5X** (Rust — the TOML
  parser this reuses).
- Verified this session: PEP 621 (packaging.python.org) — `[project] name` and
  `dependencies` (array of PEP 508 specifier strings).
- Seams: `architecture-skeleton.ts` (extraction), `architecture-monorepo.ts` (discovery),
  `architecture-fingerprint.ts` (drift), `cargo-manifest.ts` (TOML-subset reader, reused).

## Personas

- **Technical Builder (TB)** — here, in its Python/polyglot flavor: a developer running an
  AI coding agent on a repo (or monorepo) that mixes Python with TypeScript/Go/Rust, or is
  pure Python. TB is stack-agnostic by definition; they want the architecture doc to
  describe the Python code, not skip it.

## Vocabulary

- **pyproject.toml** — the standard Python project manifest (TOML). `[project]` (PEP 621)
  holds `name` and `dependencies`; `[tool.uv.workspace]` holds a uv workspace `members` list.
- **src-layout** — package code under `src/<pkg>/`; **flat-layout** — package dirs at the
  project root.
- **Package** — an importable directory containing `__init__.py`; a **module** is a `.py`
  file. The top-level packages and modules are the structural units listed.
- **Introspected** — a package with a recognized layout (so it gets a real leaf doc), vs.
  "not introspected" (listed but explicitly undescribed).

## Jobs To Be Done

### architecture-python-language-pack.TB1 — See my Python package's structure in the doc

**Persona:** Technical Builder (TB)

> When I generate the architecture doc for a Python project, I want its top-level modules
> (src-layout or flat-layout) listed with the same structure a TS/Go/Rust repo gets, so I
> can review and annotate the real shape instead of an empty placeholder.

#### architecture-python-language-pack.TB1.AC1 — A src-layout Python project produces a doc listing its top-level modules

#### architecture-python-language-pack.TB1.AC2 — A flat-layout Python project lists its top-level packages/modules, excluding tooling/dunder files

#### architecture-python-language-pack.TB1.AC3 — A uv workspace produces a root index plus a leaf doc per member package with modules

### architecture-python-language-pack.TB2 — Catch dependency drift, and never lose my other-language docs

**Persona:** Technical Builder (TB)

> When a package's `[project] dependencies` change, I want the architecture doc to register
> the drift; and when my repo mixes Python and JS, I want both introspected and my existing
> JS docs untouched, so the doc stays trustworthy across languages.

#### architecture-python-language-pack.TB2.AC1 — Adding/removing a dependency in a package's [project] dependencies moves that package's shape-fingerprint

#### architecture-python-language-pack.TB2.AC2 — A mixed JS+Python monorepo introspects both, with the JS output byte-identical to today

#### architecture-python-language-pack.TB2.AC3 — A pure JS/TS (or Go/Rust) repo's discovery, extraction, and fingerprint are unchanged (no regression)

## Outcomes

- A Python project — src/flat single package or uv workspace — gets a real, structurally
  accurate architecture doc with zero hand-run commands, identical in shape to what
  npm/pnpm/go.work/Cargo projects already get.
- Python dependency drift is a first-class drift signal (fingerprint moves).
- The polyglot promise holds across four languages: mixing Python and JS introspects both;
  the JS half is provably unchanged. With four packs in, the cross-language registry
  refactor becomes the right next step (its own ticket).

## Open Questions

- **uv `[tool.uv.workspace] members` exact TOML syntax** — assumed a glob array like Cargo;
  verify against uv docs at implement-time before relying on it.
- All other forks resolved during intake (modern PEP 621 + uv standard; src+flat extraction;
  PEP 508 name extraction). Poetry/requirements/setup.py, namespace packages, module
  nesting, and the registry refactor are explicit out-of-scope limitations in ticket.md.
