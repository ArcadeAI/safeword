@tracker-identity-and-join
Feature: Issue-first ticket identity + tracker-key→local-folder join reader

  When a tracker is connected, a ticket's identity comes from the tracker (the issue key) and the
  local folder is keyed to it; when it isn't connected, identity stays local exactly as today. The
  network is only on the critical path at creation, so creation must degrade safely — a loud
  failure with no half-made ticket, and a re-run that reconciles rather than duplicates. A single
  reader maps a tracker key back to its local folder so colocated evidence stays reachable.
  Child of epic KKNFZA (TB1.AC1, SM2.AC6).

  Rule: ticket new takes identity from the tracker and keys the folder to it

    @tracker-identity-and-join.TB1.AC1
    Scenario: A connected tracker mints the issue before the local folder
      Given a connected tracker
      When I run "ticket new login-bug"
      Then the tracker issue is created before any local folder
      And the ticket's identity is the issue key
      And the local folder is keyed to the issue key

    @tracker-identity-and-join.TB1.AC1
    Scenario: An existing issue is adopted rather than re-created
      Given a connected tracker
      And an existing issue for the work
      When I run "ticket new login-bug" pointed at that issue
      Then no new issue is created
      And the local folder is keyed to the existing issue key

    @tracker-identity-and-join.TB1.AC1
    Scenario: With no tracker connected, identity is minted locally exactly as today
      Given no tracker is connected
      When I run "ticket new login-bug"
      Then a local Crockford id is minted as before
      And no tracker call is made
      And the folder name matches today's "{ID}-{slug}" format

  Rule: ticket new degrades safely when the network is the critical path

    @tracker-identity-and-join.TB1.AC2
    Scenario: An unreachable tracker fails loudly and leaves no orphan
      Given a connected tracker that is unreachable
      When I run "ticket new login-bug"
      Then the command fails with a clear, non-zero error
      And no local folder is created

    @tracker-identity-and-join.TB1.AC2
    Scenario: A missing credential fails loudly, never silently
      Given a configured tracker provider with no resolvable credential
      When I run "ticket new login-bug"
      Then the command fails with a clear, non-zero error
      And no local folder is created
      And no secret value is written to config or logs

    @tracker-identity-and-join.TB1.AC2
    Scenario: A partial create reconciles to the same issue instead of duplicating
      Given the tracker minted an issue on a prior run but its key was never recorded locally
      When I run "ticket new login-bug" again for that work
      Then the prior issue is reused
      And no second issue is created

  Rule: a tracker key resolves to its local folder

    @tracker-identity-and-join.SM1.AC1
    Scenario: A known tracker key resolves to its local folder
      Given a ticket whose folder records the tracker key "ENG-45"
      When a hook resolves the folder for tracker key "ENG-45"
      Then it returns that ticket's folder

    @tracker-identity-and-join.SM1.AC1
    Scenario: Both GitHub and Linear key shapes resolve
      Given a ticket recorded under GitHub key "#123"
      And a ticket recorded under Linear key "ENG-45"
      When a hook resolves the folder for each key
      Then each returns its own ticket's folder

    @tracker-identity-and-join.SM1.AC1
    Scenario: An unknown tracker key returns a clean not-found, never a crash
      Given no ticket records the tracker key "ENG-999"
      When a hook resolves the folder for tracker key "ENG-999"
      Then it reports not found
      And it does not raise an error
