# Test Definitions: Issue-first ticket identity + key→folder join (DGH59K)

<!-- Scenario lineage: tracker-identity-and-join.<persona><n>.AC<#>. Feature source:
     features/tracker-identity-and-join.feature (Gherkin is canonical; this file is the R/G/R
     ledger). Maps to epic KKNFZA TB1.AC1 (identity + safe degrade) and SM2.AC6 (join reader).
     Test levels: TB1.AC1/AC2 are command-level (temp dir + injected tracker client: assert issue
     created before folder, folder keyed to issue, no orphan, no duplicate, no-tracker path
     unchanged). SM1.AC1 is unit-level on the key→folder reader. The injected tracker client mocks
     ONLY the network boundary; real ticket-writer/fs collaborators run (wiring test). -->

## Rule: ticket new takes identity from the tracker and keys the folder to it

### Scenario: tracker-identity-and-join.TB1.AC1.connected_mints_issue_before_folder

Given a connected tracker
When I run `ticket new login-bug`
Then the tracker issue is created before any local folder
And the ticket's identity is the issue key
And the local folder is keyed to the issue key

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC1.existing_issue_is_adopted

Given a connected tracker and an existing issue for the work
When I run `ticket new login-bug` pointed at that issue
Then no new issue is created
And the local folder is keyed to the existing issue key

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC1.no_tracker_is_local_as_today

Given no tracker is connected
When I run `ticket new login-bug`
Then a local Crockford id is minted as before
And no tracker call is made
And the folder name matches today's `{ID}-{slug}` format

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: ticket new degrades safely when the network is the critical path

### Scenario: tracker-identity-and-join.TB1.AC2.unreachable_fails_no_orphan

Given a connected tracker that is unreachable
When I run `ticket new login-bug`
Then the command fails with a clear, non-zero error
And no local folder is created

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC2.missing_credential_fails_loudly

Given a configured tracker provider with no resolvable credential
When I run `ticket new login-bug`
Then the command fails with a clear, non-zero error
And no local folder is created
And no secret value is written to config or logs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC2.partial_create_reconciles_no_duplicate

Given the tracker minted an issue on a prior run but its key was never recorded locally
When I run `ticket new login-bug` again for that work
Then the prior issue is reused
And no second issue is created

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: a tracker key resolves to its local folder

### Scenario: tracker-identity-and-join.SM1.AC1.known_key_resolves_folder

Given a ticket whose folder records the tracker key `ENG-45`
When a hook resolves the folder for tracker key `ENG-45`
Then it returns that ticket's folder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.SM1.AC1.both_key_shapes_resolve

Given a ticket recorded under GitHub key `#123` and a ticket recorded under Linear key `ENG-45`
When a hook resolves the folder for each key
Then each returns its own ticket's folder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.SM1.AC1.unknown_key_clean_not_found

Given no ticket records the tracker key `ENG-999`
When a hook resolves the folder for tracker key `ENG-999`
Then it reports not found
And it does not raise an error

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
