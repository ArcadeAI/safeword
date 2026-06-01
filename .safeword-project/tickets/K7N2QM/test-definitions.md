# K7N2QM — Test Definitions

Behavior specifications for configurable file paths
(personas/glossary/architecture). Derived from `dimensions.md`. Each
scenario is Atomic / Observable / Deterministic / Independent (AODI).

## Rule: Read API resolves persona references via configured path

> The read API (`validatePersonaReference`) is cheap and side-effect-free:
> resolves to the configured override when set, falls back to the default
> location otherwise, and returns `{ status: 'unknown' }` on any
> missing-file case (configured or default). Loud failure on
> configured-but-missing lives at `safeword check`, not here.

### Scenario: Override unset reads default location

Given `.safeword/config.json` has no `paths.personas` entry
And `.safeword-project/personas.md` exists with a persona `PO`
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'valid', match: { code: 'PO', ... } }`

- [x] RED skip: regression already covered by personas-ref.test.ts:34 ("returns valid match when personas.md has the code") — same Given/When/Then; would duplicate
- [x] GREEN skip: same coverage as above; full-suite run at R1.2 GREEN (05313409) confirms the fallback path through the new helper still works
- [x] REFACTOR skip: no new code to refactor

### Scenario: Relative override resolves project-root-relative

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with a persona `PO`
And `.safeword-project/personas.md` does not exist
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'valid', match: { code: 'PO', ... } }`

- [x] RED 9f07ed8c
- [x] GREEN 05313409
- [x] REFACTOR skip: helper is the minimal viable shape; no duplication or unclear naming yet

### Scenario: Absolute override is used verbatim

Given `.safeword/config.json` has `paths.personas` set to an absolute path outside the project tree
And the absolute path points to a file with a persona `PO`
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'valid', match: { code: 'PO', ... } }`

- [x] RED skip: helper's isAbsolute branch shipped in R1.2 GREEN (05313409) — pre-emptive impl
- [x] GREEN f84dee1a
- [x] REFACTOR skip: no new code path

### Scenario: Configured-but-missing returns unknown

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` does not exist
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'unknown' }`
And it does not throw

- [x] RED skip: helper's try/catch path shipped in R1.2 GREEN (05313409)
- [x] GREEN 45598ff9
- [x] REFACTOR skip: no new code path

### Scenario: Configured file present, input doesn't match any persona

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with personas `PO`, `DEV`
When `validatePersonaReference(cwd, 'NOPE')` is called
Then it returns `{ status: 'unknown' }`

- [x] RED skip: lookup-unknown branch is existing personas.ts behavior (ticket 7YN5QB)
- [x] GREEN 45598ff9
- [x] REFACTOR skip: no new code path

### Scenario: Empty-string override falls back to default

Given `.safeword/config.json` has `paths.personas: ""`
And `.safeword-project/personas.md` exists with a persona `PO`
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'valid', match: { code: 'PO', ... } }`

- [x] RED skip: helper's empty-string defensive guard shipped in R1.2 GREEN (05313409)
- [x] GREEN 45598ff9
- [x] REFACTOR skip: no new code path

## Rule: `safeword check` validates the configured persona file loudly

> The diagnostic surface owns ambiguity reporting. Missing-configured-file
> is a loud failure (non-zero exit) because the user opted in and a typo
> would otherwise silently strand persona references. Legacy-file-when-
> override-set is a zero-exit advisory because the file is harmless to
> safeword's operation — just dead weight.

### Scenario: Override unset and default absent produces no personas error

Given `.safeword/config.json` has no `paths.personas` entry
And `.safeword-project/personas.md` does not exist
When `safeword check --offline` runs
Then no personas-related issue is reported
And the exit code is 0

- [x] RED skip: regression covered by check.test.ts:251 ("treats missing personas.md as absent (no error)") — same Given/When/Then
- [x] GREEN skip: full-suite run at R2.3 GREEN (f4a725d3) confirms unchanged fallback behavior
- [x] REFACTOR skip: no new code

### Scenario: Override unset and default well-formed produces no personas error

Given `.safeword/config.json` has no `paths.personas` entry
And `.safeword-project/personas.md` exists and parses cleanly
When `safeword check --offline` runs
Then no personas-related issue is reported
And the exit code is 0

- [x] RED skip: regression covered by check.test.ts:223 ("passes when personas.md is well-formed")
- [x] GREEN skip: full-suite run at R2.3 GREEN (f4a725d3) confirms unchanged fallback behavior
- [x] REFACTOR skip: no new code

