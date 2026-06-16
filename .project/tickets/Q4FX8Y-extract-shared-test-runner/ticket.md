---
id: Q4FX8Y
slug: extract-shared-test-runner
type: feature
phase: intake
status: in_progress
created: 2026-06-16T13:58:31.841Z
last_modified: 2026-06-16T13:58:31.841Z
---

# Centralize and harden the test/build resolver (polyglot, nested, multi-runner)

**Goal:** One resolver decides what test/build commands to run for a repo — correct across polyglot monorepos (run **every** detected suite, not first-match), nested/sub-package manifests, and languages with multiple runners — consumed identically by `/verify`, `/audit`, and the stop-hook `test-runner.ts` without drift.

**Why:** 2FVZ26 made all three language-aware but (a) the logic is duplicated in three forms (bash in verify/audit skills+commands, TS in `test-runner.ts`) and (b) it is **first-match-wins, root-only, one-runner-per-language**. So a JS+Python monorepo verifies only JS and the done-gate passes with Python untested (**false green**); a `unittest`/`tox` Python project or a `go.work`/Rust-workspace repo is mis- or under-tested. This folds in Option C (centralization) **and** fixes the correctness gaps.

> Source: 2FVZ26 figure-it-out (Option C, deferred) + the polyglot/runner gaps surfaced in review. Reclassified task→**feature**: new CLI surface + behavior change + multiple flows → build with `/bdd`.

## Decisive constraint (from /figure-it-out)

Shipped hooks **cannot import safeword package code** — `templates/hooks/lib/lint.ts:145` states this and is why logic is duplicated there. So a shared _import_ between CLI `src/` and `test-runner.ts` is impossible. The single source of truth must therefore be reached by **calling the CLI**, not importing it.

## Chosen design — `safeword test-plan` (Option A)

A pure resolver lives once in `packages/cli/src/` and is exposed as a CLI subcommand that emits a machine-readable plan; every surface consumes the CLI (precedent: `lint.ts` already shells to `safewordCliCommand()`; `/audit` calls `bunx safeword sync-config`):

```
safeword test-plan --kind test|build [--json]
# → [{ language, cwd, command, available, runner }, ...]  (ALL detected suites)
```

- **`test-runner.ts`** shells to the CLI for the plan (with the existing installed-CLI → `bunx` fallback), then executes each command with its current timeout/truncation logic. The hook shrinks to a thin caller — no language strings, no `.safeword`/template byte-parity burden for the logic.
- **`/verify`** runs the planned test+build commands and aggregates the done-gate line (`✓ X/X tests pass` across suites).
- **`/audit`** uses the same discovery for its per-language dead-code/outdated/arch checks.
- Resolver is unit-tested in the normal CLI suite with an injected `isToolAvailable` + temp-dir fixtures (no real toolchains needed) — like `typecheck-gate.ts`'s seam.

### Resolver correctness rules

| Concern          | Rule                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Polyglot         | Return **all** detected language suites (JS + Python + Go + Rust), each a plan entry. No first-match.                                                                                                                                                                      |
| JS monorepo      | A real root `test` script is the orchestrator (turbo/nx/make) → use it; PM-aware (bun/pnpm/yarn/npm). Don't also recurse workspaces.                                                                                                                                       |
| Python runner    | `tox.ini`→`tox`; `[tool.pytest.ini_options]`/`pytest.ini`/installed→`pytest` (recurses from root); else `python -m unittest discover`. PM-aware (uv/poetry).                                                                                                               |
| Go               | `go.work` → `go test $(go list -f '{{.Dir}}/...' -m \| xargs)`; else `go test ./...`. Behavior depends on module layout (nested vs sibling) — verify against the target Go version at build; respect the Go 1.25 `go.mod ignore` directive.                                |
| Rust             | nextest configured/installed → `cargo nextest run --workspace` (+ `cargo test --doc`, since nextest skips doctests); else `cargo test --workspace` (which already runs doctests).                                                                                          |
| Nested manifests | **Reuse** `findInTree` + `SUBDIRECTORY_EXCLUDE` from `src/utils/fs.ts` (already skips `node_modules`/`.git`/`vendor`/`dist`/`build`/`target`/`coverage`, maxDepth 10) — the resolver lives in CLI `src/` so it imports these directly. Do **not** write a new tree-walker. |
| Tool absent      | Entry flagged `available:false` → skipped with a **visible** note, never silently dropped.                                                                                                                                                                                 |
| Timeout/perf     | Tests execute only at the **done gate** (see revalidation below), not every stop — so the all-suites cost is bounded to done/`verify`. Keep per-suite timeout + a cross-language `test:done` fast-subset escape hatch + partial-result reporting.                          |

