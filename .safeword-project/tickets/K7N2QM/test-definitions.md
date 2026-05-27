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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Relative override resolves project-root-relative

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with a persona `PO`
And `.safeword-project/personas.md` does not exist
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'valid', match: { code: 'PO', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Absolute override is used verbatim

Given `.safeword/config.json` has `paths.personas` set to an absolute path outside the project tree
And the absolute path points to a file with a persona `PO`
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'valid', match: { code: 'PO', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured-but-missing returns unknown

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` does not exist
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'unknown' }`
And it does not throw

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured file present, input doesn't match any persona

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with personas `PO`, `DEV`
When `validatePersonaReference(cwd, 'NOPE')` is called
Then it returns `{ status: 'unknown' }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Empty-string override falls back to default

Given `.safeword/config.json` has `paths.personas: ""`
And `.safeword-project/personas.md` exists with a persona `PO`
When `validatePersonaReference(cwd, 'PO')` is called
Then it returns `{ status: 'valid', match: { code: 'PO', ... } }`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Override unset and default well-formed produces no personas error

Given `.safeword/config.json` has no `paths.personas` entry
And `.safeword-project/personas.md` exists and parses cleanly
When `safeword check --offline` runs
Then no personas-related issue is reported
And the exit code is 0

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured-but-missing reports loud failure

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` does not exist
When `safeword check --offline` runs
Then output contains `personas-path: docs/personas.md: file not found`
And the exit code is non-zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured file well-formed passes check

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists and parses cleanly
When `safeword check --offline` runs
Then no personas-related issue is reported
And the exit code is 0

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured file malformed reports content errors

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with a malformed persona block
When `safeword check --offline` runs
Then output contains a `personas.md:<line>: <message>` issue
And the exit code is non-zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Legacy default-location file with active override emits advisory

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists and parses cleanly
And `.safeword-project/personas.md` also exists (legacy from prior install)
When `safeword check --offline` runs
Then output contains an advisory naming `.safeword-project/personas.md` as orphaned
And the exit code is 0

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Override set skips default scaffold

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `.safeword-project/personas.md` does not exist
When `safeword setup` runs
Then `.safeword-project/personas.md` does not exist

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Override set leaves pre-existing default file untouched

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `.safeword-project/personas.md` exists with user-authored content
When `safeword setup` runs
Then `.safeword-project/personas.md` retains its original content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: `safeword reset` with override set does not touch the configured-path file

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `docs/personas.md` exists with user-authored content
When `safeword reset` runs
Then `docs/personas.md` retains its original content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: `safeword reset --full` with override set does not remove default-location file

Given `.safeword/config.json` has `paths.personas: "docs/personas.md"`
And `.safeword-project/personas.md` exists with user-authored content
When `safeword reset --full` runs
Then `.safeword-project/personas.md` retains its original content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Config schema is forward-compatible with glossary and architecture keys

> The `paths` slot reserves keys for sibling tickets (YR6C49 glossary,
> M6D315 architecture). Read-site behavior for those keys lands in their
> own tickets; K7N2QM only needs to ensure the schema accepts them.

### Scenario: Config with glossary and architecture keys parses without error

Given `.safeword/config.json` has `paths.glossary: "docs/glossary.md"` and `paths.architecture: "ARCHITECTURE.md"`
When `safeword check --offline` runs
Then the config parses without error
And no schema-validation issue is reported about the `paths` keys

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
