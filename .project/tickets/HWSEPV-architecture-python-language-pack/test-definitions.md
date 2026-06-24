# Test Definitions: Python language pack (HWSEPV)

Feature source: `features/architecture-python-language-pack.feature`

test-definitions.md is the R/G/R ledger. The black-box `.feature` lane proves the
observable doc-coverage behaviors — including dependency drift, observable via the
shape-fingerprint in the doc frontmatter and `architecture --check`. Fine-grained
PEP 508 name extraction, uv-workspace parse, and src/flat extractor internals are
pinned by unit tests as a secondary layer, listed under "Unit-pinned" below.

## Rule: Python projects get real structural extraction and drift detection

### Scenario: A src-layout Python project lists its top-level src modules

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A flat-layout Python project lists root packages and modules, not tooling files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A uv workspace produces a root index and per-package leaf docs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A package with no recognized modules is marked, not introspected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adding a Python dependency makes the architecture doc go stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Polyglot repos introspect every language without regressing JS

### Scenario: A mixed JS and Python monorepo introspects both packages

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pure JS single-repo is unchanged by the Python extractor

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Scenario notes (coverage honesty)

- **Scenario 1's load-bearing RED is the `db` (`src/db.py` file) assertion.** A `src/api/`
  package dir is already listed by today's TS dir-enumeration, so `lists "api"` and
  `single-repo module doc` pass pre-implementation; only the top-level `src/*.py` file is new.
  Do NOT weaken the fixture to dir-only modules.
- The `the doc does not list the module "X"` Then (scenario 2's tooling exclusion) already
  exists from the Rust slice — no new step definition is required; the Python-specific Givens
  live in a new `steps/architecture-python-language-pack.steps.ts`.
- **Scenario 2 Given pins both flat-layout branches** (scenario-gate nit): "a package dir
  `core` (with **init**.py)" AND "a module file `utils.py`" — so the fixture exercises root
  `__init__.py`-dir extraction AND root `*.py` extraction, not just one. Do not collapse both
  to `.py` files.
- **Scenario 5 (drift) keeps the Go/Rust shape** (asserts stale-after-add, no explicit
  fresh-before anchor) — a deliberate cross-pack-consistency choice; the false-positive guard
  (a version bump does NOT move the fingerprint) is unit-pinned, which backstops an
  "always-stale" bug. Changing only Python's drift scenario would diverge from the shipped lanes.

## Unit-pinned (secondary — fine-grained internals beneath the black-box scenarios)

- **TB2.AC1 fine-grain — PEP 508 dependency-name extraction:** `requests>=2.0` → `requests`,
  `foo[extra]>=1; python_version<"3.9"` → `foo`; adding/removing a `[project] dependencies`
  entry changes `shapeFingerprint` while a JS package's is untouched; a version bump does not.
  `architecture-fingerprint.test.ts` + a PEP 508 parse unit.
- **detectUvWorkspace parse:** `[tool.uv.workspace] members = [..]` (TOML, via the shared
  reader); no `[tool.uv.workspace]` → `undefined`. `architecture-monorepo.test.ts`.
- **extractSkeleton Python layout:** `pyproject.toml` + `src/` → src subpackages + `src/*.py`;
  flat-layout → root `__init__.py` dirs + root `*.py`, excluding tooling (setup.py/conftest.py/
  noxfile.py) and dunder (**init**.py/**main**.py); no recognized modules → empty skeleton.
  `architecture-skeleton.test.ts`.
