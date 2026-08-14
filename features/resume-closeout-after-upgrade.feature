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
Feature: Resume interrupted closeout after a Codex upgrade

  @resume-closeout-after-upgrade.NTB1.R1
  Rule: resume-closeout-after-upgrade.NTB1.R1 — Blocked closeout records one bounded handoff and the first matching protected task receives its continuation

    Scenario: A blocked old task records the one observed pending pull request
      Given closeout has observed one exact pull request at a controlled write time in a Codex task still named by the current profile activation marker
      When closeout attempts and cannot obtain its transcript-bound protected current-task binding
      Then one advisory handoff records current-profile provenance, the canonical repository identity, canonical local checkout identity, numeric pull request, observed head, the millisecond-precision write time, and an expiry exactly 24 hours later
      And the handoff contains no branch, worktree, transcript, merge-decision, approval, or cleanup-authority field
      And no claim record exists for the new handoff
      And the current task output directs the user to start a new protected Codex task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario Outline: Valid pull-request integer boundaries are persisted
      Given blocked protected closeout observes pull request <pull request> at a controlled time
      When closeout cannot obtain a protected current-task binding
      Then one advisory handoff records numeric pull request <pull request>
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

      Examples:
        | pull request |
        | 1 |
        | 9007199254740991 |

    @rejection
    Scenario: A normally protected closeout does not create a handoff
      Given closeout has observed one exact pull request in a protected Codex task
      When closeout obtains the protected current-task binding
      Then no restart handoff is stored
      And closeout proceeds with its normal protected binding

    @rejection
    Scenario: A never-protected Codex task cannot create a restart handoff
      Given a Codex task not named by the current profile activation marker observes one exact pull request
      When it reaches the blocked-closeout path
      Then no handoff or claim record is stored
      And a later protected task receives no closeout continuation from that attempt
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the unprotected task's normal blocked-closeout output is still emitted
      And the task output reports that this task is not the current protected task

    @rejection
    Scenario Outline: A formerly protected task without the current marker cannot create a handoff
      Given no handoff exists and blocked closeout's task id <marker state> at a controlled time
      When closeout runs its blocked-restart path
      Then no handoff or claim record is created
      And the current task output reports that this task is not the current protected task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

      Examples:
        | marker state |
        | is superseded by another task in the profile activation marker |
        | has no profile activation marker |

    @rejection
    Scenario Outline: An ambiguous closeout target does not create a handoff
      Given marker-current protected closeout observes <count> pull requests in a Codex task that must restart
      When closeout cannot obtain a protected current-task binding
      Then no restart handoff is stored
      And the current task output reports that one exact pull request is required
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

      Examples:
        | count |
        | zero |
        | two |

    @rejection
    Scenario Outline: Hostile observed identities are not persisted
      Given marker-current blocked closeout observes <hostile identity>
      When closeout cannot obtain a protected current-task binding
      Then no handoff exists in the profile store
      And the current task output reports invalid observed closeout identity
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

      Examples:
        | hostile identity |
        | a flag-shaped pull request value |
        | a negative pull request value |
        | a non-integer pull request value |
        | a non-hexadecimal observed head |
        | an uppercase hexadecimal observed head |
        | pull request zero |
        | pull request 9007199254740992, one above the maximum safe integer |
        | a 39-character hexadecimal observed head |
        | a 41-character hexadecimal observed head |

    @rejection
    Scenario: A traversal-shaped repository identity cannot escape the handoff store
      Given marker-current blocked closeout observes a repository identity whose normalized key targets a known path outside the profile store
      When closeout cannot obtain a protected current-task binding
      Then no handoff exists in the profile store or at that known external target
      And the current task output reports invalid repository identity
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: Concurrent blocked closeouts create only one handoff
      Given two blocked-closeout invocations from the same marker-current protected task have distinct pull-request identities and reach handoff creation for the same repository before either write commits at a controlled time
      When both writes are released to commit concurrently
      Then exactly one handoff exists for that repository
      And its pull request, observed head, and repository identity all come from the same winning writer
      And that winning writer is told the handoff was saved and to start a new protected Codex task
      And the losing task output reports the existing pending closeout
      And the losing task output names its unsaved numeric pull request and directs the user to supply it manually in a new protected task

    @rejection
    Scenario: A newer task revokes a staged handoff before commit
      Given marker-current blocked closeout stages one valid handoff at a controlled time
      And a newer protected task replaces the profile activation marker before atomic commit
      When the staged handoff attempts to commit
      Then no handoff or claim record is created
      And the blocked task output reports that this task is not the current protected task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: A second pending handoff does not overwrite the first
      Given one fresh unclaimed handoff exists for one pull request and observed head one tick before its controlled expiry in the current repository
      When blocked closeout attempts to record a different pull request for that repository
      Then the original handoff bytes remain unchanged
      And the current task output reports the existing pending closeout
      And the current task output names the unsaved numeric pull request and directs the user to supply it manually in a new protected task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: Re-recording the same pending pull request is idempotent
      Given one fresh unclaimed handoff exists for the same pull request, observed head, and repository at a controlled time
      When blocked closeout attempts to record that identical pull request identity again
      Then the original handoff bytes remain unchanged
      And the current task output reports that the pending closeout is already saved
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: A changed head does not rewrite a saved pull request
      Given one fresh unclaimed handoff exists for a pull request and its original observed head at a controlled time
      When blocked closeout observes the same pull request number with a different head
      Then the original handoff bytes remain unchanged
      And the current task output reports that the saved pull request head changed
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: An ambiguous existing store is not rewritten
      Given two distinct fresh valid handoff records normalize to the current canonical repository at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then both existing handoff bytes remain unchanged
      And no third handoff is created
      And the current task output reports ambiguous pending closeout state
      And the current task output directs the user to inspect GitHub and restart closeout with the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario Outline: One valid and one unusable matching handoff block blind replacement
      Given one fresh valid handoff and one <unusable state> handoff both normalize to the current canonical repository at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then both existing handoff bytes remain unchanged
      And no third handoff is created
      And the current task output reports ambiguous pending closeout state
      And the current task output directs the user to inspect GitHub and restart closeout with the numeric pull request

      Examples:
        | unusable state |
        | expired |
        | invalid |
        | an unsafe-path match |
        | a store-key identity disagreement |

    @rejection
    Scenario: A valid match and a store-key identity disagreement remain ambiguous
      Given one fresh valid matching handoff and one record under the current repository key naming a different validated canonical repository exist at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then both existing handoff bytes remain unchanged
      And no third handoff is created
      And the current task output reports ambiguous pending closeout state
      And the current task output directs the user to inspect GitHub and restart closeout with the numeric pull request

    Scenario Outline: Authorized creation replaces multiple unusable matching handoffs
      Given <unusable records> all normalize to the current canonical repository at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity
      And no unusable matching handoff remains
      And no claim record bound to any superseded handoff remains
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

      Examples:
        | unusable records |
        | two expired handoffs |
        | one expired and one invalid handoff |

    @rejection
    Scenario: Interrupted multi-record replacement preserves the complete old generation
      Given two unusable matching handoffs exist and their repository-store generation swap is interrupted before atomic commit
      When blocked closeout records one exact pull request for that repository at a controlled time
      Then both original unusable handoffs remain byte-for-byte complete
      And no fresh handoff or staged generation is discoverable
      And the current task output directs the user to retry with the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: Foreign handoffs do not block writing for the current repository
      Given one fresh handoff exists for a foreign repository at a controlled time
      When blocked closeout records one exact pull request for the current repository
      Then one fresh handoff contains the newly observed pull request identity for the current repository
      And the foreign handoff bytes remain unchanged
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: An unrelated malformed store entry does not block authorized creation
      Given one malformed handoff is stored under a normalized key for a different repository at a controlled time
      When blocked closeout records one exact pull request for the current repository
      Then one fresh handoff contains the newly observed pull request identity for the current repository
      And the unrelated malformed handoff bytes remain unchanged
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario Outline: One invalid existing handoff is replaced explicitly
      Given one existing handoff for the current repository has <invalid state> at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity
      And the previous invalid handoff is no longer discoverable
      And no claim record bound to the previous invalid handoff remains
      And the current task output reports that invalid pending closeout state was replaced

      Examples:
        | invalid state |
        | a malformed schema |
        | a store key whose decoded repository identity disagrees |
        | missing profile provenance |
        | foreign profile provenance |
        | an impossible clock |
        | an excessive lifetime |

    Scenario: An expired handoff can be replaced
      Given one expired handoff exists for the current repository at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity
      And the previous expired handoff is no longer discoverable

    Scenario: An expired claimed handoff can be replaced
      Given one expired handoff and claim record exist for the current repository at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity
      And the expired claim record is removed

    Scenario Outline: Authorized creation clears an unbound repository claim
      Given the current repository store contains <unbound claim> at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff exists and no unbound claim remains
      And a later current protected task can claim and receive that handoff

      Examples:
        | unbound claim |
        | an orphan claim without a handoff |
        | a claim naming a different absent handoff |

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
    Scenario: A non-current task cannot overwrite the current task's claim
      Given one fresh handoff is claimed by the current protected task while this blocked task is not current and never held that claim at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then the claimed handoff and claim record bytes remain unchanged
      And the blocked task output reports that this task is not the current protected task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: A superseded marker task cannot rewrite its former claim
      Given blocked closeout previously owned a fresh handoff claim that now belongs to the current task at a controlled time
      When blocked closeout attempts to record that pull request again
      Then the handoff and current claim record bytes remain unchanged
      And the blocked task output reports that this task is not the current protected task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: A current claim owner records the same pending closeout idempotently
      Given blocked closeout's current protected task already claims a fresh matching handoff with the same pull-request identity at a controlled time
      When blocked closeout attempts to record that pull request again
      Then the handoff and current claim record bytes remain unchanged
      And the current task output reports that the same pending closeout was already saved and remains claimed by this task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: A current claim owner cannot overwrite its handoff with a different identity
      Given blocked closeout's current protected task already claims a fresh matching handoff at a controlled time
      When blocked closeout attempts to record a different pull-request identity for that repository
      Then the handoff and current claim record bytes remain unchanged
      And the current task output reports the existing pending closeout identity conflict
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: A fresh handoff with a stale claim is preserved for restart discovery
      Given one fresh handoff is claimed by a task whose profile activation marker is no longer current at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then the original handoff and stale claim record bytes remain unchanged
      And the current task output reports the existing pending closeout
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario Outline: Closeout without one canonical repository does not create a handoff
      Given marker-current blocked closeout resolves <repository count> canonical repository identities
      When closeout cannot obtain a protected current-task binding
      Then no restart handoff is stored
      And the current task output directs the user to retry with the numeric pull request from a canonical repository checkout
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

      Examples:
        | repository count |
        | zero |
        | two |

    @rejection
    Scenario Outline: Closeout without one canonical checkout identity does not create a handoff
      Given marker-current blocked closeout resolves <checkout state> at a controlled time
      When closeout runs its blocked-restart path
      Then no handoff or claim record is created
      And the current task output directs the user to retry from one canonical local checkout with the numeric pull request

      Examples:
        | checkout state |
        | no checkout identity |
        | a non-canonical checkout identity |

    Scenario: The matching restarted task receives one concrete continuation
      Given an unclaimed handoff for the current repository is one tick before expiry at a controlled time
      When a protected Codex task starts in that repository
      Then SessionStart output contains one command naming only the numeric pending pull request
      And SessionStart output requests no transcript, branch, or worktree selection
      And the existing protected SessionStart proof is still emitted
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: The handoff written by blocked closeout is consumed after restart
      Given blocked protected closeout writes its observed numeric pull request at a controlled time
      When the next protected Codex task starts in the same canonical repository before expiry
      Then SessionStart output contains one command naming that same numeric pull request
      And the resulting claim record names the new current task
      And the existing protected SessionStart proof is still emitted
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: Installed Codex SessionStart wiring delivers the pending closeout
      Given the CLI-installed Codex profile has one fresh handoff for the current repository at a controlled time
      When the installed profile dispatches its real SessionStart hook for a new protected task
      Then the hook output contains one continuation naming the numeric pending pull request
      And the real profile-store claim names that new protected task
      And the existing protected SessionStart proof is still emitted
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario Outline: Installed Codex SessionStart wiring rejects an unusable handoff
      Given the CLI-installed Codex profile has one <unusable handoff> for the current repository at a controlled time
      When the installed profile dispatches its real SessionStart hook for a new protected task
      Then the hook output contains no closeout continuation or unusable handoff identity
      And the real profile store contains no claim for that handoff
      And the existing protected SessionStart proof is still emitted

      Examples:
        | unusable handoff |
        | expired handoff |
        | handoff carrying foreign profile provenance |

    Scenario: The installed continuation invokes the shipped guarded closeout surface
      Given the CLI-installed SessionStart hook emits its exact continuation and atomically claims a fresh matching handoff
      When the protected task invokes that exact continuation against the CLI-installed closeout surface
      Then the shipped closeout guard accepts the numeric pull request without requiring a prior transcript
      And the guard creates a fresh cleanup preview before any destructive apply
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: Shipped guarded cleanup removes the real profile receipt
      Given the CLI-installed SessionStart hook claimed a fresh matching handoff and emitted its exact continuation
      When the shipped closeout guard re-observes unchanged merged state and completes cleanup
      Then the real profile store contains neither that handoff nor its claim
      And the command observer records removal of only the preview-recorded branch and worktree targets

    Scenario: Shipped blocked-closeout wiring records the pending closeout
      Given the CLI-installed Codex closeout surface observes one exact pull request at a controlled time
      When that shipped surface reaches its blocked restart path
      Then the real profile store contains one advisory handoff recording the observed pull request identity
      And the shipped output directs the user to start a new protected Codex task
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: A handoff with unknown fields remains forward compatible
      Given a fresh matching handoff contains one unrecognized field at a controlled time
      When a protected Codex task starts in the same canonical repository
      Then SessionStart output contains one continuation naming the numeric pending pull request
      And SessionStart output contains no content derived from the unrecognized field
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A matching repository handoff from another checkout is not delivered
      Given a fresh handoff for the current canonical repository names a different local checkout identity
      When a protected Codex task starts in this checkout at a controlled time
      Then SessionStart output reports that the pending closeout belongs to another checkout without naming cleanup targets
      And no continuation or destructive command is emitted
      And the handoff bytes remain unchanged and no claim record is created
      And the existing protected SessionStart proof is still emitted

    Scenario: A handoff written before a plugin-version change is consumed afterward
      Given blocked protected closeout writes its observed numeric pull request under the current profile identity and old plugin version at a controlled time
      When the plugin version is upgraded and the next protected Codex task starts in the same canonical repository before expiry
      Then SessionStart output contains one command naming that same numeric pull request
      And SessionStart output contains no untrusted-provenance notice
      And the existing protected SessionStart proof is still emitted
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: The installed profile upgrade preserves a pending handoff end to end
      Given the CLI-installed pre-upgrade Codex profile writes one pending handoff at a controlled time
      When the CLI performs the real profile-plugin upgrade and a new protected task starts in that repository
      Then SessionStart output contains one continuation naming the same numeric pending pull request
      And the real profile-store claim names the new protected task
      And SessionStart output contains no untrusted-provenance notice
      And the existing protected SessionStart proof is still emitted

    Scenario: Equivalent repository remote spellings match one handoff
      Given a fresh handoff records the canonical identity derived from an HTTPS remote at a controlled time
      When a protected Codex task starts from the same repository using its equivalent SSH remote at that controlled time
      Then SessionStart output contains one continuation naming the numeric pending pull request
      And the existing protected SessionStart proof is still emitted
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: Case-only repository spelling differences match one handoff
      Given a fresh handoff records a mixed-case GitHub owner and repository at a controlled time
      When a protected Codex task starts from the same owner and repository with different letter case
      Then SessionStart output contains one continuation naming the numeric pending pull request
      And the existing protected SessionStart proof is still emitted
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    Scenario: Discovery selects one matching handoff among foreign handoffs
      Given one fresh matching handoff and two fresh foreign handoffs exist at a controlled time
      When a protected Codex task starts in the matching repository
      Then SessionStart output contains one continuation naming the matching numeric pull request
      And the matching handoff is claimed by the current task
      And the foreign handoff bytes remain unchanged

    Scenario: Discovery ignores an unrelated malformed store entry
      Given one fresh matching handoff and one malformed handoff under a normalized key for a different repository exist at a controlled time
      When a protected Codex task starts in the matching repository
      Then SessionStart output contains one continuation naming the matching numeric pull request
      And the matching handoff is claimed by the current task
      And the unrelated malformed handoff bytes remain unchanged
      And the existing protected SessionStart proof is still emitted
      And SessionStart output contains no invalid-state notice for the unrelated entry

    @rejection
    Scenario: A handoff-store failure still tells the user how to recover
      Given an initially empty store, one exact observed pull request, and handoff-store writes that fail while reads remain available
      When closeout cannot obtain a protected current-task binding
      Then no restart handoff is reported as saved
      And no handoff or claim record exists for that repository afterward
      And the current task output directs the user to retry from a new protected Codex task with the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario: An unreadable store blocks handoff creation without writing blind
      Given closeout has observed one exact pull request but the profile handoff store cannot be enumerated or read
      When closeout cannot obtain a protected current-task binding at a controlled time
      Then no handoff or claim record is created or mutated
      And the current task output reports that pending-closeout storage is unavailable
      And the current task output directs the user to retry with the numeric pull request

    @rejection
    Scenario: Interrupted first handoff creation exposes no partial record
      Given no handoff exists and persistence is interrupted after staging complete bytes but before atomic commit
      When blocked closeout records one exact pull request at a controlled time
      Then no committed handoff or staged temporary file is treated as discoverable current work
      And the current task output directs the user to retry with the numeric pull request
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario Outline: Interrupted handoff replacement preserves the complete old state
      Given one <existing state> handoff exists and replacement is interrupted after staging complete bytes but before atomic commit
      When blocked closeout records one exact pull request at a controlled time
      Then the original handoff bytes remain unchanged
      And no staged temporary file is treated as discoverable current work

      Examples:
        | existing state |
        | invalid |
        | expired |
        | expired with a claim |

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
  @resume-closeout-after-upgrade.TBU1.R1
  Rule: resume-closeout-after-upgrade.TBU1.R1 — A handoff is bound to one repository and claimed by at most one current Codex task

    Scenario: Concurrent protected starts elect one current claimant
      Given two protected Codex tasks race to install the profile activation marker before discovering one fresh handoff at a controlled time
      When both SessionStart flows continue after one atomic marker winner is observable
      Then exactly one claim record names the marker-winning task
      And only the marker-winning task receives the continuation while the other receives a normal SessionStart proof and a not-current notice
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

    @rejection
    Scenario Outline: A newer task revokes a staged claim mutation before commit
      Given the marker-current protected task stages <claim mutation> for a fresh matching handoff at a controlled time
      And a newer protected task replaces the profile activation marker before atomic commit
      When the staged claim mutation attempts to commit
      Then the handoff and prior claim bytes remain unchanged
      And no continuation is emitted to the superseded task
      And SessionStart output reports that this task is not the current protected task

      Examples:
        | claim mutation |
        | first claim creation |
        | stale-claim reclaim |

    @rejection
    Scenario: A different task cannot consume a live claim
      Given a fresh handoff is claimed by the marker-current protected task at a controlled time
      When an older protected task that is no longer current reruns discovery in the same repository
      Then SessionStart output contains no continuation or destructive command
      And the claim still names the original task and the handoff bytes remain unchanged
      And the existing protected SessionStart proof is still emitted
      And SessionStart output reports that this task is not the current protected task

    @rejection
    Scenario: A repeated startup in the same current task does not duplicate delivery
      Given the marker-current protected task already received one continuation and owns its fresh handoff claim at a controlled time
      When that same task dispatches SessionStart again in the repository
      Then SessionStart output contains no second closeout continuation
      And the handoff and claim record bytes remain unchanged
      And the existing protected SessionStart proof is still emitted

    Scenario: A task reclaims a claim whose owner is no longer current
      Given a fresh matching handoff was claimed by a Codex task whose profile activation marker names a different current task at a controlled time
      When a newly protected Codex task atomically installs itself as the profile activation marker and starts in the same repository
      Then the claim record names the new current task
      And the handoff bytes remain unchanged
      And only the new current task receives the continuation

    Scenario: A newer protected task revokes an overlapping former owner before re-delivery
      Given one running protected task owns a fresh claim and a newer protected task becomes the profile activation marker at a controlled time
      When the newer task atomically reclaims the handoff
      Then only the newer task receives the continuation after reclaim
      And the handoff bytes remain unchanged

    @rejection
    Scenario: A missing activation marker does not authorize reclaim
      Given a protected Codex task passed its startup proof, claimed a fresh matching handoff, and then its profile activation marker was removed
      When that same proof-carrying task runs handoff discovery in the same repository at a controlled time
      Then startup output reports that this task is not the current protected task
      And the handoff and claim record bytes remain unchanged
      And no continuation or destructive command is emitted

    @rejection
    Scenario: A claim from another profile installation is not reclaimed
      Given a fresh matching handoff has a claim carrying provenance from another Codex profile installation
      When a protected Codex task starts in the same repository at a controlled time
      Then SessionStart output reports untrusted pending closeout state without naming its target
      And the handoff and claim record bytes remain unchanged
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A superseded claim owner cannot resume after reclaim
      Given a new current task reclaimed a fresh matching handoff at a controlled time
      When the superseded task attempts closeout
      Then its closeout output reports that this task is not the current protected task
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

    @rejection
    Scenario: Interrupted first claim creation exposes no partial owner
      Given a fresh matching handoff has no claim and claim persistence is interrupted after staging complete bytes but before atomic commit
      When a protected Codex task starts in the same repository at a controlled time
      Then no committed claim or staged claim is treated as a live owner
      And the handoff bytes remain unchanged
      And SessionStart emits no closeout continuation
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: Interrupted claim reclaim preserves the complete former owner
      Given a fresh matching handoff has one complete stale-owner claim and reclaim is interrupted after staging the new owner but before atomic commit
      When the new protected Codex task starts in the same repository at a controlled time
      Then the former claim owner bytes remain unchanged and no staged claim is treated as current
      And the handoff bytes remain unchanged
      And SessionStart emits no closeout continuation
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: An orphan claim record cannot trigger discovery
      Given a claim record exists without its corresponding handoff
      When a protected Codex task starts in the same repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without crashing
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A store key that disagrees with its handoff repository is rejected
      Given a handoff stored under the current repository key names a different validated canonical repository
      When a protected Codex task starts in the current repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without naming its target
      And the handoff bytes remain unchanged
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: Repository disagreement takes precedence over foreign provenance
      Given a handoff under the current repository key names a different validated canonical repository and carries foreign profile provenance
      When a protected Codex task starts in the current repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without naming its target or reporting provenance
      And no continuation or destructive command is emitted

    @rejection
    Scenario: Structural failure takes precedence over foreign provenance
      Given a matching handoff has unreadable structure and bytes that also resemble foreign profile provenance
      When a protected Codex task starts in the repository at a controlled time
      Then SessionStart output reports invalid pending closeout structure without echoing its contents
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: Foreign profile provenance takes precedence over expiry
      Given a matching handoff has foreign profile provenance and is also expired at a controlled time
      When a protected Codex task starts in the repository
      Then SessionStart output reports untrusted pending closeout state without naming its target or reporting expiry
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: Handoff rejection takes precedence over malformed claim state
      Given an expired matching handoff also has a malformed claim record at a controlled time
      When a protected Codex task starts in the repository
      Then SessionStart output reports expired pending closeout state without echoing claim contents
      And no continuation or destructive command is emitted

    @rejection
    Scenario: Unsafe path takes precedence over malformed contents
      Given a handoff-store symlink escapes the store and its target also contains malformed handoff bytes
      When a protected Codex task starts in the repository at a controlled time
      Then SessionStart output reports an unsafe handoff-store path without echoing or decoding the target contents
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A claim bound to another handoff is rejected
      Given a fresh matching handoff is paired with a claim bound to a different handoff
      When a protected Codex task starts in the same repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without naming its target
      And the handoff and claim record bytes remain unchanged
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A handoff symlink escaping the store is rejected
      Given a handoff directory entry resolves outside the profile handoff store
      When a protected Codex task starts in the matching repository at a controlled time
      Then SessionStart output reports an unsafe handoff-store path without reading the external target
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A claim-record symlink escaping the store is rejected
      Given a claim directory entry resolves outside the profile handoff store
      When a protected Codex task starts in the matching repository at a controlled time
      Then SessionStart output reports an unsafe handoff-store path without reading the external target
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario Outline: A store path replaced by a symlink before mutation is rejected
      Given a symlink to a known external target is already in place at the profile store path when <mutation> begins
      When the protected closeout flow attempts that mutation at a controlled time
      Then the external target bytes remain unchanged
      And pending closeout output reports an unsafe handoff-store path without echoing external contents
      And no continuation or destructive command is emitted

      Examples:
        | mutation |
        | handoff creation |
        | invalid-handoff replacement |
        | claim creation |
        | claim reclaim |
        | repository-store generation swap |
        | receipt removal |

    @rejection
    Scenario: A handoff without current-profile provenance is rejected
      Given a schema-valid handoff has no profile provenance field
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
    Scenario: Reinstalling the Codex profile invalidates an old pending handoff
      Given a fresh handoff was written by the prior Codex profile installation at a controlled time
      When the reinstalled profile dispatches SessionStart for a protected task in the matching repository
      Then SessionStart output reports untrusted pending closeout state without naming its target
      And SessionStart output directs the user to recover the pull request from GitHub and restart closeout with its numeric identifier
      And no continuation or destructive command is emitted

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
        | a negative pull request value |
        | a non-integer pull request value |
        | a repository identity with path traversal |
        | a non-hexadecimal observed head |
        | an uppercase hexadecimal observed head |
        | pull request zero |
        | pull request 9007199254740992, one above the maximum safe integer |
        | a 39-character hexadecimal observed head |
        | a 41-character hexadecimal observed head |

    Scenario Outline: Valid pull-request integer boundaries are delivered
      Given a fresh matching handoff stores numeric pull request <pull request> at a controlled time
      When a protected Codex task starts in that repository
      Then SessionStart output contains one continuation naming numeric pull request <pull request>
      And the handoff is claimed by the current task
      And the existing protected SessionStart proof is still emitted

      Examples:
        | pull request |
        | 1 |
        | 9007199254740991 |

    @rejection
    Scenario: An unprotected Codex task cannot discover or claim a handoff
      Given a fresh matching handoff exists at a controlled time
      When an unprotected Codex task starts in that repository
      Then no continuation or destructive command is emitted
      And the handoff and claim state remain unchanged
      And the normal unprotected Codex startup output is still emitted
      And startup output reports that this task is not the current protected task

    @rejection
    Scenario Outline: The command observer covers destructive escape routes
      Given guarded closeout is blocked before destructive apply at a controlled time
      When the flow attempts <escape route>
      Then the command observer reports the forbidden mutation

      Examples:
        | escape route |
        | a force-push |
        | local branch deletion |
        | remote ref deletion |
        | a hard reset |
        | tag mutation |
        | remote mutation |
        | a worktree command |
        | direct filesystem removal of a cleanup target |
        | a merge mutation |
        | an approval mutation |
        | a pull-request mutation |

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