### Scenario: Configured-but-missing reports loud failure

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` does not exist
When `safeword check --offline` runs
Then output contains `personas-path: docs/personas.md: file not found`
And the exit code is non-zero

- [x] RED 2015fc16
- [x] GREEN f4a725d3
- [x] REFACTOR skip: findPersonaIssues now has two branches (override-missing loud / default-missing quiet) — minimal & explicit

### Scenario: Configured file well-formed passes check

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists and parses cleanly
When `safeword check --offline` runs
Then no personas-related issue is reported
And the exit code is 0

- [x] RED skip: findPersonaIssues from R2.3 GREEN (f4a725d3) routes through resolveConfiguredPath; well-formed file goes through existing validator
- [x] GREEN f5572097
- [x] REFACTOR skip: no new code path

### Scenario: Configured file malformed reports content errors

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with a malformed persona block
When `safeword check --offline` runs
Then output contains a `personas.md:<line>: <message>` issue
And the exit code is non-zero

- [x] RED skip: existing persona validator runs regardless of file location (routed via resolveConfiguredPath in R2.3 GREEN f4a725d3)
- [x] GREEN f5572097
- [x] REFACTOR skip: no new code path

### Scenario: Legacy default-location file with active override emits advisory

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists and parses cleanly
And `.safeword-project/personas.md` also exists (legacy from prior install)
When `safeword check --offline` runs
Then output contains an advisory naming `.safeword-project/personas.md` as orphaned
And the exit code is 0

- [x] RED e72e8442
- [x] GREEN f5572097
- [x] REFACTOR skip: findPersonaAdvisories is minimal; advisories field on HealthStatus is the cleanest separation from issues

## Rule: Reconcile skips default scaffold when persona override is configured

> `configKey` on `managedFiles` entries suppresses the entry uniformly —
> setup skips creation, `reset --full` skips removal. Result: one
> personas.md per project, where the user named it. The default location
> is "not safeword's concern" when an override is active. Never deletes
> user-authored content (data-loss principle).

### Scenario: Override unset scaffolds default from template

Given `.safeword/config.json` has no `paths.personas` entry
And `.safeword-project/personas.md` does not exist
When `safeword setup` runs
Then `.safeword-project/personas.md` exists with the personas-template content

- [x] RED skip: regression covered by reconcile.test.ts:188 ("should create managed files when missing") — same Given/When/Then
- [x] GREEN skip: full-suite run at R3.2 GREEN (78f32531) confirms unchanged fallback behavior
- [x] REFACTOR skip: no new code

### Scenario: Override set skips default scaffold

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `.safeword-project/personas.md` does not exist
When `safeword setup` runs
Then `.safeword-project/personas.md` does not exist

- [x] RED 4040f8ac
- [x] GREEN 78f32531
- [x] REFACTOR skip: isConfigOverridden helper is minimal; configKey field placement on FileDefinition extension is the cleanest insertion point

### Scenario: Override set leaves pre-existing default file untouched

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `.safeword-project/personas.md` exists with user-authored content
When `safeword setup` runs
Then `.safeword-project/personas.md` retains its original content

- [x] RED skip: configKey gate from R3.2 GREEN (78f32531) suppresses the entry entirely — pre-existing file is never even considered for write
- [x] GREEN 21a30622
- [x] REFACTOR skip: same gate path

### Scenario: `safeword reset` with override set does not touch the configured-path file

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with user-authored content
When `safeword reset` runs
Then `docs/personas.md` retains its original content

- [x] RED skip: configured path is never in managedFiles (plain reset only acts on managed entries) — guarantee test only
- [x] GREEN 21a30622
- [x] REFACTOR skip: no code path

### Scenario: `safeword reset --full` with override set does not remove default-location file

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `.safeword-project/personas.md` exists with user-authored content
When `safeword reset --full` runs
Then `.safeword-project/personas.md` retains its original content

- [x] RED skip: uninstall-full gate shipped in R3.2 GREEN (78f32531) — covered by the same configKey check
- [x] GREEN 21a30622
- [x] REFACTOR skip: gate path is minimal

## Rule: Config schema is forward-compatible with glossary and architecture keys

> The `paths` slot reserves keys for sibling tickets (YR6C49 glossary,
> M6D315 architecture). Read-site behavior for those keys lands in their
> own tickets; K7N2QM only needs to ensure the schema accepts them.

### Scenario: Config with glossary and architecture keys parses without error

Given `.safeword/config.json` has `paths.glossary: "docs/glossary.md"` and `paths.architecture: "ARCHITECTURE.md"`
When `safeword check --offline` runs
Then the config parses without error
And no schema-validation issue is reported about the `paths` keys

- [x] RED skip: ConfiguredPathKey type union already includes glossary and architecture (R1.2 GREEN 05313409); JSON.parse accepts any keys
- [x] GREEN f5572097
- [x] REFACTOR skip: no new code path

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: surveyed all five touched files (configured-paths.ts, personas.ts, schema.ts, reconcile.ts, check.ts) after R2.6 GREEN — no duplication worth extracting, no naming drift, no excessive length. `findPersonaIssues` and `findPersonaAdvisories` both call `readConfiguredPath` but that's two calls in one file, not a real DRY violation. `isConfigOverridden` in reconcile.ts wraps the same call but exposes a different intent (boolean check vs raw read), and the wrapper is local to one consumer. Leave as-is.
