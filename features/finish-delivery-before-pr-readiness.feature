Feature: Finish accepted changes before asking for PR review

  Every scenario tagged for Claude Code, OpenAI Codex, and Cursor is executed
  independently through each tagged host's installed Safeword workflow. A Then
  that explicitly names an installed lifecycle hook asserts deterministic hook
  behavior. "The workflow's next-step directive" is the canonical instruction
  the agent applies at the named workflow transition; it is not an automatic
  hook emission unless the Then explicitly says so.

  @prodigy-flow.TBU1.PY73VN.R1
  Rule: prodigy-flow.TBU1.PY73VN.R1 — Successful TDD steps advance without routine prompts

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: RED advances directly into implementation
      Given an accepted feature has a failing proof for the intended missing behavior
      When the RED step completes successfully
      Then the workflow's next-step directive names implementation without asking whether to continue

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: GREEN advances through refactor to the next incomplete scenario
      Given an accepted feature has reached GREEN with another scenario incomplete and Safeword's installed lifecycle hook active
      When the agent completes the GREEN step successfully
      Then the workflow's next-step directive names refactor and the next incomplete scenario without asking whether to continue

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: An unsuccessful TDD step remains at the failing step
      Given an accepted feature has <unhealthy step outcome>
      When the TDD step exits
      Then the workflow's next-step directive names <current step> and its failing evidence without naming <following step>

      Examples:
        | unhealthy step outcome | current step | following step |
        | a RED proof that passes instead of exposing missing behavior | RED | implementation |
        | a GREEN proof with a required check still failing | GREEN | refactor |

  @prodigy-flow.TBU1.PY73VN.R2
  Rule: prodigy-flow.TBU1.PY73VN.R2 — Completed scenarios trigger whole-ticket closeout

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Final scenario advances through verified ticket closure on every installed host
      Given every scenario in an accepted feature is complete with Safeword's installed lifecycle hook active
      When the agent exits implementation successfully
      Then the workflow's next-step directive names, in order, whole-ticket review, plan reconciliation, verification, audit, and ticket closure

    @surface.safeword-cli
    Scenario: Verification advances into recorded ticket closure
      Given an accepted ticket has passed verification with audit outstanding
      When the audit completes successfully
      Then the ticket status is done with verification evidence recorded

    @rejection @surface.safeword-cli
    Scenario: Failed verification preserves the open ticket
      Given an accepted ticket is at verification with a required check failing
      When verification completes
      Then the ticket status remains open and no verification evidence is recorded

  @prodigy-flow.TBU1.PY73VN.R3
  Rule: prodigy-flow.TBU1.PY73VN.R3 — Verified done precedes PR readiness

    @surface.safeword-cli
    Scenario Outline: Safeword installation ships the Ready gate to each enabled host
      Given a project enables <agent host>
      When the Technical Builder installs or updates Safeword
      Then <agent host>'s installed lifecycle configuration invokes the shared Ready gate

      Examples:
        | agent host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

    @surface.safeword-cli
    Scenario: Ready-gate installation preserves existing lifecycle configuration
      Given a project has an existing host lifecycle configuration
      When the Technical Builder installs or updates Safeword with the Ready gate
      Then the existing lifecycle configuration remains and the shared Ready gate is added

    @surface.safeword-cli
    Scenario: Ready-gate installation leaves a disabled host untouched
      Given a project does not enable Cursor
      When the Technical Builder installs or updates Safeword
      Then Cursor's lifecycle configuration is not created or modified

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Each installed host rejects direct Ready promotion before done
      Given an active ticket at implementation with Safeword's installed lifecycle hook active
      When the agent directly invokes the GitHub CLI's Ready promotion
      Then the installed lifecycle hook denies the command before it reaches the GitHub CLI

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Ready promotion is rejected across unfinished ticket states
      Given an active ticket is at <ticket state> with an installed agent lifecycle hook active
      When an agent directly invokes the GitHub CLI's Ready promotion
      Then the installed lifecycle hook denies the command before it reaches the GitHub CLI and names <unfinished step> and <next delivery action>

      Examples:
        | ticket state | unfinished step | next delivery action |
        | implementation | unfinished implementation | complete the current scenario |
        | done phase with status still open | ticket closure | close the verified ticket |
        | done status without verification evidence | verification evidence | run verification |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Unreadable verification evidence fails Ready promotion closed
      Given a done ticket whose verification evidence cannot be read by an installed agent lifecycle hook
      When an agent directly invokes the GitHub CLI's Ready promotion
      Then the installed lifecycle hook denies the command before it reaches the GitHub CLI and names the unreadable evidence and a recovery action

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Missing or unresolvable ticket state fails Ready promotion closed
      Given <ticket resolution state> for an installed agent lifecycle hook
      When an agent directly invokes the GitHub CLI's Ready promotion
      Then the installed lifecycle hook denies the command before it reaches the GitHub CLI and names <recovery action>

      Examples:
        | ticket resolution state | recovery action |
        | no active ticket resolves | open or resume the delivery ticket |
        | the active ticket cannot be parsed | repair the ticket state |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Ready-by-default creation is rejected before verified done
      Given an active ticket is at implementation with an installed agent lifecycle hook active
      When an agent directly invokes the GitHub CLI's ready-by-default pull-request creation
      Then the installed lifecycle hook denies the command before it reaches the GitHub CLI and names the unfinished ticket step and the next delivery action

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Ready denial gives a Non-Technical Builder a plain next action
      Given a Non-Technical Builder's active ticket is at implementation with an installed agent lifecycle hook active
      When the agent directly invokes the GitHub CLI's Ready promotion
      Then the denial says the change is not finished and names the next delivery action without using the terms RED, GREEN, refactor, reconciliation, or audit

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Draft creation remains available for evidence before done
      Given an active ticket has not reached verified done with an installed agent lifecycle hook active
      When an agent directly invokes the GitHub CLI's Draft pull-request creation for CI evidence
      Then the command reaches the GitHub CLI as Draft creation

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Draft creation returns delivery to the unfinished step
      Given an active ticket has a Draft pull request open for CI evidence and unfinished delivery steps
      When the agent finishes the Draft creation step
      Then the workflow's next-step directive names the next unfinished delivery step instead of reporting the change ready for review

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Ready promotion is allowed after verified done
      Given a ticket is done with verification evidence with Safeword's installed lifecycle hook active
      When an agent directly invokes the GitHub CLI's Ready promotion
      Then the installed lifecycle hook allows the command to reach the GitHub CLI as Ready promotion

  @prodigy-flow.TBU1.PY73VN.R4
  Rule: prodigy-flow.TBU1.PY73VN.R4 — Genuine boundaries interrupt resumably

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A locally repairable missing dependency is restored without asking to continue
      Given an accepted delivery is advancing automatically
      When verification finds a missing lockfile dependency that the existing package manifest authorizes
      Then the workflow's next-step directive names dependency restoration and reruns the failed check without asking the Technical Builder whether to proceed

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: A genuine boundary stops at the blocked step with exact recovery
      Given an accepted delivery is advancing automatically through Safeword's installed lifecycle hooks and <observable condition>
      When a <boundary type> boundary blocks verification
      Then the agent stops at verification without advancing, and reports <recovery action> followed by the evidence for the block

      Examples:
        | boundary type | observable condition | recovery action |
        | authority | a required decision is not delegated to the agent | request the required human decision |
        | safety | the exact risky operation requires approval | approve the exact risky operation |
        | dependency | a manifest-authorized dependency cannot be restored automatically | restore the required dependency |
        | scope | the required fix changes the accepted ticket scope | decide the proposed scope change |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A genuine boundary stops at implementation instead of verification
      Given an accepted delivery is advancing automatically at implementation through Safeword's installed lifecycle hooks
      When an authority boundary blocks implementation
      Then the agent stops at implementation without advancing and reports the required human decision

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: An unauthorized missing dependency stops for a decision
      Given an accepted delivery is advancing automatically at verification through Safeword's installed lifecycle hooks
      When verification requires a dependency that is absent from the package manifest
      Then the agent stops at verification without advancing and asks the Technical Builder to authorize the dependency change

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A boundary gives a Non-Technical Builder a plain recovery action
      Given a Non-Technical Builder's accepted delivery is stopped by an authority boundary
      When the installed Safeword workflow reports the interruption
      Then it names the exact decision needed to resume without using the terms RED, GREEN, refactor, reconciliation, or audit

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Recovery state controls resumption at every established stop point
      Given a Technical Builder's delivery is stopped by an authority boundary at <interrupted step> with <recovery state>
      When the Technical Builder asks for the next step
      Then the workflow's next-step directive <directive behavior>

      Examples:
        | interrupted step | recovery state | directive behavior |
        | implementation | the required decision outstanding | repeats implementation and the required decision |
        | implementation | the required decision completed | names implementation work and no longer repeats the required decision |
        | verification | the required decision outstanding | repeats verification and the required decision |
        | verification | the required decision completed | names verification work and no longer repeats the required decision |

  # skip: cloud-agent lifecycle enforcement is out of scope until those hosts expose equivalent local hooks.
  # skip: GitHub CLI transport failures retain the CLI's existing non-zero output and do not change ticket state.
  # skip: OpenCode lifecycle enforcement is deferred because this ticket's accepted affected surfaces are Claude Code, OpenAI Codex, and Cursor.
  # skip: enforcement matches the named gh pr argv shapes only; a Ready mutation issued through gh api, REST, or GraphQL is not denied by this ticket's gate and is deferred beyond its local command boundary.
