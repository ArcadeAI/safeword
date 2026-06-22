# Behavior source for W610WW. The backing implementation is proven end-to-end by
# vitest, not the cucumber lane: tests/hooks/ledger-validation.test.ts (the
# wholeTicketPassApplies trigger + cross-scenario row), tests/skill-invocation-gate.test.ts
# (requiredSkillsForDone), and tests/integration/whole-ticket-quality-refactor.test.ts
# (the done gate spawned against a temp repo).
#
# This @wip is BROADER than formatter-aware-lint-hook.feature's: that feature keeps
# most scenarios live and @wips only the few that need a full install. Here the whole
# feature is @wip because every scenario's enforcement point is the stop hook, and the
# vitest integration test already drives it against a temp repo — wiring cucumber step
# defs would duplicate that harness for no added coverage (gherkin-lane policy 7ES3GW:
# the .feature is the behavior source; the backing layer may be vitest integration).
@wip @whole-ticket-quality-refactor.DEV1.AC2
Feature: Whole-ticket quality review and refactor before verify

  The end of implementation runs one whole-ticket /quality-review then
  /refactor pass, gated to fire only when a ticket has more than one
  RED-GREEN-REFACTOR loop, for both BDD features and TDD tasks. Enforcement
  lives at the done gate: the cross-scenario refactor row proves the refactor
  half, the skill-invocation log proves the review half. The trigger replaces
  today's "required iff any annotation" rule with "required iff two-or-more
  annotated loops, or a row already exists".

  Rule: The whole-ticket pass is required only above one loop

    @whole-ticket-quality-refactor.DEV2.AC1
    Scenario: A single annotated loop is exempt despite the annotation
      Given a ticket whose ledger has exactly one annotated RGR loop and no cross-scenario row
      When the done gate validates the ledger
      Then the cross-scenario refactor row is not required, even though the loop is annotated

    @whole-ticket-quality-refactor.DEV2.AC1
    Scenario: A ticket with zero parsed scenarios needs no row
      Given a ticket whose ledger has no scenario blocks and no annotations
      When the done gate validates the ledger
      Then the cross-scenario refactor row is not required

    @whole-ticket-quality-refactor.SM1.AC1
    Scenario: Exactly two annotated loops require the cross-scenario row
      Given a ticket whose ledger has exactly two annotated RGR loops and no row
      When the done gate validates the ledger
      Then validation fails for a missing cross-scenario refactor row

    @whole-ticket-quality-refactor.DEV1.AC2
    Scenario: Exactly two annotated loops with a refactor commit pass
      Given a ticket whose ledger has exactly two annotated RGR loops and a cross-scenario row carrying a reachable SHA
      When the done gate validates the ledger
      Then the cross-scenario refactor row passes validation

    @whole-ticket-quality-refactor.SM1.AC1
    Scenario: A multi-scenario ticket with no annotations stays exempt
      Given a legacy ticket with three scenarios and no step annotations
      When the done gate validates the ledger
      Then the cross-scenario refactor row is not required

    @whole-ticket-quality-refactor.SM1.AC1
    Scenario: A single-loop ticket with a present empty-skip row is still blocked
      Given a ticket with one annotated loop whose cross-scenario row reads "skip:" with no reason
      When the done gate validates the ledger
      Then validation fails for an empty cross-scenario skip reason

    @whole-ticket-quality-refactor.DEV1.AC2
    Scenario: A two-loop ticket with an empty skip reason is blocked
      Given a two-loop ticket whose cross-scenario row reads "skip:" with no reason
      When the done gate validates the ledger
      Then validation fails for an empty cross-scenario skip reason

    @whole-ticket-quality-refactor.DEV1.AC2
    Scenario: A two-loop ticket with a real skip reason passes
      Given a two-loop ticket whose cross-scenario row reads "skip: no shared duplication emerged"
      When the done gate validates the ledger
      Then the cross-scenario refactor row passes validation

  Rule: Tasks and features share one validation path

    @whole-ticket-quality-refactor.SM1.AC2
    Scenario: A two-loop task is blocked by the same validator as a feature
      Given a task ticket whose ledger has exactly two annotated RGR loops and no row
      When the done gate runs on the task
      Then the done gate blocks for a missing cross-scenario refactor row with the same message a feature receives

    @whole-ticket-quality-refactor.SM1.AC2
    Scenario: A two-loop task is blocked for a missing quality review
      Given a task ticket with two annotated loops whose session log has no /quality-review entry
      When the done gate checks required skill invocations on the task
      Then the done gate blocks for a missing /quality-review invocation

    @whole-ticket-quality-refactor.DEV2.AC1
    Scenario: A single-loop task proceeds without a row
      Given a task ticket whose ledger has one annotated RGR loop and no row
      When the done gate runs on the task
      Then the done gate does not block for a cross-scenario refactor row

  Rule: The quality-review half is proven by its invocation log

    @whole-ticket-quality-refactor.DEV1.AC1
    Scenario: A two-loop ticket without a logged quality review is blocked
      Given a two-loop ticket whose session log has no /quality-review entry
      When the done gate checks required skill invocations
      Then the done gate blocks for a missing /quality-review invocation

    @whole-ticket-quality-refactor.DEV1.AC1
    Scenario: A two-loop ticket with a logged quality review passes the review check
      Given a two-loop ticket whose session log has a /quality-review entry
      When the done gate checks required skill invocations
      Then the /quality-review invocation requirement is satisfied

    @whole-ticket-quality-refactor.DEV2.AC1
    Scenario: A single-loop ticket is not blocked for a missing quality review
      Given a ticket with exactly one annotated loop whose session log has no /quality-review entry
      When the done gate checks required skill invocations
      Then the done gate does not require a /quality-review invocation

    @whole-ticket-quality-refactor.SM1.AC1
    Scenario: A legacy unannotated multi-scenario ticket is exempt from the review too
      Given a ticket with two or more scenarios and no step annotations
      When the done gate checks required skill invocations
      Then the done gate does not require a /quality-review invocation, matching the row's legacy exemption
