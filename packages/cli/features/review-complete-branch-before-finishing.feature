@proof.vitest
Feature: Review complete branch changes before builders finish

  @branch-review.TBU1.R1
  Rule: branch-review.TBU1.R1 — The review selects and accounts for the complete branch against the ticket

    @demo @surface.safeword-cli
    Scenario: A multi-file feature is reviewed from the integration merge base
      Given a clean BDD branch changes only eligible authored files across several commits
      And the integration branch has advanced with unrelated changes since the branch point
      And the ticket describes behavior those files must deliver
      When the builder runs the shared Safeword branch-review command
      Then the result names the computed merge-base revision and reviewed head revision
      And every committed path is accounted for against the ticket behavior
      And upstream-only paths are not reported as reviewed or omitted ticket work
      And each reviewer packet includes the ticket's accepted goals and scenarios
      And the result reports current freshness and complete coverage

    @rejection
    Scenario: A caller cannot shrink the branch by naming a later base
      Given a BDD branch has relevant changes before its latest commit
      When the builder requests a review with a later base
      Then the command refuses that request without claiming completed coverage

    @rejection
    Scenario: A caller cannot shrink the branch by naming selected files
      Given a BDD branch changes several authored files
      When the builder requests a branch review naming only one changed file
      Then the command refuses that request without claiming completed coverage

    @rejection
    Scenario: A configured topic branch cannot hide earlier work
      Given the project configures a remote ref with the current topic branch's name as its integration ref
      And the branch has authored changes before its latest push
      When the builder reviews the branch
      Then the command refuses the topic ref without saving a review result

    Scenario: A topic may track a configured non-default integration branch
      Given the project configures origin/develop as its integration ref while origin/main is the remote default
      And the topic branch tracks origin/develop and has authored changes
      When the builder reviews the branch
      Then the result uses origin/develop as its base and accounts for the authored changes

    @rejection
    Scenario: Renamed, deleted, and force-added ignored paths remain in the inventory
      Given a branch renames one file, deletes another, and force-adds an ignored authored file
      When the builder reviews the branch
      Then the rename destination and force-added file are reviewed
      And the rename source and deleted file are named as omitted with reasons
      And coverage is partial rather than complete

  @branch-review.TBU1.R2
  Rule: branch-review.TBU1.R2 — Findings are prioritized and actionable across files

    @rejection
    Scenario: A cross-file behavior gap is explained
      Given a branch changes two files that together violate a ticket scenario
      When the builder reviews the branch
      Then both changed files and the violated ticket scenario appear in one review pass
      And a returned finding names the affected behavior, relevant files, consequence, and priority

  @branch-review.TBU1.R3
  Rule: branch-review.TBU1.R3 — Later changes to reviewed work need a fresh review

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: A code fix during verification cannot inherit the earlier review
      Given a saved branch review covered the implementation at exit
      And the ticket is in the done phase awaiting its closing status edit
      And verification changes an authored implementation file
      When the builder tries to set the ticket status to done
      Then the close is refused and the stale review and fresh-review action are named

    Scenario: Routine ticket records do not restart branch review
      Given a saved branch review covered the implementation at exit
      And verification commits only phase, timestamp, Work Log, and evidence records
      When the builder tries to finish the ticket
      Then the earlier review remains current for the reviewed work

    @rejection
    Scenario: Changed ticket goals require a fresh review
      Given a saved branch review covered the implementation against the accepted ticket goals
      And the ticket has left implementation
      And an accepted ticket goal changes after that review
      When the builder tries to finish the ticket
      Then completion is refused and the changed goal needs a fresh review

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
      And an authored code fix was <change> after that clean review
      When the builder tries to leave implementation
      Then <host> keeps the ticket in implementation and names the stale review

      Examples:
        | host | change |
        | Claude Code | committed |
        | Claude Code | left uncommitted |
        | OpenAI Codex | committed |
        | OpenAI Codex | left uncommitted |
        | Cursor | committed |
        | Cursor | left uncommitted |
        | OpenCode CLI | committed |
        | OpenCode CLI | left uncommitted |

    Scenario: A partial review can continue with clear disclosure
      Given a current review names an omitted changed path and its reason
      And the agent records a decision to continue with that exact omission
      When the builder leaves implementation
      Then the ticket advances with a summary that names the omission and calls coverage partial

    @rejection
    Scenario: A partial review cannot advance without acknowledgement
      Given a current review names an omitted changed path
      And an earlier review's acknowledgement names a different review and omitted path
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
    Scenario: An oversized authored file cannot count as completely reviewed
      Given a branch changes an authored file larger than one reviewer packet permits
      When the builder reviews the branch
      Then the report names the oversized path as omitted with its reason
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
