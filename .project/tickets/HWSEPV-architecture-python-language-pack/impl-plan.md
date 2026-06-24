# Impl Plan: Python language pack (HWSEPV)

**Status:** planned

## Approach

Outside-in TDD over the same three production seams, reusing the `cargo-manifest.ts`
TOML machinery (pyproject.toml is TOML). The new work vs Rust: PEP 508 dependency-name
extraction, the `[project]`/`[tool.uv.workspace]` table reads, and the src-vs-flat
extraction fork. Build order — keystone (extraction) first, then discovery, then
fingerprint:

0. **Verify uv syntax (implement-time gate).** Before wiring `detectUvWorkspace`, confirm
   uv's actual `[tool.uv.workspace] members` TOML form against current uv docs; correct
   scenario 3's fixture before GREEN if it diverges (scenario-gate implementer NOTE).
1. **pyproject reader** — `pyproject-manifest.ts` (new): `readPyprojectName` (`[project] name`),
   `readPyprojectDependencies` (`[project] dependencies` + `optional-dependencies` arrays →
   PEP 508 names), `readUvWorkspaceMembers` (`[tool.uv.workspace] members`). Reuses the
   TOML primitives from `cargo-manifest.ts` where cleanly shareable (the array-body scan,
   `stripComment`, `unquote`) — extract those to a shared `toml.ts` IF the reuse is clean,
   else duplicate minimally and let the registry refactor consolidate later. PEP 508 name =
   leading `/^[A-Za-z0-9._-]+/` of each specifier. _Unit_ (`pyproject-manifest.test.ts`).
2. **Extraction (keystone)** — `architecture-skeleton.ts`: dispatch on `pyproject.toml` →
   src-layout (`src/` present) lists `src/` subdirs + `src/*.py`; flat-layout lists root
   dirs containing `__init__.py` + root `*.py`, minus tooling (setup.py/conftest.py/noxfile.py)
   and dunder (**init**.py/**main**.py). TS/Go/Rust branches unchanged. _Unit_. Turns
   scenarios 1, 2 green.
3. **Discovery** — `architecture-monorepo.ts`: `detectUvWorkspace` appended to the `??`
   chain; `hasRecognizedManifest` gains `pyproject.toml`; `packageName` falls back to
   `readPyprojectName`. _Unit_. Turns scenarios 3, 4, 6 green.
4. **Fingerprint** — `architecture-fingerprint.ts`: union `readPyprojectDependencies` into
   the dependency set. _Unit_. Turns scenario 5 green.
5. **Black-box BDD** — `steps/architecture-python-language-pack.steps.ts` over real fixtures;
   reuses the shared When/Then vocabulary + `architecture-fixtures.ts`. No new step
   definition (the negative `does not list the module` Then exists from Rust).

Test-layer rationale: TOML/PEP 508 parse, extraction, fingerprint are pure → unit; which
docs appear and what `--check` reports are a process-boundary contract → the `.feature` lane.

## Decisions

| Decision            | Choice                                                                         | Alternatives considered            | Rejected because                                                                         |
| ------------------- | ------------------------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Python extraction   | src-layout: src/ dirs + src/\*.py; flat-layout: root \_\_init\_\_ dirs + \*.py | Single-package-only / nesting      | Real Python projects use both layouts; nesting stays out (consistent with Go/Rust)       |
| Manifest standard   | PEP 621 `[project]` + uv `[tool.uv.workspace]`                                 | Poetry / requirements.txt          | PEP 621 + uv is the modern standard; Poetry is a tool-table follow-up                    |
| Dependency names    | Leading distribution name of each PEP 508 specifier                            | Full specifier string              | Versions/extras/markers are noise — only the name is shape (mirrors the other packs)     |
| pyproject parsing   | Reuse the Cargo TOML-subset machinery                                          | A TOML library / new parser        | Zero-dep posture; pyproject IS TOML — strongest reuse yet                                |
| Extraction dispatch | Manifest-keyed: pyproject → Python branch (after Cargo, before src-dir/go)     | Augment src-dir path conditionally | Manifest dispatch keeps each language isolated, zero TS/Go/Rust regression               |
| Registry refactor   | DEFER to a dedicated post-4-packs ticket                                       | Do it inside this slice            | Rule-of-N — abstract against the complete language set, not mid-add (Iron Law: no batch) |

## Arch alignment

- **Deterministic, LLM-free engine** — TOML/PEP 508 parse, extraction, fingerprint are pure
  derive/parse; no new source of truth, no LLM, no Python interpreter shell-out.
- **Never silently wrong** — a package with no recognized modules stays the honest "not
  introspected" marker; Poetry-only/namespace-package/legacy gaps are documented out-of-scope.
- **Polyglot promise** — Python plugs into the same heal-target + fingerprint machinery as the
  other three; with four packs in, the LanguagePack registry refactor is the right next ticket.

## Known deviations

- (anticipated) The TOML-primitive sharing between `cargo-manifest.ts` and the new
  `pyproject-manifest.ts` — extract to a shared `toml.ts` only if clean; otherwise minimal
  duplication that the registry refactor absorbs. Record the actual choice at reconcile.

## Assessment triggers

- **All four packs now exist** → the LanguagePack registry refactor (Generalize the Mechanism:
  one `{detectWorkspace, readModuleName, readDependencies, extractModules}` per language,
  iterated at the discovery/identity/fingerprint/extraction sites) is the right next ticket.
- Poetry / requirements.txt / setup.py demand surfaces → a follow-up dependency/identity source.
- Namespace packages or module nesting needed → their own slice.
