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

| Concern          | Rule                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Polyglot         | Return **all** detected language suites (JS + Python + Go + Rust), each a plan entry. No first-match.                                                        |
| JS monorepo      | A real root `test` script is the orchestrator (turbo/nx/make) → use it; PM-aware (bun/pnpm/yarn/npm). Don't also recurse workspaces.                         |
| Python runner    | `tox.ini`→`tox`; `[tool.pytest.ini_options]`/`pytest.ini`/installed→`pytest` (recurses from root); else `python -m unittest discover`. PM-aware (uv/poetry). |
| Go               | `go.work` → `go test $(go list -f '{{.Dir}}/...' -m \| xargs)`; else `go test ./...`.                                                                        |
| Rust             | nextest configured/installed → `cargo nextest run --workspace` (+ `cargo test --doc`); else `cargo test --workspace`.                                        |
| Nested manifests | Discover via declared workspace members (pnpm/cargo `[workspace]`/go.work) + bounded tree scan — not root-only.                                              |
| Tool absent      | Entry flagged `available:false` → skipped with a **visible** note, never silently dropped.                                                                   |
| Timeout/perf     | Per-suite timeout preserved; stop-hook path keeps a fast-subset preference (extend `test:done` cross-language) + total budget; report partial results.       |

## Acceptance criteria

- [ ] `safeword test-plan --kind test|build --json` returns **all** detected suites for a repo; pure resolver unit-tested with injected availability + fixtures.
- [ ] Polyglot monorepo (JS+Python) runs **both** suites — done-gate cannot go green with a language untested (kills the false green).
- [ ] Python runner detected (pytest vs `tox` vs `unittest`), not hardcoded; Rust uses `--workspace` (+ nextest when present); Go honors `go.work`.
- [ ] Nested/sub-package manifests are discovered (not root-only).
- [ ] `test-runner.ts`, `/verify`, `/audit` all consume `test-plan`; **zero** language command strings duplicated across surfaces.
- [ ] Tool-absent suites are reported as skipped (visible), never silently passed; per-suite timeout + partial-result reporting intact.
- [ ] Done-gate literal-phrase contract preserved; existing 2FVZ26 tests + verify-skill/parity stay green; dogfood parity preserved.

## Known limitations to decide at build (open)

- Fast-subset vs full-suite in the 60s stop-hook budget for large monorepos — needs a cross-language `test:done` convention.
- JS workspace with **no** root test script (per-package only) — run per-package, or require a root script? (lean: require root script v1.)
- Whether `test-plan` only _plans_ (callers execute) or can also _execute_ (`--run`). Lean: plan-only; callers execute so /verify stays transparent and the done-gate sees results.

## Work Log

- 2026-06-16T13:58:31.841Z Started: Created ticket Q4FX8Y
