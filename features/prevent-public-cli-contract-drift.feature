# Automated by packages/cli/tests/cli-protocol/cli-contract.test.ts and check:cli-contract.
@proof.vitest
@surface.safeword-cli
Feature: Prevent public CLI contracts from drifting again
  Maintainers need one production-derived contract gate so every shipped invocation
  stays consistent for humans, agents, compatibility callers, and internal tooling.

  @cli-contract-drift.SWM1.R1
  Rule: cli-contract-drift.SWM1.R1 — Every production invocation has exactly one public, retained-alias, or internal catalog entry

    Scenario: The exhaustive catalog classifies every production invocation once
      Given the catalog includes canonical retained-alias internal Commander-alias bare-default and argv-rewrite invocations
      When the production CLI contract is checked
      Then each normalized invocation has exactly one classification and a separate matching visibility

    @rejection
    Scenario Outline: Invalid invocation ownership is rejected with the route
      Given the production contract contains a <defect>
      When the production CLI contract is checked
      Then the gate fails with <diagnostic> and the normalized route

      Examples:
        | defect | diagnostic |
        | registered invocation without a catalog entry | unclassified invocation |
        | catalog entry without a registered invocation | missing registration |
        | duplicate catalog entries for one invocation | duplicate classification |
        | unsupported classification value | unknown classification |
        | visibility mismatch | visibility mismatch |

  @cli-contract-drift.SWM1.R2
  Rule: cli-contract-drift.SWM1.R2 — One side-effect-free factory assembles the exact production Commander program and runCli remains the only argv boundary

    Scenario: The real production program is assembled without runtime effects
      Given real registration collaborators and observed process argv environment output exit status and handler entry
      When createCliProgram assembles the production CLI
      Then every catalogued route is registered and no argv normalization parsing handler process output or exit mutation occurs

    Scenario: runCli applies rewrites and parses through the factory program
      Given a direct or chained catalogued argv compatibility rewrite with options and delimiter values
      When runCli receives that argv
      Then it resolves to one canonical invocation preserves the remaining argv and parses through createCliProgram

    @rejection
    Scenario Outline: Runtime registration drift is rejected
      Given runtime and catalog differ only in <field>
      When the assembled production program is reconciled
      Then the gate fails and names the route flag and <field>

      Examples:
        | field |
        | route or alias spelling |
        | visibility |
        | syntax or positional arity |
        | long or short flag |
        | parsed attribute |
        | required optional or variadic value shape |
        | negation |
        | default or choices |
        | hidden state |
        | global or local ownership |
        | conflicts or implies relation |

    Scenario: Commander-owned options are derived from the assembled program
      Given Commander adds help or version at exact routes
      When runtime options are reconciled
      Then only those observed route-and-flag pairs are exempt from catalog ownership

  @cli-contract-drift.SWM1.R3
  Rule: cli-contract-drift.SWM1.R3 — Retained aliases preserve supported behavior and reject options their handlers do not consume

    Scenario: Supported retained-alias behavior remains invocable
      Given a retained alias with consumed local options supported global options and a value after the option delimiter
      When the alias is invoked through the shipped CLI
      Then it returns its exact declared machine contract and preserves the delimited value

    Scenario: An intentional redundant option remains explicit compatibility
      Given a retained alias catalogues a redundant legacy option and replacement
      When the alias is invoked with that option
      Then the machine result identifies the redundant option without changing the handler outcome

    @rejection
    Scenario: Removing or renaming a retained alias is rejected
      Given a catalogued retained alias spelling is absent from the runtime inventory
      When the production CLI contract is checked
      Then the gate fails and names the exact lost spelling

    @rejection
    Scenario Outline: Irrelevant alias options fail before handler entry
      Given a retained alias does not own the <option kind>
      When the alias is invoked with that option through the shipped CLI
      Then it exits nonzero with the exact machine parse error and the handler is not entered

      Examples:
        | option kind |
        | unknown local option |
        | inherited option excluded by the alias |

  @cli-contract-drift.SWM1.R4
  Rule: cli-contract-drift.SWM1.R4 — Shipped surfaces fail one focused gate when stale

    Scenario: Every public command and argv rewrite has a shipped subprocess fixture
      Given the catalog declares public commands and argv compatibility rewrites with deterministic fixtures
      When bounded batches execute the built CLI
      Then every declared fixture runs once and returns its exact exit stdout stderr and machine schema

    @rejection
    Scenario: Shipped fixture failures aggregate deterministically
      Given one fixture times out one returns malformed machine output and one mismatches its contract
      When the CLI contract fixtures run
      Then the gate reports all failures once in stable route order without retrying

    @rejection
    Scenario Outline: Each shipped surface detects independent drift
      Given exactly the <surface> output differs from its catalog or deterministic generator
      When the CLI contract gate runs
      Then the gate fails and names only <surface>

      Examples:
        | surface |
        | public help |
        | capabilities |
        | generated Claude plugin |
        | generated command reference |

    Scenario: Deprecated terminology is allowed only in compatibility regions
      Given the documentation inventory contains deprecated text inside matched unnested compatibility delimiters
      When canonical lifecycle terminology is checked
      Then the region is accepted and operative text before and after it is still checked

    @rejection
    Scenario Outline: Operative or malformed compatibility text is rejected
      Given the documentation inventory contains <defect>
      When canonical lifecycle terminology is checked
      Then the gate fails with the file line and delimiter state

      Examples:
        | defect |
        | deprecated operative text |
        | unclosed compatibility region |
        | reversed compatibility delimiters |
        | nested compatibility delimiters |

  @surface.github-actions-execution-sandbox
  @cli-contract-drift.SWM1.R5
  Rule: cli-contract-drift.SWM1.R5 — Pull requests always emit one stable CLI contract context

    Scenario: The dedicated CLI contract job is stable and unconditional
      Given the pull-request workflow has no paths filter or automatic retry
      When the CLI contract job is inspected
      Then it is named exactly CLI contract invokes the complete local gate has a five-minute timeout and reports runtime against the pull-request head
