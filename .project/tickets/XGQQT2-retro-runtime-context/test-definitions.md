# Test Definitions: Attach useful runtime context to retros without signup

Feature source: `features/retro-runtime-context.feature`

test-definitions.md is the R/G/R ledger.

## Rule: retro-runtime-context.SWM1.R1 — Every project keeps one opaque locally generated identity across installs and upgrades

### Scenario: First install creates distinct project identity locally

- [x] RED skip: first-install identity generation predates this ticket; the two-project setup characterization passed on its first run
- [x] GREEN: setup-convergence acceptance proof passes for distinct lowercase UUIDs with offline setup
- [x] REFACTOR: shared config and UUID helpers keep the lifecycle proof focused

### Scenario: Upgrade creates a missing project identity locally

- [x] RED skip: missing-identity upgrade repair predates this ticket; the setup characterization passed on its first run
- [x] GREEN: setup-convergence acceptance proof passes for a previously installed project with no identity
- [x] REFACTOR skip: the scenario reuses the lifecycle helper without production structure

### Scenario: Project identity survives ordinary lifecycle operations

- [x] RED skip: lifecycle preservation predates this ticket; the repeated-setup characterization passed on its first run
- [x] GREEN: setup-convergence acceptance proof preserves the generated identity on the next setup
- [x] REFACTOR skip: the scenario shares the upgrade fixture

### Scenario: Malformed project identity is replaced locally

- [x] RED skip: malformed-identity repair was already covered by the setup-convergence suite
- [x] GREEN: the existing real-setup repair proof remains green in the six-scenario lifecycle slice
- [x] REFACTOR: the existing scenario now uses the shared config and UUID helpers

### Scenario: Noncanonical uppercase project identity is normalized locally

- [x] RED skip: lowercase normalization predates this ticket; the real-setup characterization passed on its first run
- [x] GREEN: setup-convergence acceptance proof persists the lowercase form
- [x] REFACTOR skip: no production structure was needed

### Scenario: Recreated project identity is not derived from the project path

- [x] RED skip: random regeneration predates this ticket; the same-path characterization passed on its first run
- [x] GREEN: setup-convergence acceptance proof replaces a removed identity with a different lowercase UUID
- [x] REFACTOR skip: the scenario reuses the lifecycle helper without production structure

## Rule: retro-runtime-context.SWM1.R2 — Every harness describes the same bounded runtime concepts through one versioned context contract

### Scenario: Claude Code and Codex use one complete source contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cursor omits signals its harness does not expose

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every supported harness reaches the real collector

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured project identity is the emitted project identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Runtime metadata does not change duplicate identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Duplicate identity changes across its authoritative inputs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cursor conversation identity is the session-scope authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A released v0.79.6 envelope remains byte-identical

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Released local host classification remains accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cursor cannot claim the released-client local classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector preserves released optional-value rules

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector rejects a body above its released byte limit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector accepts a body at its released byte limit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unrecognized source field is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector rejects an invalid envelope version

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector rejects malformed allowlisted source values

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector rejects omitted required source fields

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector rejects source vocabulary outside the local contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector preserves first-writer bytes for a duplicate session scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A current envelope round-trips through the real collector

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-runtime-context.TBU1.R1 — Runtime context contains only explicitly allowlisted facts and never transcript, source, machine, or arbitrary environment content

### Scenario: Available approved facts form the complete current source profile

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Representative direct optional string boundaries are enforced independently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Derived optional string boundaries are enforced on authoritative inputs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Supported repository remotes are canonicalized without credentials

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A supported non-GitHub remote preserves its public host and path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsupported repository identity is omitted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable optional context produces a minimal source

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Git email is not public runtime context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: retro-runtime-context.NTB1.R1 — Context discovery never disrupts the user or existing recovery

### Scenario: Invalid configured project identity keeps existing recovery behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Context discovery failure cannot disrupt retro delivery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One enrichment failure preserves the other optional context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Disabled Cursor public retros do not disclose runtime context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A runtime without a runnable public carrier keeps existing recovery behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Claude Remote evidence keeps existing recovery behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Claude Remote evidence does not suppress other harnesses

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing Cursor conversation identity keeps existing recovery behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Collector rejection keeps existing recovery behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Collector transport failure keeps existing recovery behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
