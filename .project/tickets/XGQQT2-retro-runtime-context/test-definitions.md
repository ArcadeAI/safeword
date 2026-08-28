# Test Definitions: Attach useful runtime context to retros without signup

Feature source: `features/retro-runtime-context.feature`

test-definitions.md is the R/G/R ledger.

## Rule: retro-runtime-context.SWM1.R1 — Every project keeps one opaque locally generated identity across installs and upgrades

### Scenario: First install creates distinct project identity locally

- [x] RED skip: first-install identity generation predates this ticket; the two-project setup characterization passed on its first run
- [x] GREEN abced4588
- [x] REFACTOR skip: the scenario reuses the lifecycle helper without production structure

### Scenario: Upgrade creates a missing project identity locally

- [x] RED skip: missing-identity upgrade repair predates this ticket; the setup characterization passed on its first run
- [x] GREEN abced4588
- [x] REFACTOR skip: the scenario reuses the lifecycle helper without production structure

### Scenario: Project identity survives ordinary lifecycle operations

- [x] RED skip: lifecycle preservation predates this ticket; the repeated-setup characterization passed on its first run
- [x] GREEN abced4588
- [x] REFACTOR skip: the scenario shares the upgrade fixture

### Scenario: Malformed project identity is replaced locally

- [x] RED skip: malformed-identity repair was already covered by the setup-convergence suite
- [x] GREEN abced4588
- [x] REFACTOR skip: malformed repair required no new production structure

### Scenario: Noncanonical uppercase project identity is normalized locally

- [x] RED skip: lowercase normalization predates this ticket; the real-setup characterization passed on its first run
- [x] GREEN abced4588
- [x] REFACTOR skip: no production structure was needed

### Scenario: Recreated project identity is not derived from the project path

- [x] RED skip: random regeneration predates this ticket; the same-path characterization passed on its first run
- [x] GREEN abced4588
- [x] REFACTOR skip: the scenario reuses the lifecycle helper without production structure

## Rule: retro-runtime-context.SWM1.R2 — Every harness describes the same bounded runtime concepts through one versioned context contract

### Scenario: Claude Code and Codex use one complete source contract

- [x] RED 4c877857e
- [x] GREEN cf6bd64c0
- [x] REFACTOR skip: one closed source builder serves both harnesses

### Scenario: Cursor omits signals its harness does not expose

- [x] RED 4c877857e
- [x] GREEN cf6bd64c0
- [x] REFACTOR skip: Cursor reuses the source builder and intentionally supplies no speculative optionals

### Scenario: Every supported harness reaches the real collector

- [x] RED ffa7ff5a5
- [x] GREEN 4237f8d64
- [x] REFACTOR 3ae64e4df

### Scenario: Configured project identity is the emitted project identity

- [x] RED skip: configured UUID emission was characterized through the existing source builder
- [x] GREEN c4e5d46d6
- [x] REFACTOR ecb424e22

### Scenario: Runtime metadata does not change duplicate identity

- [x] RED skip: session-scope derivation already excluded optional metadata
- [x] GREEN 1f63adbf0
- [x] REFACTOR skip: the existing scope function remained unchanged

### Scenario: Duplicate identity changes across its authoritative inputs

- [x] RED skip: the released scope function already included harness, project UUID, and session identity
- [x] GREEN 1f63adbf0
- [x] REFACTOR skip: no new duplicate authority was introduced

### Scenario: Cursor conversation identity is the session-scope authority

- [x] RED skip: the same-session row passed when the distinct-session characterization was added
- [x] GREEN 1f63adbf0
- [x] REFACTOR skip: the real lifecycle test reuses one Cursor runner

### Scenario: A released v0.79.6 envelope remains byte-identical

- [x] RED skip: the released byte fixture remained green before implementation
- [x] GREEN 86fa70c08
- [x] REFACTOR skip: canonical serialization order and bytes were left unchanged

### Scenario: Released local host classification remains accepted

- [x] RED ffa7ff5a5
- [x] GREEN 4237f8d64
- [x] REFACTOR c2c070fb5

### Scenario: Cursor cannot claim the released-client local classification

- [x] RED ffa7ff5a5
- [x] GREEN 4237f8d64
- [x] REFACTOR c2c070fb5

### Scenario: The collector preserves released optional-value rules

- [x] RED skip: released collector optional-value acceptance was unchanged
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: legacy validation remained isolated from current producer hygiene

### Scenario: The collector rejects a body above its released byte limit

- [x] RED skip: the released 65,536-byte collector wall already rejected this fixture
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: no body-limit implementation changed

### Scenario: The collector accepts a body at its released byte limit

- [x] RED skip: the released 65,536-byte boundary already accepted this fixture
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: no body-limit implementation changed

### Scenario: An unrecognized source field is refused

- [x] RED skip: closed-field rejection predates this ticket
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: the source-field authority remained closed

### Scenario: The collector rejects an invalid envelope version

- [x] RED skip: version rejection predates this ticket
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: the v1 version wall remained unchanged

### Scenario: The collector rejects malformed allowlisted source values

