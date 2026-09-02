Feature: Rank local reviewers and models

  @ranked-local-reviews.TBU1.R1 @vitest @surface.safeword-cli
  Rule: ranked-local-reviews.TBU1.R1 Routes execute in declared order without cache-driven reordering

    Scenario: Explicit reviewer and model routes run in configured order
      Given Codex with model A is declared before OpenCode with model B and the first route cannot complete
      When a review starts through the public command
      Then Codex model A is attempted before OpenCode model B

    Scenario: Reversed reviewer and model routes run in configured order
      Given OpenCode with model B is declared before Codex with model A and the first route cannot complete
      When a review starts through the public command
      Then OpenCode model B is attempted before Codex model A

    Scenario: Cached observations do not change route order
      Given a recently-failed Codex route is declared before a healthy OpenCode route and the first route cannot complete
      When the next review starts through the public command
      Then the Codex route is still attempted before the OpenCode route

    Scenario: Runtime default keeps its configured position
      Given a Codex route without a model is declared before an explicit OpenCode model
      When the next review starts through the public command
      Then Codex is attempted first and launched without explicit model selection

    Scenario: First successful independent route completes the review
      Given an independent Codex route is declared before an OpenCode route and Codex will succeed
      When a review starts through the public command
      Then an independent review is recorded and OpenCode is not attempted

  @ranked-local-reviews.TBU1.R2 @vitest @surface.safeword-cli
  Rule: ranked-local-reviews.TBU1.R2 Invalid or unfunded routes fail visibly without changing model intent

    Scenario: Invalid model identifiers reject route configuration
      Given a route contains an option-shaped model identifier
      When the public review command loads the configuration
      Then it reports invalid configuration and launches no route instead of using the runtime default

    Scenario: Empty route lists reject configuration
      Given a supported author has an explicitly empty route list
      When the public review command loads the configuration
      Then it reports invalid configuration and launches no route instead of compiling legacy routes

    Scenario: Unfunded routes are reported without launch
      Given the shared deadline cannot fund the next configured route
      When a review starts through the public command
      Then that route and every remaining route are reported unattempted without launch

    Scenario: Exhausted configured routes remain blocked
      Given every funded configured route fails
      When the review chain finishes
      Then no independent review is recorded and the result names each attempted route

    Scenario: A valid funded route launches normally
      Given a valid route has enough supplied wall-clock deadline to run
      When the public review command reaches that route
      Then the route is launched at the process boundary

  @ranked-local-reviews.TBU1.R3 @vitest @surface.safeword-cli
  Rule: ranked-local-reviews.TBU1.R3 Same-author routes are always degraded regardless of position

    Scenario: Same-author success cannot satisfy independent review
      Given a same-author route appears before an independent route and will succeed
      When a review starts through the public command
      Then it is labelled degraded, the later independent route is attempted, and its success records an independent review

    Scenario: Last same-author success remains degraded
      Given every independent route failed before a final same-author route that will succeed
      When the review continues through the public command
      Then it is labelled degraded and no independent review is recorded

  @ranked-local-reviews.TBU1.R4 @vitest @surface.safeword-cli
  Rule: ranked-local-reviews.TBU1.R4 Runtime-wide failures skip remaining models without hiding route evidence

    Scenario: Runtime-wide failure skips later models on that runtime
      Given two Codex model routes precede an OpenCode route and Codex is unavailable
      When the review starts through the public command
      Then the attempted Codex route is named, its second model is reported skipped, and OpenCode is attempted next

    Scenario: Attempt failure keeps the next model on that runtime eligible
      Given two Codex model routes precede an OpenCode route and the first Codex model has an attempt-only failure
      When the review starts through the public command
      Then the second Codex model is attempted before OpenCode

  @ranked-local-reviews.NTB1.R1 @vitest @surface.safeword-cli
  Rule: ranked-local-reviews.NTB1.R1 Status distinguishes installed compatible catalogued and proven evidence

    Scenario: Catalogued models are not reported as proven
      Given a runtime advertises model selection and lists a configured model
      When the public status command describes local review routes
      Then the route is reported as compatible and catalogued but not proven

    Scenario: Successful review records proven evidence
      Given a compatible configured route has completed a valid review
      When the public status command describes local review routes
      Then the route is reported as proven by that successful review

    Scenario: Unlisted models are not reported as catalogued
      Given an installed compatible runtime does not list the configured model
      When the public status command describes local review routes
      Then the route is reported as installed and compatible but not catalogued

    Scenario: Installed runtimes without model selection are not compatible
      Given a configured runtime is installed but does not advertise model selection
      When the public status command describes local review routes
      Then the route is reported as installed but not compatible

    Scenario: Missing runtimes are reported as not installed
      Given a configured route's runtime is not installed
      When the public status command describes local review routes
      Then the route is reported as not installed and not compatible

    Scenario: Most recent failure replaces stale proven evidence
      Given a previously-proven route failed its most recent review
      When the public status command describes local review routes
      Then the route reports its known failure and is not reported as proven

  @ranked-local-reviews.NTB1.R2 @vitest @surface.safeword-cli
  Rule: ranked-local-reviews.NTB1.R2 Existing projects keep today's behavior until they opt in

    Scenario: Ordered routes replace legacy route settings when both exist
      Given legacy model settings and an ordered route list are both configured
      When the public review command plans the review
      Then the route chain is exactly the configured list and contains no legacy route

    Scenario Outline: Legacy settings preserve the existing route plan
      Given no ordered route list is configured and legacy model settings exist for a <author> author
      When the public review command plans the review
      Then the ordered runtime chain is <chain>

      Examples:
        | author   | chain                         |
        | Claude   | Codex then OpenCode then Claude |
        | Codex    | Claude then OpenCode then Codex |
        | OpenCode | Claude then Codex then OpenCode |
