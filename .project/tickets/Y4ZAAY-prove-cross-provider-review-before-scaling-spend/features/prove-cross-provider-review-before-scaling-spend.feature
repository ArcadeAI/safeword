Feature: Prove cross-provider review before scaling spend

  @prove-cross-provider-review-before-scaling-spend.SWM1.R1
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R1 — The recorded provider identity matches the provider that performed every paid turn

    Scenario: The development runner uses Terra for every review stage
      Given a development review that reads repository content and verifies a finding
      When the maintainer inspects its recorded provider calls
      Then at least one repository-reading turn and one finding-verification turn are retained
      And every repository-reading and finding-verification turn proves OpenAI GPT-5.6 Terra at standard service tier
      And no turn proves another provider, model, or service tier

    Scenario: A complete Terra call inventory is accepted
      Given a completed review retains at least one repository-reading turn and one finding-verification turn
      And it retains one earlier durable attempt intent and a matching native response for every paid turn
      And every response proves OpenAI GPT-5.6 Terra at standard service tier
      When the maintainer validates its provider-call inventory
      Then the review is accepted as route-valid

    @rejection
    Scenario Outline: Untrustworthy provider evidence is rejected
      Given a review that is complete apart from <provider evidence defect>
      When the maintainer validates its provider-call inventory
      Then the review is rejected as route-invalid with exactly <route defect>

      Examples:
        | provider evidence defect | route defect |
        | a response from another provider | provider-mismatch |
        | a response from another model | model-mismatch |
        | a response from another service tier | service-tier-mismatch |
        | a response with Anthropic-shaped usage detail | non-native-usage |
        | a missing response | missing-response |
        | a truncated response | malformed-response |
        | a duplicated response | duplicate-response |
        | a response paired with the wrong paid turn | turn-mismatch |
        | repository-reading turns without a finding-verification turn | missing-review-stage |
        | finding-verification turns without a repository-reading turn | missing-review-stage |
        | no recorded paid turns | missing-paid-turns |

    Scenario Outline: Trusted corpus provenance is copied without embellishment
      Given a completed development review is linked to trusted provenance <registered provenance>
      When the harness retains its result
      Then corpus_author_provenance equals <registered provenance>
      And the result makes no Claude-authorship claim

      Examples:
        | registered provenance |
        | legacy-source-a       |
        | Legacy Source/B:Raw   |

    @rejection
    Scenario Outline: Development provenance cannot be replaced
      Given a completed development review is linked to the trusted legacy corpus provenance
      When its result is presented with <provenance defect>
      Then the result is rejected as provenance-invalid
      And the trusted provenance remains unchanged

      Examples:
        | provenance defect |
        | a Claude-authorship claim |
        | a different provenance value |
        | no provenance value |

    @paid-canary @manual
    Scenario: One authorized live attempt proves the paid route
      Given the development corpus and both clean code checkouts match a durable maintainer authorization
      When the maintainer deliberately runs the one-time paid proof
      Then one completed attempt retains repository-reading and finding-verification turns
      And every retained turn has exactly one earlier matching intent and one native response
      And every matched response proves OpenAI GPT-5.6 Terra at standard service tier

  @prove-cross-provider-review-before-scaling-spend.SWM1.R2
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R2 — Durable attempt and cost evidence bounds every new paid attempt

    Scenario: The paid child receives only its provider credential
      Given the parent holds separate GitHub and OpenAI credentials for an authorized live attempt
      When the parent launches the paid child
      Then the child receives the OpenAI credential
      And the child receives no credential other than the OpenAI credential
      And no paid request is made

    Scenario: Explicit initialization creates an empty authorized checkpoint
      Given trusted upstream registration contains an unused one-time initialization authorization
      When the maintainer explicitly initializes the canary
      Then the authorization is consumed and durable accounting starts at zero attempts and zero spend
      And no paid request is made

    @rejection
    Scenario: Initialization refuses a redirected output root
      Given trusted upstream registration contains an unused one-time initialization authorization
      And the requested output root is a symbolic link
      When the maintainer explicitly initializes the canary
      Then initialization is rejected before the authorization is consumed
      And no paid request is made

    @rejection
    Scenario: Consumed initialization cannot reset durable accounting
      Given the one-time initialization authorization is already consumed
      And durable accounting records started attempts and observed spend
      When the maintainer explicitly initializes the canary again
      Then initialization is rejected and the exact accounting remains unchanged
      And no paid request is made

    Scenario Outline: Complete accounting enforces both paid limits after restart
      Given <started attempts> attempts and <observed spend> are durably accounted
      And execution is <execution mode>
      When the harness decides whether to start another attempt
      Then the attempt is <decision> with exactly <reasons>

      Examples:
        | execution mode | started attempts | observed spend              | decision | reasons                    |
        | same process    | 9                | 14 US dollars               | started  | eligible                   |
        | resumed process | 9                | 14.999999999999 US dollars | started  | eligible                   |
        | resumed process | 10               | 14 US dollars               | blocked  | attempt-stop               |
        | resumed process | 9                | exactly 15 US dollars       | blocked  | cost-stop                  |
        | resumed process | 10               | exactly 15 US dollars       | blocked  | attempt-stop and cost-stop |

    @rejection
    Scenario Outline: Missing or contradictory accounting fails closed
      Given a resumed canary has <accounting defect>
      And every complete limit remains below its authorized stop
      When the harness decides whether to start another attempt
      Then the attempt is blocked with exactly <reasons>
      And no paid request is made

      Examples:
        | accounting defect | reasons |
        | missing attempt evidence | incomplete-attempt-accounting |
        | contradictory attempt evidence | incomplete-attempt-accounting |
        | missing cost evidence | incomplete-cost-accounting |
        | contradictory cost evidence | incomplete-cost-accounting |
        | missing attempt and cost evidence | incomplete-attempt-accounting and incomplete-cost-accounting |
        | contradictory attempt and cost evidence | incomplete-attempt-accounting and incomplete-cost-accounting |

    Scenario: A multi-turn review consumes one attempt
      Given no review attempts have started
      When one review completes repository reading and finding verification
      Then the durable started-attempt count is one
      And both paid turns belong to that attempt

    @rejection
    Scenario: A provider failure is not retried invisibly
      Given eight attempts are completely accounted and automatic provider retries are disabled
      When the ninth attempt receives one retryable provider failure without priceable usage
      Then exactly one ninth-attempt request is observed
      And another attempt is blocked with exactly incomplete-cost-accounting

    Scenario Outline: A completed attempt that reaches the spend limit is retained
      Given an authorized attempt starts below the spend limit
      And zero attempts have previously started
      And its complete sequence of paid turns leaves observed spend at <spend>
      When the harness records the completed attempt
      Then every turn and its exact cost remain durable
      And a later attempt is blocked with exactly cost-stop
      And no paid request is made for the blocked attempt

      Examples:
        | spend |
        | exactly the authorized 15 US dollar limit |
        | 15.000000000001 US dollars |

    Scenario: Invalid paid work with complete usage is not refunded
      Given a route-invalid paid attempt retains complete native standard-tier Terra usage
      When the harness reconciles observed spend
      Then its exact cost contributes to durable observed spend once

    @rejection
    Scenario: Invalid paid work with out-of-policy usage gets no invented price
      Given zero attempts have previously started
      And a route-invalid paid attempt retains usage outside the frozen native Terra policy
      When the harness reconciles observed spend
      Then cost accounting is incomplete
      And another attempt is blocked with exactly incomplete-cost-accounting

    Scenario: Route-invalid paid work still consumes an attempt
      Given nine started attempts are durably accounted
      And observed spend remains below the authorized 15 US dollar limit after the tenth attempt's cost is recorded
      When a tenth paid attempt completes with route-invalid evidence and complete native standard-tier Terra usage
      Then the durable started-attempt count is ten
      And a later attempt is blocked with exactly attempt-stop

    Scenario Outline: Frozen native usage determines the exact pricing policy
      Given a completed standard-tier Terra turn retains <input usage>
      When the harness recomputes its cost
      Then it uses <pricing policy>

      Examples:
        | input usage | pricing policy |
        | 272000 total input tokens | the frozen short-context rates |
        | 272001 total input tokens | the frozen long-context rates |

    Scenario: Missing cache-write detail is normalized without changing the tier
      Given a completed standard-tier Terra turn retains no cache-write detail
      When the harness recomputes its cost
      Then it uses zero cache-write tokens at the otherwise applicable frozen rates

    @rejection
    Scenario Outline: Weak or replayed authorization cannot dispatch paid work
      Given otherwise complete accounting and <authorization defect>
      When live execution is requested
      Then the attempt is blocked with exactly missing-authorization
      And no paid request is made

      Examples:
        | authorization defect |
        | no durable maintainer authorization |
        | an edited authorization |
        | a duplicated authorization |
        | an authorization from an untrusted source |
        | authorization for another repository |
        | authorization for another corpus |
        | authorization for another output root |
        | authorization for another route |
        | authorization for another limit |
        | authorization for different code |
        | authorization for a dirty checkout |
        | a stale authorization |
        | an authorization whose receipt pairs are exhausted |

    Scenario: Matching authorization admits a no-spend dispatch preflight
      Given a durable authorization matches the repository, corpus, output root, route, limits, and clean code pins
      And the paid input matches its frozen case and attempt identity
      When live dispatch is validated without loading provider credentials
      Then dispatch is admitted up to the credential-loading boundary
      And no paid request is made

    Scenario: Concurrent attempt start is atomic
      Given durable accounting records five of ten authorized attempts with spend below the authorized limit
      When two processes contend to start the next attempt
      Then exactly one durable sixth attempt is created
      And the losing process is blocked with exactly dispatch-contention and makes no paid request

    @rejection
    Scenario Outline: Authorized corpus cannot dispatch unrelated paid input
      Given a durable authorization names one frozen development corpus
      And the paid child input has <identity defect>
      When live execution is requested
      Then the attempt is blocked before secrets are loaded
      And no paid request is made

      Examples:
        | identity defect |
        | a case that differs from its frozen manifest |
        | an immutable review identity that differs from its frozen manifest |
        | an attempt context that differs from its authorized attempt |

    Scenario: Automated lanes exclude live paid proof
      Given the default and continuous-integration test selectors
      When the automated BDD lane enumerates runnable scenarios
      Then no @paid-canary or @manual scenario is selected
      And every scenario in this feature without those tags is selected
      And no paid request is made

    @rejection
    Scenario: Validated paid input cannot change before child execution
      Given paid child input matches its authorized frozen corpus case
      When those input bytes change after parent validation
      Then the child rejects the input before provider execution
      And no paid request is made

    @rejection
    Scenario: Existing attempt evidence blocks before paid execution
      Given a fresh authorized attempt ID already has retained evidence bytes
      When live execution is requested
      Then the attempt is blocked before its durable start
      And no paid request is made

  @prove-cross-provider-review-before-scaling-spend.SWM1.R3
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R3 — Development evidence remains permanently separate from confirmatory evidence

    Scenario: A development result is durably diagnostic-only
      Given the trusted corpus registration is development-only
      When the harness retains a completed review
      Then the result and run identity are marked diagnostic-only
      And the trusted corpus provenance remains unchanged

    @rejection
    Scenario Outline: Development evidence cannot authorize confirmation
      Given completed development evidence is presented with <presentation>
      When a maintainer requests <confirmatory action>
      Then the request is rejected without changing the development evidence

      Examples:
        | presentation | confirmatory action |
        | its original diagnostic identity | confirmatory estimates |
        | its original diagnostic identity | confirmatory spend authorization |
        | a changed path | confirmatory spend authorization |
        | a changed local role | confirmatory spend authorization |
        | a changed local anchor | confirmatory spend authorization |
        | a self-issued confirmatory identity | confirmatory estimates |
        | a foreign confirmatory identity | confirmatory estimates |
        | unavailable trusted registration | confirmatory spend authorization |
        | unknown trusted registration | confirmatory spend authorization |

    Scenario: Independently anchored confirmatory evidence remains usable
      Given evidence matches an independently trusted confirmatory registration
      And an unrelated stale development marker is present locally
      When a maintainer requests confirmatory use
      Then the confirmatory guard admits the request
