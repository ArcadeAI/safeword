# Test Definitions: Ship Safeword as a native Claude Code plugin

Feature source: `features/native-claude-plugin.feature`

Each scenario is tracked through RED, GREEN, and REFACTOR during implementation.

Pre-release verification on 2026-08-02 passed every executable non-`@wip`,
non-`@manual`, non-`@live` scenario: 769 passed and 3 were intentionally
skipped. The authorized interactive reload boundary also passed in a temporary
Claude profile. Unchecked ledger entries below remain release-boundary work or
automation bookkeeping; they are not being collapsed into a false
completed-release claim.

## Rule: native-claude-plugin.TBU1.R1

### Scenario: Install converges supported profile states to the exact enabled user-scoped plugin

- [x] RED 89cb3147b
- [x] GREEN 9e5a8c440
- [x] REFACTOR skip: subprocess parsing, marketplace convergence, plugin convergence, and verification are isolated helpers

Boundary-contract correction: RED bdd2101c3 captured Claude 2.1.170's real `source: "git"` marketplace shape; GREEN 883d99432 accepts only its exact URL/ref identity.

### Scenario: Fresh setup recommends an explicit user-scoped plugin install without writing legacy Claude assets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install refuses an unsupported Claude host before profile mutation

- [x] RED cf49c092f
- [x] GREEN 994eefd9f
- [x] REFACTOR skip: failure classification and next-action selection share the typed result boundary

### Scenario: Install refuses a marketplace name that resolves to an unofficial source

- [x] RED cf49c092f
- [x] GREEN 994eefd9f
- [x] REFACTOR skip: exact source comparison is isolated from profile mutation

### Scenario: Install rejects current metadata backed by a legacy cached payload

- [x] RED 446c716fe
- [x] GREEN 0416912bc
- [x] REFACTOR skip: installed identity, inventory, required assets, and hashes are checked by focused validators

### Scenario: Claude subprocess failure reports partial profile effects without project mutation

- [x] RED cf49c092f
- [x] GREEN 994eefd9f
- [x] REFACTOR skip: the completed-effect journal is passed through every subprocess failure

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

### Scenario: An aggregate event returns one valid host response

- [x] RED 2fd8b7f78
- [x] GREEN 3e9cc76d0
- [x] REFACTOR skip: response parsing and field aggregation are split into narrow helpers

### Scenario: A generated plugin reference cannot depend on a materialized project framework copy

- [x] RED 8f914bce9
- [x] GREEN 1233abd8f
- [x] REFACTOR skip: one typed reference graph now drives closure, validation, and inventory sealing

### Scenario: A failed sibling hook prevents event-level plugin proof

- [x] RED 1233abd8f
- [x] GREEN 999f67b30
- [x] REFACTOR skip: each proof-authorizing event has one aggregate dispatcher boundary

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
- [x] GREEN cd66cc7ac + live session 5d6daf03-bc80-4c7c-99b8-eb03c1c6c04b
- [x] REFACTOR skip: live host acceptance exercised the shipped dispatcher without code changes

Claude Code 2.1.170 started without Safeword, then installed the generated
plugin into a temporary profile while the task remained open. Interactive
`/reload-plugins` reported one plugin and 24 hooks; the following ordinary
prompt returned `SAFEWORD_INTERACTIVE_RELOAD_OK` and wrote a same-session
UserPromptSubmit proof for the expected version and hook-manifest digest. A
second isolated run invoked `/safeword:explain` immediately after reload;
Claude identified and processed the Safeword skill, then ran all five Stop
hooks, proving workflow availability in the live task as well as hook activation.

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

### Scenario: Damaged plugin runtime writes no plugin proof

- [x] RED e80fd0941
- [x] GREEN 1233abd8f
- [x] REFACTOR 999f67b30

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

Catalogue completeness and real-manifest runtime integrity were strengthened in
`1233abd8f` and `999f67b30` after quality review.

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

- [x] cross-scenario efc416145
