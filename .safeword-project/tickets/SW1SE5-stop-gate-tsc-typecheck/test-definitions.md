# SW1SE5 — Test Definitions

Behavior for the implement-phase-stop incremental `tsc` check. Derived from
`dimensions.md`. Each scenario is Atomic / Observable / Deterministic /
Independent (AODI).

Function shapes (firm up in decomposition):

- `shouldRunTypecheck({ projectDir, changedTsFiles, phase })` → `boolean` — pure
  gate (tsconfig present AND ≥1 changed TS file AND phase ≠ done). Unit-testable.
- `runIncrementalTypecheck(projectDir)` → `{ ok: boolean; output: string }` —
  spawns `tsc --noEmit --incremental`; I/O, integration-tested.
- stop-quality wiring composes them: when `shouldRunTypecheck`, run the check
  and surface `output` as advice on the non-done stop path (never hard-block).

## Rule: The check runs only for TS projects with changed TS files

> `shouldRunTypecheck` is true iff a `tsconfig.json` exists at or above at
> least one changed TypeScript file (find-up; root OR a package dir, so
> monorepos work) AND the stop is not the done phase. "TypeScript file" means
> `.ts` / `.tsx` / `.mts` / `.cts`. Otherwise the gate skips entirely — no
> tsc spawn, no output.

### Scenario: Changed TS file with a tsconfig above it runs the check

Given a project with a root `tsconfig.json`, an implement-phase stop, and one changed `.ts` file
When `shouldRunTypecheck` is evaluated
Then it returns `true` with that tsconfig path

- [x] RED 4fa3a94b
- [x] GREEN 4fa3a94b
- [x] REFACTOR skip: pure decision logic with small focused functions; nothing to extract

### Scenario: Non-TS project (no tsconfig anywhere) skips the check

Given a project with no `tsconfig.json` at any level above the changed `.ts` file, at an implement-phase stop
When `shouldRunTypecheck` is evaluated
Then it returns `false`

- [x] RED 4fa3a94b
- [x] GREEN 4fa3a94b
- [x] REFACTOR skip: pure decision logic with small focused functions; nothing to extract

### Scenario: No TS files changed skips the check

Given a TS project at an implement-phase stop with zero changed TS files this session
When `shouldRunTypecheck` is evaluated
Then it returns `false`

- [x] RED 4fa3a94b
- [x] GREEN 4fa3a94b
- [x] REFACTOR skip: pure decision logic with small focused functions; nothing to extract

### Scenario: Monorepo — package-level tsconfig (no root tsconfig) is found via find-up

Given a project with NO root `tsconfig.json` but `packages/cli/tsconfig.json` exists, a changed file `packages/cli/src/foo.ts`, and an implement-phase stop
When `shouldRunTypecheck` is evaluated
Then it returns `true` with the `packages/cli/tsconfig.json` path (find-up resolves from the changed file's directory)

- [x] RED 4fa3a94b
- [x] GREEN 4fa3a94b
- [x] REFACTOR skip: pure decision logic with small focused functions; nothing to extract

### Scenario: `.tsx` / `.mts` / `.cts` count as TypeScript files

Given a project with a `tsconfig.json` and changed files `App.tsx`, `node.mts`, `legacy.cts` (no `.ts` changed), at an implement-phase stop
When `shouldRunTypecheck` is evaluated
Then it returns `true`

- [x] RED 4fa3a94b
- [x] GREEN 4fa3a94b
- [x] REFACTOR skip: pure decision logic with small focused functions; nothing to extract

## Rule: Type errors in changed code are surfaced as advice

> When the check runs, a failing `tsc --noEmit` surfaces its output in the stop
> message; a clean check adds nothing.

### Scenario: A type error appears in the stop output

Given a TS project whose changed `.ts` file has a type error, at an implement-phase stop
When the stop hook runs
Then the stop output contains the tsc error (the offending file path and message)

- [x] RED 97a5497c
- [x] GREEN b5dc92b5
- [x] REFACTOR skip: surfacing logic composed behind a runner seam; nothing to extract

### Scenario: Clean types add no output

Given a TS project whose changed `.ts` files all type-check, at an implement-phase stop
When the stop hook runs
Then the stop output contains no tsc/type-error advice

- [x] RED 97a5497c
- [x] GREEN b5dc92b5
- [x] REFACTOR skip: clean-path returns null advice; no code to refactor

## Rule: The check is soft — it never blocks the stop

> Surfacing type errors is advisory. The done gate remains the hard backstop.

### Scenario: A type error does not hard-block the implement-phase stop

Given a TS project whose changed `.ts` file has a type error, at an implement-phase stop
When the stop hook runs
Then it does not hard-block (the stop is allowed); the error is surfaced as advice, not a denial

- [x] RED 69302789
- [x] GREEN b5dc92b5
- [x] REFACTOR skip: reuses the existing softBlock path; no new structure

## Rule: The check is scoped to non-done stops

> The new behavior lives on the implement (non-done) path. The done path is
> unchanged — it already requires /verify (which typechecks via /lint).

### Scenario: Done-phase stop does not trigger the implement-stop tsc advice

Given a TS project with a changed `.ts` file containing a type error, at a `done`-phase stop
When the stop hook runs
Then the implement-stop tsc-advice path does not fire (the done-phase evidence gate governs instead)

- [x] RED 97a5497c
- [x] GREEN b5dc92b5
- [x] REFACTOR skip: done-phase suppression is the gate's phase guard; no new code

## Feature-level cross-scenario refactor

- [x] REFACTOR skip: gate decision kept pure behind a `TypecheckRunner` seam (DI-tested), runner + git-diff source each one focused function, wiring is a thin compose-and-softBlock; no cross-scenario duplication to extract
