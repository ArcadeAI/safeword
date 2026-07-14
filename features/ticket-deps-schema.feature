# Acceptance is proven by the vitest lanes, not cucumber step definitions: the
# hook gate is driven via stdin payloads in
# packages/cli/tests/integration/blocked-on-gate.test.ts; warn-only validation +
# stale-override in tests/commands/check.test.ts; INDEX/override surfacing in
# tests/ticket-sync/ticket-sync.test.ts. Tagged @wip to exclude this feature
# from the cucumber acceptance lane (proof lives in vitest), while staying
# discoverable for `safeword check` AC-coverage.
@ticket-deps-schema.TB1 @wip
Feature: epic + blocked_on schema and the blocked_on phase gate
  Two canonical optional frontmatter fields (epic, blocked_on) with warn-only
  validation, plus one hard gate: blocked_on denies advancing a ticket's phase
  out of intake unless every same-repo blocker is done (or a reasoned override
  is set for terminal-but-not-done blockers).

  Rule: epic and blocked_on are optional canonical fields

    @ticket-deps-schema.TB1.AC1
    Scenario: A ticket carrying neither field validates cleanly
      Given a ticket with no epic and no blocked_on
      When safeword check runs
      Then it emits no relation advisory for that ticket
      And it exits 0

  Rule: Relations validation warns, never blocks

    @ticket-deps-schema.TB1.AC2
    Scenario: An unresolvable blocked_on id is warned, not errored
      Given a ticket whose blocked_on lists an id that is not in the corpus
      When safeword check runs
      Then it prints a warning naming the unresolvable id
      And it exits 0

    @ticket-deps-schema.TB1.AC2
    Scenario: A blocked_on cycle is warned, not errored
      Given two tickets where A is blocked_on B and B is blocked_on A
      When safeword check runs
      Then it prints a warning naming the cycle
      And it exits 0

    @ticket-deps-schema.TB1.AC2
    Scenario: A self-referential blocked_on is warned
      Given a ticket whose blocked_on lists its own id
      When safeword check runs
      Then it prints a warning naming the self-cycle
      And it exits 0

    @ticket-deps-schema.TB1.AC2
    Scenario: A clean corpus produces no relation advisories
      Given every blocked_on id resolves and no cycle exists
      When safeword check runs
      Then it prints no relation advisory

  Rule: blocked_on gates phase-advance out of intake

    @ticket-deps-schema.TB1.AC3
    Scenario: Advancing out of intake is denied while a blocker is in progress
      Given a ticket in phase intake blocked_on a ticket whose status is in_progress
      When an edit tries to change its phase to define-behavior
      Then the write is denied with "BLOCKED on <id> (status: in_progress)"

    @ticket-deps-schema.TB1.AC3
    Scenario: Advancing out of intake is allowed once the blocker is done
      Given a ticket in phase intake blocked_on a ticket whose status is done
      When an edit changes its phase to define-behavior
      Then the write is allowed

    @ticket-deps-schema.TB1.AC3
    Scenario: Any non-done blocker among several denies the advance
      Given a ticket in phase intake blocked_on two tickets, one done and one in_progress
      When an edit tries to change its phase to define-behavior
      Then the write is denied naming the in_progress blocker

    @ticket-deps-schema.TB1.AC3
    Scenario: All-done blockers allow the advance
      Given a ticket in phase intake blocked_on two tickets that are both done
      When an edit changes its phase to define-behavior
      Then the write is allowed

    @ticket-deps-schema.TB1.AC3
    Scenario: A blocker with unreadable status fails safe and denies the advance
      Given a ticket in phase intake blocked_on a ticket whose status is missing or unparseable
      When an edit tries to change its phase to define-behavior
      Then the write is denied, treating the blocker as not done

  Rule: Non-done terminal blockers require a reasoned override

    @ticket-deps-schema.TB1.AC4
    Scenario: A cancelled blocker without an override denies the advance
      Given a ticket in phase intake blocked_on a ticket whose status is cancelled
      And the ticket has no blocked_on_override
      When an edit tries to change its phase to define-behavior
      Then the write is denied

    @ticket-deps-schema.TB1.AC4
    Scenario Outline: A substantive override allows advance past a terminal-but-not-done blocker
      Given a ticket in phase intake blocked_on a ticket whose status is <status>
      And the ticket sets blocked_on_override with a substantive reason
      When an edit changes its phase to define-behavior
      Then the write is allowed

      Examples:
        | status     |
        | cancelled  |
        | superseded |
        | wontfix    |

    @ticket-deps-schema.TB1.AC4
    Scenario: An override's reason is surfaced in the INDEX
      Given a ticket that advanced past a cancelled blocker via blocked_on_override
      When the ticket INDEX is regenerated
      Then the override reason appears against that ticket in the INDEX

  Rule: The override must be honest

    @ticket-deps-schema.TB1.AC4
    Scenario: An override with a trivial reason is rejected
      Given a ticket in phase intake blocked_on a cancelled ticket
      And its blocked_on_override reason is empty or trivial
      When an edit tries to change its phase to define-behavior
      Then the write is denied

    @ticket-deps-schema.TB1.AC4
    Scenario: A stale override is flagged once every blocker is done
      Given a ticket that carries a blocked_on_override
      And every listed blocker now has status done
      When safeword check runs
      Then it warns that the override is stale and should be removed

  Rule: The gate fires only on the intake-exit transition (grandfather)

    @ticket-deps-schema.TB1.AC5
    Scenario: A blocker added after intake does not retroactively block
      Given a ticket already past intake
      When it gains a blocked_on referencing an in_progress ticket
      Then further edits to the ticket are not denied

    @ticket-deps-schema.TB1.AC5
    Scenario: A non-phase edit is never blocked
      Given a ticket in phase intake blocked_on an in_progress ticket
      When an edit changes only its title, leaving phase at intake
      Then the write is allowed

  Rule: A dependency cycle does not hang the gate

    @ticket-deps-schema.TB1.AC5
    Scenario: The gate short-circuits on a cycle instead of looping
      Given a ticket in phase intake whose blocked_on chain forms a cycle
      When an edit tries to change its phase to define-behavior
      Then the gate surfaces the cycle as the block reason without looping
