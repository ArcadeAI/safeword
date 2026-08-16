# Behavior source for in-progress ticket 07VEZF. The existing closeout binding
# tests cover only part of this contract; keep the feature out of executable
# lanes until every scenario has named proof.
@wip @surface.openai-codex @surface.closeout-cleanup-guard
Feature: Resume interrupted closeout after a Codex upgrade

  @resume-closeout-after-upgrade.NTB1.R1
  Rule: resume-closeout-after-upgrade.NTB1.R1 — Blocked closeout records one bounded handoff and the first matching protected task receives its continuation

    Scenario: A blocked old task records the one observed pending pull request
      Given closeout has observed one exact pull request at a controlled write time in a Codex task that must restart
      When closeout cannot obtain a protected current-task binding
      Then one advisory handoff records current-profile provenance, the canonical repository identity, numeric pull request, observed head, the millisecond-precision write time, and an expiry exactly 24 hours later
      And no claim record exists for the new handoff
      And the current task output directs the user to start a new protected Codex task
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario: A normally protected closeout does not create a handoff
      Given closeout has observed one exact pull request in a protected Codex task
      When closeout obtains the protected current-task binding
      Then no restart handoff is stored
      And closeout proceeds with its normal protected binding

    @rejection
    Scenario Outline: An ambiguous closeout target does not create a handoff
      Given closeout observes <count> pull requests in a Codex task that must restart
      When closeout cannot obtain a protected current-task binding
      Then no restart handoff is stored
      And the current task output reports that one exact pull request is required
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

      Examples:
        | count |
        | zero |
        | two |

    @rejection
    Scenario Outline: Hostile observed identities are not persisted
      Given blocked closeout observes <hostile identity>
      When closeout cannot obtain a protected current-task binding
      Then no handoff exists in the profile store
      And the current task output reports invalid observed closeout identity
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

      Examples:
        | hostile identity |
        | a flag-shaped pull request value |
        | a non-hexadecimal observed head |
        | pull request zero |
        | an overflowing pull request value |
        | a shortened hexadecimal observed head |
        | an overlong hexadecimal observed head |

    @rejection
    Scenario: A traversal-shaped repository identity cannot escape the handoff store
      Given blocked closeout observes a repository identity whose normalized key targets a known path outside the profile store
      When closeout cannot obtain a protected current-task binding
      Then no handoff exists in the profile store or at that known external target
      And the current task output reports invalid repository identity
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    Scenario: Concurrent blocked closeouts create only one handoff
      Given two blocked closeouts with distinct pull-request identities reach handoff creation for the same repository before either write commits at a controlled time
      When both writes are released to commit concurrently
      Then exactly one handoff exists for that repository
      And it is schema-valid and names exactly one complete observed pull request identity
      And the winning task receives the normal blocked-closeout output
      And the losing task output reports the existing pending closeout

    @rejection
    Scenario: A second pending handoff does not overwrite the first
      Given one fresh unclaimed handoff exists for one pull request and observed head in the current repository at a controlled time
      When blocked closeout attempts to record a different pull request for that repository
      Then the original handoff bytes remain unchanged
      And the current task output reports the existing pending closeout

    Scenario: Re-recording the same pending pull request is idempotent
      Given one fresh unclaimed handoff exists for the same pull request, observed head, and repository at a controlled time
      When blocked closeout attempts to record that identical pull request identity again
      Then the original handoff bytes remain unchanged
      And the current task output reports that the pending closeout is already saved

    @rejection
    Scenario: A changed head does not rewrite a saved pull request
      Given one fresh unclaimed handoff exists for a pull request and its original observed head at a controlled time
      When blocked closeout observes the same pull request number with a different head
      Then the original handoff bytes remain unchanged
      And the current task output reports that the saved pull request head changed

    @rejection
    Scenario: An ambiguous existing store is not rewritten
      Given two distinct handoff records normalize to the current canonical repository
      When blocked closeout attempts to record another pull request for that repository
      Then both existing handoff bytes remain unchanged
      And no third handoff is created
      And the current task output reports ambiguous pending closeout state

    Scenario: An expired handoff can be replaced
      Given one expired handoff exists for the current repository at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity

    Scenario: An expired claimed handoff can be replaced
      Given one expired handoff and claim record exist for the current repository at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity
      And the expired claim record is removed

    Scenario Outline: A handoff at its expiry boundary can be replaced
      Given one handoff with <claim state> reaches its exact expiry at a controlled millisecond
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity
      And no expired claim record remains

      Examples:
        | claim state |
        | no claim |
        | a claim record |

    @rejection
    Scenario: A handoff claimed by a current task is not overwritten
      Given one fresh handoff is claimed by a different current task and blocked closeout never held that claim at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then the claimed handoff and claim record bytes remain unchanged
      And the current task output reports the existing pending closeout

    @rejection
    Scenario: A blocked former claim owner cannot rewrite its handoff
      Given blocked closeout previously owned a fresh handoff claim that now belongs to the current task
      When blocked closeout attempts to record that pull request again
      Then the handoff and current claim record bytes remain unchanged
      And the blocked task output reports that its claim is no longer current
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario: A fresh handoff with a stale claim is preserved for restart discovery
      Given one fresh handoff is claimed by a task whose profile activation marker is no longer current at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then the original handoff and stale claim record bytes remain unchanged
      And the current task output reports the existing pending closeout

    @rejection
    Scenario Outline: Closeout without one canonical repository does not create a handoff
      Given blocked closeout resolves <repository count> canonical repository identities
      When closeout cannot obtain a protected current-task binding
      Then no restart handoff is stored
      And the current task output directs the user to retry with the numeric pull request from a canonical repository checkout
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

      Examples:
        | repository count |
        | zero |
        | two |

    Scenario: The matching restarted task receives one concrete continuation
      Given an unclaimed handoff for the current repository is one tick before expiry at a controlled time
      When a protected Codex task starts in that repository
      Then SessionStart output contains one command naming only the numeric pending pull request
      And SessionStart output requests no transcript, branch, or worktree selection
      And the existing protected SessionStart proof is still emitted
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    Scenario: The handoff written by blocked closeout is consumed after restart
      Given blocked protected closeout writes its observed numeric pull request at a controlled time
      When the next protected Codex task starts in the same canonical repository before expiry
      Then SessionStart output contains one command naming that same numeric pull request
      And the resulting claim record names the new current task
      And the existing protected SessionStart proof is still emitted
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    Scenario: A handoff written before a profile upgrade is consumed afterward
      Given blocked protected closeout writes its observed numeric pull request under the current profile identity and old plugin version
      When the plugin version is upgraded and the next protected Codex task starts in the same canonical repository before expiry
      Then SessionStart output contains one command naming that same numeric pull request
      And SessionStart output contains no untrusted-provenance notice
      And the existing protected SessionStart proof is still emitted
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    Scenario: Equivalent repository remote spellings match one handoff
      Given a fresh handoff records the canonical identity derived from an HTTPS remote at a controlled time
      When a protected Codex task starts from the same repository using its equivalent SSH remote
      Then SessionStart output contains one continuation naming the numeric pending pull request
      And the existing protected SessionStart proof is still emitted
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario: A handoff-store failure still tells the user how to recover
      Given closeout has observed one exact pull request and handoff-store writes fail while reads remain available
      When closeout cannot obtain a protected current-task binding
      Then no restart handoff is reported as saved
      And no handoff or claim record exists for that repository afterward
      And the current task output directs the user to retry from a new protected Codex task with the numeric pull request
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario Outline: Unaffected hosts do not create Codex restart handoffs
      Given blocked closeout runs in a <host> session with one exact pull request
      When that host reaches its normal blocked-closeout path
      Then no Codex restart handoff or claim record is stored
      And the host's normal blocked-closeout output is emitted

      Examples:
        | host |
        | Claude Code |
        | Cursor |

  @resume-closeout-after-upgrade.NTB1.R2
  Rule: resume-closeout-after-upgrade.NTB1.R2 — Expired, malformed, or foreign handoffs never surface as current work

    @rejection
    Scenario: An expired handoff is not presented as current work
      Given an otherwise matching unclaimed handoff for the current repository is past expiry at a controlled time
      When a protected Codex task starts
      Then SessionStart output reports an expired pending closeout without naming its pull request or head
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A malformed handoff is not presented as current work
      Given an otherwise matching handoff file for the current repository fails the handoff schema
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports an invalid pending closeout without echoing its contents
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A foreign handoff is not presented as current work
      Given an unclaimed handoff is recorded for a different canonical repository
      When a protected Codex task starts at a controlled time
      Then SessionStart output does not disclose or name the foreign handoff
      And no continuation or destructive command is emitted
      And the foreign handoff and claim record bytes remain unchanged
      And the existing protected SessionStart proof is still emitted
      And SessionStart output reports that no matching pending closeout was selected

    @rejection
    Scenario: A handoff expires at the exact lifetime boundary
      Given an otherwise matching unclaimed handoff for the current repository reaches its expiry at a controlled time
      When a protected Codex task starts at that time
      Then SessionStart output reports an expired pending closeout
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: An expired claimed handoff is not presented as current work
      Given an otherwise matching handoff and claim record reach expiry at a controlled time
      When a protected Codex task starts at that time
      Then SessionStart output reports an expired pending closeout
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A handoff with an excessive lifetime is not presented as current work
      Given a structurally valid handoff expires more than 24 hours after its recorded write time
      When a protected Codex task starts in the matching repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without naming its target
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario Outline: An impossible handoff clock is not presented as current work
      Given a structurally valid handoff has <clock defect> relative to the controlled current time
      When a protected Codex task starts in the matching repository
      Then SessionStart output reports invalid pending closeout state without naming its target
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

      Examples:
        | clock defect |
        | a write time in the future |
        | an expiry at its write time |
        | an expiry before its write time |
        | an expiry less than 24 hours after its write time |

    @rejection
    Scenario: An unreadable handoff store does not break protected startup
      Given SessionStart cannot enumerate or read the profile handoff store
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports that pending closeout discovery is unavailable
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario Outline: Discovery without one canonical repository cannot claim a handoff
      Given a fresh unclaimed handoff exists and SessionStart resolves <repository count> canonical repository identities
      When a protected Codex task starts at a controlled time
      Then no continuation or destructive command is emitted
      And the handoff and claim state remain unchanged
      And the existing protected SessionStart proof is still emitted
      And SessionStart output reports that discovery requires one canonical repository identity

      Examples:
        | repository count |
        | zero |
        | two |

    @rejection
    Scenario: Multiple matching handoffs are rejected as ambiguous
      Given two distinct on-disk handoff records have repository identities that normalize to the current canonical repository
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports ambiguous pending closeout state without naming either target
      And neither handoff is claimed or mutated
      And the existing protected SessionStart proof is still emitted

  @resume-closeout-after-upgrade.TBU1.R1
  Rule: resume-closeout-after-upgrade.TBU1.R1 — A handoff is bound to one repository and claimed by at most one current Codex task

    Scenario: The first matching task atomically claims the handoff
      Given two protected Codex tasks reach discovery for one fresh handoff before either claim commits at a controlled time
      When both claims are released to commit concurrently
      Then exactly one claim record names one task
      And only that task receives the continuation while the other receives a normal SessionStart proof and an already-claimed notice
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario: A different task cannot consume a live claim
      Given a fresh handoff is claimed by another current Codex task at a controlled time
      When this task starts in the same repository
      Then SessionStart output contains no continuation or destructive command
      And the claim still names the original task and the handoff bytes remain unchanged
      And the existing protected SessionStart proof is still emitted

    Scenario: A task reclaims a claim whose owner is no longer current
      Given a fresh matching handoff was claimed by a Codex task whose profile activation marker names a different current task at a controlled time
      When a protected Codex task starts in the same repository
      Then the claim record names the new current task
      And only the new current task receives the continuation

    @rejection
    Scenario: A superseded claim owner cannot resume after reclaim
      Given a new current task reclaimed a fresh matching handoff at a controlled time
      When the superseded task attempts closeout
      Then its closeout output reports that its claim is no longer current
      And it emits no continuation or destructive command

    @rejection
    Scenario Outline: A malformed claim record cannot trigger reclaim
      Given a fresh matching handoff has <claim defect>
      When a protected Codex task starts in the same repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without echoing the claim contents
      And the handoff and claim record bytes remain unchanged
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

      Examples:
        | claim defect |
        | a truncated owner claim record |
        | a structurally valid claim record with an invalid owner identity |

    @rejection
    Scenario: A failed atomic claim does not emit a continuation
      Given a fresh matching handoff exists but the claim store cannot commit a record
      When a protected Codex task starts in the same repository at a controlled time
      Then SessionStart output reports that pending closeout could not be claimed
      And no continuation or destructive command is emitted
      And the handoff remains unchanged
      And the existing protected SessionStart proof is still emitted

    Scenario: Repeated discovery by the current claim owner is idempotent
      Given this protected Codex task already owns the live claim for a fresh matching handoff
      When SessionStart discovery runs again at a controlled time
      Then no second closeout continuation is emitted
      And the claim record remains unchanged
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: An orphan claim record cannot trigger discovery
      Given a claim record exists without its corresponding handoff
      When a protected Codex task starts in the same repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without crashing
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A handoff symlink escaping the store is rejected
      Given a handoff directory entry resolves outside the profile handoff store
      When a protected Codex task starts in the matching repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without reading the external target
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A claim-record symlink escaping the store is rejected
      Given a claim directory entry resolves outside the profile handoff store
      When a protected Codex task starts in the matching repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without reading the external target
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A handoff without current-profile provenance is rejected
      Given a schema-valid handoff was not provably written by the current Codex profile
      When a protected Codex task starts in the matching repository at a controlled time
      Then SessionStart output reports an untrusted pending closeout without echoing its contents
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A handoff from a different profile installation is rejected
      Given a structurally valid handoff carries valid provenance from a different Codex profile installation
      When a protected Codex task starts in the matching repository at a controlled time
      Then SessionStart output reports untrusted pending closeout state without naming its target
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario Outline: Injection-shaped handoff identities are rejected
      Given a handoff passes structural JSON decoding but fails identity validation with <hostile identity>
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports an invalid pending closeout without echoing its contents
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

      Examples:
        | hostile identity |
        | a flag-shaped pull request value |
        | a repository identity with path traversal |
        | a non-hexadecimal observed head |
        | pull request zero |
        | an overflowing pull request value |
        | a shortened hexadecimal observed head |
        | an overlong hexadecimal observed head |

    @rejection
    Scenario: An unprotected Codex task cannot discover or claim a handoff
      Given a fresh matching handoff exists at a controlled time
      When an unprotected Codex task starts in that repository
      Then no continuation or destructive command is emitted
      And the handoff and claim state remain unchanged
      And the normal unprotected Codex startup output is still emitted
      And startup output reports that protected handoff discovery was skipped

    @rejection
    Scenario Outline: Unaffected agent hosts cannot discover or claim a Codex handoff
      Given a fresh matching Codex handoff exists at a controlled time
      When a <host> session starts in that repository
      Then no closeout continuation is emitted
      And the handoff and claim state remain unchanged
      And the host's normal startup output is still emitted
      And no Codex-specific output is added

      Examples:
        | host |
        | Claude Code |
        | Cursor |

  @resume-closeout-after-upgrade.TBU1.R2
  Rule: resume-closeout-after-upgrade.TBU1.R2 — Resumption re-observes pull-request and repository state and never carries merge or cleanup authority

    @rejection
    Scenario Outline: Changed closeout targets remain untouched after restart
      Given a claimed handoff whose fresh guarded closeout preview records a target that then has <drift>
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output contains <observation> for the numeric pull request
      And no branch or worktree removal command is run
      And no merge, approval, or pull-request state-changing command is run
      And the handoff and current claim record remain unchanged

      Examples:
        | drift | observation |
        | a different pull-request head | head changed since handoff |
        | a pull request that is not merged | pull request is not merged |
        | a changed canonical repository remote | repository identity changed |
        | a missing branch target | branch target is missing |
        | a recreated branch target | branch target identity changed |
        | a missing worktree target | worktree target is missing |
        | a recreated worktree target | worktree target identity changed |
        | a pull request that no longer resolves | pull request is unavailable |

    Scenario: Successful guarded cleanup clears the handoff
      Given the restarted task claimed an unchanged pending closeout handoff at a controlled time
      When the existing closeout guard proves cleanup completed
      Then the command observer records the expected branch and worktree removal commands
      And the handoff and claim record are removed

    Scenario: Cleared closeout is absent from later discovery
      Given no handoff or claim record exists for the repository at a controlled time
      When a later protected Codex task starts in that repository at that time
      Then it emits only its normal SessionStart proof with no closeout continuation

    @rejection
    Scenario: Receipt removal failure leaves an inert recoverable record
      Given destructive cleanup completed before expiry but removing the handoff or claim record fails at a controlled time
      When closeout reports its final state
      Then closeout output reports incomplete receipt cleanup
      And a later protected task re-observes the missing cleanup targets and runs no destructive command

    @rejection
    Scenario: Failed guarded cleanup preserves the handoff until expiry
      Given the restarted task claimed an unchanged pending closeout handoff one tick before its controlled expiry
      When the existing closeout guard reports a blocker
      Then the handoff and current claim record bytes remain unchanged at that time
      And closeout output reports the blocker
      And no branch or worktree removal command is run
      And no merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario: Restarted closeout cannot remove its current branch or worktree
      Given the restarted protected task is running on a branch or worktree selected by the fresh cleanup preview
      When the restarted task invokes the existing closeout guard
      Then closeout output reports that the current execution context is protected
      And no branch or worktree removal command is run
