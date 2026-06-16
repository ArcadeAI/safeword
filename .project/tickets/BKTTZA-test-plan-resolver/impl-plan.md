# Impl Plan: test-plan resolver

**Status:** implemented

## Approach

One pure module `packages/cli/src/test-plan/resolve.ts` owns all behavior; a thin
CLI command `packages/cli/src/commands/test-plan.ts` wraps it. Outside-in: the CLI
JSON contract scenario is the integration boundary; everything else is proven at
the unit layer against the pure resolver (injected `isToolAvailable` + temp-dir
fixtures), which is the highest layer that covers each behavior with fast feedback.

| Scenario cluster (rule)                                                             | Owner                                                                           | Test layer           | Build order                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------- | ---------------------------------- |
| Discovery: detect all languages, nested, vendored-excluded, empty plan              | `detectLanguages()` reusing `findInTree`/`SUBDIRECTORY_EXCLUDE` (`utils/fs.ts`) | unit                 | 1 — foundation                     |
| JS detection via real `test`/`build` script (not the file); PM-aware                | `resolveJs()` (reuse `detectPackageManager` from `test-runner.ts` logic)        | unit                 | 2                                  |
| Per-language runner (Python tox/pytest/unittest+PM, Rust nextest/cargo, Go go.work) | `resolvePython/Rust/Go()` with injected `isToolAvailable`                       | unit                 | 3 — bulk of AC2                    |
| Availability flag (`available:false`, never dropped)                                | `PlanEntry.available` set by each resolver                                      | unit                 | 4                                  |
| `--kind build` commands; Python omitted; JS-no-build omitted                        | `kind` param branch in each resolver                                            | unit                 | 5                                  |
| CLI emits JSON with field contract                                                  | `commands/test-plan.ts` + commander registration                                | integration (runCli) | 6 — last, wraps the green resolver |

Build order is dependency-first: discovery → JS → other runners → availability → build-kind → CLI wrapper, so each RED builds on green. Cucumber `.feature` steps map onto the same fixtures; the runner-detection cluster may collapse to a `Scenario Outline`/table-driven unit set at GREEN.

## Decisions

| Decision                 | Choice                                             | Alternatives considered     | Rejected because                                                                                                            |
| ------------------------ | -------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Where the resolver lives | New `src/test-plan/resolve.ts` (CLI src)           | In `templates/hooks/lib/`   | Shipped hooks can't import safeword code (`lint.ts:145`); consumers reach it via the CLI, so it belongs in src.             |
| Consumer contract        | Plan-only JSON (`safeword test-plan --json`)       | `--run` that executes       | `test-runner.ts` already owns execution/timeout; `/verify` needs to run in bash to emit `✓ X/X tests pass`. (epic decision) |
| Tree discovery           | Reuse `findInTree`/`SUBDIRECTORY_EXCLUDE`          | New tree-walker             | Already battle-tested with the right excludes + maxDepth; no reason to duplicate.                                           |
| Availability seam        | Inject `isToolAvailable(tool)`                     | Probe `command -v` directly | Determinism: unit tests assert runner selection without real toolchains installed (mirrors `typecheck-gate.ts`).            |
| Go workspace command     | `go test $(go list -f '{{.Dir}}/...' -m \| xargs)` | plain `go test ./...`       | `./...` doesn't span sibling workspace modules (contested; verified this session).                                          |

## Arch alignment

- **Schema as Single Source of Truth / CLI command structure** — registers as a standard subcommand alongside `sync-config`, `lint-gherkin` (see `ARCHITECTURE.md` → CLI).
- **Reuse over duplication** — reuses `utils/fs.ts` discovery and the package-manager detection idiom rather than re-implementing.
- **Dual-config / language-pack model** — runner detection mirrors `LANGUAGE_PACK_SPEC.md` per-language tool conventions.

## Known deviations

skip: no deviations planned — conforms to existing CLI-command + utils-reuse patterns.

## Assessment triggers

- A 5th language pack (e.g. Java) → revisit whether per-language `resolve*()` functions should become a registry keyed off `LANGUAGE_PACKS`.
- Real demand for fast feedback on large polyglot repos → add the deferred cross-language `test:done` fast-subset.
- A consumer needing execution (not just a plan) → revisit the plan-only decision (`--run`).
- JS workspaces with per-package-only test scripts showing up in practice → add the deferred PM-recursive fallback.
