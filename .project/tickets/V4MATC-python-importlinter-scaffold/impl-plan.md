# Impl Plan: Python pack: scaffold generic import-linter config

**Status:** implemented

_Rev 2 corrected the plan against codebase reality (pre-implementation review + primary-source docs); rev 3 reconciles it against what shipped._

## Approach

**Riskiest assumption:** "exactly one importable package at repo root or under `src/`" is decidable from a cheap tree probe and matches real single-package layouts — proven by the two cheapest scenarios (R1 flat + R1 src-layout) plus R3's ambiguity outline. Slice 1.

**Ground truth this plan builds on (verified by review, file:line):**

- The pack ALREADY generates `.importlinter` as a **managedFile** — layer-based, gated on `detectPythonLayers` (`packs/python/files.ts:263-277`), with green tests asserting the layers contract (`tests/commands/setup-python-phase2.test.ts:170-216`). This feature **extends** that generator (adds `acyclic_siblings` for the unambiguous-single-package case; layers contract preserved where detected) — never a parallel path.
- **managedFiles** (`schema.ts:86`, `reconcile.ts:597-625`) already provide create-if-missing on install AND upgrade → R4's create-once/upgrade-creates/never-overwrite rows ride existing machinery.
- What does NOT exist: **conditional removal on reset** — default reset never removes managedFiles; `reset --full` removes unconditionally (`reconcile.ts:746-757`). R4's reset trio needs new reconcile machinery (per-entry `removeIfUnmodified`); nearest precedent `removeFileIfContentEquals` on TextPatchDefinition (`schema.ts:65`).
- Existing-config detection (`utils/project-detector.ts:240-253`) covers `.importlinter` + pyproject only — **setup.cfg `[importlinter]` must be added** for R2.
- Setup **already auto-installs** import-linter with ruff/mypy when layers are detected (`commands/setup.ts:177-215` via `getPythonTools(hasLayers)`); guidance prints on failure (`setup.ts:263-267`). R5 (as flipped) = extend the install condition to the single-package case; failure-guidance path already exists.
- **Critical gate/content separation:** the current generator returns `undefined` when existing config is detected (`files.ts:267`) — at reset time the scaffold itself trips that gate, so content-comparison would compare against `undefined` and never match. The existing-config **gate** and the expected-content **generation** must be separable functions.

**Exact scaffold format (verified: import-linter readthedocs, acyclic_siblings page):**

```ini
[importlinter]
root_package = <pkg>

[importlinter:contract:safeword-acyclic]
name = No circular imports between sibling modules (safeword)
type = acyclic_siblings
ancestors = <pkg>
```

`type = acyclic_siblings` (underscore); `ancestors` is REQUIRED; `root_package` singular for one package. `depth` defaults to 10 (sufficient; omit).

**Proof plan (highest practical scope per scenario):**

| Behavior | Owner | Primary proof | Notes |
| --- | --- | --- | --- |
| Sole-package detection (flat/src/zero/2+/mixed) | new pure helper in `packs/python` | unit | slice 1 |
| Scaffold content (root_package + acyclic_siblings; layers preserved when detected) | extended `generateProjectImportLinterConfig`, gate split out | unit | asserts exact INI above |
| Setup scaffolds / gates (R1, R2 setup, R3 setup) | setup flow | integration — real CLI on fixtures (`tests/helpers.ts:401` runCli pattern) | migrate `setup-python-phase2.test.ts` layer assertions alongside |
| Upgrade creates / idempotent / preserves (R4, R2/R3 upgrade rows) | managedFiles reconcile (existing) | integration | |
| Reset removes-unmodified / preserves (R4) | NEW `removeIfUnmodified` reconcile machinery | integration | machinery slice sequenced first |
| Install with other tools / failure guidance (R5) | `getPythonTools` condition extension | integration — output + dependency assertion | failure fixture: PM unavailable |
| lint-imports teeth (R1 cycle + exit-0) | real binary | E2E in cucumber lane + guarded vitest | requires `import-linter` in `.github/requirements-ci.txt` (CI has Python 3.12 + pip); src-layout fixture needs `PYTHONPATH=src` or editable install; local runs skip visibly when binary absent |
| Ownership/parity guards (done_when anchor) | `tests/schema.test.ts` + `tests/parity.test.ts` | existing guard suites extended | |

**Build order** (each slice builds on green; load-bearing first):

