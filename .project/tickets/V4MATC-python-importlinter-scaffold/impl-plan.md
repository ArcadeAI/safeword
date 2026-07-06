# Impl Plan: Python pack: scaffold generic import-linter config

**Status:** planned

## Approach

**Riskiest assumption:** "exactly one importable package at repo root or under `src/`" is decidable from a cheap tree probe and matches how real single-package Python projects are laid out — proven by the two cheapest scenarios (R1 flat + R1 src-layout) plus R3's ambiguity outline. If detection is wrong, everything downstream produces broken or missing configs, so it is slice 1.

**Proof plan (highest practical scope per scenario):**

| Behavior | Owner | Primary proof | Why sufficient | Supporting proof |
| --- | --- | --- | --- | --- |
| Package detection (flat / src / zero / 2+ / mixed) | new pure helper in `packs/python` (e.g. `detectSolePackage(cwd)`) | unit | pure fs-probe logic, combinatorial layouts enumerate cheaply | — |
| `.importlinter` content (root_packages + acyclic-siblings) | new generator in `packs/python/files.ts` | unit | deterministic string generation | — |
| Setup scaffolds / gates on existing config (R1, R2 setup rows, R3 setup rows) | `setup` flow via the pack | integration — real CLI (`runCli`) on temp fixture repos, mocking nothing | the scenario's observable is a file on disk after the real command; repo's established pattern (`tests/commands/setup-*.test.ts`) | — |
| Upgrade creates-if-absent / idempotent / preserves-extended (R4, R2/R3 upgrade rows) | `upgrade` flow | integration — real CLI on fixtures | same | — |
| Reset removes-unmodified / preserves-extended / preserves-authored (R4) | `reset` flow | integration — real CLI on fixtures | same | — |
| Install guidance per package manager; no-nag when installed (R5) | pack setup output via `getPythonInstallCommand` | integration — assert CLI output on fixtures with lockfile markers | output is the observable; PM detection already unit-covered | tool-absence simulated via PATH control |
| `lint-imports` teeth: exit 0 on acyclic, non-zero on cycle (R1) | scaffolded config + real tool | E2E — run real `lint-imports` in a fixture venv | only the real binary proves config validity for the tool | guarded: visible skip when `lint-imports` unavailable in the environment (never silent-green), mirroring the audit skill's own gating |
| Ownership/parity guards recognize the template (done_when anchor) | `schema.ts` + parity machinery | existing guard suites — `schema` contract tests + `parity-check` tests extended with the new entry | repo-internal infra; the guards ARE the proof (flagged at gate: not scenario material) | — |

**Build order** (each slice builds on green):

1. `detectSolePackage` helper + unit tests (load-bearing slice — wrong design fails here cheapest)
2. `.importlinter` generator + unit tests
3. Setup wiring: scaffold + existing-config/ambiguity gating (integration; proves R1 setup, R2, R3)
4. Upgrade create-if-absent + never-overwrite (integration; R4 upgrade scenarios, R2/R3 upgrade rows)
5. Reset content-comparison removal (integration; R4 reset scenarios)
6. Install guidance line (integration; R5)
7. `lint-imports` E2E teeth (guarded; R1 cycle scenario)
8. Schema/parity registration + guard-test extension (done_when anchor)
9. Cucumber step definitions binding the `.feature` scenarios to the lanes above

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Config location | standalone safeword-scaffolded `.importlinter` | `[tool.importlinter]` in `pyproject.toml` | safeword editing a user-owned file loses clean create/remove ownership; import-linter auto-detects the standalone file equally |
| Post-creation ownership | create-once, then user's (never overwrite) | ownedFiles drift-guard (overwrite-on-upgrade) | users are expected to extend with their own contracts (out_of_scope names layer contracts user-owned); overwrite destroys their work — decided at scenario-gate pass 1 |
| Reset removal criterion | content-comparison against the regenerated scaffold for this project | sidecar marker/manifest tracking scaffolded-ness | deterministic regeneration makes comparison state-free; a sidecar is more moving parts and can lie after manual edits |
| Detection breadth | exactly one `__init__.py` package at root or under `src/`; else no scaffold | broad heuristics (setup.py metadata, namespace packages) | a wrong guess errors every audit — worse than the honest skip; widen later on demand (#847 scope) |
| Tool installation | guidance only (`getPythonInstallCommand`), never install | auto-install like JS ESLint parity | Python pack's established pattern is guidance; config-without-tool still yields audit's honest "tool not installed" skip (#857 branch), so no red audits |

## Arch alignment

Record: `ARCHITECTURE.md` (configured `paths.architecture`). This implementation honors:

- **Language Packs — Modular Language Support:** all new logic lives in `packs/python/` behind the existing `LanguagePack` interface (detection, config generation, setup utilities in `files.ts`/`setup.ts`).
- **Language Detection before framework detection:** the scaffold rides the existing pack-detection flow; no new top-level detection path.
- **Type Checking / linting tool table:** extends the documented per-language tool roster (ARCHITECTURE.md already frames per-language quality tooling; import-linter joins ruff/mypy for Python). ARCHITECTURE.md's Python tooling row should gain import-linter at implement-exit — noted as a docs task in slice 8.

## Known deviations

skip: none — conforms to the pack pattern; the one semantic novelty (create-once instead of ownedFiles drift-guard) is a deliberate, documented decision above, matching the existing "yours after creation" precedent of the BDD `features/` starters rather than deviating from it.

## Assessment triggers

- import-linter changes its config auto-detection or the `acyclic-siblings` contract type (pin: v2.x) → revisit generator + audit gating.
- Demand for multi-package/namespace layouts (#847 explicitly defers) → revisit detection breadth decision.
- safeword grows a `sync-config`-style regeneration path for Python → revisit create-once (a regenerate command would need the content-comparison logic generalized).
- The Python pack gains auto-install behavior for other tools → revisit guidance-only decision for consistency.