- [x] RED ffa7ff5a5
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: existing field validators were extended only for the source matrix

### Scenario: The collector rejects omitted required source fields

- [x] RED ffa7ff5a5
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: required-field validation remained centralized

### Scenario: The collector rejects source vocabulary outside the local contract

- [x] RED ffa7ff5a5
- [x] GREEN 4237f8d64
- [x] REFACTOR skip: one explicit harness/host matrix owns the vocabulary

### Scenario: The collector preserves first-writer bytes for a duplicate session scope

- [x] RED skip: first-writer raw-byte preservation predates this ticket
- [x] GREEN c2c070fb5
- [x] REFACTOR skip: SQLite dedupe and raw-body authority were untouched

### Scenario: A current envelope round-trips through the real collector

- [x] RED 653461c3f
- [x] GREEN 86fa70c08
- [x] REFACTOR c2c070fb5

## Rule: retro-runtime-context.TBU1.R1 — Runtime context contains only explicitly allowlisted facts and never transcript, source, machine, or arbitrary environment content

### Scenario: Available approved facts form the complete current source profile

- [x] RED c4e5d46d6
- [x] GREEN ecb424e22
- [x] REFACTOR 86fa70c08

### Scenario: Representative direct optional string boundaries are enforced independently

- [x] RED 653461c3f
- [x] GREEN 86fa70c08
- [x] REFACTOR skip: one optional-value normalizer serves every direct field

### Scenario: Derived optional string boundaries are enforced on authoritative inputs

- [x] RED 653461c3f
- [x] GREEN 86fa70c08
- [x] REFACTOR skip: derived values cross the same optional-value boundary

### Scenario: Supported repository remotes are canonicalized without credentials

- [x] RED c4e5d46d6
- [x] GREEN ecb424e22
- [x] REFACTOR skip: one credential-stripping remote parser serves both supported forms

### Scenario: A supported non-GitHub remote preserves its public host and path

- [x] RED c4e5d46d6
- [x] GREEN ecb424e22
- [x] REFACTOR skip: the same allowlist preserves GitLab path case

### Scenario: Unsupported repository identity is omitted

- [x] RED c4e5d46d6
- [x] GREEN ecb424e22
- [x] REFACTOR skip: unsupported hosts and local paths share one omission branch

### Scenario: Unavailable optional context produces a minimal source

- [x] RED 653461c3f
- [x] GREEN 86fa70c08
- [x] REFACTOR skip: the closed builder omits invalid optionals independently

### Scenario: Git email is not public runtime context

- [x] RED c4e5d46d6
- [x] GREEN ecb424e22
- [x] REFACTOR skip: Git email collection was removed rather than hardened

## Rule: retro-runtime-context.NTB1.R1 — Context discovery never disrupts the user or existing recovery

### Scenario: Invalid configured project identity keeps existing recovery behavior

- [x] RED skip: invalid project configuration already produced no public source
- [x] GREEN c4e5d46d6
- [x] REFACTOR skip: recovery composition remained unchanged

### Scenario: Context discovery failure cannot disrupt retro delivery

- [x] RED c4e5d46d6
- [x] GREEN ecb424e22
- [x] REFACTOR 86fa70c08

### Scenario: One enrichment failure preserves the other optional context

- [x] RED c4e5d46d6
- [x] GREEN ecb424e22
- [x] REFACTOR 86fa70c08

### Scenario: Disabled Cursor public retros do not disclose runtime context

- [x] RED ba9956ce4
- [x] GREEN bdf630194
- [x] REFACTOR 3ae64e4df

### Scenario: A runtime without a runnable public carrier keeps existing recovery behavior

- [x] RED skip: public delivery already required the explicit route flag
- [x] GREEN 3ae64e4df
- [x] REFACTOR skip: no alternate carrier or recovery lane was added

### Scenario: Claude Remote evidence keeps existing recovery behavior

- [x] RED ba9956ce4
- [x] GREEN bdf630194
- [x] REFACTOR skip: the Claude-only denial remains an early route decision

### Scenario: Claude Remote evidence does not suppress other harnesses

- [x] RED ba9956ce4
- [x] GREEN bdf630194
- [x] REFACTOR 3ae64e4df

### Scenario: Missing Cursor conversation identity keeps existing recovery behavior

- [x] RED 5be197598
- [x] GREEN 42deb8685
- [x] REFACTOR skip: one eligibility guard prevents transcript-path fallback from becoming public identity

### Scenario: Collector rejection keeps existing recovery behavior

- [x] RED skip: injected rejection isolation passed on its first characterization run
- [x] GREEN 53eacc2f6
- [x] REFACTOR skip: existing abandoned outcome preserves private filing

### Scenario: Collector transport failure keeps existing recovery behavior

- [x] RED skip: connection and deadline isolation passed on their first characterization run
- [x] GREEN 53eacc2f6
- [x] REFACTOR skip: the existing single-attempt deadline needed no new worker or retry

## Feature-level cross-scenario refactor

- [x] cross-scenario c2c070fb5
