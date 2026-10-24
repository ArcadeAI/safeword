Feature: Review complete branch changes before builders finish

  @branch-review.TBU1.R1
  Rule: branch-review.TBU1.R1 — The review selects and accounts for the complete branch against the ticket

    @demo @surface.safeword-cli
    Scenario: A multi-file feature is reviewed from the integration merge base
      Given a clean BDD branch changes only eligible authored files across several commits
      And the ticket describes behavior those files must deliver
      When the builder runs the shared Safeword branch-review command
      Then the result names the computed merge-base revision and reviewed head revision
      And every committed path is accounted for against the ticket behavior
      And the result reports current freshness and complete coverage

    @rejection
    Scenario: A caller cannot shrink the branch by naming a later base
      Given a BDD branch has relevant changes before its latest commit
      When the builder requests a review with a later base
      Then the review still inventories changes from the integration merge base

  @branch-review.TBU1.R2
  Rule: branch-review.TBU1.R2 — Findings are prioritized and actionable across files

    @rejection
    Scenario: A cross-file behavior gap is explained
      Given a branch changes two files that together violate a ticket scenario
      When the builder reviews the branch
      Then the finding names the affected behavior, relevant files, consequence, and priority

  @branch-review.TBU1.R3
  Rule: branch-review.TBU1.R3 — Later changes to reviewed work need a fresh review

    @rejection
    Scenario: A code fix during verification cannot inherit the earlier review
      Given a saved branch review covered the implementation at exit
      And verification changes an authored implementation file
      When the builder tries to finish the ticket
      Then the earlier review is stale and the changed work needs review

    Scenario: Routine ticket records do not restart branch review
      Given a saved branch review covered the implementation at exit
      And verification commits only phase, timestamp, Work Log, and evidence records
      When the builder tries to finish the ticket
      Then the earlier review remains current for the reviewed work

    @rejection
    Scenario: Changed ticket goals require a fresh review
      Given a saved branch review covered the implementation against the accepted ticket goals
      And an accepted ticket goal changes after that review
      When the builder tries to finish the ticket
      Then the earlier review is stale and the changed goal needs review

  @branch-review.TBU1.R4
  Rule: branch-review.TBU1.R4 — Implementation exit checks the saved review before advancing

    Scenario: A current complete review lets implementation finish
      Given a multi-loop ticket has a current review covering every branch change
      When the builder leaves implementation
      Then the ticket advances to verification

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    @rejection
    Scenario Outline: Each supported local host refuses changed work at implementation exit
      Given a BDD ticket is at implementation exit in <host>
      And a saved review covers an earlier branch snapshot
      And an authored file has a nonignored uncommitted edit since that clean review
      When the builder tries to leave implementation
      Then <host> keeps the ticket in implementation and names the stale review

      Examples:
        | host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |
        | OpenCode CLI |

    Scenario: A partial review can continue with clear disclosure
      Given a current review names an omitted changed path and its reason
      And the agent records a decision to continue with that exact omission
      When the builder leaves implementation
      Then the ticket advances with a summary that names the omission and calls coverage partial

    @rejection
    Scenario: A partial review cannot advance without acknowledgement
      Given a current review names an omitted changed path
      And the agent has not acknowledged that omission
      When the builder tries to leave implementation
      Then the ticket stays in implementation and names the unacknowledged path

    @rejection
    Scenario: No branch changes cannot pass as a completed review
      Given a multi-loop ticket has no committed or nonignored uncommitted branch changes
      When the builder tries to leave implementation
      Then the result says no branch changes were reviewed and requires a reasoned skip

  @branch-review.NTB1.R1
  Rule: branch-review.NTB1.R1 — The report distinguishes reviewed paths from omissions

    @rejection
    Scenario: A skipped generated path cannot count as complete coverage
      Given a branch has authored changes and an explicitly generated path
      When the builder reviews the branch
      Then the report names the generated path as omitted with its reason
      And the coverage is partial rather than complete

    @rejection
    Scenario: Sensitive file content stays out of the reviewer packet
      Given a branch commits an authored file and a credential-like file
      When the builder reviews the branch
      Then the credential-like path is named as omitted with its reason
      And the reviewer packet does not contain its content
      And coverage is partial

  @branch-review.NTB1.R2
  Rule: branch-review.NTB1.R2 — The report tells a builder what to do next in plain language

    @rejection
    Scenario: A builder sees the next action for a partial review
      Given a review could not read an authored changed path
      When the builder reads its result
      Then the result names that path, explains the gap, and gives a concrete next action in plain language

  @branch-review.NTB1.R3
  Rule: branch-review.NTB1.R3 — Freshness and coverage are reported separately

    @rejection
    Scenario: Missing integration base cannot claim a completed review
      Given the integration base cannot be determined
      When the builder reviews the branch
      Then coverage is none and the result says no branch work was reviewed

    @rejection
    Scenario: A dirty branch is current but only partially covered
      Given a branch has uncommitted nonignored changes when review begins
      When the builder reviews the branch
      Then the result reports current freshness, partial coverage, and the uncommitted paths

    @rejection
    Scenario: A failed later review pass leaves its paths omitted
      Given a branch review needs more than one bounded pass
      And a later pass fails to return a review
      When the builder reads the result
      Then coverage is partial and the failed pass's paths are named as omitted

    @rejection
    Scenario: Stale review still shows its missing evidence
      Given a saved review has omitted paths
      And authored work changes after the reviewed snapshot
      When the builder checks the saved result
      Then it reports stale freshness and still names the omitted paths
