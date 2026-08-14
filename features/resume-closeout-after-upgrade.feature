# Behavior source for 07VEZF. Executable proof is intended to live in
# packages/cli/tests/hooks/closeout-session-binding.test.ts and
# packages/cli/tests/commands/codex-hook.test.ts,
# packages/cli/tests/closeout-cleanup.test.ts, and
# packages/cli/tests/integration/closeout-host-adapters.test.ts. Those suites exercise the
# profile handoff store and shipped SessionStart hook at their real boundaries.
#
# Reproducing the same filesystem, profile, and hook fixtures as Cucumber steps
# would duplicate the integration harness without adding confidence.
@proof.vitest @surface.openai-codex @surface.closeout-cleanup-guard
Feature: Resume interrupted closeout after a Codex upgrade

  @resume-closeout-after-upgrade.NTB1.R1
  Rule: resume-closeout-after-upgrade.NTB1.R1 — Blocked closeout records one bounded handoff and the first matching protected task receives its continuation

    Scenario: A blocked old task records the one observed pending pull request
      Given closeout has observed one exact pull request at a controlled write time in a Codex task still named by the current profile activation marker
      When closeout attempts and cannot obtain its transcript-bound protected current-task binding
      Then one advisory handoff records current-profile provenance, the canonical repository identity, numeric pull request, observed head, the millisecond-precision write time, and an expiry exactly 24 hours later
      And no claim record exists for the new handoff
      And the current task output directs the user to start a new protected Codex task
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    Scenario Outline: Valid pull-request integer boundaries are persisted
      Given blocked protected closeout observes pull request <pull request> at a controlled time
      When closeout cannot obtain a protected current-task binding
      Then one advisory handoff records numeric pull request <pull request>
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

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
      Given a Codex task that never held the current profile activation marker observes one exact pull request
      When it reaches the blocked-closeout path
      Then no handoff or claim record is stored
      And a later protected task receives no closeout continuation from that attempt
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the unprotected task's normal blocked-closeout output is still emitted

    @rejection
    Scenario Outline: A formerly protected task without the current marker cannot create a handoff
      Given no handoff exists and blocked closeout's task id <marker state> at a controlled time
      When closeout runs its blocked-restart path
      Then no handoff or claim record is created
      And the current task output reports that its protection is no longer current
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command

      Examples:
        | marker state |
        | is superseded by another task in the profile activation marker |
        | has no profile activation marker |

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
      Given blocked closeout observes a repository identity whose normalized key targets a known path outside the profile store
      When closeout cannot obtain a protected current-task binding
      Then no handoff exists in the profile store or at that known external target
      And the current task output reports invalid repository identity
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    Scenario: Concurrent blocked closeouts create only one handoff
      Given two blocked closeouts with distinct pull-request identities reach handoff creation for the same repository before either write commits at a controlled time
      When both writes are released to commit concurrently
      Then exactly one handoff exists for that repository
      And its pull request, observed head, and repository identity all come from the same winning writer
      And that winning writer receives the normal blocked-closeout output
      And the losing task output reports the existing pending closeout

    @rejection
    Scenario: A second pending handoff does not overwrite the first
      Given one fresh unclaimed handoff exists for one pull request and observed head one tick before its controlled expiry in the current repository
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
      Given two distinct fresh valid handoff records normalize to the current canonical repository at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then both existing handoff bytes remain unchanged
      And no third handoff is created
      And the current task output reports ambiguous pending closeout state

    @rejection
    Scenario Outline: One valid and one unusable matching handoff block blind replacement
      Given one fresh valid handoff and one <unusable state> handoff both normalize to the current canonical repository at a controlled time
      When blocked closeout attempts to record another pull request for that repository
      Then both existing handoff bytes remain unchanged
      And no third handoff is created
      And the current task output reports ambiguous pending closeout state

      Examples:
        | unusable state |
        | expired |
        | invalid |

    Scenario Outline: Authorized creation replaces multiple unusable matching handoffs
      Given <unusable records> all normalize to the current canonical repository at a controlled time
      When blocked closeout records one exact pull request for that repository
      Then exactly one fresh handoff contains the newly observed pull request identity
      And no unusable matching handoff remains
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
      And the current task output reports that invalid pending closeout state was replaced

      Examples:
        | invalid state |
        | a malformed schema |
        | missing profile provenance |
        | foreign profile provenance |
        | an impossible clock |
        | an excessive lifetime |

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
      And the blocked task output reports that its protection is no longer current

    @rejection
    Scenario: A blocked former claim owner cannot rewrite its handoff
      Given blocked closeout previously owned a fresh handoff claim that now belongs to the current task
      When blocked closeout attempts to record that pull request again
      Then the handoff and current claim record bytes remain unchanged
      And the blocked task output reports that its protection is no longer current
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

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

    Scenario: Installed Codex SessionStart wiring delivers the pending closeout
      Given the CLI-installed Codex profile has one fresh handoff for the current repository at a controlled time
      When the installed profile dispatches its real SessionStart hook for a new protected task
      Then the hook output contains one continuation naming the numeric pending pull request
      And the real profile-store claim names that new protected task
      And the existing protected SessionStart proof is still emitted
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

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
      And the existing protected SessionStart proof is still emitted

    Scenario: A handoff written before a plugin-version change is consumed afterward
      Given blocked protected closeout writes its observed numeric pull request under the current profile identity and old plugin version at a controlled time
      When the plugin version is upgraded and the next protected Codex task starts in the same canonical repository before expiry
      Then SessionStart output contains one command naming that same numeric pull request
      And SessionStart output contains no untrusted-provenance notice
      And the existing protected SessionStart proof is still emitted
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

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
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    Scenario: Case-only repository spelling differences match one handoff
      Given a fresh handoff records a mixed-case GitHub owner and repository at a controlled time
      When a protected Codex task starts from the same owner and repository with different letter case
      Then SessionStart output contains one continuation naming the numeric pending pull request
      And the existing protected SessionStart proof is still emitted

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
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

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
      And no branch, worktree, merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario Outline: Interrupted handoff replacement preserves the complete old state
      Given one <existing state> handoff exists and replacement is interrupted after staging complete bytes but before atomic commit
      When blocked closeout records one exact pull request and a protected task then runs SessionStart at a controlled time
      Then the original handoff bytes remain unchanged
      And no staged temporary file is treated as discoverable current work
      And SessionStart <startup observation>

      Examples:
        | existing state | startup observation |
        | invalid | reports invalid pending closeout state without naming its target |
        | expired | reports an expired pending closeout without naming its pull request or head |
        | expired with a claim | reports an expired pending closeout without naming its pull request or head |

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
      And the expired handoff bytes remain unchanged
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
      And the foreign handoff bytes remain unchanged
      And no claim record is created for the foreign handoff
      And the existing protected SessionStart proof is still emitted
      And SessionStart output contains no pending-closeout selection notice

    @rejection
    Scenario Outline: An unusable foreign handoff remains silent
      Given a <unusable state> handoff is stored under a normalized key for a different canonical repository at a controlled time
      When a protected Codex task starts in the current repository
      Then SessionStart output contains no pending-closeout, expiry, or invalid-state notice
      And no continuation or destructive command is emitted
      And the foreign handoff and claim state remain unchanged
      And the existing protected SessionStart proof is still emitted

      Examples:
        | unusable state |
        | expired |
        | schema-invalid but repository-decodable |

    @rejection
    Scenario: A same-named repository under another owner is foreign
      Given an unclaimed handoff differs from the current canonical repository only by owner at a controlled time
      When a protected Codex task starts
      Then SessionStart output does not disclose or name the foreign handoff
      And no continuation or destructive command is emitted
      And the foreign handoff bytes remain unchanged
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: A handoff expires at the exact lifetime boundary
      Given an otherwise matching unclaimed handoff for the current repository reaches its expiry at a controlled time
      When a protected Codex task starts at that time
      Then SessionStart output reports an expired pending closeout without naming its pull request or head
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario: An expired claimed handoff is not presented as current work
      Given an otherwise matching handoff and claim record reach expiry at a controlled time
      When a protected Codex task starts at that time
      Then SessionStart output reports an expired pending closeout without naming its pull request or head
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
      Given two distinct fresh valid on-disk handoff records normalize to the current canonical repository at a controlled time
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports ambiguous pending closeout state without naming either target
      And neither handoff is claimed or mutated
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario Outline: One valid and one unusable matching handoff remain ambiguous
      Given one fresh valid handoff and one <unusable state> handoff both normalize to the current canonical repository
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports ambiguous pending closeout state without naming either target
      And neither handoff is claimed or mutated
      And the existing protected SessionStart proof is still emitted

      Examples:
        | unusable state |
        | expired |
        | invalid |

    @rejection
    Scenario Outline: Multiple unusable matching handoffs remain inert during discovery
      Given <unusable records> all normalize to the current canonical repository at a controlled time
      When a protected Codex task starts
      Then SessionStart output reports unusable pending closeout state without naming any target
      And no handoff is claimed or mutated
      And the existing protected SessionStart proof is still emitted

      Examples:
        | unusable records |
        | two expired handoffs |
        | one expired and one invalid handoff |

    @rejection
    Scenario: An empty handoff store emits no continuation
      Given no handoff or claim record exists for the repository at a controlled time
      When a protected Codex task starts in that repository at that time
      Then it emits only its normal SessionStart proof with no closeout continuation
      And SessionStart output contains no pending-closeout selection notice

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
      And the handoff bytes remain unchanged
      And only the new current task receives the continuation

    Scenario: A newer protected task revokes an overlapping former owner before re-delivery
      Given one running protected task owns a fresh claim and a newer protected task becomes the profile activation marker at a controlled time
      When the newer task atomically reclaims the handoff
      Then only the newer task receives the continuation after reclaim
      And the former owner is denied by the existing closeout guard before any state-changing command
      And the handoff bytes remain unchanged

    @rejection
    Scenario: A missing activation marker does not authorize reclaim
      Given a protected Codex task passed its startup proof, claimed a fresh matching handoff, and then its profile activation marker was removed
      When an unprotected Codex task runs SessionStart in the same repository at a controlled time
      Then startup output reports that protected handoff discovery was skipped
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

    Scenario: Repeated discovery by the current claim owner re-emits the same advisory
      Given this protected Codex task already owns the live claim for a fresh matching handoff
      When SessionStart discovery runs again at a controlled time
      Then the same closeout continuation is emitted to the current claim owner
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
    Scenario: A store key that disagrees with its handoff repository is rejected
      Given a handoff stored under the current repository key names a different validated canonical repository
      When a protected Codex task starts in the current repository at a controlled time
      Then SessionStart output reports invalid pending closeout state without naming its target
      And the handoff bytes remain unchanged
      And no continuation or destructive command is emitted
      And the existing protected SessionStart proof is still emitted

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
    Scenario Outline: A store path replaced by a symlink before mutation is rejected
      Given a symlink to a known external target is already in place at the profile store path when <mutation> begins
      When the protected closeout flow attempts that mutation at a controlled time
      Then the external target bytes remain unchanged
      And pending closeout output reports invalid or unavailable store state without echoing external contents
      And no continuation or destructive command is emitted

      Examples:
        | mutation |
        | handoff creation |
        | invalid-handoff replacement |
        | claim creation |
        | claim reclaim |
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
      Given a claimed handoff and fresh guarded closeout preview whose <reference> then has <drift>
      When the restarted task invokes the existing closeout guard at a controlled time
      Then closeout output contains <observation> for the numeric pull request
      And no branch or worktree removal command is run
      And no merge, approval, or pull-request state-changing command is run
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
    Scenario: Repository drift takes precedence over pull-request head drift
      Given a claimed handoff whose canonical repository changed and whose pull-request head also changed
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
      Given the restarted task claimed an unchanged pending closeout handoff at a controlled time
      When the existing closeout guard proves cleanup completed
      Then the command observer records removal of only the branch and worktree targets recorded by the fresh cleanup preview
      And those targets correspond to the handoff-recorded pull request head and branch
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
      Given destructive cleanup completed but a fresh handoff receipt survived and <target> is now missing at a controlled time
      When a later protected task resumes guarded closeout from that receipt
      Then closeout output reports <observation> for the numeric pull request
      And no branch or worktree removal command is run
      And no merge, approval, or pull-request state-changing command is run
      And the surviving handoff and current claim record remain unchanged for guarded recovery until expiry
      And closeout output directs the user to resolve the remaining cleanup target

      Examples:
        | target | observation |
        | the branch target | branch target is missing |
        | the worktree target | worktree target is missing |

    Scenario: A later task clears a receipt after cleanup already completed
      Given a merged pull request has a surviving fresh handoff receipt but both preview-recorded branch and worktree targets are absent at a controlled time
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
      And no branch or worktree removal command is run
      And no merge, approval, or pull-request state-changing command is run

    @rejection
    Scenario: Expiry revokes an in-flight cleanup before destructive apply
      Given a claimed handoff expires after guarded preview but before apply while a new blocked closeout replaces the expired receipt
      When the original task invokes guarded apply at the controlled expiry
      Then closeout output reports that the original handoff and claim are no longer current
      And the command observer records no branch, worktree, merge, approval, or pull-request state-changing command
      And the replacement handoff bytes remain unchanged

    @rejection
    Scenario Outline: Restarted closeout cannot remove its current execution context
      Given the restarted protected task is running on <current context> selected by the fresh cleanup preview at a controlled time
      When the restarted task invokes the existing closeout guard
      Then closeout output reports that the current execution context is protected
      And no branch or worktree removal command is run
      And the handoff and current claim record bytes remain unchanged

      Examples:
        | current context |
        | the current branch |
        | the current worktree |
