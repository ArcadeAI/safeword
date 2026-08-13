Feature: Prove cross-provider review before scaling spend

  @prove-cross-provider-review-before-scaling-spend.SWM1.R1
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R1 — The recorded provider identity matches the provider that performed every paid turn

    Scenario: The development runner uses Terra for every review stage
      Given a development review that reads repository content and verifies a finding
      When the maintainer inspects its recorded provider calls
      Then every repository-reading and finding-verification turn proves OpenAI GPT-5.6 Terra at standard service tier
      And no turn proves another provider, model, or service tier

    Scenario: A complete Terra call inventory is accepted
      Given a completed review retains one earlier durable attempt intent and a matching native response for every paid turn
      When the maintainer validates its provider-call inventory
      Then the review is accepted as route-valid

    @rejection
    Scenario Outline: Untrustworthy provider evidence is rejected
      Given a completed review has <provider evidence defect>
      When the maintainer validates its provider-call inventory
      Then the review is rejected as route-invalid

      Examples:
        | provider evidence defect |
        | a response from another provider, model, or service tier |
        | a missing, truncated, or duplicated response |
        | a response paired with the wrong paid turn |
        | no recorded paid turns |

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

    Scenario: The paid child receives only its provider credential
      Given the parent holds separate GitHub and OpenAI credentials for an authorized live attempt
      When the parent launches the paid child
      Then the child receives the OpenAI credential
      And the child receives no GitHub credential

  @prove-cross-provider-review-before-scaling-spend.SWM1.R2
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R2 — Durable attempt and cost evidence bounds every new paid attempt

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
      When the harness decides whether to start another attempt
      Then the attempt is blocked with exactly <reasons>
      And no paid request is made

      Examples:
        | accounting defect | reasons |
        | missing or contradictory attempt evidence | incomplete-attempt-accounting |
        | missing or contradictory cost evidence | incomplete-cost-accounting |
        | missing or contradictory attempt and cost evidence | incomplete-attempt-accounting and incomplete-cost-accounting |

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

    Scenario: A completed attempt that reaches the spend limit is retained
      Given an authorized attempt starts below the spend limit
      And its complete sequence of paid turns reaches or crosses 15 US dollars
      When the harness records the completed attempt
      Then every turn and its exact cost remain durable
      And a later attempt is blocked with exactly cost-stop
      And no paid request is made for the blocked attempt

    @rejection
    Scenario Outline: Invalid paid work is never refunded or assigned an invented price
      Given a route-invalid paid attempt retains <usage evidence>
      When the harness reconciles observed spend
      Then <accounting outcome>

      Examples:
        | usage evidence | accounting outcome |
        | complete native standard-tier Terra usage | its exact cost contributes to durable observed spend once |
        | usage outside the frozen native Terra policy | cost accounting is incomplete and another attempt is blocked |

    Scenario Outline: Frozen native usage determines the exact pricing policy
      Given a completed standard-tier Terra turn retains <input usage>
      When the harness recomputes its cost
      Then it uses <pricing policy>

      Examples:
        | input usage | pricing policy |
        | 272000 total input tokens | the frozen short-context rates |
        | 272001 total input tokens | the frozen long-context rates |
        | no cache-write detail | zero cache-write tokens at the otherwise applicable frozen rates |

    @rejection
    Scenario Outline: Weak or replayed authorization cannot dispatch paid work
      Given otherwise complete accounting and <authorization defect>
      When live execution is requested
      Then the attempt is blocked with exactly missing-authorization
      And no paid request is made

      Examples:
        | authorization defect |
        | no durable maintainer authorization |
        | an edited, duplicated, or untrusted authorization |
        | authorization for another repository, corpus, output, route, or limit |
        | authorization for different code or a dirty checkout |

    @rejection
    Scenario: Authorized corpus cannot dispatch unrelated paid input
      Given a durable authorization names one frozen development corpus
      And the paid child input names a case, immutable review identity, or attempt context that differs from its frozen manifest or authorized attempt
      When live execution is requested
      Then the attempt is blocked before secrets are loaded
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
        | a changed path, local role, or local anchor | confirmatory spend authorization |
        | a self-issued or foreign confirmatory identity | confirmatory estimates |
        | unavailable or unknown trusted registration | confirmatory spend authorization |

    Scenario: Independently anchored confirmatory evidence remains usable
      Given evidence matches an independently trusted confirmatory registration
      And an unrelated stale development marker is present locally
      When a maintainer requests confirmatory use
      Then the confirmatory guard admits the request
