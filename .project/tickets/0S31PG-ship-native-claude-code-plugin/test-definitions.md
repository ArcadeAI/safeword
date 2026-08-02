# Test Definitions: Ship Safeword as a native Claude Code plugin

Feature source: `features/native-claude-plugin.feature`

Each scenario is tracked through RED, GREEN, and REFACTOR during implementation.

## Rule: native-claude-plugin.TBU1.R1

### Scenario: Install converges supported profile states to the exact enabled user-scoped plugin

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Fresh setup recommends an explicit user-scoped plugin install without writing legacy Claude assets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install refuses an unsupported Claude host before profile mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install refuses a marketplace name that resolves to an unofficial source

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Claude subprocess failure reports partial profile effects without project mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.TBU1.R2

### Scenario: Cleanup removes recognized Safeword entries from mixed Claude configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declining cleanup confirmation leaves profile and project state unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cleanup preserves and reports unknown content at a managed legacy path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ordinary setup preserves an existing legacy project and its Claude profile

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.TBU1.R3

### Scenario: A cached plugin resolves framework code internally and writes state to the documented boundaries

- [x] RED 83f018986
- [x] GREEN 4bd92e656
- [x] REFACTOR skip: proof writer and identity validation are already isolated at one cache-local entrypoint

### Scenario: A generated plugin reference cannot depend on a materialized project framework copy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.TBU1.R4

### Scenario: Repeating a completed lifecycle operation is a no-op

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A lifecycle mutation refuses to run over a pending cleanup recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Setup in plugin mode never recreates retired Claude legacy assets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.TBU1.R5

### Scenario: The next prompt after live plugin reload proves the new plugin before prompt processing

- [x] RED 906691fa7
- [x] GREEN caaf3c8ed
- [ ] REFACTOR

### Scenario: Refused live reload leaves legacy authority intact

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.NTB1.R1

### Scenario: Coexisting plugin hooks prove identity but suppress duplicate work per legacy event

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin hooks remain functional for events without viable legacy authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid plugin proof cannot authorize legacy cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The loaded plugin becomes authoritative in the same task after cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.NTB1.R2

### Scenario: Ready plugin states are classified without mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-ready plugin states are classified without weakening legacy protection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Runtime identity mismatch writes no plugin proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.NTB1.R3

### Scenario: Successful cleanup makes no Claude lifecycle mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Rejected cleanup performs no compensating Claude lifecycle mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cleanup with no recognized legacy assets reports no contraction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.NTB1.R4

### Scenario: Recovery applies the exact disposition recorded by the durable transaction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Concurrent edits stop cleanup without overwriting the edited target

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cleanup refuses symlinked or escaping legacy targets before mutation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.SWM1.R1

### Scenario: The production generation command produces the complete plugin from canonical sources

- [x] RED cd1d3272f
- [x] GREEN ad8b306e0
- [x] REFACTOR 28b21363a

### Scenario: Generation fails on a missing transitive runtime dependency

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generation rejects a duplicate invocation name across skills and commands

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.SWM1.R2

### Scenario: An aligned release contract passes without modifying generated assets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each Claude delivery drift fails with the offending surface

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.SWM1.R3

### Scenario: Equivalent host workflows and lifecycle events share canonical parity identities

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An equivalent workflow missing from one supported host fails parity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: native-claude-plugin.SWM1.R4

### Scenario: Installed cache executes after its marketplace source plugin directory is unavailable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Damaged installed cache fails as cache integrity rather than marketplace health

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing marketplace metadata cannot be mistaken for successful cache execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Interactive host boundaries are recorded rather than silently skipped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
