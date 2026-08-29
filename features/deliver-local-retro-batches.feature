Feature: Deliver every eligible local retro finding in one bounded batch

  @deliver-local-retro-batches.SWM1.R1
  Rule: deliver-local-retro-batches.SWM1.R1 — Every valid sanitized finding from one local session is recorded in original order as one bounded submission

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Every local carrier submits multiple findings as one ordered batch
      Given an opted-in local <harness> session with three valid sanitized findings
      When the session completes through its installed retro carrier
      Then the collector records one request containing those three findings in original order

      Examples:
        | harness      |
        | Claude Code  |
        | OpenAI Codex |
        | Cursor       |

    @surface.safeword-cli
    Scenario: One finding uses the same batch contract
      Given an opted-in local session with one valid sanitized finding
      When the session completes through the shared local retro carrier
      Then the collector records one v2 request whose findings are exactly that finding

    @surface.safeword-cli
    Scenario: Invalid findings are excluded before a mixed batch leaves the project
      Given an opted-in local session with valid findings surrounding an invalid finding
      When the session completes through the shared local retro carrier
      Then the collector raw request contains only the valid sanitized findings in original order

    @rejection @surface.safeword-cli
    Scenario: No valid findings make no public attempt
      Given an opted-in local session with no valid sanitized findings
      When the session completes through the shared local retro carrier
      Then the collector receives zero requests

    @surface.safeword-cli
    Scenario: A request exactly at the shared byte limit is accepted whole
      Given an opted-in local session whose canonical v2 request is exactly 65536 bytes
      When the session completes through the shared local retro carrier
      Then the collector records the entire batch in one request

    @rejection @surface.safeword-cli
    Scenario: An oversized request makes no partial public attempt
      Given an opted-in local session whose canonical v2 request is exactly 65537 bytes
      When the session completes through the shared local retro carrier
      Then the collector receives zero requests

  @deliver-local-retro-batches.SWM1.R2
  Rule: deliver-local-retro-batches.SWM1.R2 — Released single-finding senders and new batch senders share one exact collector boundary without weakening raw-body duplicate authority

    @surface.safeword-cli @surface.railway-public-retro-collector
    Scenario: The shipped local batch crosses the real collector boundary unchanged
      Given an opted-in local session with three valid sanitized findings
      When the session completes through the shared local retro carrier against the public collector intake
      Then the collector records one durable submission containing those three findings in original order

    @surface.railway-public-retro-collector
    Scenario Outline: Released v1 and exact v2 requests are both accepted
      Given <request> for a distinct session scope
      When its raw request reaches the public collector intake
      Then the collector retains one durable submission whose findings are exactly the request findings in original order
      And the request receives a durable receipt

      Examples:
        | request                              |
        | a released v1 single-finding request |
        | a canonical v2 batch request         |

    @surface.railway-public-retro-collector
    Scenario Outline: Byte-identical replay in one session scope reuses the durable receipt
      Given <recorded request> and the same canonical bytes for its session scope
      When the request is submitted with <request identity>
      Then the collector returns the original receipt and retains one durable submission

      Examples:
        | recorded request                       | request identity              |
        | a recorded v2 batch                     | the original request identity |
        | a recorded v2 batch                     | a new request identity         |
        | a recorded v1 single-finding submission | the original request identity |
        | a recorded v1 single-finding submission | a new request identity         |

    @surface.railway-public-retro-collector
    Scenario: Identical bytes in a different session scope receive a distinct receipt
      Given a recorded v2 batch and an identical canonical request for a different session scope
      When the request reaches the public collector intake
      Then it receives its own distinct durable receipt and the collector retains two durable submissions

    @rejection @surface.railway-public-retro-collector
    Scenario: Unequal raw bytes in one session scope remain a conflict
      Given a recorded v2 batch and a request with the same sanitized findings but different canonical bytes for its session scope
      When the different batch reaches the public collector intake
      Then the collector reports a conflict and retains the original raw submission

    @rejection @surface.railway-public-retro-collector
    Scenario: A v2 batch cannot replace a v1 submission in the same session scope
      Given a recorded v1 single-finding submission and a canonical v2 batch for the same session scope
      When the v2 batch reaches the public collector intake
      Then the collector reports a conflict and retains the original raw submission

    @rejection @surface.railway-public-retro-collector
    Scenario Outline: Invalid v2 envelopes are rejected before storage
      Given a v2 request with <invalid shape>
      When its raw request reaches the public collector intake
      Then the collector rejects it without creating a durable submission

      Examples:
        | invalid shape            |
        | an empty findings batch  |
        | an unknown root field    |
        | a non-string findings entry |

    @surface.railway-public-retro-collector
    Scenario Outline: The collector enforces the shared whole-request byte limit
      Given <request>
      When it reaches the public collector intake
      Then the collector <outcome>

      Examples:
        | request                                   | outcome                                    |
        | a canonical v2 raw request of 65536 bytes | records the entire batch in one submission |
        | a canonical v2 raw request of 65537 bytes | rejects it without a durable submission    |
        | a released v1 raw request of 65536 bytes  | records the finding in one submission      |
        | a released v1 raw request of 65537 bytes  | rejects it without a durable submission    |

  @deliver-local-retro-batches.NTB1.R1
  Rule: deliver-local-retro-batches.NTB1.R1 — Public acceptance failure timeout opt-out invalid input and oversize never block completion or consume private recovery

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Public acceptance preserves private recovery silently
      Given an opted-in local session with three valid sanitized findings and a collector that accepts submissions
      When the session completes through its installed retro carrier
      Then the collector records one request
      And completion succeeds without output and every valid sanitized finding remains available for private recovery

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Opt-out preserves private recovery silently
      Given a local session with several valid sanitized findings and public retro collection opted out
      When the session completes through its installed retro carrier
      Then the collector receives zero requests
      And completion succeeds without output while every valid sanitized finding remains available for private recovery

    @rejection @surface.safeword-cli
    Scenario: Oversize preserves private recovery silently
      Given an opted-in local session with several valid findings whose canonical v2 request is 65537 bytes
      When the session completes through the shared local retro carrier
      Then completion succeeds with zero public retries and every valid sanitized finding remains available for private recovery without output

    @rejection @surface.safeword-cli
    Scenario: Invalid input that leaves no valid findings stays silent and recoverable
      Given an opted-in local session in which every extracted finding is invalid for public collection
      When the session completes through the shared local retro carrier
      Then the carrier exits successfully with zero public retries and no output while every extracted finding remains available for private recovery

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Public collector outcomes preserve private recovery silently
      Given a local session with several valid findings and <collector outcome>
      When the session completes through its installed retro carrier
      Then the carrier makes exactly one public delivery attempt and does not retry
      And the session-end carrier exits successfully without output
      And every valid sanitized finding remains available for private recovery

      Examples:
        | collector outcome                                |
        | a collector that refuses the connection          |
        | a collector that rejects the request             |
        | a collector that reports a duplicate             |
        | a collector that reports a conflict              |
        | a collector that returns an unreadable response  |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A collector timeout preserves private recovery silently
      Given a local session with several valid findings and a collector that never responds before a controlled delivery deadline expires
      When the session completes through its installed retro carrier
      Then the carrier makes exactly one public delivery attempt and does not retry
      And the session-end carrier exits successfully when the controlled deadline expires without waiting beyond it or producing output
      And every valid sanitized finding remains available for private recovery
