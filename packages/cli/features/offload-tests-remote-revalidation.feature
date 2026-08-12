@wip
Feature: Revalidate remote verification before execution

  @offload-tests.TBU1.R10
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R10 — The remote workflow independently revalidates revision and lane before executing repository code

    @surface.github-actions-execution-sandbox
    Scenario: The workflow validates request consistency before checkout
      Given the workflow receives a supported lane, token, full target SHA and canonical branch ref
      When it starts before repository checkout
      Then it validates token, target-ref digest, SHA, lane and immutable workflow context and observes the same repository branch tip at the supplied SHA without claiming to authenticate CLI origin or reading Actions metadata

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Invalid or moved workflow input stops before repository code
      Given the workflow receives <remote-boundary>
      When pre-checkout validation runs
      Then the job fails without checkout or repository command execution
      Examples:
        | remote-boundary |
        | an unsupported lane |
        | a branch moved before observation |
        | a target-ref digest inconsistent with the canonical branch input |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every workflow identity input rejects its first noncanonical boundary
      Given the raw workflow_dispatch event contains <invalid-identity>
      When the pinned trusted validator reads the event before checkout
      Then validation fails before checkout, dependency installation, repository helper or repository command execution
      Examples:
        | invalid-identity |
        | an empty request token |
        | a request token shorter or longer than exactly 64 lowercase hexadecimal characters |
        | a request token containing non-hexadecimal, uppercase, option-like or percent-encoded text |
        | duplicate request-token fields in raw event JSON |
        | an empty target SHA |
        | a target SHA shorter or longer than exactly 40 lowercase hexadecimal characters |
        | a target SHA containing non-hexadecimal, uppercase, option-like or percent-encoded text |
        | duplicate target-SHA fields in raw event JSON |
        | an empty branch ref |
        | an option-like, tag, abbreviated, differently cased or percent-encoded branch ref |
        | a branch ref outside canonical `refs/heads/<validated-name>` syntax |
        | duplicate branch-ref fields in raw event JSON |
        | a target-ref digest that is missing, duplicated, non-lowercase-hex, not 64 characters or inconsistent with target-ref bytes |
        | duplicate lane fields in raw event JSON |

    @rejection @surface.github-actions-execution-sandbox
    Scenario: The workflow identity-input boundary matrix is complete
      Given a test-owned literal manifest crosses request token, target SHA, target ref, target-ref digest and lane with omission, empty string, wrong JSON type, first-short, first-long, noncanonical character or encoding, equal duplicate and unequal duplicate where applicable
      When an independent raw-event generator compares its fixture IDs with validator executions without importing production parser tables
      Then expected field-by-boundary ID set and cardinality equal generated and executed result sets and cardinalities, every invalid cell fails before checkout, and exactly one canonical control per field is accepted

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: The production validator consumes the exact workflow event bytes before checkout
      Given the managed job receives <event-source> at the exact absolute path in `GITHUB_EVENT_PATH` and records that file's pre-parse SHA-256
      When the pinned validator opens that path without following a substituted link and parses its raw bytes before checkout
      Then <event-outcome>, the validator output names the same byte digest, and no normalized in-memory context object substitutes for raw-file validation
      Examples:
        | event-source | event-outcome |
        | a real GitHub-created canonical workflow_dispatch event file | its exact declared inputs are validated and execution may continue |
        | a byte-preserving test-owned event file with a duplicate raw key | validation fails before repository code, proving the parser's defense-in-depth duplicate rejection |
        | a GitHub event file whose platform serialization has already normalized caller input to one canonical member per declared key | validation relies on the exact normalized bytes plus the managed workflow's closed input declaration and does not claim it observed discarded pre-normalization duplicates |

    @surface.github-actions-execution-sandbox
    Scenario: A direct replay with matching visible inputs can execute but proves no CLI origin
      Given a direct caller replays a visible token, full target SHA, lane and branch consistently
      When the managed workflow validates those inputs
      Then the job may execute because no workflow-side MAC authenticates CLI origin

    @rejection
    Scenario: Resume rejects duplicate exact matches created by a direct replay
      Given an authenticated pending record has no run ID and discovery exposes two runs matching every frozen visible identity field
      When Safeword correlates the pending request
      Then it keeps the request indeterminate for explicit run-ID recovery and neither redispatches nor falls back locally
