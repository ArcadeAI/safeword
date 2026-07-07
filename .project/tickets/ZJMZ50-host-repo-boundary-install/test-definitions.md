# Test Definitions: Install the boundary gate into host repos (ZJMZ50)

Feature source: `features/host-repo-boundary-install.feature`

test-definitions.md is the R/G/R ledger.

## Rule: host-repo-boundary-install.TB1.R1 — A husky host gains the commit and push shims without losing a byte of its own hook content

### Scenario: Setup appends both shims to existing husky hooks

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

### Scenario: Setup creates a missing hook file beside an existing one

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

### Scenario: Conflicting manager signals do not get a silent shim

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR

## Rule: host-repo-boundary-install.TB1.R2 — Re-running setup or upgrade never duplicates a shim

### Scenario: A second setup run leaves the hooks byte-identical

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

### Scenario: Upgrade over an installed shim adds no duplicate

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

## Rule: host-repo-boundary-install.TB1.R3 — A lefthook or pre-commit host gets an exact integration snippet, never an edited config file

### Scenario: Lefthook host receives a snippet and an untouched config

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR

### Scenario: Pre-commit-framework host receives a snippet and an untouched config

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR

### Scenario: Bare host is pointed at husky without any hook writes

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR

### Scenario: A host with husky merely installed but never initialized is nudged, not shimmed

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR

### Scenario: Pasting the printed snippet quiesces the nudge

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR

## Rule: host-repo-boundary-install.TB1.R4 — The installed shim can never block a commit or push

### Scenario: The emitted shim invokes the boundary gate when the binary is present

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The emitted shim passes when safeword's binary is absent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The emitted shim passes even when the boundary gate crashes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: host-repo-boundary-install.TB1.R5 — safeword reset removes the shims and leaves the host's own hook content intact

### Scenario: Reset restores a pre-existing hook byte-for-byte

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

### Scenario: Reset removes a hook file that setup alone created

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

### Scenario: Reset spares hook lines the user added after setup

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

## Rule: host-repo-boundary-install.SM1.R1 — Shims install, heal, and revert through the same managed-surface machinery, gated on the detected hook-manager world

### Scenario: Upgrade heals a stale shim block in place

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

### Scenario: A deleted shim block returns on upgrade

- [x] RED 57f9669
- [x] GREEN 4374675
- [ ] REFACTOR

## Rule: host-repo-boundary-install.SM1.R2 — A host where the hooks could never fire gets no hook writes

### Scenario: Non-git directory gets no hook writes and no hook nudge

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR

### Scenario: Setup in a monorepo subdirectory plants no dead hooks

- [x] RED a7a0f60
- [x] GREEN 622d680
- [ ] REFACTOR
