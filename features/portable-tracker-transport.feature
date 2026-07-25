# Tagged @wip to exclude this feature from the cucumber acceptance lane: the plan
# and apply-results code is pure (no CLI-driven live tracker), and the executor that
# actually calls GitHub is external (agent/gh), so there is no live-tracker-free way
# to drive the end-to-end mirror here ("no live tracker in tests", per #363 — same
# stance as sync-tracker.feature and tracker-identity-and-join.feature). Behavior is
# proven by vitest unit tests over the pure plan + apply-results functions; this
# .feature is the canonical scenario source (feature-files-as-source).
@wip
Feature: Environment-portable tracker transport
  safeword computes a network-free sync plan (create/update/close intents from local
  tickets diffed against the tracker-map) and folds an executor's results back into the
  map — so the mirror works through whatever GitHub access an environment has, not only
  where the gh binary is installed. The gh path stays the default when present.

  Rule: --plan emits the right intent for each ticket's sync state

    @portable-tracker-transport.TB1.AC1
    Scenario: A never-synced ticket becomes a create intent
      Given a ticket with no entry in the tracker map
      When I run sync-tracker in plan mode
      Then the plan contains a create intent for that ticket with its minimal issue payload

    @portable-tracker-transport.TB1.AC1
    Scenario: An already-recorded ticket becomes an update intent
      Given a ticket recorded in the tracker map with an issue reference
      When I run sync-tracker in plan mode
      Then the plan contains an update intent for that ticket carrying its recorded reference

    @portable-tracker-transport.TB1.AC1
    Scenario: A terminal ticket becomes a close intent
      Given a recorded ticket whose status is terminal
      When I run sync-tracker in plan mode
      Then the plan contains a close intent for that ticket carrying its recorded reference

    @portable-tracker-transport.TB1.AC1
    Scenario: A never-synced ticket that is already terminal becomes a create carrying a closed state
      Given a ticket with no entry in the tracker map whose status is terminal
      When I run sync-tracker in plan mode
      Then the plan contains a create intent for that ticket whose payload state is closed

    @portable-tracker-transport.TB1.AC1
    Scenario: An empty corpus yields an empty but valid plan
      Given no tickets exist
      When I run sync-tracker in plan mode
      Then the plan is emitted with no intents and carries a version

  Rule: --plan carries the ticket graph by ticket id

    @portable-tracker-transport.TB1.AC1
    Scenario: A ticket with a parent carries a parent edge
      Given a ticket whose parent is another ticket in the corpus
      When I run sync-tracker in plan mode
      Then that ticket's intent carries a parent edge naming the parent's ticket id

    @portable-tracker-transport.TB1.AC1
    Scenario: A blocked ticket carries its blocked-by edges as a set
      Given a ticket blocked by two other tickets in the corpus
      When I run sync-tracker in plan mode
      Then that ticket's intent carries blocked-by edges naming exactly those two ticket ids, in any order

    @portable-tracker-transport.TB1.AC1
    Scenario: A ticket with both a parent and a blocked-by edge carries both
      Given a ticket with a parent and a blocked-by edge, both present in the corpus
      When I run sync-tracker in plan mode
      Then that ticket's intent carries the parent edge and the blocked-by edge

    @portable-tracker-transport.TB1.AC1
    Scenario: Only the unresolvable edge is dropped; resolvable edges remain
      Given a ticket whose parent is in the corpus and whose blocked-by edge names a ticket that is not
      When I run sync-tracker in plan mode
      Then that ticket's intent carries the parent edge
      And its blocked-by edges omit the absent ticket, leaving no blocked-by edge

  Rule: --plan runs offline

    @portable-tracker-transport.TB1.AC1 @portable-tracker-transport.TB1.AC4
    Scenario: Planning needs no credential and contacts no tracker
      Given a credential resolver and tracker client that fail if they are called
      When I run sync-tracker in plan mode
      Then the plan still lists the tickets' intents
      And neither the credential resolver nor the tracker client was called

  Rule: --apply-results folds executor results into the map idempotently

    @portable-tracker-transport.TB1.AC2
    Scenario: A create result is recorded with its issue number and url
      Given a results file reporting a created issue number and url for a ticket
      When I run sync-tracker --apply-results with that file
      Then the tracker map records that ticket with the bare issue number and url as recorded

    @portable-tracker-transport.TB1.AC2
    Scenario: Re-applying the same results changes nothing
      Given results that have already been applied to the tracker map
      When I apply the same results again
      Then the tracker map is unchanged

    @portable-tracker-transport.TB1.AC2
    Scenario: An update or close result makes no identity change
      Given an executor result acknowledging an update to an already-recorded issue
      When I apply the results
      Then applying succeeds
      And the tracker map's reference for that ticket is unchanged

  Rule: Malformed results are rejected without corrupting the map

    @portable-tracker-transport.SM1.AC1
    Scenario Outline: A malformed results file is rejected and the map is left intact
      Given a results file that is <defect>
      When I apply the results
      Then the command fails with an actionable error
      And the tracker map on disk is unchanged

      Examples:
        | defect                                                       |
        | not valid JSON                                               |
        | absent from disk                                             |
        | declaring an unsupported contract version                    |
        | a create result missing an issue number                      |
        | a create result missing the issue url                        |
        | reporting number 4764539863 for an issue whose url ends /549 |
        | naming a ticket absent from the corpus                       |

    @portable-tracker-transport.SM1.AC1
    Scenario: Applying against a corrupt tracker map is refused, leaving the file intact
      Given the tracker map on disk is corrupt
      When I run sync-tracker --apply-results with a well-formed results file
      Then the command fails with an actionable error
      And the corrupt tracker map is left exactly as it was

    @portable-tracker-transport.SM1.AC1
    Scenario: A planned create round-trips through results back into the map
      Given a plan containing a create intent for a ticket
      And an executor result for that create carrying the versioned results envelope
      When I apply the results
      Then the tracker map records that ticket with the created issue number and url as recorded

  Rule: The command surface is wired — stdout contract and mode routing

    @portable-tracker-transport.TB1.AC1
    Scenario: --plan writes a valid SyncPlan to stdout and nothing else
      Given a corpus with one never-synced ticket
      When I invoke the sync-tracker command with --plan
      Then stdout is a single valid SyncPlan JSON document carrying a version and the create intent
      And stdout contains no log or diagnostic lines

    @portable-tracker-transport.TB1.AC3
    Scenario: Planning an unconfigured project yields an empty plan, not a plan full of creates
      Given no tracker is configured
      When I invoke the sync-tracker command with --plan
      Then stdout is an empty but valid SyncPlan document
      And the notice that nothing was planned is kept off stdout

    @portable-tracker-transport.TB1.AC4
    Scenario: Planning full ticket bodies to GitHub warns about egress without polluting the plan
      Given the project projects full ticket bodies to a GitHub repo
      When I invoke the sync-tracker command with --plan
      Then an egress warning is reported away from stdout
      And stdout is still a single valid SyncPlan document

    @portable-tracker-transport.TB1.AC3
    Scenario: With no mode flag, the command routes to the gh path
      When I run sync-tracker with neither plan nor apply mode
      Then it dispatches to the gh executor path
      And it neither computes a plan nor reads a results file

    @portable-tracker-transport.TB1.AC3
    Scenario: Plan and apply modes cannot be combined
      When I run sync-tracker in both plan and apply modes at once
      Then the command fails telling me the two modes are mutually exclusive

  Rule: Egress discipline is preserved

    @portable-tracker-transport.TB1.AC4
    Scenario: A create intent body carries only minimal egress
      Given a ticket with a spec and a work log
      When I run sync-tracker in plan mode
      Then the create intent's body carries only the title, status, labels and back-link
      And it carries neither the spec nor the work log

    @portable-tracker-transport.TB1.AC4
    Scenario: The emitted plan contains no credential
      Given a tracker credential is present in the environment
      When I run sync-tracker in plan mode
      Then the emitted plan contains no credential or token
