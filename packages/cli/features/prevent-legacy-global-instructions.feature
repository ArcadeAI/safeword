# The move-boundary race hooks and registered historical full-file digest are
# exercised by focused Vitest integration tests. Keep this behavior contract in
# Gherkin while excluding duplicate Cucumber glue from the acceptance lane.
@manual @surface.openai-codex @surface.safeword-cli
Feature: Prevent stale Safeword guidance from blocking Codex users

  @prevent-legacy-global-instructions.TBU1.R1
  Rule: prevent-legacy-global-instructions.TBU1.R1 — Current Safeword project paths remain authoritative when legacy profile guidance is present

    Scenario: Session context explicitly supersedes retired Safeword paths
      Given an enrolled Safeword project and legacy global Codex guidance
      When the Safeword Codex session hook loads standing context
      Then the first context block names ".project/" as the ticket location
      And it names ".safeword/guides/" as the guide location
      And it explicitly supersedes the retired Safeword paths

    @rejection
    Scenario: Retired paths are never presented as current Safeword authority
      Given an enrolled Safeword project and legacy global Codex guidance
      When the Safeword Codex session hook loads standing context
      Then the first context block does not direct the builder to retired Safeword paths
      And it directs the builder to the current project paths

  @prevent-legacy-global-instructions.TBU1.R2
  Rule: prevent-legacy-global-instructions.TBU1.R2 — Conflicting profile guidance is diagnosed without changing user-owned content

    Scenario Outline: Read-only diagnostics classify conflicting global guidance without mutation
      Given a Codex profile AGENTS file containing <guidance_state> guidance
      When the builder runs <command>
      Then the result names the active profile AGENTS file
      And it reports <classification> for the profile guidance
      And it recommends <disposition>
      And the profile AGENTS file is unchanged

      Examples:
        | guidance_state | command      | classification   | disposition                  |
        | exact legacy   | codex status | exact legacy     | recoverable cleanup          |
        | exact legacy   | doctor       | exact legacy     | recoverable cleanup          |
        | edited legacy  | codex status | suspected legacy | manual review without cleanup |
        | edited legacy  | doctor       | suspected legacy | manual review without cleanup |

    @rejection
    Scenario: User-authored global guidance is not reported as Safeword legacy content
      Given a Codex profile AGENTS file with unrelated user guidance
      When the builder runs Codex status
      Then no legacy Safeword guidance finding is reported

  @prevent-legacy-global-instructions.TBU1.R3
  Rule: prevent-legacy-global-instructions.TBU1.R3 — Positively identified historical content has an explicit recoverable cleanup path

    @rejection
    Scenario: Edited legacy guidance is refused during cleanup
      Given a Codex profile AGENTS file containing edited legacy guidance
      When the builder requests legacy-guidance cleanup
      Then cleanup is refused as unsafe
      And the profile AGENTS file remains unchanged

    @rejection
    Scenario: Guidance changed after diagnosis is preserved
      Given exact legacy guidance was diagnosed as recoverably remediable
      And the profile AGENTS file changes before cleanup
      When the builder requests the reported cleanup
      Then cleanup is refused because the source changed
      And the changed profile AGENTS file remains unchanged

    @rejection
    Scenario: Guidance changed at the move boundary is restored
      Given exact legacy guidance was confirmed for cleanup
      And the profile AGENTS file changes as cleanup moves it
      When the builder applies the reported cleanup action
      Then cleanup is refused because the moved artifact changed
      And the changed profile AGENTS file is restored as the active guidance

    @rejection
    Scenario: A concurrently recreated active file is preserved during restoration
      Given exact legacy guidance was confirmed for cleanup
      And changed guidance is moved while another file recreates the active path
      When the builder applies the reported cleanup action
      Then cleanup is refused because the moved artifact changed
      And the concurrently recreated active file remains unchanged
      And the moved guidance is preserved at a named recovery path

    Scenario: Exact legacy guidance is moved to a recoverable backup
      Given a Codex profile AGENTS file matching a registered historical revision
      When the builder applies the reported cleanup action
      Then the active profile AGENTS file is absent
      And its original content is available in a named backup

    @rejection
    Scenario: Existing cleanup backup is never overwritten
      Given exact legacy guidance and an existing cleanup backup
      When the builder requests legacy-guidance cleanup
      Then cleanup is refused because the backup path is occupied
      And both the profile guidance and existing backup remain unchanged
