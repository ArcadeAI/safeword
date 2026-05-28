# YR6C49 — Technical Decomposition

Six tasks, sequenced for incremental delivery. Tasks 2 and 4 can run in
parallel after Task 1. All 30 scenarios from `test-definitions.md` are
allocated.

## Component map

| Component                 | File(s)                                                                                                                         | Role                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Parser + validator**    | `packages/cli/src/utils/glossary.ts` (new)                                                                                      | Pure parse / resolve / validate; mirrors `personas.ts` parse/resolve/validate split                              |
| **Lookup API**            | `packages/cli/src/utils/glossary.ts` (same file, extends)                                                                       | `lookupGlossaryReference` (pure) + `validateGlossaryReference(cwd, input)` (uses K7N2QM `resolveConfiguredPath`) |
| **Template**              | `packages/cli/templates/glossary-template.md` (new)                                                                             | Canonical scaffold with required-Definition + commented rich example                                             |
| **Schema + scaffold**     | `packages/cli/src/schema.ts`, `packages/cli/src/reconcile.ts` (existing — adds `configKey: 'glossary'` entry to `managedFiles`) | Register glossary.md as managed-but-user-owned with the configKey gate; setup scaffolds from template            |
| **Check command**         | `packages/cli/src/commands/check.ts`                                                                                            | Structural error reporting; configured-but-missing loud failure; legacy-default advisory                         |
| **Arcade fixture**        | `packages/cli/tests/integration/arcade-glossary.test.ts` (new)                                                                  | Snapshot arcade's `.project/glossary.md` into the test tree; assert parses with zero errors                      |
| **DISCOVERY.md sub-step** | `.claude/skills/bdd/DISCOVERY.md` + canonical `packages/cli/templates/skills/bdd/DISCOVERY.md`                                  | "Load project glossary" block parallel to existing "Load project personas"                                       |

## Task breakdown

| Task                                                 | Scenarios                                                | Test type                                      | Files                                                                                                                                                 | Depends on |
| ---------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **1. Parser core (entry shapes + skip-mask)**        | R1.1, R1.2, R1.3, R1.4, R1.5, R2.1, R2.2, R2.3 (8)       | unit                                           | `utils/glossary.ts` (new); test file `utils/glossary.test.ts`                                                                                         | —          |
| **2. Structural validator**                          | R3.1, R3.2, R3.3, R3.4, R3.5 (5)                         | unit                                           | `utils/glossary.ts` (extends)                                                                                                                         | Task 1     |
| **3. Lookup API + configured-path wiring**           | R4.1, R4.2, R4.3, R4.4, R4.5, R7.1, R7.2, R7.3, R7.4 (9) | unit (lookup) + I/O (path resolution)          | `utils/glossary.ts` (extends), reuses `utils/configured-paths.ts` helper                                                                              | Tasks 1, 2 |
| **4. Template + scaffold + schema `configKey` gate** | R5.1, R5.2, R5.3 (3)                                     | integration (setup) + unit (reconcile plan)    | `templates/glossary-template.md` (new); `schema.ts` (add `managedFiles` entry with `configKey: 'glossary'`); reconcile gate inherits K7N2QM mechanism | Task 1     |
| **5. `safeword check` integration**                  | R6.1, R6.2, R6.3 (3)                                     | integration                                    | `commands/check.ts`                                                                                                                                   | Tasks 2, 4 |
| **6. KD4BYF arcade fixture + DISCOVERY.md sub-step** | R8.1, R8.2 (2)                                           | integration (parse) + doc-presence (DISCOVERY) | `tests/integration/arcade-glossary.test.ts` (new); `.claude/skills/bdd/DISCOVERY.md`; `templates/skills/bdd/DISCOVERY.md`                             | Tasks 1–5  |

Total: 30 scenarios, 6 tasks. Tasks 2 and 4 are independent after Task 1.

## Test-layer rationale

- **Task 1 (parser)** — pure functions over string input; unit tests with
  inline-string fixtures cover all 8 partitions cheaply. Mirrors
  [personas.test.ts](packages/cli/src/utils/personas.test.ts) shape — same
  helper names (`parseX`, `computeSkipMask`, `stripInlineComments`).
- **Task 2 (validator)** — pure function over `ParsedGlossaryEntry[]`;
  unit tests with constructed input. No I/O.
