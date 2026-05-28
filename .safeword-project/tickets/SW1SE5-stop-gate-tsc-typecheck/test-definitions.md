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

> `shouldRunTypecheck` is true iff a root `tsconfig.json` exists AND at least
> one TypeScript file changed this session AND the stop is not the done phase.
> Otherwise the gate skips entirely — no tsc spawn, no output.

### Scenario: TS project with a changed TS file runs the check

Given a project with a root `tsconfig.json`, an implement-phase stop, and one changed `.ts` file
When `shouldRunTypecheck` is evaluated
Then it returns `true`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-TS project skips the check

Given a project with no `tsconfig.json` and a changed `.ts` file at an implement-phase stop
When `shouldRunTypecheck` is evaluated
Then it returns `false`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No TS files changed skips the check

Given a TS project at an implement-phase stop with zero changed TS files this session
When `shouldRunTypecheck` is evaluated
Then it returns `false`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Type errors in changed code are surfaced as advice

> When the check runs, a failing `tsc --noEmit` surfaces its output in the stop
> message; a clean check adds nothing.

### Scenario: A type error appears in the stop output

Given a TS project whose changed `.ts` file has a type error, at an implement-phase stop
When the stop hook runs
Then the stop output contains the tsc error (the offending file path and message)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Clean types add no output

Given a TS project whose changed `.ts` files all type-check, at an implement-phase stop
When the stop hook runs
Then the stop output contains no tsc/type-error advice

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The check is soft — it never blocks the stop

> Surfacing type errors is advisory. The done gate remains the hard backstop.

### Scenario: A type error does not hard-block the implement-phase stop

Given a TS project whose changed `.ts` file has a type error, at an implement-phase stop
When the stop hook runs
Then it does not hard-block (the stop is allowed); the error is surfaced as advice, not a denial

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The check is scoped to non-done stops

> The new behavior lives on the implement (non-done) path. The done path is
> unchanged — it already requires /verify (which typechecks via /lint).

### Scenario: Done-phase stop does not trigger the implement-stop tsc advice

Given a TS project with a changed `.ts` file containing a type error, at a `done`-phase stop
When the stop hook runs
Then the implement-stop tsc-advice path does not fire (the done-phase evidence gate governs instead)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] REFACTOR
