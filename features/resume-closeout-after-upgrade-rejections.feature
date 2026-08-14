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
# the command observer for branch, worktree, merge, approval, and pull-request mutations.
# NTB1.R2 rejection behavior is falsified by the positive matching-continuation
# scenarios in NTB1.R1 and TBU1.R1, which run in the same proof suites.
@proof.vitest @surface.openai-codex @surface.closeout-cleanup-guard
Feature: Reject unusable closeout handoffs after a Codex restart

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
      Then SessionStart output contains none of the foreign handoff's pull request, head, or canonical repository identity
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
        | foreign profile provenance |

    @rejection
    Scenario: A same-named repository under another owner is foreign
      Given an unclaimed handoff differs from the current canonical repository only by owner at a controlled time
      When a protected Codex task starts
      Then SessionStart output contains none of the foreign handoff's pull request, head, or canonical repository identity
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
      Given a structurally valid handoff expires 24 hours and one tick after its recorded write time
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
        | a write time five minutes and one tick in the future |
        | an expiry at its write time |
        | an expiry before its write time |

    Scenario Outline: Reader tolerance accepts bounded handoff clocks
      Given a fresh matching handoff has <accepted clock> at a controlled time
      When a protected Codex task starts in the matching repository
      Then SessionStart output contains one continuation naming the numeric pending pull request
      And the handoff is claimed by the current task

      Examples:
        | accepted clock |
        | a write time exactly five minutes in the future |
        | an expiry one hour after its write time |

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
    Scenario Outline: Missing or invalid checkout identity is rejected before provenance
      Given a matching handoff has <checkout defect> and also carries foreign profile provenance
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports invalid checkout identity without reporting provenance or naming its target
      And no continuation or destructive command is emitted

      Examples:
        | checkout defect |
        | no checkout identity |
        | a non-canonical checkout identity |

    Scenario: An unsafe foreign-key entry remains unobserved
      Given an unsafe-path handoff entry is stored only under a foreign repository key
      When a protected Codex task starts in the current repository at a controlled time
      Then SessionStart output contains no unsafe-path notice or foreign contents
      And the external target is not read
      And no continuation or claim is emitted

    @rejection
    Scenario: Multiple matching handoffs are rejected as ambiguous
      Given two distinct fresh valid on-disk handoff records normalize to the current canonical repository at a controlled time
      When a protected Codex task starts at a controlled time
      Then SessionStart output reports ambiguous pending closeout state without naming either target
      And SessionStart output directs the user to inspect GitHub and restart closeout with the numeric pull request
      And neither handoff is claimed or mutated
      And the existing protected SessionStart proof is still emitted

    @rejection
    Scenario Outline: One valid and one unusable matching handoff remain ambiguous
      Given one fresh valid handoff and one <unusable state> handoff both normalize to the current canonical repository at a controlled time
      When a protected Codex task starts
      Then SessionStart output reports ambiguous pending closeout state without naming either target
      And SessionStart output directs the user to inspect GitHub and restart closeout with the numeric pull request
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
      And SessionStart output directs the user to inspect GitHub and restart closeout with the numeric pull request
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
