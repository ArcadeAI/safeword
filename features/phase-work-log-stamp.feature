# Behavior source for E32M4P (#772). The executable backing is Vitest hook
# coverage: unit tests over the pure transition-detection/append helpers, plus
# integration tests spawning the Bun hook script against temp projects.
# Cucumber step definitions would duplicate that harness without adding
# confidence, so the feature is @wip like its siblings.
@wip
Feature: Phase transitions stamp the ticket work log with real time

  The bdd phase files used to end with "add a work-log entry" templates whose
  {timestamp} an LLM cannot know — so transition timestamps were fabricated.
  A PostToolUse observer now watches ticket.md edits that change `phase:` and
  appends `- <ISO-time> Phase: <from> → <to>` with the system clock. The hook
  owns that/when; agent narrative entries remain the agent's.

  Rule: A phase transition that lands gains exactly one real-time work-log line

    @phase-work-log-stamp.TB1.R1 @surface.claude-code
    Scenario: An Edit that advances the phase appends one stamped line
      Given a ticket.md at phase define-behavior in the tickets namespace
      When the agent lands an Edit that changes the phase to scenario-gate
      Then the work log gains exactly one line "- <ISO-time> Phase: define-behavior → scenario-gate" whose timestamp falls within the test run's clock window

    @phase-work-log-stamp.TB1.R1
    Scenario: A MultiEdit carrying a phase change among other edits appends one stamped line
      Given a ticket.md at phase implement
      When the agent lands a MultiEdit whose edits include changing the phase to verify
      Then the work log gains exactly one stamped transition line

    @phase-work-log-stamp.TB1.R1
    Scenario: A backward phase move is stamped like any transition
      Given a ticket.md at phase scenario-gate
      When the agent lands an Edit that changes the phase back to define-behavior
      Then the work log gains one line recording "scenario-gate → define-behavior"

  Rule: The stamp is a pure append — frontmatter and body survive

    @phase-work-log-stamp.TB1.R2
    Scenario: Everything but the appended line is byte-identical
      Given a ticket.md with frontmatter, sections, and an existing work log
      When a phase transition lands and the hook stamps it
      Then the file content equals the pre-stamp content plus the single appended line

    @phase-work-log-stamp.TB1.R2
    Scenario: A ticket without a Work Log section gains one before the entry
      Given a ticket.md that has no "## Work Log" heading
      When a phase transition lands
      Then the file ends with a "## Work Log" section containing the stamped line

  Rule: Edits that are not phase transitions leave the work log untouched

    @phase-work-log-stamp.TB1.R3
    Scenario: A ticket.md edit that does not touch phase adds no stamp
      Given a ticket.md at phase implement
      When the agent lands an Edit that only rewords the Goal line
      Then the work log is unchanged

    @phase-work-log-stamp.TB1.R3
    Scenario: Re-declaring the same phase adds no stamp
      Given a ticket.md at phase implement
      When the agent lands an Edit whose old and new payloads carry phase implement
      Then the work log is unchanged

    @phase-work-log-stamp.TB1.R3
    Scenario: Files that are not a tickets-namespace ticket.md are never stamped
      Given a spec.md in a ticket folder and a ticket.md outside the tickets namespace
      When the agent lands edits changing phase-like lines in each
      Then neither file is modified by the hook

    @phase-work-log-stamp.TB1.R3
    Scenario: A full-file Write rewrite is a documented no-op
      Given a ticket.md at phase implement
      When the agent lands a Write replacing the whole file with phase verify
      Then no stamp is appended
      # A Write payload carries no prior content at PostToolUse time, so the
      # from-phase is unknowable post-hoc — documented detection limit.

  Rule: No bdd phase file instructs fabricating a timestamp

    @phase-work-log-stamp.SM1.R1
    Scenario: The bdd phase files carry no fabricated-timestamp transition template
      Given the shipped skill files DISCOVERY.md, SCENARIOS.md, TDD.md, and VERIFY.md
      When their exit checklists are scanned
      Then none instructs writing a "- {timestamp} Complete:" transition entry
