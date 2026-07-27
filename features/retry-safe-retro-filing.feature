@retry-safe-retro-filing
Feature: Retry-safe retro relay foundation

  The relay foundation gives every harness adapter the same HTTP contract and
  transport-independent request identity. Production rollout remains a later
  gate; this slice proves the boundary that rollout will use.

  Rule: Request identity is stable across harness adapters and payload changes are rejected

    @retry-safe-retro-filing.TBU1.R1 @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Every named harness adapter retries through the real relay route
      Given the Claude, Codex, and Cursor adapters target a real relay HTTP server
      And only the GitHub REST network boundary is mocked
      When Claude files a request and Codex and Cursor retry its persisted requestId and payload
      Then the relay receives the identical installation repository requestId title and body from every adapter
      And every adapter receives the same issue number
      And GitHub receives exactly one create request

    @retry-safe-retro-filing.TBU1.R1 @rejection
    Scenario Outline: Changing an approved payload field is rejected
      Given an authorized retro filing request has been durably accepted
      When an adapter reuses its requestId with a different <field>
      Then the relay returns a payload mismatch
      And GitHub receives no additional create request

      Examples:
        | field |
        | title |
        | body  |

  Rule: First attempts and retries create at most one GitHub issue per request

    @retry-safe-retro-filing.TBU1.R2 @rejection
    Scenario: Concurrent first attempts return one durable receipt
      Given two independent relay clients share one requestId and payload
      When both first attempts overlap while GitHub creation is delayed
      Then both attempts return the same issue number
      And GitHub receives exactly one create request

    @retry-safe-retro-filing.TBU1.R2
    Scenario: Losing the relay response after filing is safe to retry
      Given GitHub accepted a create and the relay durably recorded its issue number
      When response delivery fails and the adapter retries the request
      Then the relay returns the recorded issue number
      And GitHub receives no additional create request

  Rule: Uncertain delivery remains visible and recoverable without automatic recreation

    @retry-safe-retro-filing.TBU1.R3 @rejection
    Scenario: A crash after GitHub create becomes ambiguous without acknowledgement or recreation
      Given GitHub accepted the issue before the relay persisted its number
      When a fresh relay process opens the same durable store and the request is retried
      Then the request returns ambiguous without an issue number
      And the adapter is not told to acknowledge its spool
      And GitHub receives no second create request

    @retry-safe-retro-filing.TBU1.R3
    Scenario Outline: The admin route adopts exactly one raw request-marker match
      Given an ambiguous request in the real relay store
      And raw REST finds <match_count> issues with the scoped request marker
      When an operator invokes the real reconciliation route for the original requestId
      Then the request <outcome>
      And GitHub receives no create request

      Examples:
        | match_count | outcome                                       |
        | 0           | remains ambiguous with no-match alert         |
        | 1           | returns that issue number and becomes filed   |
        | 2           | remains ambiguous with multiple-match alert   |

  Rule: Authorization is repository-scoped and independent of dedupe identity

    @retry-safe-retro-filing.SWM1.R1 @rejection
    Scenario Outline: Repository authorization determines whether filing proceeds
      Given a valid adapter credential is <authorization> for the requested repository
      When it submits a retro filing request
      Then the relay returns <outcome>
      And GitHub receives <create_count> create requests

      Examples:
        | authorization | outcome                   | create_count |
        | authorized    | the filed issue number    | 1            |
        | unauthorized  | an authorization error    | 0            |

    @retry-safe-retro-filing.SWM1.R1 @rejection
    Scenario Outline: Invalid authentication is rejected before GitHub
      Given the adapter credential is <credential_state>
      When it submits a retro filing request
      Then the relay returns an authentication error
      And GitHub receives no create request

      Examples:
        | credential_state |
        | missing          |
        | malformed        |
        | unknown          |

    @retry-safe-retro-filing.SWM1.R1
    Scenario: Authorized filing credentials never enter durable state or observability
      Given a valid credential authorizes the installation and repository
      When the relay files through GitHub with an installation token
      Then the durable record logs and metrics identify the request and filed outcome
      But neither credential appears in the durable record logs or metrics

    @retry-safe-retro-filing.SWM1.R1
    Scenario: GitHub creation uses a repository-scoped relay credential
      Given a valid credential authorizes the installation and repository
      When the relay files through GitHub
      Then GitHub receives one create authenticated with a relay-minted installation token scoped to that repository

  Rule: Only complete raw REST issue bodies are request-marker authority

    @retry-safe-retro-filing.SWM1.R2 @rejection
    Scenario Outline: Sanitized MCP bodies never decide ambiguous-create recovery
      Given an ambiguous request owns an exact request marker
      And raw REST <raw_state> that exact request marker
      And a sanitized MCP representation <mcp_state> that exact request marker
      When an operator reconciles the original request
      Then the relay <outcome>
      And GitHub receives no create request

      Examples:
        | raw_state | mcp_state | outcome                                         |
        | contains  | omits     | returns the raw issue and becomes filed         |
        | omits     | contains  | remains ambiguous with no-match alert            |

    @retry-safe-retro-filing.SWM1.R2
    Scenario: Incomplete raw enumeration never resolves an ambiguous create
      Given an ambiguous request owns an exact request marker
      And the raw REST issue scan fails before the final page
      When an operator reconciles the original request
      Then the relay returns an incomplete reconciliation result
      And GitHub receives no create request
