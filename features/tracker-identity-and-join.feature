# Tagged @wip to exclude this feature from the cucumber acceptance lane: issue-first
# creation shells out to a real tracker (gh/Arcade) and the join reader has no CLI
# surface, so there is no live-tracker-free way to drive these end-to-end ("no live
# tracker in tests", per the testing lesson in #363 — same stance as
# sync-tracker.feature and tracker-connect-flow.feature). Behavior is proven in
# packages/cli/tests (resolve-by-key, ticket-writer-issue-first, ticket-creation-mode,
# ticket-identity, create-ticket-routed, ticket-new-wiring); this .feature is the
# canonical scenario source (feature-files-as-source).
@tracker-identity-and-join @wip
Feature: Issue-first ticket identity + tracker-key→local-folder join reader

  When a tracker is connected, a ticket's identity comes from the tracker (the issue key) and the
  local folder is keyed to it; when it isn't connected, identity stays local exactly as today. The
  network is only on the critical path at creation, so creation must degrade safely — a loud
  failure with no half-made ticket, and a re-run that reconciles rather than duplicates. A single
  reader maps a tracker key back to its local folder so colocated evidence stays reachable.
  Child of epic KKNFZA (TB1.AC1, SM2.AC6).

  Rule: ticket new takes identity from the tracker and keys the folder to it

    # Wiring scenario: exercises the real `ticket new` command end-to-end (real ticket-writer + fs),
    # mocking only the tracker network boundary. Count + emptiness observables close the
    # create-then-rename escape hatch (no temp folder before the issue mints).
    @tracker-identity-and-join.TB1.AC1 @wiring
    Scenario: A connected tracker mints the issue before any folder exists
      Given a connected tracker
      When I run "ticket new login-bug"
      Then tracker issue-create is called exactly once
      And no local ticket folder exists at the moment issue-create is invoked
      And after the command exactly one new ticket folder exists, keyed to the issue key
      And the ticket's identity is the issue key

    @tracker-identity-and-join.TB1.AC1
    Scenario: An existing issue is adopted rather than re-created
      Given a connected tracker
      And an existing issue "ENG-45" for the work
      When I run "ticket new login-bug --issue ENG-45"
      Then tracker issue-create is called zero times
      And the existing issue "ENG-45" is adopted
      And the local folder is keyed to "ENG-45"

    @tracker-identity-and-join.TB1.AC1
    Scenario: With no tracker connected, identity is minted locally exactly as today
      Given no tracker is connected
      When I run "ticket new login-bug"
      Then no tracker client is constructed and no tracker call is made
      And the folder name matches today's "{ID}-{slug}" format with ID a Crockford-base32 id of the current length

  Rule: ticket new degrades safely when the network is the critical path

    @tracker-identity-and-join.TB1.AC2
    Scenario: An unreachable tracker fails loudly and leaves no orphan
      Given a connected tracker that is unreachable
      When I run "ticket new login-bug"
      Then the command fails with a clear, non-zero error
      And tracker issue-create was attempted (the failure came from the tracker, not a pre-flight skip)
      And the tickets directory contains the same folders as before the command

    @tracker-identity-and-join.TB1.AC2
    Scenario: A rejected credential fails loudly and leaves no orphan
      Given a connected tracker that rejects the configured credential
      When I run "ticket new login-bug"
      Then the command fails with a clear, non-zero error that names authorization
      And the tickets directory contains the same folders as before the command
      And the configured secret value appears in neither the error, the config, nor the logs

    @tracker-identity-and-join.TB1.AC2
    Scenario: A missing credential fails loudly, never silently
      Given a configured tracker provider with no resolvable credential
      When I run "ticket new login-bug"
      Then the command fails with a clear, non-zero error
      And the tickets directory contains the same folders as before the command
      And the configured secret value appears in neither the error, the config, nor the logs

    # Decision C (idempotency): issue-first creation does NOT auto-reconcile a
    # partial-create crash (no local id exists before the issue, so the JS5K5G
    # pending pattern can't key it; title-search/slug-marker add scope + ambiguity).
    # A successful create records its ref so sync-tracker never double-creates; the
    # rare post-crash orphan (issue minted, recording crashed) is ACCEPTED and left
    # for a follow-up to surface. See child spec Open Questions + the orphan-surface
    # follow-up ticket. No scenario here asserts auto-reconcile.

    @tracker-identity-and-join.TB1.AC1
    Scenario: A successful issue-first create records its ref for later sync
      Given a connected tracker
      When I run "ticket new login-bug"
      Then the created issue's ref is recorded in the tracker-map
      And a later sync of that ticket updates the issue rather than creating a second one

  Rule: a tracker key resolves to its local folder

    @tracker-identity-and-join.SM1.AC1
    Scenario: A known tracker key resolves to its local folder
      Given a ticket whose folder records the tracker key "ENG-45"
      When a hook resolves the folder for tracker key "ENG-45"
      Then it returns that ticket's folder path

    @tracker-identity-and-join.SM1.AC1
    Scenario: Both GitHub and Linear key shapes resolve to their own folders
      Given a ticket recorded under GitHub key "#123"
      And a ticket recorded under Linear key "ENG-45"
      When a hook resolves the folder for each key
      Then each returns its own ticket's folder path

    @tracker-identity-and-join.SM1.AC1
    Scenario: An unknown tracker key returns the not-found sentinel, never an error
      Given no ticket records the tracker key "ENG-999"
      When a hook resolves the folder for tracker key "ENG-999"
      Then it returns the not-found sentinel (undefined), not a path
      And it does not raise an error

    @tracker-identity-and-join.SM1.AC1
    Scenario: A map entry pointing at a missing folder reports not found, not a dangling path
      Given the tracker-map records "ENG-45" but its folder no longer exists
      When a hook resolves the folder for tracker key "ENG-45"
      Then it returns the not-found sentinel (undefined)
      And it does not return a path that does not exist
