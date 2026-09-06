@surface.safeword-cli @feature.predictable-safeword-cli
Feature: One predictable Safeword CLI

  @predictable-safeword-cli.TBU1.R1
  Rule: predictable-safeword-cli.TBU1.R1 — The default command reports project health without changing the project
    @rejection
    Scenario: Bare Safeword remains read-only after project-only installation
      Given a configured project without native profile plugins
      When the user runs Safeword with no command
      Then the result reports action required without changes

    Scenario: Bare Safeword prioritizes native profile repair over planning drift
      Given a configured project with managed drift
      When the user runs Safeword with no command
      Then the result requires action and recommends "safeword codex migrate"

  @predictable-safeword-cli.TBU1.R2
  Rule: predictable-safeword-cli.TBU1.R2 — Read-only commands remain read-only on first run, drift, and failure
    @rejection
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

  @predictable-safeword-cli.TBU1.R3
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

    @rejection
    Scenario: Human default output hides implementation detail
      Given a result with repeated warnings and internal identifiers
      When Safeword renders it for a human with verbose disabled
      Then warnings are deduplicated and internal identifiers are hidden

    Scenario: Human verbose output separates implementation detail
      Given a result with repeated warnings and internal identifiers
      When Safeword renders the same result with verbose enabled
      Then implementation detail follows the unchanged primary verdict

  @predictable-safeword-cli.TBU1.R4
  Rule: predictable-safeword-cli.TBU1.R4 — Destructive work shows an exact plan and requires explicit confirmation
    @rejection
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

  @predictable-safeword-cli.TBU1.R5
  Rule: predictable-safeword-cli.TBU1.R5 — Install converges, and the second identical run reports no changes
    @rejection
    Scenario: Install refuses redundant mutation after convergence
      Given install has converged a project
      When the user runs install again
      Then the result is successful with no reported or filesystem effects

    Scenario: Partial install reports completed effects and recovery
      Given an install whose second effect fails
      When Safeword applies install
      Then the result reports the first completed effect the stable error and recovery action

  @predictable-safeword-cli.NTB1.R1
  Rule: predictable-safeword-cli.NTB1.R1 — Action-required state is distinct from failure and never masquerades as success
    @rejection
    Scenario Outline: Result state determines the stable exit status
      Given a command result in <state> state
      When Safeword completes the command
      Then the process exits with <status>
      Examples:
        | state           | status |
        | healthy         | 0      |
        | failed          | 1      |
        | action-required | 2      |

  @predictable-safeword-cli.NTB1.R2
  Rule: predictable-safeword-cli.NTB1.R2 — Non-interactive operation never prompts or guesses consent
    @rejection
    Scenario Outline: Non-interactive destructive commands never prompt
      Given a destructive command has a valid plan
      When it runs in <mode>
      Then it does not prompt or apply without explicit consent
      Examples:
        | mode       |
        | --no-input |
        | non-TTY    |

  @predictable-safeword-cli.SWM1.R1
  Rule: predictable-safeword-cli.SWM1.R1 — Plans and results have shared typed contracts and renderers own presentation
    @rejection
    Scenario: A handler describes effects without writing output
      Given a public command handler
      When it observes and plans an operation
      Then it returns typed data and writes no process output

    Scenario: Every public handler obeys the presentation boundary
      Given every public catalog entry and its deterministic invocation fixture
      When each real handler is invoked through the executable adapter
      Then every invocation returns one JSON result through the shared renderer

  @predictable-safeword-cli.SWM1.R2
  Rule: predictable-safeword-cli.SWM1.R2 — Every public command supports deterministic JSON and no-input operation
    Scenario: Every public command accepts the machine contract
      Given every public command and its deterministic invocation fixture
      When each command is invoked through its machine fixture
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

    @rejection
    Scenario: Offline rejects a declared network operation
      Given a public command plan that declares a network effect
      When the agent invokes it with "--offline --json --no-input"
      Then no network call occurs and the result requires an online next action

    Scenario: Cwd selects the requested project
      Given two projects with different Safeword states
      When status is run with cwd selecting the second project
      Then the result describes only the second project

    Scenario: Quiet suppresses chatter but preserves actionable output
      Given healthy action-required and failed results
      When Safeword renders each result with quiet enabled
      Then healthy prose is suppressed while next actions and errors remain visible

  @predictable-safeword-cli.SWM1.R3
  Rule: predictable-safeword-cli.SWM1.R3 — JSON uses one versioned envelope and stable error and exit semantics
    Scenario Outline: JSON output is one complete parseable versioned envelope
      Given a command that <outcome>
      When Safeword renders JSON
      Then stdout contains only one schema-version-1 envelope with state changed findings effects errors recovery and next actions
      Examples:
        | outcome         |
        | succeeds        |
        | requires action |

    @rejection
    Scenario: Failed commands remain inside the stable JSON error contract
      Given a command that fails
      When Safeword renders JSON
      Then stdout contains only one schema-version-1 envelope with state changed findings effects errors recovery and next actions
      And the JSON envelope reports failed state with a stable error

  @predictable-safeword-cli.SWM1.R4
  Rule: predictable-safeword-cli.SWM1.R4 — Capabilities describe commands and effects without executing them
    @rejection
    Scenario: Capabilities exposes neither hidden commands nor command effects
      Given the public command catalog
      When the agent requests capabilities as JSON
      Then every public command declares its canonical name aliases effect class prompt policy network policy schema and invocation fixture
      And hidden helpers are absent and no command effect occurs

  @predictable-safeword-cli.SWM1.R5
  Rule: predictable-safeword-cli.SWM1.R5 — Normal help exposes the simplified hierarchy while old names remain deprecated aliases
    @rejection
    Scenario: Help shows the canonical hierarchy only
      Given the Safeword CLI
      When the user requests ordinary help
      Then canonical command families are visible and internal helpers are hidden

    Scenario Outline: Replaced commands remain compatible aliases indefinitely
      Given the legacy command "<legacy>"
      When the user invokes the retained alias
      Then canonical behavior runs with indefinite-retention compatibility metadata
      Examples:
        | legacy               |
        | check                |
        | diff                 |
        | reset                |
        | setup                |
        | upgrade              |
        | sync-config          |
        | sync-tracker         |
        | connect              |
        | architecture         |
        | sync-learnings       |
        | sync-tickets         |
        | codify               |
        | self-report          |
        | retro-reconcile      |
        | lint-gherkin         |
        | test-plan            |
        | retro                |
        | migrate codex-plugin |

  @surface.openai-codex
  @predictable-safeword-cli.SWM1.R6
  Rule: predictable-safeword-cli.SWM1.R6 — Typed Codex hook entrypoints stay hidden, quiet, offline, effect-free, and responsive
    @rejection
    Scenario: The real Codex hook adapter is hidden quiet offline and lifecycle-safe
      Given an installed Codex hook
      When it invokes its real hidden Safeword entrypoint
      Then output contains no human or progress prose and any required stdout is one valid host-protocol payload
      And no install upgrade package or network effect occurs
      And the entrypoint is absent from help and capabilities

    Scenario: Codex hook responsiveness stays within the operation budget
      Given an installed Codex hook after warm-up
      When its latency is measured over 20 samples
      Then its p95 latency stays below 5000 milliseconds

  @predictable-safeword-cli.SWM1.R7
  Rule: predictable-safeword-cli.SWM1.R7 — Progress reporting keeps one restartable 100-millisecond schedule
    @rejection
    Scenario: Restarting progress reporting replaces the pending schedule
      Given a progress reporter with a controlled scheduler
      When progress reporting starts twice before 100 milliseconds elapse
      Then the first schedule is cancelled and the replacement emits one meaningful message after 100 milliseconds
