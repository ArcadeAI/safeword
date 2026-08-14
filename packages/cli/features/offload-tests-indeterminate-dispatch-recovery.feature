Feature: Recover from indeterminate remote dispatches

  @wip @offload-tests.TBU1.R5
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R5 — An indeterminate dispatch is reported for recovery and never automatically duplicated locally

    @public-cli @surface.safeword-cli
    Scenario Outline: Ambiguous dispatch preserves pending recovery without fallback
      Given a valid dispatch request was attempted once
      When the public Safeword CLI receives <ambiguous-outcome>
      Then it exits indeterminate, preserves the authenticated pending record, prints its resume command, and sends neither another POST nor a local plan invocation
      Examples:
        | ambiguous-outcome |
        | a timeout |
        | a transport error |
        | a proxy response without a GitHub request ID |
        | an HTTP redirect |
        | HTTP 204 |
        | HTTP 429 |
        | HTTP 500 |
        | HTTP 200 without a positive run ID |

    @rejection
    Scenario: Indeterminate dispatch is never retried automatically
      Given a pending request has no conclusive acceptance or rejection
      When the command exits or is resumed
      Then Safeword neither redispatches nor authorizes local fallback
