@surface.safeword-cli @feature.predictable-safeword-cli
Feature: One predictable Safeword CLI

  Rule: predictable-safeword-cli.TBU1.R1 — The default command reports project health without changing the project
    Scenario: Bare Safeword remains read-only after project-only installation
      Given a configured project without native profile plugins
      When the user runs Safeword with no command
      Then the result reports action required without changes

    Scenario: Bare Safeword recommends planning drift
      Given a configured project with managed drift
      When the user runs Safeword with no command
      Then the result requires action and recommends "safeword plan"

  Rule: predictable-safeword-cli.TBU1.R2 — Read-only commands remain read-only on first run, drift, and failure
    Scenario Outline: Every read-only command has no effects in every project state
      Given a project that is <state>
      When the user runs the read-only command "<command>"
      Then no filesystem package or network effect occurs
      Examples:
        | state        | command |
        | unconfigured | status  |
        | drifted      | status  |
        | failed       | status  |
        | unconfigured | plan    |
        | drifted      | plan    |
        | failed       | plan    |
        | unconfigured | doctor  |
        | drifted      | doctor  |
        | failed       | doctor  |

  Rule: predictable-safeword-cli.TBU1.R3 — Human output leads with the outcome, says whether anything changed, and offers no more than one next action
    Scenario Outline: Human output has one verdict and an explicit change statement
      Given a <state> result with <action_count> possible next actions
      When Safeword renders it for a human
      Then one outcome comes first changed is explicit and <next_count> next actions are shown
      Examples:
        | state           | action_count | next_count |
        | healthy         | 0            | 0          |
        | action-required | 3            | 1          |
        | failed          | 2            | 1          |

    Scenario: Human default output hides implementation detail
      Given a result with repeated warnings and internal identifiers
      When Safeword renders it for a human with verbose disabled
      Then warnings are deduplicated and internal identifiers are hidden

    Scenario: Human verbose output separates implementation detail
      Given a result with repeated warnings and internal identifiers
      When Safeword renders the same result with verbose enabled
      Then implementation detail follows the unchanged primary verdict

  Rule: predictable-safeword-cli.TBU1.R4 — Destructive work shows an exact plan and requires explicit confirmation
    Scenario: Remove without consent does not mutate
      Given a configured project
      When the user runs "safeword remove --no-input"
      Then the exact destructive plan is reported and no effect is applied

    Scenario: Confirmed remove applies only the previewed effects
      Given a configured project and its remove plan
      When the user explicitly confirms that plan
      Then only the previewed effects are applied

    Scenario: A stale destructive plan is refused
      Given the project changed after a remove plan was previewed
      When the user confirms the stale plan
      Then no effect is applied and a fresh plan is required

    Scenario: Partial apply reports completed effects and recovery
      Given a confirmed plan whose second effect fails
      When Safeword applies the plan
      Then the result reports the first completed effect the stable error and recovery action

  Rule: predictable-safeword-cli.TBU1.R5 — Setup converges, and the second identical run reports no changes
    Scenario: A second setup run is unchanged
      Given setup has converged a project
      When the user runs setup again
      Then the result is successful and changed is false

  Rule: predictable-safeword-cli.NTB1.R1 — Action-required state is distinct from failure and never masquerades as success
    Scenario Outline: Result state determines the stable exit status
      Given a command result in <state> state
      When Safeword completes the command
      Then the process exits with <status>
      Examples:
        | state           | status |
        | healthy         | 0      |
        | failed          | 1      |
        | action-required | 2      |

  Rule: predictable-safeword-cli.NTB1.R2 — Non-interactive operation never prompts or guesses consent
    Scenario Outline: Non-interactive destructive commands never prompt
      Given a destructive command has a valid plan
      When it runs in <mode>
      Then it does not prompt or apply without explicit consent
      Examples:
        | mode       |
        | --no-input |
        | non-TTY    |

  Rule: predictable-safeword-cli.SWM1.R1 — Plans and results have shared typed contracts and renderers own presentation
    Scenario: A handler describes effects without writing output
      Given a public command handler
      When it observes and plans an operation
      Then it returns typed data and writes no process output

    Scenario: Every public handler obeys the presentation boundary
      Given every public catalog entry and its deterministic invocation fixture
      When each real handler is invoked through the executable adapter
      Then only the shared renderer writes output and no handler terminates the process

  Rule: predictable-safeword-cli.SWM1.R2 — Every public command supports deterministic JSON and no-input operation
    Scenario: Every public command accepts the machine contract
      Given every public command and its deterministic invocation fixture
      When each command is invoked with "--json --no-input"
      Then each invocation returns deterministic JSON without prompting

    Scenario Outline: Global options work on either side of the command
      Given a public command
      When the global option "<option>" is placed before and after its name
      Then both invocations have equivalent results
      Examples:
        | option     |
        | --json     |
        | --no-input |
        | --cwd      |
        | --quiet    |
        | --offline  |
        | --verbose  |

    Scenario: Double dash preserves command arguments
      Given a public command with positional arguments
      When global options precede the command and double dash precedes a flag-like argument
      Then the flag-like argument reaches the handler unchanged

    Scenario: Offline rejects a declared network operation
      Given a public command plan that declares a network effect
      When the agent invokes it with "--offline --json --no-input"
      Then no network call occurs and the result requires an online next action

    Scenario: Cwd selects the project without changing the shell directory
      Given two projects with different Safeword states
      When status is run with cwd selecting the second project
      Then the result describes only the second project and the parent process cwd is unchanged

    Scenario: Quiet suppresses chatter but preserves actionable output
      Given healthy action-required and failed results with progress prose
      When Safeword renders each result with quiet enabled
      Then healthy and progress prose is suppressed while next actions and errors remain visible

  Rule: predictable-safeword-cli.SWM1.R3 — JSON uses one versioned envelope and stable error and exit semantics
    Scenario Outline: JSON output is one complete parseable versioned envelope
      Given a command that <outcome>
      When Safeword renders JSON
      Then stdout contains only one schema-version-1 envelope with state changed findings effects errors recovery and next actions
      Examples:
        | outcome         |
        | succeeds        |
        | requires action |
        | fails           |

  Rule: predictable-safeword-cli.SWM1.R4 — Capabilities describe commands and effects without executing them
    Scenario: Capabilities is complete and effect-free
      Given the public command catalog
      When the agent requests capabilities as JSON
      Then every public command declares its canonical name aliases effect class prompt policy network policy schema and invocation fixture
      And hidden helpers are absent and no command effect occurs

  Rule: predictable-safeword-cli.SWM1.R5 — Normal help exposes the simplified hierarchy while old names remain deprecated aliases
    Scenario: Help shows the canonical hierarchy only
      Given the Safeword CLI
      When the user requests ordinary help
      Then canonical command families are visible and internal helpers are hidden

    Scenario Outline: Replaced commands remain compatible aliases indefinitely
      Given the legacy command "<legacy>"
      When the user invokes it in retained release line <release_line>
      Then canonical behavior runs with indefinite-retention compatibility metadata
      Examples:
        | legacy          | release_line |
        | check           | 1            |
        | check           | 2            |
        | diff            | 1            |
        | diff            | 2            |
        | reset           | 1            |
        | reset           | 2            |
        | upgrade         | 1            |
        | upgrade         | 2            |
        | sync-config     | 1            |
        | sync-config     | 2            |
        | sync-tracker    | 1            |
        | sync-tracker    | 2            |
        | connect         | 1            |
        | connect         | 2            |
        | architecture    | 1            |
        | architecture    | 2            |
        | sync-learnings  | 1            |
        | sync-learnings  | 2            |
        | sync-tickets    | 1            |
        | sync-tickets    | 2            |
        | codify          | 1            |
        | codify          | 2            |
        | self-report     | 1            |
        | self-report     | 2            |
        | retro-reconcile | 1            |
        | retro-reconcile | 2            |
        | lint-gherkin    | 1            |
        | lint-gherkin    | 2            |
        | test-plan       | 1            |
        | test-plan       | 2            |
        | retro           | 1            |
        | retro           | 2            |
        | migrate codex-plugin | 1        |
        | migrate codex-plugin | 2        |

  @surface.openai-codex
  Rule: predictable-safeword-cli.SWM1.R6 — Typed Codex hook entrypoints stay hidden, quiet, offline, and free of install or upgrade effects
    Scenario Outline: Each real hook adapter is hidden quiet offline and lifecycle-safe
      Given an installed <surface> hook
      When it invokes its real hidden Safeword entrypoint
      Then output contains no human or progress prose and any required stdout is one valid host-protocol payload
      And no install upgrade package or network effect occurs
      And the entrypoint is absent from help and capabilities
      Examples:
        | surface     |
        | Codex       |

    Scenario: Hook invocation stays within the existing latency budget
      Given an installed agent hook after warm-up
      When its latency is measured repeatedly
      Then its p95 latency stays within the repository threshold

  Rule: predictable-safeword-cli.SWM1.R7 — Long-running interactive commands report meaningful progress within 100 milliseconds
    Scenario: Meaningful feedback is emitted before slow work
      Given an interactive command with an injected monotonic clock and an apply step longer than 100 milliseconds
      When the user confirms the plan
      Then the progress adapter emits meaningful feedback within 100 milliseconds
