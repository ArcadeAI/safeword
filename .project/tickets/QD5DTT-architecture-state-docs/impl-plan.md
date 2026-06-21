# Impl Plan: Architecture state docs — Slice 1

**Status:** implemented

## Approach

Four pure-ish components, built bottom-up so each lands on green before the next depends on it. Most behavior is unit-testable because the extractor, fingerprint, and reconcile are pure functions over a fixture tree + doc model; only the session-start composition needs integration.

1. **Skeleton extractor** — `architecture-skeleton.ts`. _As-built:_ enumerates top-level `src/` subdirectories directly (not via `DetectedArchitecture` — see Decisions); emits nodes with `src/<name>` code references and a `purpose` placeholder floor, plus `purposeFloorViolations`. **Test layer: unit.** Covers modules-equal-tree, non-empty purpose + violation, non-structural exclusion, no-src, zero-modules, and content-agnostic extraction (scenario 6 reframed from "unparseable-skipped" — the structure-based extractor never reads source bytes). _Built first._
2. **Shape-fingerprint** — `packages/cli/src/utils/`. Pure hash over the extractor's structural inputs (shape, not bytes). **Test layer: unit**, metamorphic (the Scenario Outline: each input transform → hash differs/identical vs the recorded value). _Build second (depends on the extractor's structural model)._
3. **Reconcile / marker engine** — `packages/cli/src/utils/`. Pure function over (existing doc model, fresh skeleton, recorded fingerprint) → per-section verdicts: no-marker / `⚠ stale` / orphan / purpose-placeholder. **Test layer: unit.** Covers all NTB1.AC2 scenarios + the orphan-vs-stale disambiguation. _Build third._
4. **SessionStart self-heal wiring** — `packages/cli/src/hooks/` (+ `templates/hooks/`). Composes extractor + fingerprint + reconcile; reads/writes the doc at the **configured** `paths.architecture` location. **Test layer: integration** (session-start path: doc + project → healed doc + markers). Covers the four "when a session starts" scenarios, corrupt-fingerprint regeneration, and out-of-band heal-and-flag. _Build last._

**LLM-free invariant** (the done-when that is not a scenario): asserted at the unit layer — the extractor/fingerprint/reconcile signatures take no model client, and the self-heal path imports no model SDK. A structural test guards it.

## Decisions

| Decision                   | Choice                                                            | Alternatives considered                        | Rejected because                                                                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module enumeration         | Direct top-level `src/` subdirectory scan                         | Reuse `DetectedArchitecture` (`boundaries.ts`) | `DetectedArchitecture` detects _layers_ by known names (utils/services/…), not arbitrary feature modules (auth/billing); the scenarios need every top-level module enumerated. `DetectedArchitecture` is still the right input for the _boundary fingerprint_, not for module listing. |
| Boundary fingerprint input | dependency-cruiser config (`.dependency-cruiser.cjs` + generated) | `eslint-plugin-boundaries` config              | Repo enforces boundaries via dependency-cruiser; the eslint plugin is docs-only                                                                                                                                                                                                        |
| Fingerprint basis          | Hash of structural **shape**                                      | Content hash of file bytes                     | Bytes move on comment/version noise → false drift; metamorphic invariant requires shape                                                                                                                                                                                                |
| Marker storage             | In-doc frontmatter stamps + inline per-section markers            | Separate sidecar drift file                    | Splits source of truth; the doc must be self-describing for the agent that reads it                                                                                                                                                                                                    |
| Self-heal accuracy         | Deterministic re-extraction only (LLM-free)                       | LLM regeneration of the skeleton               | Hallucination surface + cost on every session start                                                                                                                                                                                                                                    |

## Arch alignment

Records exist at the configured `paths.architecture` (`ARCHITECTURE.md`). This implementation honors:

- **CLI Structure layering** (`ARCHITECTURE.md` → CLI Structure): detection/file-ops live in `utils/`, Claude Code hooks in `hooks/` — extractor/fingerprint/reconcile are utils; self-heal is a hook.
- **dependency-cruiser as the arch-validation mechanism** (`ARCHITECTURE.md` → Tech Stack): the fingerprint reads the same boundary config the repo already validates against.
- **Hooks never block the workflow** (`ARCHITECTURE.md` → Key Decisions, Graceful Linter Fallback): Slice 1 self-heal only marks/warns; blocking gates are deferred to Slice 2.
- **Once-per-session work** (`ARCHITECTURE.md` → Key Decisions, golangci-lint session cache): self-heal runs at SessionStart, not per-edit.

## Known deviations

- The feature's _default_ output is `.project/architecture.md`, but this repo overrides `paths.architecture` to `ARCHITECTURE.md`. Honored as built — `selfHeal` resolves via `resolveConfiguredPath(cwd, 'architecture')`, never hardcoding the path.
- **SessionStart hook wiring is not done.** `selfHeal` is implemented and integration-tested as a function, but no SessionStart hook invokes it yet — so in a real install the doc is not auto-healed on session start. Remaining work to finish Slice 1 end-to-end: a template SessionStart hook that calls `selfHeal` plus its registration. Tracked as the next step (own task or Slice-1 follow-up); the four "when a session starts" scenarios are proven against `selfHeal` directly.
- **Staleness uses the global fingerprint, not per-node.** A section is stale when its stamp differs from the whole-project fingerprint, so any structural change marks every surviving section stale (banner-blindness risk the figure-it-out premortem named). Acceptable for Slice 1; per-node fingerprints are the refinement (see Assessment triggers).

## Assessment triggers

- **Monorepo support (Slice 3)** — revisits the single-doc / single-fingerprint assumption (per-node fingerprints, derived root index).
- **Non-TypeScript language packs** — revisits the extractor's TS + dependency-cruiser specificity (per-pack fingerprint inputs).
- **Self-heal too slow on large repos** — revisits the incremental-hashing boundary (re-hash all vs. only-moved nodes).