## Acceptance criteria

- [ ] `safeword test-plan --kind test|build --json` returns **all** detected suites for a repo; pure resolver unit-tested with injected availability + fixtures.
- [ ] Polyglot monorepo (JS+Python) runs **both** suites — done-gate cannot go green with a language untested (kills the false green).
- [ ] Python runner detected (pytest vs `tox` vs `unittest`), not hardcoded; Rust uses `--workspace` (+ nextest when present); Go honors `go.work`.
- [ ] Nested/sub-package manifests are discovered (not root-only) by **reusing** `findInTree`/`SUBDIRECTORY_EXCLUDE` from `src/utils/fs.ts` — no new tree-walker — plus Go `go.mod ignore` awareness.
- [ ] `test-runner.ts`, `/verify`, `/audit` all consume `test-plan`; **zero** language command strings duplicated across surfaces.
- [ ] Tool-absent suites are reported as skipped (visible), never silently passed; per-suite timeout + partial-result reporting intact.
- [ ] Done-gate literal-phrase contract preserved; existing 2FVZ26 tests + verify-skill/parity stay green; dogfood parity preserved.

## Revalidation notes (quality-review, 2026-06-16)

Each quality-review finding was revalidated against the code before being folded in. Two corrected a wrong assumption — recorded here so they are not "fixed" again:

- **`runTests` is done-phase-only, NOT per-stop.** `stop-quality.ts:489` calls `runTests` only inside `if (currentPhase === 'done')`. The review's "Critical: don't run all suites on every stop" was based on a false premise — there is **no** per-stop test execution to scope down, and no hook-vs-verify policy split is needed. Running all suites at the done gate is correct (same cost as `/verify`). The only real lever is total time on large polyglot repos → the `test:done` fast-subset escape hatch (now cross-language).
- **Discovery ignores already exist.** `src/utils/fs.ts` `findInTree`/`SUBDIRECTORY_EXCLUDE` already excludes vendored/generated dirs at maxDepth 10. Reuse it; nothing to add except Go's `go.mod ignore`.
- **Spawn cost is negligible** — the CLI is invoked at the done gate and on manual `/verify`/`/audit`, not on every stop (precedent: `lint.ts` shells out per edit).
- **Go `./...` across workspace modules is contested** across sources — keep the `go list` workaround; verify against the target Go version at build.

## Known limitations to decide at build (open)

- JS workspace with **no** root test script (per-package only) — run per-package, or require a root script? (lean: require root script v1.)
- Whether `test-plan` only _plans_ (callers execute) or can also _execute_ (`--run`). Lean: plan-only; callers execute so `/verify` stays transparent and the done-gate sees results.
- Cross-language `test:done` fast-subset convention for very large polyglot repos (nice-to-have, not v1-blocking).

## Work Log

- 2026-06-16T13:58:31.841Z Started: Created ticket Q4FX8Y
- 2026-06-16 Quality-review + revalidation: corrected the per-stop premise (tests are done-gate-only), reused existing `findInTree` ignores, downgraded spawn-cost, kept Go workaround with a build-time caveat. Plan tightened; ready for `/bdd`.
