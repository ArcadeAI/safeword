@prevent-retro-duplicate-issues
Feature: Prevent repeated retro findings from opening duplicate issues

  Retro runs can describe the same friction differently. Exact, code-derived
  canonical markers keep evidence on one issue without fuzzy merging.

  Rule: A canonical repro identity ignores model-assigned classification drift

    @prevent-retro-duplicate-issues.SM1.R1
    Scenario: New issue body contains both legacy and canonical markers
      Given a normalized retro finding
      When CLI triage creates its issue
      Then the body contains the legacy signature marker
      And the body contains a canonical marker derived from its normalized repro

    @prevent-retro-duplicate-issues.SM1.R1
    Scenario: Same repro with altered title category and surface finds the canonical issue
      Given an open issue with a canonical marker for a repro
      And a new finding has that repro but a different title category and surface
      When CLI triage processes the finding
      Then it creates no new issue
      And it records the encounter on the existing issue's occurrence ledger

  Rule: Exact compatibility precedes canonical lookup and does not merge near matches

    @prevent-retro-duplicate-issues.SM1.R2
    Scenario: Legacy signature match remains the first lookup
      Given an open issue containing only a matching legacy signature marker
      When CLI triage processes the matching finding
      Then it creates no new issue
      And it does not request canonical lookup

    @prevent-retro-duplicate-issues.SM1.R2
    Scenario: Canonical search rejects a body without the exact marker
      Given GitHub search returns an issue body with a different canonical marker
      When CLI triage searches for a canonical marker
      Then that issue is not considered a match

    @prevent-retro-duplicate-issues.SM1.R2
    Scenario: Different canonical repro identity creates a new issue
      Given an open issue with a different canonical marker
      When CLI triage processes a finding with no matching legacy signature
      Then it creates a new issue

  Rule: Canonical matches retain ordinary recurrence accounting

    @prevent-retro-duplicate-issues.SM1.R3
    Scenario: Canonical recurrence is idempotent within a session
      Given an open issue with a matching canonical marker and an existing session ledger entry
      When CLI triage processes that finding again in the same session
      Then it creates no new issue
      And it does not add another ledger occurrence
