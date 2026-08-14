# Behavior source for 07VEZF. Executable proof is intended to live in
# packages/cli/tests/hooks/closeout-session-binding.test.ts and
# packages/cli/tests/commands/codex-hook.test.ts,
# packages/cli/tests/closeout-cleanup.test.ts, and
# packages/cli/tests/integration/closeout-host-adapters.test.ts. Those suites exercise the
# profile handoff store and shipped SessionStart hook at their real boundaries.
#
# Reproducing the same filesystem, profile, and hook fixtures as Cucumber steps
# would duplicate the integration harness without adding confidence.
# Every phrase saying no destructive command is run or emitted is checked through
# the command observer for local and remote branch or ref deletion, force-push,
# hard reset, tag or remote mutation, worktree commands, direct filesystem removal
# of cleanup targets, merge, approval, and pull-request mutations.
@proof.vitest @surface.openai-codex @surface.closeout-cleanup-guard
Feature: Revalidate cleanup after resuming a Codex closeout

  @resume-closeout-after-upgrade.TBU1.R2
  Rule: resume-closeout-after-upgrade.TBU1.R2 — Resumption re-observes pull-request and repository state and never carries merge or cleanup authority

    @rejection
    Scenario Outline: Changed closeout targets remain untouched after restart
      Given a claimed handoff and fresh guarded closeout preview whose <reference> then has <drift>
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output contains <observation> for the numeric pull request
      And the command observer records no branch or worktree removal command
      And the command observer records no merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

      Examples:
        | reference | drift | observation |
        | handoff-recorded pull-request head | a different pull-request head | head changed since handoff |
        | freshly observed pull request | a pull request that is not merged | pull request is not merged |
        | handoff-recorded canonical repository | a changed canonical repository remote | repository identity changed |
        | preview-recorded branch target | a missing branch target | branch target is missing |
        | preview-recorded branch identity | a recreated branch target | branch target identity changed |
        | preview-recorded worktree target | a missing worktree target | worktree target is missing |
        | preview-recorded worktree identity | a recreated worktree target | worktree target identity changed |
        | freshly observed pull request | a pull request that no longer resolves | pull request is unavailable |

    @rejection
    Scenario: Pull-request identity drift takes precedence over a missing cleanup target
      Given a claimed handoff whose pull-request head changed and whose preview-recorded branch target is also missing
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports that the head changed since handoff for the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

    @rejection
    Scenario: Pull-request head drift takes precedence over an unmerged state
      Given a claimed handoff whose pull-request head changed and whose pull request is also unmerged
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports that the head changed since handoff for the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

    @rejection
    Scenario: An unavailable pull request takes precedence over recorded head mismatch
      Given a claimed handoff whose pull request no longer resolves and whose recorded head differs from the last observable head
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports that the numeric pull request is unavailable
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

    @rejection
    Scenario: Repository drift takes precedence over pull-request head drift
      Given a claimed handoff whose canonical repository changed and whose pull-request head also changed
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports that repository identity changed for the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

    @rejection
    Scenario: Repository drift takes precedence over an unavailable pull request
      Given a claimed handoff whose canonical repository changed and whose pull request no longer resolves
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports that repository identity changed for the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

    @rejection
    Scenario: An unmerged pull request takes precedence over recreated cleanup targets
      Given a claimed handoff whose pull request is unmerged and whose preview-recorded branch target was recreated
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports that the numeric pull request is not merged
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

    @rejection
    Scenario: Recreated target identity takes precedence over a missing target
      Given a claimed handoff whose preview-recorded branch target was recreated and whose preview-recorded worktree target is missing
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports that branch target identity changed for the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

    Scenario: Successful guarded cleanup clears the handoff
      Given the restarted task claimed an unchanged pending closeout handoff one tick before its controlled expiry
      When the existing closeout guard proves cleanup completed at that time
      Then the command observer records removal of only the branch and worktree targets recorded by the fresh cleanup preview
      And those targets correspond to the handoff-recorded pull request and head as re-observed by the fresh preview
      And no other state-changing command is run
      And the handoff and claim record are removed

    @rejection
    Scenario Outline: Receipt removal failure is reported after cleanup
      Given destructive cleanup completed before expiry but removing <failed record> fails at a controlled time
      When closeout reports its final state
      Then closeout output reports incomplete receipt cleanup
      And <remaining state>

      Examples:
        | failed record | remaining state |
        | the claim record | the handoff and claim record remain available for guarded recovery |
        | the handoff record | the handoff remains available for a new claim and the old claim is absent |

    @rejection
    Scenario Outline: A later task safely resolves a receipt left after cleanup
      Given destructive cleanup completed but a fresh handoff receipt with a claim whose owner is no longer current survived and <target> is now missing at a controlled time
      When a later protected task atomically reclaims the receipt and resumes guarded closeout
      Then closeout output reports <observation> for the numeric pull request
      And the command observer records no branch or worktree removal command
      And the command observer records no merge, approval, or pull-request state-changing command
      And the surviving handoff remains unchanged and the claim names the later task for guarded recovery until expiry
      And closeout output directs the user to resolve the remaining cleanup target

      Examples:
        | target | observation |
        | the branch target | branch target is missing |
        | the worktree target | worktree target is missing |

    Scenario: A later task clears a receipt after cleanup already completed
      Given a merged pull request has a surviving fresh handoff receipt with a claim whose owner is no longer current but both preview-recorded branch and worktree targets are absent at a controlled time
      When a later protected task resumes guarded closeout from that receipt
      Then closeout output reports that cleanup was already complete for the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the surviving handoff and current claim record are removed

    @rejection
    Scenario: Failed guarded cleanup preserves the handoff until expiry
      Given the restarted task claimed an unchanged pending closeout handoff one tick before its controlled expiry
      When the existing closeout guard reports a blocker
      Then the handoff and current claim record bytes remain unchanged at that time
      And closeout output reports the blocker
      And the command observer records no branch or worktree removal command
      And the command observer records no merge, approval, or pull-request state-changing command

    Scenario: A user dismisses a permanently undeliverable handoff
      Given guarded closeout reports terminal repository or checkout identity drift for a claimed handoff at a controlled time
      When the current protected task explicitly confirms dismissal of that numeric pending pull request
      Then the handoff and its claim are removed
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario Outline: Unsafe dismissal preserves a pending handoff
      Given <dismissal state> for a pending closeout handoff at a controlled time
      When dismissal is attempted
      Then the handoff and claim bytes remain unchanged
      And closeout output reports <dismissal result>

      Examples:
        | dismissal state | dismissal result |
        | the acting task is not marker-current | this task is not the current protected task |
        | guarded closeout has not reported terminal drift | the pending closeout remains deliverable |
        | explicit confirmation is absent | explicit confirmation is required |

    Scenario: The shipped closeout surface dismisses terminal drift only after confirmation
      Given the CLI-installed closeout surface reports terminal checkout identity drift for a claimed handoff
      When the marker-current protected task explicitly confirms dismissal through that shipped surface
      Then the real profile store contains neither the handoff nor its claim
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: Expiry revokes an in-flight cleanup before destructive apply
      Given an unchanged claimed handoff expires after guarded preview but before apply
      When the original task invokes guarded apply at the controlled expiry
      Then closeout output reports that the handoff and claim expired before apply
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the expired handoff and claim record bytes remain unchanged

    @rejection
    Scenario Outline: Restarted closeout cannot remove its current execution context
      Given the restarted protected task is running on <current context> selected by the fresh cleanup preview at a controlled time
      When the restarted task invokes the existing closeout guard
      Then closeout output reports that the current execution context is protected
      And the command observer records no branch or worktree removal command
      And the handoff and current claim record bytes remain unchanged

      Examples:
        | current context |
        | the current branch |
        | the current worktree |

    @rejection
    Scenario Outline: Current execution context follows earlier safety observations and precedes target drift
      Given a claimed handoff whose cleanup target is the task's current execution context and also has <other state>
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output reports <observation> for the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the handoff and current claim record remain unchanged

      Examples:
        | other state | observation |
        | an unmerged pull request | pull request is not merged |
        | a recreated target identity | current execution context is protected |
