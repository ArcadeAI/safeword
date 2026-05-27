# K7N2QM — Technical Decomposition

Five tasks, sequenced for incremental delivery. Tasks 2 and 3 can run in
parallel after Task 1. All 18 scenarios from `test-definitions.md` are
allocated.

## Component map

| Component              | File(s)                                                       | Role                                                                                                |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Config helper**      | `packages/cli/src/utils/configured-paths.ts` (new)            | Reads `.safeword/config.json`, exposes `resolveConfiguredPath(cwd, key, defaultPath)`               |
| **Read API**           | `packages/cli/src/utils/personas.ts`                          | `validatePersonaReference` routes through the helper                                                |
| **Schema + reconcile** | `packages/cli/src/schema.ts`, `packages/cli/src/reconcile.ts` | Add optional `configKey` to `ManagedFileDefinition`; suppress entry when `paths.<configKey>` is set |
| **Check command**      | `packages/cli/src/commands/check.ts`                          | Loud failure on configured-but-missing; advisory on legacy-default file                             |
| **Docs**               | `README.md`, setup docs                                       | Worked example of `paths` block                                                                     |

## Task breakdown

| Task                                              | Scenarios     | Test type                                 | Files                                                                          | Depends on |
| ------------------------------------------------- | ------------- | ----------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| **1. Config helper + `paths` schema slot**        | R4.1 (1)      | unit                                      | `utils/configured-paths.ts` (new); type extension on safeword config interface | —          |
| **2. Read-API refactor (personas)**               | R1.1–R1.6 (6) | unit + I/O                                | `utils/personas.ts`                                                            | Task 1     |
| **3. Schema `configKey` + reconcile suppression** | R3.1–R3.5 (5) | unit on plan + integration on setup/reset | `schema.ts`, `reconcile.ts`                                                    | Task 1     |
| **4. Check command integration**                  | R2.1–R2.6 (6) | integration                               | `commands/check.ts`                                                            | Tasks 1, 3 |
| **5. Docs**                                       | —             | manual review                             | `README.md`, setup docs                                                        | Tasks 1–4  |

Total: 18 scenarios, 5 tasks. Tasks 2 and 3 are independent after Task 1.

## Test-layer rationale

- **Task 1 (helper)** — pure read-side function with branching on config
  state and path style; unit tests with temp dirs cover all partitions
  cheaply. R4.1 (forward-compat schema acceptance) attaches here because
  it tests the config interface, not a behavior.
- **Task 2 (read API)** — `validatePersonaReference` is already covered
  by 71 existing tests; new scenarios extend that file (`personas-ref.test.ts`).
  Unit-layer because no command-line surface is involved.
- **Task 3 (reconcile)** — split: unit tests on `planManagedFilesActions`
  output verify the gate; integration tests on `safeword setup` / `safeword reset --full`
  verify end-to-end disk state. Integration is necessary because the
  scenarios assert file presence/absence on disk after a command run.
- **Task 4 (check)** — integration tests at the `runCheck` level, matching
  the pattern at `packages/cli/tests/commands/check.test.ts:182`. The
  scenarios assert exit codes + stdout content, which only the command
  surface exposes.
- **Task 5 (docs)** — no automated tests; covered by README review and
  the setup-output mention.

## Implementation notes

- **Task 1** ships the `configKey` type field on `ManagedFileDefinition`
  too (forward-declaration), so Task 3 doesn't need to re-touch the
  schema model. The helper reads from `.safeword/config.json` once per
  call (no caching for v1 — same pattern as `packs/config.ts:19`).
- **Task 3's reconcile gate** must apply uniformly to both
  `planManagedFilesActions` (line 427 — create-if-missing path) and the
  `uninstall-full` branch (line 561) — that's the consistency guarantee
  R3.5 pins.
- **Task 4's advisory** is the only zero-exit issue type in
  `safeword check`. The existing pattern emits issues that all gate
  non-zero exit; advisory needs a separate code path or an
  `severity: 'advisory'` field on the issue type. Lean: minimal
  divergence — emit the advisory line and skip adding it to the
  non-zero-exit issue list.

## Out of scope for these tasks

- Glossary and architecture read sites (sibling tickets YR6C49 / M6D315).
- Migrating any existing project data (user's responsibility per ticket scope).
- Config-validator strictness (non-string `paths` values, unknown keys) —
  schema validation handles defensively at runtime; explicit validator
  rules are a separate concern.