1. `detectSolePackage` pure helper + unit tests
2. Generator extension: split existing-config gate from content generation; add `acyclic_siblings` emission; unit tests (exact INI)
3. **Replace/migrate the layer-generator entry**: single generator emits layers-when-detected + acyclic-when-unambiguous; migrate `setup-python-phase2.test.ts` assertions; decide `detectPythonLayers` interplay in code review
4. Detector: add setup.cfg `[importlinter]` form + tests
5. Setup wiring integration tests (R1 setup, R2 setup rows, R3 setup rows)
6. NEW reconcile machinery: per-entry `removeIfUnmodified` for managedFiles (unit on `computeUninstallPlan`)
7. Upgrade + reset integration tests (R4, R2/R3 upgrade rows)
8. Install condition extension + failure-guidance test (R5)
9. CI: add `import-linter` to `.github/requirements-ci.txt`; guarded E2E teeth tests + cucumber step definitions with venv/PYTHONPATH fixture needs
10. Schema/parity guard extension + ARCHITECTURE.md Python tooling row (docs task)

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Config location | standalone `.importlinter` (existing managedFile entry) | `[tool.importlinter]` in pyproject | editing a user-owned file loses clean lifecycle; tool auto-detects both equally |
| Relationship to existing layer generator | extend one generator (layers when detected + acyclic_siblings when unambiguous) | parallel new path; replace layers outright | parallel = two `.importlinter` philosophies; replacing layers regresses existing layered-project behavior |
| Post-creation ownership | managedFiles create-once (existing semantics), never overwrite | ownedFiles drift-guard | users extend with own contracts; overwrite destroys them |
| Reset removal criterion | NEW per-entry `removeIfUnmodified` (content-comparison vs regenerated scaffold, gate-free content source) | sidecar marker; unconditional `--full` removal (status quo) | sidecar = more state that can lie; unconditional removal deletes user contracts (R4 rejection scenarios) |
| Tool installation | auto-install with the pack's other Python tools, extended to single-package projects (R5 as flipped by Alex, 2026-07-06) | guidance-only | inconsistent with pack reality (already auto-installs); leaves the check dead until manual action |
| Detection breadth | exactly one `__init__.py` package at root or under `src/` | broad heuristics (setup.py metadata, namespace pkgs) | wrong guess errors every audit; widen on demand |
| Install-condition source (added at whole-ticket review) | `hasImportLinterScaffoldTarget` exported from files.ts; setupPython consumes it | re-deriving layers-or-sole-package at each call site | duplicated predicate drifts silently when scaffold conditions change |

**Reconciliation notes (what differed from the plan):**

- Slice 3's "migrate setup-python-phase2 assertions" turned out to be a no-op: Test 2.1b's fixture has no importable package at all, so it remains valid under the new behavior (verified green throughout).
- Slice 6's machinery landed as a per-entry *function* (`removeIfUnmodified?: (ctx) => string | undefined`) rather than a boolean flag — the function IS the gate-free content source, collapsing two plan concepts into one field.
- R5 flipped mid-implement (Alex, 2026-07-06): auto-install with the pack's other tools, replacing the original guidance-only rule — recorded in the Decisions row above and in spec.md.
- The full-suite environment detour (Node 22 vs the repo's ^24.16 floor) was resolved by installing Node 24.18 (upstream #872 filed then closed as env-misdiagnosis).

## Arch alignment

Record: `ARCHITECTURE.md`. Honors **Language Packs — Modular Language Support** (all logic in `packs/python/` behind the pack interface) and **Language Detection before framework detection** (rides existing pack flow). ARCHITECTURE.md's Python tooling row gains import-linter at implement-exit (slice 10).

## Known deviations

One acknowledged: **new reconcile machinery** (`removeIfUnmodified` for managedFiles) — no existing category covers conditional-content removal on reset; nearest precedent is `removeFileIfContentEquals` on text patches. Scoped to a per-entry opt-in flag so it cannot change any other managed file's behavior.

## Assessment triggers

- import-linter changes config auto-detection or `acyclic_siblings` semantics (pin: 2.x) → revisit generator + audit gating.
- Demand for multi-package/namespace layouts → revisit detection breadth.
- A `sync-config`-style Python regeneration path → revisit create-once (comparison logic generalizes).
- Other packs need conditional-removal semantics → promote `removeIfUnmodified` from Python-specific usage to documented schema vocabulary.
- CI guarantees a `uv` binary → harden the R5 install assertions from install-intent output to strict pyproject content (deferred quality-review finding 5).
- A second Python cucumber steps file appears → extract shared fixtures to `steps/support/python-fixtures.ts` (deferred finding 4).
