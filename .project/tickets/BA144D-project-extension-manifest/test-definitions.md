# Test Definitions: Let Projects Extend Safeword Guardrails Without Forking Safeword

Feature source: `features/project-extension-manifest.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Extension inventory is explicit and project-owned

### Scenario: Missing or empty extension inventory is a safe no-op

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Populated extension inventory declares every supported extension kind

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Lifecycle commands preserve customer source files

### Scenario: Setup and upgrade refresh adapters without changing extension source files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reset removes extension adapters without deleting extension source files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Supported adapters expose requested extensions

### Scenario: Supported extension mappings expose adapters without copying source content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Upgrade refreshes an existing extension adapter without copying source content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Customer skill extensions appear through the shared skill inventory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Invalid extension manifests fail before an agent depends on them

### Scenario: Check reports a missing extension source path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Check reports duplicate extension names

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Check rejects extension source paths outside customer-owned project files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Check reports unsafe hook declarations before installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsupported agent or event mappings fail without changing customer content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Hooks compose safely across agent surfaces

### Scenario: Setup and upgrade preserve customer hooks while refreshing safeword hooks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Hook extension with explicit safety semantics is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ambiguous or unsafe hook declarations are rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Allowed runtime command is accepted only with a project-local script argument

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
