# Impl Plan: Architecture state docs — Slice 1

**Status:** planned

## Approach

Four pure-ish components, built bottom-up so each lands on green before the next depends on it. Most behavior is unit-testable because the extractor, fingerprint, and reconcile are pure functions over a fixture tree + doc model; only the session-start composition needs integration.

1. **Skeleton extractor** — `packages/cli/src/utils/`. Reuses `DetectedArchitecture` (`boundaries.ts`) for layer/module detection; emits nodes (top-level modules, deps, dependency-cruiser boundary config, schema files) with code references and a `purpose` floor. **Test layer: unit** (fixture tree in → skeleton out). Covers: modules-equal-tree, non-empty purpose + violation, non-structural exclusion, no-src, zero-modules, unparseable-skipped. _Build first._
2. **Shape-fingerprint** — `packages/cli/src/utils/`. Pure hash over the extractor's structural inputs (shape, not bytes). **Test layer: unit**, metamorphic (the Scenario Outline: each input transform → hash differs/identical vs the recorded value). _Build second (depends on the extractor's structural model)._
3. **Reconcile / marker engine** — `packages/cli/src/utils/`. Pure function over (existing doc model, fresh skeleton, recorded fingerprint) → per-section verdicts: no-marker / `⚠ stale` / orphan / purpose-placeholder. **Test layer: unit.** Covers all NTB1.AC2 scenarios + the orphan-vs-stale disambiguation. _Build third._
4. **SessionStart self-heal wiring** — `packages/cli/src/hooks/` (+ `templates/hooks/`). Composes extractor + fingerprint + reconcile; reads/writes the doc at the **configured** `paths.architecture` location. **Test layer: integration** (session-start path: doc + project → healed doc + markers). Covers the four "when a session starts" scenarios, corrupt-fingerprint regeneration, and out-of-band heal-and-flag. _Build last._

**LLM-free invariant** (the done-when that is not a scenario): asserted at the unit layer — the extractor/fingerprint/reconcile signatures take no model client, and the self-heal path imports no model SDK. A structural test guards it.

## Decisions

| Decision                   | Choice                                                            | Alternatives considered           | Rejected because                                                                        |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| Layer/module detection     | Reuse `DetectedArchitecture` (`boundaries.ts`)                    | New bespoke detector              | Duplicates existing detection; two layer models would drift                             |
| Boundary fingerprint input | dependency-cruiser config (`.dependency-cruiser.cjs` + generated) | `eslint-plugin-boundaries` config | Repo enforces boundaries via dependency-cruiser; the eslint plugin is docs-only         |
| Fingerprint basis          | Hash of structural **shape**                                      | Content hash of file bytes        | Bytes move on comment/version noise → false drift; metamorphic invariant requires shape |
| Marker storage             | In-doc frontmatter stamps + inline per-section markers            | Separate sidecar drift file       | Splits source of truth; the doc must be self-describing for the agent that reads it     |
| Self-heal accuracy         | Deterministic re-extraction only (LLM-free)                       | LLM regeneration of the skeleton  | Hallucination surface + cost on every session start                                     |

## Arch alignment

Records exist at the configured `paths.architecture` (`ARCHITECTURE.md`). This implementation honors:

- **CLI Structure layering** (`ARCHITECTURE.md` → CLI Structure): detection/file-ops live in `utils/`, Claude Code hooks in `hooks/` — extractor/fingerprint/reconcile are utils; self-heal is a hook.
- **dependency-cruiser as the arch-validation mechanism** (`ARCHITECTURE.md` → Tech Stack): the fingerprint reads the same boundary config the repo already validates against.
- **Hooks never block the workflow** (`ARCHITECTURE.md` → Key Decisions, Graceful Linter Fallback): Slice 1 self-heal only marks/warns; blocking gates are deferred to Slice 2.
- **Once-per-session work** (`ARCHITECTURE.md` → Key Decisions, golangci-lint session cache): self-heal runs at SessionStart, not per-edit.

## Known deviations

- The feature's _default_ output is `.project/architecture.md`, but this repo overrides `paths.architecture` to `ARCHITECTURE.md`. Not a real deviation — Slice 1 must resolve the path via `resolveConfiguredPath(cwd, 'architecture')` and never hardcode `.project/architecture.md`. Flagged so implementation honors the override.
- Otherwise: no deviations planned.

## Assessment triggers

- **Monorepo support (Slice 3)** — revisits the single-doc / single-fingerprint assumption (per-node fingerprints, derived root index).
- **Non-TypeScript language packs** — revisits the extractor's TS + dependency-cruiser specificity (per-pack fingerprint inputs).
- **Self-heal too slow on large repos** — revisits the incremental-hashing boundary (re-hash all vs. only-moved nodes).