- **Task 3 (lookup + path)** — split: `lookupGlossaryReference` is pure
  (unit-tested with constructed term list); `validateGlossaryReference`
  goes through `resolveConfiguredPath` and `readFileSync` (I/O-tested
  with temp dir + `.safeword/config.json` fixture). Same pattern as
  K7N2QM Task 2.
- **Task 4 (scaffold + configKey)** — split: `planManagedFilesActions`
  unit-tested to verify the gate; `safeword setup` integration-tested
  end-to-end via temp project. Integration is necessary because R5
  asserts file presence/absence on disk after a command run.
- **Task 5 (check)** — integration tests at the `runCheck` level,
  matching the pattern at `packages/cli/tests/commands/check.test.ts`.
  Scenarios assert exit codes + stderr content, which only the command
  surface exposes.
- **Task 6 (arcade + DISCOVERY)** — split: arcade fixture is an
  integration test (snapshot arcade's actual `.project/glossary.md` into
  `tests/fixtures/`, parse + validate, assert zero errors); DISCOVERY
  sub-step is a doc-presence test (read both on-disk and canonical
  template, regex-assert structural parallel to the persona block).

## Implementation notes

- **Task 1** ships `parseGlossary`, `parseGlossaryHeader`,
  `stripInlineComments`, `computeSkipMask` — most can be lifted nearly
  verbatim from `personas.ts` with minor adjustments (field names,
  no auto-derived codes). Resist over-extracting a shared parser
  utility until a third consumer exists (architecture.md in M6D315
  would be the trigger).
- **Task 2** semantics decisions (from Phase 4 adversarial pass):
  - **Repeated `**Definition:**` within one entry** — first-wins.
    Rationale: matches how persona `**Role:**` would behave (only
    the first wins via `current.hasRole = true`); simpler; surprising
    repeated authoring is more likely a copy-paste mistake than
    intentional override.
  - **Alias pointing to another term's canonical name** (Tool aliases
    "Foo"; Bar has canonical "Foo") — treat as duplicate-alias error
    (R3.3 semantics). Rationale: from the resolver's perspective the
    string "Foo" must resolve to exactly one term; ambiguity is the
    bug, regardless of whether the collision is alias-vs-alias or
    alias-vs-canonical.
- **Task 3** mirrors K7N2QM personas wiring at
  [personas.ts:449-463](packages/cli/src/utils/personas.ts:449). New
  constant `GLOSSARY_FILE_SUBPATH = ['.safeword-project', 'glossary.md']`
  - `resolveConfiguredPath(cwd, 'glossary', nodePath.join(...))`. The
    read API contract is identical: return `{ status: 'unknown' }` on any
    missing-file case, never throw.
- **Task 4 schema entry** mirrors the existing personas entry with
  `configKey: 'glossary'` (the K7N2QM R3.2 mechanism). Template
  reference points at `templates/glossary-template.md`.
- **Task 5 advisory** uses the same zero-exit advisory path established
  by K7N2QM R2.6 (`commands/check.ts` legacy-default-file advisory).
  Reuse the same emit helper if one exists; if not, the K7N2QM commit
  43e72691 / f5572097 patterns show the inline shape.
- **Task 6 DISCOVERY block** must edit BOTH the dogfood file
  (`.claude/skills/bdd/DISCOVERY.md`) AND the canonical template
  (`packages/cli/templates/skills/bdd/DISCOVERY.md`) — pre-commit
  hook enforces canonical-first discipline. The R8.2 scenario asserts
  parallel structure in both.

## Out of scope for these tasks

- Glossary use during agent intake (i.e., the agent actually invoking
  `validateGlossaryReference` during scope drafting) — this is a Phase 0
  prompt-engineering concern, not a code-shipped behavior. R8.2 asserts
  the DISCOVERY.md docs the loading step; observation of the agent
  actually using it is dogfood, not test surface.
- New-term prose extraction (lint-style) — explicitly out-of-scope per
  ticket (FSE 2025 suppression evidence; deferred to spec.md era).
- Arcade-side migration / decommission of arcade's local glossary
  validator — KD4BYF owns that work; this ticket only delivers the
  canonical reader arcade will adopt.
- Per-ticket vocabulary section — deferred to Y2HCNJ spec.md.
- Migrating existing default-location glossary files when override is
  configured — data-loss risk; user owns cleanup; `safeword check`
  advisory is the right surface (K7N2QM-inherited contract).
