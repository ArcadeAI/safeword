# Behavior source for TFG4CR. The executable backing is the spawned-script
# Vitest coverage mapped scenario-by-scenario in
# .project/tickets/TFG4CR-closeout-preview-apply-convergence/bdd-proof.json.
# The primary guard suite is packages/cli/tests/closeout-cleanup.test.ts.
# Those tests exercise the
# installed cleanup guard, transcript fixtures, linked worktrees, authenticated
# spool validation, and acknowledgement-gated drain at their real boundaries.
#
# The feature is @proof.vitest because reproducing those filesystem, Git, and
# host-identity fixtures as Cucumber steps would duplicate the integration
# harness without adding confidence.
@proof.vitest
Feature: Closeout preview and apply convergence

  # Cleanup ordering, per-operation compare-and-swap, partial retry, and host parity
  # remain governed by features/close-completed-sessions-safely.feature.

  @closeout-preview-apply-convergence.NTB1.R1
  Rule: closeout-preview-apply-convergence.NTB1.R1 — Preview and apply converge on one bounded retrospective result

    @surface.openai-codex @surface.closeout-cleanup-guard @surface.retro-filer
    Scenario: An unsealed finding remains observable to retrospective extraction
      Given an unsealed transcript window contains one valid finding
      When retrospective extraction evaluates that window
      Then exactly one draft with that finding signature is spooled

    @surface.closeout-cleanup-guard @surface.retro-filer
    Scenario: Distinct findings survive signature deduplication
      Given one finding signature is already durably spooled
      And the bounded delta contains that duplicate plus two findings with distinct new signatures
      When retrospective extraction evaluates the delta
      Then the original draft remains and exactly two new drafts with the distinct signatures are durably spooled

    @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: Preview reporting advances only a bounded retrospective delta
      Given preview sealed a successful retrospective with no pending drafts and approved unchanged cleanup targets
      And the earlier transcript prefix would produce a duplicate finding if reprocessed
      And the bounded post-seal delta has no new findings
      When apply evaluates the appended preview report
      Then the seal advances only to the end of file captured when extraction began

    @surface.openai-codex @surface.closeout-cleanup-guard @surface.retro-filer
    Scenario: A finding appended during extraction is evaluated in the same invocation
      Given preview captured a fixed transcript end and began evaluating the bounded delta
      And a new finding is appended after that captured end but before the receipt is written
      And filing occurs outside the closeout invocation
      When the current closeout invocation observes transcript progress
      Then that finding is durably spooled from a subsequent bounded window and cleanup remains blocked

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: Continuously expanding extraction input fails closed after bounded windows
      Given every retrospective extraction window advances the live transcript
      When the current closeout invocation reaches its extraction-window limit
      Then the retrospective remains incomplete and cleanup remains blocked

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard @surface.retro-filer
    Scenario: A partially written transcript record is not sealed or lost
      Given preview reads a transcript whose final JSONL record has no terminating newline
      When preview seals retrospective evidence
      Then the seal stops at the prior complete record

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard @surface.retro-filer
    Scenario: A previously partial record is evaluated after completion
      Given preview sealed only through the record before a partial JSONL tail
      And that tail is now complete and contains a finding
      When the next apply invocation evaluates transcript progress
      Then that finding is durably spooled and cleanup remains blocked

    @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: A successful retro with no pending filing is reusable
      Given an automation invocation under the same authenticated task sealed a successful retrospective with no pending drafts without reporting into the task transcript
      And preview approved exact unchanged cleanup targets
      And the transcript is unchanged
      And the sealed prefix would create a duplicate finding if reprocessed
      When apply validates the approved cleanup
      Then no duplicate finding is produced or spooled and cleanup is applied

    @surface.openai-codex @surface.closeout-cleanup-guard @surface.retro-filer
    Scenario: A post-preview finding converges after filing
      Given the bounded post-seal delta produced a finding and blocked cleanup
      And that finding is durably filed and acknowledged
      And the sealed prefix would create a duplicate finding if reprocessed
      And filing activity appends a candidate for that same acknowledged finding
      When apply reruns from the same authenticated task against unchanged targets
      Then the original cleanup authorization is applied on that retry

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: A new post-preview finding blocks cleanup before filing
      Given the merged pull request number is 2431
      And preview sealed valid retrospective evidence and approved cleanup targets
      And the bounded post-seal delta contains a new finding
      And filing occurs outside the closeout invocation
      When apply evaluates that delta
      Then no cleanup occurs, a sealed draft and its exact spool path are reported for supported filing, and rerunning "bun .safeword/scripts/closeout-cleanup.ts --pr 2431" after filing is reported

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario Outline: Malformed sealed retrospective receipts are ignored and replaced
      Given the merged pull request number is 2431
      And preview approved exact unchanged cleanup targets
      And the cached retrospective receipt contains "<invalid-evidence>"
      When closeout validates the receipt
      Then the malformed receipt is ignored and retrospective extraction runs again

      Examples:
        | invalid-evidence |
        | a missing filing verdict |
        | a non-boolean filing verdict |
        | a negative pending-draft count |
        | a fractional sealed byte length |

  @closeout-preview-apply-convergence.NTB1.R2
  Rule: closeout-preview-apply-convergence.NTB1.R2 — Bootstrap and linked-worktree tasks receive an exact supported identity path

    @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: A fresh hook binding is consumed after sealing its exact transcript
      Given a fresh hook binding names the exact authenticated task, project root, and canonical transcript
      When closeout previews
      Then that exact transcript is sealed for apply and the accepted binding is consumed

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: A fresh hook binding cannot cross the authenticated ownership boundary
      Given the merged pull request number is 2431
      And a fresh hook binding names a different task than the authenticated current task
      When closeout attempts preview
      Then no binding is established, no transcript is sealed, no cleanup occurs, and "start one fresh task and run bun .safeword/scripts/closeout-cleanup.ts --pr 2431" is reported

    @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: OpenAI Codex Desktop binds the current task across linked worktrees
      Given OpenAI Codex Desktop has no consumable hook binding in the linked worktree
      And exactly one canonical transcript matches the authenticated current task identity
      When closeout previews
      Then it binds that task and seals its canonical transcript for apply

    @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: Apply recovers when preview's consumed hook binding is presented again
      Given preview's single-use hook binding is consumed and presented again
      And its named task, project root, and transcript agree with the authenticated current task
      And exactly one canonical transcript still matches the authenticated current task identity
      When apply reruns from the same task
      Then the sealed transcript evidence is accepted from the authenticated current task identity and the original cleanup authorization is applied

    @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: A consumed binding cannot override an authenticated current task
      Given a consumed binding from another task is presented again
      And the authenticated current task otherwise resolves exactly
      When apply reruns
      Then the authenticated current task is bound and its canonical transcript is sealed

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: A consumed hook binding cannot authenticate a task by itself
      Given the merged pull request number is 2431
      And a consumed hook binding is presented again
      And no authenticated current task identity matches it
      When closeout attempts preview
      Then no binding is established, no transcript is sealed, no cleanup occurs, and "start one fresh task and run bun .safeword/scripts/closeout-cleanup.ts --pr 2431" is reported

    @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario Outline: A bootstrap task can use the guard installed during the task
      Given the current Codex task "<change>" the binding hook after it began
      And exactly one canonical transcript matches the authenticated current task identity
      When closeout previews with the authenticated current task identity
      Then it seals that task's canonical transcript without requiring a new task

      Examples:
        | change |
        | installed |
        | upgraded |

    @rejection @surface.openai-codex @surface.closeout-cleanup-guard
    Scenario: A bootstrap identity cannot cross its project ownership boundary
      Given the merged pull request number is 2431
      And the authenticated current task identity resolves to one transcript owned by a separate clone with the same remote
      When closeout attempts preview from the caller's linked worktree
      Then no transcript is sealed, no cleanup occurs, and "start one fresh task and run bun .safeword/scripts/closeout-cleanup.ts --pr 2431" is reported

  @closeout-preview-apply-convergence.TBU1.R1
  Rule: closeout-preview-apply-convergence.TBU1.R1 — Authenticated filing evidence converges across worktree and session boundaries

    @surface.retro-filer @surface.closeout-cleanup-guard
    Scenario: Draining removes only acknowledged drafts
      Given the bound spool contains acknowledged and unacknowledged drafts
      When the supported drain runs
      Then only acknowledged drafts are removed and unacknowledged drafts remain with provenance

    @surface.retro-filer @surface.closeout-cleanup-guard
    Scenario: Authenticated fallback drains the named spool from another worktree and session
      Given the preferred filer is unavailable
      And a trusted continuation names one validated spool with pending drafts
      And another worktree has an unrelated spool with pending drafts
      When fallback filing runs from another active worktree and session
      Then those drafts receive durable acknowledgements, only the named spool is drained, and unrelated spools remain unchanged

    @rejection @surface.retro-filer @surface.closeout-cleanup-guard
    Scenario: A noncanonical fallback spool is refused
      Given one caller-selected noncanonical spool contains a valid pending draft
      When fallback filing is attempted
      Then no draft is filed or drained and the caller-selected spool remains byte-identical

    @rejection @surface.retro-filer @surface.closeout-cleanup-guard
    Scenario: Repeated apply preserves one unacknowledged draft
      Given a bounded delta has one pending unacknowledged draft
      When apply reruns while filing remains unavailable
      Then cleanup remains blocked and the spool stays byte-identical without another draft

    @rejection @surface.retro-filer @surface.closeout-cleanup-guard
    Scenario: A fallback spool with a modified sealed body is refused
      Given the continuation's named or resolved spool contains one pending draft record
      And the spool's sealed body fails validation
      When fallback filing is attempted
      Then no draft is filed or drained and both the named path and any resolved target remain byte-identical

    @rejection @surface.retro-filer @surface.closeout-cleanup-guard
    Scenario: Unavailable filing preserves authenticated drafts for retry
      Given the merged pull request number is 2431
      And neither the preferred filer nor its supported authenticated fallback can file
      When closeout reports the filing failure
      Then the exact drafts and spool path remain reported with their provenance, cleanup remains blocked, and rerunning "bun .safeword/scripts/closeout-cleanup.ts --pr 2431" after filing is reported

  @closeout-preview-apply-convergence.TBU1.R2
  Rule: closeout-preview-apply-convergence.TBU1.R2 — Repository or cleanup-target drift still prevents mutation

    # Regression assurance specific to excluding retro progress from cleanup authorization;
    # the broader operation protocol remains owned by close-completed-sessions-safely.

    @surface.closeout-cleanup-guard
    Scenario: Retrospective progress alone preserves cleanup authorization
      Given preview approved exact unchanged cleanup targets
      And only bounded transcript progress and durable filing acknowledgement changed
      When apply validates the original cleanup authorization
      Then cleanup is applied without approving a new digest

    @rejection @surface.closeout-cleanup-guard
    Scenario: Cleanup-target drift remains blocking when retro progress also advances
      Given preview approved exact cleanup targets
      And one approved repository or cleanup target changed before apply
      When apply validates the original cleanup authorization
      Then no cleanup target is mutated and closeout reports target drift
