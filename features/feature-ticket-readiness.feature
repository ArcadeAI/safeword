# Behavior source for 9S6HFC. The executable backing is Vitest hook coverage:
# pre-tool-quality integration tests drive phase-entry denials, prompt hook tests
# drive legacy resume messaging, and unit tests cover the shared readiness helper.
#
# The feature is @wip because hook behavior is already exercised more directly
# by spawning the Bun hook scripts against temp projects; cucumber step
# definitions would duplicate that harness without adding confidence.
@wip
Feature: Feature ticket readiness before define-behavior

  Feature tickets require complete intake artifacts before scenario formulation
  starts. Safeword blocks new entries into define-behavior when readiness is
  missing and surfaces missing readiness immediately when a legacy ticket is
  resumed in define-behavior.

  Rule: New feature tickets must be ready before entering define-behavior

    @feature-ticket-readiness.TB1.AC1
    Scenario: A feature missing scope frontmatter is denied when phase advances
      Given an in-progress feature ticket in intake without scope, out_of_scope, or done_when
      When the agent edits ticket.md to set phase: define-behavior
      Then the edit is denied with a readiness message naming the missing frontmatter fields

    @feature-ticket-readiness.TB1.AC1
    Scenario: A feature missing spec and dimensions is denied before define-behavior
      Given an in-progress feature ticket in intake with complete scope frontmatter but no spec.md or dimensions.md
      When the agent edits ticket.md to set phase: define-behavior
      Then the edit is denied with one readiness message naming spec.md and dimensions.md

    @feature-ticket-readiness.TB1.AC3
    Scenario: A ready feature can enter define-behavior
      Given an in-progress feature ticket in intake with complete scope frontmatter, valid spec.md, and valid dimensions.md
      When the agent edits ticket.md to set phase: define-behavior
      Then the edit is allowed

    @feature-ticket-readiness.SM1.AC2
    Scenario: A task can enter define-behavior without feature readiness artifacts
      Given an in-progress task ticket in intake without spec.md or dimensions.md
      When the agent edits ticket.md to set phase: define-behavior
      Then the feature readiness gate does not deny the edit

  Rule: Legacy define-behavior tickets surface readiness before scenario guidance

    @feature-ticket-readiness.TB1.AC2
    Scenario: A legacy define-behavior feature receives an upfront readiness message
      Given the active ticket is an in-progress feature already in define-behavior with missing readiness artifacts
      When the user submits the next prompt
      Then the prompt hook outputs a readiness message with remediation steps before scenario-writing guidance

    @feature-ticket-readiness.TB1.AC3
    Scenario: A ready define-behavior feature keeps the normal scenario reminder
      Given the active ticket is an in-progress feature in define-behavior with complete readiness artifacts
      When the user submits the next prompt
      Then the prompt hook outputs the normal define-behavior reminder without a readiness warning

  Rule: Readiness validation catches invalid artifact content

    @feature-ticket-readiness.SM1.AC1
    Scenario: Invalid spec and dimensions skip reasons are reported together
      Given a feature ticket has scope frontmatter, a spec.md with a JTBD but no AC, and dimensions.md containing "skip:"
      When readiness is evaluated
      Then the result is not ready and names both the spec AC gap and the empty dimensions skip reason
