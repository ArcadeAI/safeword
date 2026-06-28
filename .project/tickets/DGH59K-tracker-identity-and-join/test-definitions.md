# Test Definitions: Issue-first ticket identity + key→folder join (DGH59K)

<!-- Scenario lineage: tracker-identity-and-join.<persona><n>.AC<#>. Feature source:
     features/tracker-identity-and-join.feature (Gherkin is canonical; this file is the R/G/R
     ledger). Maps to epic KKNFZA TB1.AC1 (identity + safe degrade) and SM2.AC6 (join reader).
     Strengthened at the scenario-gate (independent review, 2026-06-28): replaced order-only
     observables with count+emptiness (issue-create exactly once / zero; folder count unchanged on
     failure), fixed the partial-create Given to a pending tracker-map entry, named the adopt
     mechanism (--issue), pinned the not-found sentinel (undefined), added auth-rejected and
     stale-map-entry scenarios, and anchored the AC1 happy path as the @wiring end-to-end test.
     Test levels: TB1.AC1/AC2 are command-level (real `ticket new` + real ticket-writer/fs;
     injected tracker client mocks ONLY the network boundary). SM1.AC1 is unit-level on the
     key→folder reader. -->

## Rule: ticket new takes identity from the tracker and keys the folder to it

### Scenario: tracker-identity-and-join.TB1.AC1.connected_mints_issue_before_any_folder

Given a connected tracker
When I run `ticket new login-bug`
Then tracker issue-create is called exactly once
And no local ticket folder exists at the moment issue-create is invoked
And after the command exactly one new ticket folder exists, keyed to the issue key
And the ticket's identity is the issue key

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC1.existing_issue_is_adopted

Given a connected tracker and an existing issue `ENG-45` for the work
When I run `ticket new login-bug --issue ENG-45`
Then tracker issue-create is called zero times
And the existing issue `ENG-45` is adopted
And the local folder is keyed to `ENG-45`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC1.no_tracker_is_local_as_today

Given no tracker is connected
When I run `ticket new login-bug`
Then no tracker client is constructed and no tracker call is made
And the folder name matches today's `{ID}-{slug}` with ID a Crockford-base32 id of the current length

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: ticket new degrades safely when the network is the critical path

### Scenario: tracker-identity-and-join.TB1.AC2.unreachable_fails_no_orphan

Given a connected tracker that is unreachable
When I run `ticket new login-bug`
Then the command fails with a clear, non-zero error
And tracker issue-create was attempted (failure came from the tracker, not a pre-flight skip)
And the tickets directory contains the same folders as before the command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC2.rejected_credential_fails_no_orphan

Given a connected tracker that rejects the configured credential
When I run `ticket new login-bug`
Then the command fails with a clear, non-zero error that names authorization
And the tickets directory contains the same folders as before the command
And the configured secret value appears in neither the error, the config, nor the logs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC2.missing_credential_fails_loudly

Given a configured tracker provider with no resolvable credential
When I run `ticket new login-bug`
Then the command fails with a clear, non-zero error
And the tickets directory contains the same folders as before the command
And the configured secret value appears in neither the error, the config, nor the logs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: tracker-identity-and-join.TB1.AC2.partial_create_reconciles_no_duplicate

Given a prior run left a pending tracker-map entry for this work (issue minted, key not yet confirmed)
When I run `ticket new login-bug` again for that work
Then tracker issue-create is called zero times
And the local folder is keyed to the pending entry's existing issue key
And the tracker-map entry for this work is promoted to recorded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: a tracker key resolves to its local folder

### Scenario: tracker-identity-and-join.SM1.AC1.known_key_resolves_folder

Given a ticket whose folder records the tracker key `ENG-45`
When a hook resolves the folder for tracker key `ENG-45`
Then it returns that ticket's folder path

- [x] RED 58d70c8
- [x] GREEN 58d70c8
- [x] REFACTOR skip: clean; folded into GREEN (cross-package folder-resolve dup with hooks noted in impl-plan)

### Scenario: tracker-identity-and-join.SM1.AC1.both_key_shapes_resolve

Given a ticket recorded under GitHub key `#123` and a ticket recorded under Linear key `ENG-45`
When a hook resolves the folder for each key
Then each returns its own ticket's folder path

- [x] RED 58d70c8
- [x] GREEN 58d70c8
- [x] REFACTOR skip: clean; folded into GREEN

### Scenario: tracker-identity-and-join.SM1.AC1.unknown_key_clean_not_found

Given no ticket records the tracker key `ENG-999`
When a hook resolves the folder for tracker key `ENG-999`
Then it returns the not-found sentinel (undefined), not a path
And it does not raise an error

- [x] RED 58d70c8
- [x] GREEN 58d70c8
- [x] REFACTOR skip: clean; folded into GREEN

### Scenario: tracker-identity-and-join.SM1.AC1.stale_map_entry_not_found

Given the tracker-map records `ENG-45` but its folder no longer exists
When a hook resolves the folder for tracker key `ENG-45`
Then it returns the not-found sentinel (undefined)
And it does not return a path that does not exist

- [x] RED 58d70c8
- [x] GREEN 58d70c8
- [x] REFACTOR skip: clean; folded into GREEN
