Feature: Prove cross-provider review before scaling spend

  @prove-cross-provider-review-before-scaling-spend.SWM1.R1
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R1 — The recorded provider identity matches the provider that performed every paid turn

    Scenario: Complete retained Terra fixtures are accepted as route-valid
      Given a retained fixture has matching repository-reading and finding-verification turns and envelopes
      And it retains one unique durable intent record referenced by every request
      And every fixture envelope proves OpenAI GPT-5.6 Terra at standard service tier
      When the harness validates the complete provider-call inventory
      Then the fixture is accepted as route-valid
      And the ordering validator accepts the intent as preceding every retained provider request

    Scenario: Stubbed production wiring targets OpenAI for reading and verification
      Given the real development runner is wired to a recording stub transport and a temporary repository
      When one review reads a repository file, reports a finding, and verifies that finding
      Then every observed outbound model request targets the OpenAI Responses API
      And both the repository-reading request and finding-verification request specify GPT-5.6 Terra at default service tier
      And the Anthropic Messages API receives zero requests

    Scenario Outline: Registered provenance is copied by repeatable fixtures
      Given a completed fixture attempt is linked to a trusted registration with provenance <registered provenance>
      When the harness retains its development output
      Then the fixture is accepted with corpus_author_provenance equal to <registered provenance>
      And no Claude-authorship claim is present

      Examples:
        | registered provenance |
        | legacy-source-a       |
        | Legacy Source/B:Raw   |

    @paid-canary
    Scenario: Terra performs every provider turn over the legacy development corpus
      Given an anchored development corpus with its legacy author provenance unchanged
      And the frozen reviewer route is OpenAI GPT-5.6 Terra at standard service tier
      And explicit durable maintainer authorization is present
      And the harness and adapter run from clean checkouts matching both authorized tags and commits
      When the maintainer deliberately executes one live paid review attempt
      Then the durable provider-turn count is positive and exactly equals the retained provider-response envelope count
      And every retained envelope proves OpenAI GPT-5.6 Terra at standard service tier
      And the recorded reviewer route matches the complete provider-call inventory
      And the durable attempt intent precedes every provider request
      And the output preserves the anchored legacy author provenance without claiming Claude authorship
      And the durable started-attempt count increases by exactly one
      And durable observed spend increases by exactly the sum of all retained turn costs

    @rejection
    Scenario Outline: Provider evidence cannot be relabeled as Terra
      Given an otherwise completed attempt has <evidence defect>
      When the harness validates the complete provider-call inventory
      Then the attempt is rejected as route-invalid
      And its durable attempt and any retained usage remain available to R2 accounting

      Examples:
        | evidence defect                                      |
        | an Anthropic-native reviewer response                |
        | an OpenAI reviewer response for a non-Terra model    |
        | a missing provider response envelope                 |
        | a present but truncated provider response envelope   |
        | retained provider usage proving a paid turn omitted from the durable inventory |
        | a repository-reading turn routed to Anthropic while all finding-verification turns use Terra |
        | a duplicated retained envelope for one recorded provider turn |
        | equal counts with an envelope request id paired to the wrong turn |
        | a Terra-labeled envelope with Anthropic-shaped cache-creation usage |
        | zero recorded turns and zero retained envelopes      |
        | an OpenAI Terra response from a non-standard tier    |
        | both Terra and non-Terra reviewer responses          |

    @rejection
    Scenario Outline: Legacy corpus provenance cannot be replaced
      Given a completed development attempt is linked to the anchored legacy corpus provenance
      When its output has <provenance defect>
      Then the attempt is rejected as provenance-invalid without changing the anchored provenance
      And its durable attempt remains counted by R2 accounting

      Examples:
        | provenance defect                       |
        | a Claude-authorship claim               |
        | an arbitrary mismatched provenance value|
        | no corpus_author_provenance value       |

    @rejection
    Scenario Outline: Provenance-invalid paid usage is never refunded
      Given a provenance-invalid paid attempt retains <usage evidence>
      When the harness reconciles its R2 accounting
      Then <accounting outcome>

      Examples:
        | usage evidence | accounting outcome |
        | complete native standard-tier Terra usage with a known cost | its cost contributes to durable observed spend exactly once |
        | usage that is not priceable by the frozen native Terra policy | cost accounting is incomplete and another attempt is blocked |

  @prove-cross-provider-review-before-scaling-spend.SWM1.R2
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R2 — Durable attempt and cost evidence bounds every new paid attempt

    Scenario: An infrastructure retry consumes another review attempt
      Given nine review attempts have started and the ninth retains a completed provider response and durable cost
      And the ninth attempt's completion record remains byte-identical
      And the recording model transport has automatic retries disabled
      And a downstream retryable infrastructure failure requires another attempt
      And complete durable observed spend is 14 US dollars
      When the isolated fixture replays the permitted retry start
      Then the durable started-attempt count becomes ten
      And exactly one additional upstream start receipt and one provider request are observed for the tenth attempt
      And the ninth attempt's completion record and retained usage remain byte-identical

    @rejection
    Scenario: A retryable OpenAI transport failure is never retried invisibly
      Given eight completed attempts have matching local journals and immutable upstream receipts
      And the recording OpenAI transport returns one retryable error without native usage
      When the controller starts the ninth attempt
      Then exactly one ninth-attempt upstream start receipt, local intent, and physical OpenAI request are observed
      And no second physical request or tenth-attempt start receipt is observed
      And resume counts nine attempts and blocks with reason incomplete-cost-accounting

    Scenario: One multi-turn review counts as one attempt
      Given zero review attempts have started
      And complete durable observed spend is zero US dollars
      When the isolated fixture replays one attempt with retained repository-reading and finding-verification turns
      Then the durable started-attempt count is one
      And exactly two provider turns remain attributed to that one attempt

    Scenario: Explicit initialization bootstraps empty durable accounting
      Given the trusted upstream registration contains an unused one-time initialization authorization
      When the maintainer explicitly initializes the canary
      Then it consumes that upstream authorization and creates the zero upstream head, zero-attempt and zero-picodollar ledgers, plus the matching local marker
      And no provider request or attempt is made

    @rejection
    Scenario: An uninitialized canary cannot execute
      Given neither a trusted canary-initialization marker nor either ticket-scoped ledger exists
      When canary execution rather than initialization is requested
      Then it is blocked with exactly reasons incomplete-attempt-accounting and incomplete-cost-accounting
      And no ledger, attempt, or provider request is created

    @rejection
    Scenario: Deleted ledgers cannot reset an initialized canary
      Given the trusted canary-initialization marker exists after prior attempts
      And immutable upstream receipts retain the prior attempt and cost heads
      And both ticket-scoped ledgers are absent
      When the harness resumes
      Then it is blocked with exactly reasons incomplete-attempt-accounting and incomplete-cost-accounting
      And no ledger, attempt, or provider request is created

    @rejection
    Scenario Outline: Untrusted initialization state cannot authorize planted ledgers
      Given <untrusted initialization state> with planted ticket-scoped ledgers
      When canary execution is requested
      Then it is blocked with exactly reasons incomplete-attempt-accounting and incomplete-cost-accounting
      And the marker and ledger bytes or absence remain exactly as found without a provider request

      Examples:
        | untrusted initialization state          |
        | no trusted initialization marker        |
        | a forged or ticket-mismatched marker    |

    @rejection
    Scenario Outline: Explicit re-initialization cannot reset an initialized canary
      Given the trusted upstream initialization authorization is already consumed with <local state>
      When the maintainer explicitly initializes the canary again
      Then initialization is refused and all local bytes or absence remain exactly as found
      And no attempt or provider request is created

      Examples:
        | local state                                      |
        | a matching marker with non-zero ledgers          |
        | no marker and both ledgers absent                |
        | no marker with planted ledgers                   |
        | a forged or ticket-mismatched marker and planted ledgers |
        | a matching marker with one ledger absent         |

    @rejection
    Scenario Outline: Initialization fails closed when trusted upstream state cannot be read
      Given local marker and ledger bytes have an arbitrary existing state
      And the trusted upstream registration is <lookup failure>
      When the maintainer explicitly initializes the canary
      Then initialization is refused and all local bytes or absence remain exactly as found
      And no attempt or provider request is created

      Examples:
        | lookup failure |
        | unavailable    |
        | unreadable     |

    Scenario Outline: Durable attempt count bounds same-process and resumed execution
      Given complete durable observed spend is <observed spend>
      And execution is <execution mode>
      And <started attempts> review attempts have already started
      And the local journals and immutable upstream receipts agree on that accounting head
      When the harness decides whether to start another attempt
      Then the next attempt is <decision> with reason <reason>
      And the resulting durable started-attempt count is <resulting attempts>
      And provider dispatch is <dispatch decision>

      Examples:
        | execution mode | observed spend | started attempts | decision | reason       | resulting attempts | dispatch decision |
        | same process    | 14 US dollars  | 9                | started  | eligible     | 10                 | permitted         |
        | resumed process | 14 US dollars  | 9                | started  | eligible     | 10                 | permitted         |
        | same process    | 0 US dollars   | 0                | started  | eligible     | 1                  | permitted         |
        | same process    | 14 US dollars  | 10               | blocked  | attempt-stop | 10                 | forbidden         |
        | resumed process | 14 US dollars  | 10               | blocked  | attempt-stop | 10                 | forbidden         |

    @rejection
    Scenario: An unfinished paid attempt still consumes the cap after resume
      Given nine review attempts have started
      When an isolated fixture replays durable tenth-attempt intent followed by an interrupted provider request without completion
      Then resume counts ten started attempts
      And another attempt is blocked with reasons attempt-stop and incomplete-cost-accounting

    @rejection
    Scenario: A provider request without prior durable attempt intent blocks resume
      Given nine review attempts have started
      And complete durable observed spend is 14 US dollars
      And retained paid-request usage belongs to an attempt whose durable intent record is absent
      And its provider-turn inventory and envelopes are complete and that usage is included in the 14-dollar total
      When the harness resumes and validates the accounting order
      Then the next attempt is blocked with reason incomplete-attempt-accounting

    @rejection
    Scenario Outline: A present intent must precede and uniquely authorize each request
      Given a resumed canary has complete durable cost evidence
      And its attempt and request records have <ordering defect>
      When the harness validates attempt ledger consistency
      Then the next attempt is blocked with reason incomplete-attempt-accounting
      And the attempt-ledger bytes remain exactly as found

      Examples:
        | ordering defect |
        | the referenced intent was durably recorded after its provider request |
        | one provider request references two distinct intent identifiers |

    @rejection
    Scenario: A route-invalid paid attempt still consumes the cap
      Given nine review attempts have started
      And complete durable observed spend is 13 US dollars
      When the tenth attempt retains 272000 uncached input and 38000 output tokens at the standard short-context rates and has an envelope-pairing route defect
      Then the durable started-attempt count becomes ten
      And its one-dollar retained usage makes complete observed spend exactly 14 US dollars
      And another attempt is blocked with reason attempt-stop

    @rejection
    Scenario Outline: Route-invalid usage never receives an invented price
      Given a rejected attempt retains <route usage>
      When the harness reconciles observed spend
      Then <cost outcome>

      Examples:
        | route usage | cost outcome |
        | 272000 uncached input and 38000 output tokens from native standard-tier Terra with an envelope-pairing defect | the rejected attempt's retained cost is exactly 1000000000000 picodollars and cost accounting is complete |
        | native OpenAI usage from a non-Terra model | cost accounting is incomplete and another attempt is blocked |
        | native Terra usage from a non-standard tier | cost accounting is incomplete and another attempt is blocked |
        | non-native provider usage | cost accounting is incomplete and another attempt is blocked |

    @rejection
    Scenario Outline: Untrustworthy attempt-count evidence blocks resume
      Given a resumed canary has <attempt evidence defect>
      And its durable cost evidence is present, readable, and internally consistent
      And complete durable observed spend is 14 US dollars
      When the harness decides whether to start another attempt
      Then the next attempt is blocked with reason incomplete-attempt-accounting
      And the attempt-ledger bytes or absence remain exactly as found

      Examples:
        | attempt evidence defect       |
        | absent durable evidence       |
        | unreadable durable evidence   |
        | internally inconsistent counts|
        | duplicate durable intent identifiers |
        | upstream attempt receipts unavailable |
        | a local attempt head lower than the upstream head |
        | equal numeric heads with different attempt identifiers |
        | duplicate upstream sequence numbers |
        | out-of-order upstream sequence numbers |

    @rejection
    Scenario: Simultaneously incomplete accounting reports both reasons
      Given a resumed canary has unreadable durable attempt evidence
      And its durable cost evidence is absent
      When the harness decides whether to start another attempt
      Then the next attempt is blocked with reasons incomplete-attempt-accounting and incomplete-cost-accounting
      And the attempt-ledger bytes or absence remain exactly as found

    @rejection
    Scenario Outline: Partial initialized state fails closed
      Given the immutable initialization marker exists with <partial ledger state>
      When the harness resumes before any provider request
      Then it is blocked with exactly reason <reason> and consumes no attempt

      Examples:
        | partial ledger state                         | reason                        |
        | a zero-attempt ledger but no cost ledger    | incomplete-cost-accounting    |
        | a zero-picodollar cost ledger but no attempt ledger | incomplete-attempt-accounting |

    Scenario Outline: Durable spend state bounds same-process and resumed execution
      Given nine review attempts have started
      And execution is <execution mode>
      And complete durable observed spend is <observed spend>
      When the harness decides whether to start another attempt
      Then the next attempt is <decision> with reason <reason>
      And the resulting durable started-attempt count is <resulting attempts>
      And provider dispatch is <dispatch decision>

      Examples:
        | execution mode | observed spend                 | decision | reason    | resulting attempts | dispatch decision |
        | same process    | 14.999999999999 US dollars    | started  | eligible  | 10                 | permitted         |
        | resumed process | 14.999999999999 US dollars    | started  | eligible  | 10                 | permitted         |
        | same process    | 14.9999998 US dollars         | started  | eligible  | 10                 | permitted         |
        | resumed process | 14.9999998 US dollars         | started  | eligible  | 10                 | permitted         |
        | same process    | exactly 15 US dollars         | blocked  | cost-stop | 9                  | forbidden         |
        | resumed process | exactly 15 US dollars         | blocked  | cost-stop | 9                  | forbidden         |
        | same process    | 15.000000000001 US dollars    | blocked  | cost-stop | 9                  | forbidden         |
        | resumed process | 15.000000000001 US dollars    | blocked  | cost-stop | 9                  | forbidden         |

    Scenario: Both durable limits are reported when both have been reached
      Given ten review attempts have started
      And complete durable observed spend is exactly 15 US dollars
      When the harness decides whether to start another attempt
      Then the next attempt is blocked with reasons attempt-stop and cost-stop
      And the durable started-attempt count is unchanged

    @rejection
    Scenario Outline: Incomplete cost evidence blocks the next attempt
      Given nine review attempts have started
      And a resumed canary has durable cost evidence that is <cost evidence defect>
      When the harness decides whether to start another attempt
      Then the next attempt is blocked with reason incomplete-cost-accounting
      And the durable started-attempt count is unchanged

      Examples:
        | cost evidence defect             |
        | absent                           |
        | unreadable                       |
        | inconsistent with retained usage |
        | upstream completion receipts unavailable |
        | a local cost head lower than the upstream head |
        | equal numeric heads with different raw-response digests |
        | equal numeric heads with different native usage or cost |

    @rejection
    Scenario: A reached attempt stop is reported alongside incomplete cost accounting
      Given ten review attempts have started
      And a resumed canary has absent durable cost evidence
      When the harness decides whether to start another attempt
      Then the next attempt is blocked with reasons attempt-stop and incomplete-cost-accounting
      And the durable started-attempt count is unchanged

    @rejection
    Scenario: A reached cost stop is reported alongside incomplete attempt accounting
      Given a resumed canary has unreadable durable attempt evidence
      And complete durable observed spend is exactly 15 US dollars
      When the harness decides whether to start another attempt
      Then the next attempt is blocked with reasons cost-stop and incomplete-attempt-accounting
      And the attempt-ledger bytes or absence remain exactly as found

    Scenario Outline: A completed threshold-reaching attempt retains correctly priced evidence
      Given eight review attempts have started with complete observed spend of <prior spend>
      And the completed standard-tier Terra attempt retains <input tokens> total uncached input tokens, zero cached or cache-write tokens, and <output tokens> output tokens
      When the harness records the completed attempt
      Then its raw responses, detailed usage, cost, and computed <threshold result> remain durable
      And its single provider turn's context tier is derived as <context tier> from retained usage
      And its cost is recomputed using that frozen standard price tier
      And the computed threshold result is reported and a later attempt is <next decision> with reason <next reason>

      Examples:
        | prior spend                | input tokens | output tokens | context tier  | threshold result   | next decision | next reason |
        | 13.999999999999 US dollars | 272000       | 38000         | short-context | below-15-dollars   | permitted     | eligible    |
        | 14 US dollars              | 272000       | 38000         | short-context | exactly-15-dollars | blocked       | cost-stop   |
        | 14 US dollars              | 272000       | 38001         | short-context | above-15-dollars   | blocked       | cost-stop   |
        | 13.893995999999 US dollars | 272001       | 1000          | long-context  | below-15-dollars   | permitted     | eligible    |
        | 13.893996 US dollars       | 272001       | 1000          | long-context  | exactly-15-dollars | blocked       | cost-stop   |
        | 13.893996 US dollars       | 272001       | 1001          | long-context  | above-15-dollars   | blocked       | cost-stop   |

    Scenario Outline: Context pricing switches only above 272000 input tokens
      Given a completed standard-tier Terra attempt retained <uncached> uncached, <cached> cached, and <cache write> cache-write input tokens
      When the harness recomputes its cost from retained usage
      Then it uses the <context tier> standard price tier

      Examples:
        | uncached | cached | cache write | context tier  |
        | 199999   | 72000  | 0           | short-context |
        | 200000   | 71999  | 1           | short-context |
        | 200000   | 71999  | 2           | long-context  |

    Scenario Outline: Detailed usage components use the frozen standard rates
      Given a completed standard-tier Terra attempt retains <total input> total input tokens establishing the <context tier> tier
      And its retained detailed usage includes 1000 <usage component> tokens
      When the harness recomputes that usage component
      Then its durable component-cost breakdown records integer <component picodollars> picodollars

      Examples:
        | total input | context tier  | usage component   | component picodollars |
        | 1000        | short-context | uncached input    | 2000000000             |
        | 1000        | short-context | cached input      | 200000000              |
        | 1000        | short-context | cache-write input | 2500000000             |
        | 1000        | short-context | output            | 12000000000            |
        | 272001      | long-context  | uncached input    | 4000000000             |
        | 272001      | long-context  | cached input      | 400000000              |
        | 272001      | long-context  | cache-write input | 5000000000             |
        | 272001      | long-context  | output            | 18000000000            |

    Scenario: An absent OpenAI cache-write usage field normalizes to zero
      Given a retained OpenAI Terra usage envelope has 272000 input tokens, reports zero cached tokens, and omits only the cache-write detail field
      When the harness recomputes its cost and total input tokens
      Then cache-write tokens and cache-write cost are both zero
      And total input is 272000 tokens in the short-context tier

    Scenario Outline: Mixed detailed usage produces one observable total cost
      Given a completed standard-tier Terra attempt retains <uncached> uncached, <cached> cached, <cache write> cache-write, and <output> total output tokens
      And <reasoning> of those output tokens are reasoning tokens
      When the harness recomputes the attempt cost
      Then the context tier is <context tier> and the total cost is <total cost> US dollars

      Examples:
        | uncached | cached | cache write | output | reasoning | context tier  | total cost |
        | 1000     | 1000   | 1000        | 1000   | 500       | short-context | 0.0167     |
        | 1000     | 1000   | 1000        | 1000   | 0         | short-context | 0.0167     |
        | 1000     | 1000   | 1000        | 1000   | 1000      | short-context | 0.0167     |
        | 100000   | 100000 | 72001       | 1000   | 500       | long-context  | 0.818005   |
        | 100000   | 100000 | 72001       | 1000   | 0         | long-context  | 0.818005   |
        | 100000   | 100000 | 72001       | 1000   | 1000      | long-context  | 0.818005   |

    Scenario: A multi-turn attempt sums every turn cost exactly once
      Given one attempt retains a short-context repository-reading turn costing 0.0167 US dollars
      And it retains a long-context finding-verification turn costing 0.818005 US dollars
      When the harness records the completed attempt
      Then its durable attempt cost and observed-spend delta are exactly 834705000000 picodollars

    Scenario: Crossing the cost threshold during a turn does not truncate the started attempt
      Given eight complete durable attempts precede an isolated consistent ninth-attempt fixture
      And its early retained turn raises observed spend to exactly 15 US dollars
      And its later repository-reading turn costs 200000 picodollars
      And its later finding-verification turn costs 12000000 picodollars
      When the harness replays the completed fixture
      Then its later provider turns are included in the completed attempt
      And durable observed spend becomes exactly 15000012200000 picodollars
      And a later attempt is blocked with reason cost-stop

    Scenario: Live execution without explicit authorization makes no paid request
      Given the paid canary has no durable explicit maintainer authorization
      And complete durable ledgers record zero attempts and zero picodollars
      When live execution is requested
      Then it is blocked with reason missing-authorization before any provider request and consumes no attempt

    Scenario Outline: Default selectors cannot execute the paid canary
      Given the feature contains a paid canary and a recording model transport
      When the <selector> test selection is evaluated
      Then the paid canary is excluded
      And the recording model transport observes zero requests

      Examples:
        | selector           |
        | local default      |
        | continuous integration |

    Scenario Outline: Authorization cannot be replayed or weakened
      Given otherwise complete durable ledgers and <authorization defect>
      When live execution is requested
      Then it is blocked with reason missing-authorization before any provider request
      And the attempt-ledger bytes or count remain exactly as found

      Examples:
        | authorization defect |
        | only a mutable local authorization boolean |
        | an edited or duplicated upstream authorization comment |
        | an upstream authorization authored by a non-allowlisted maintainer |
        | an otherwise intact authorization from another canonical repository |
        | an authorization bound to another output identity |
        | an authorization bound to another corpus digest or registration |
        | an authorization bound to another adapter or harness tag or commit |
        | a dirty adapter or harness checkout |
        | an authorization bound to another model, tier, attempt cap, or cost stop |
        | an authorization without exactly one matching upstream consumption receipt and local marker |

    Scenario Outline: Missing authorization is reported with every simultaneous accounting outcome
      Given live authorization is absent with <attempt state> and <cost state>
      When the harness evaluates the pre-call guards
      Then it reports exactly <expected reasons> before any provider request
      And the attempt-ledger bytes or count remain exactly as found

      Examples:
        | attempt state               | cost state                       | expected reasons                                                   |
        | 10 complete started attempts | complete spend of 14 US dollars | missing-authorization and attempt-stop                             |
        | unreadable attempt evidence | complete spend of 15 US dollars | missing-authorization, incomplete-attempt-accounting, and cost-stop|

  @prove-cross-provider-review-before-scaling-spend.SWM1.R3
  Rule: prove-cross-provider-review-before-scaling-spend.SWM1.R3 — Development evidence remains permanently separate from confirmatory evidence

    Scenario Outline: Independently anchored confirmatory evidence remains usable
      Given an independently anchored confirmatory corpus and artifact
      And its local presentation is <local presentation>
      When a maintainer requests <confirmatory action> from it
      Then the confirmatory guard admits the request

      Examples:
        | local presentation              | confirmatory action              |
        | unchanged                       | confirmatory estimates           |
        | unchanged                       | confirmatory spend authorization |
        | a stale local development marker | confirmatory estimates           |
        | a stale local development marker | confirmatory spend authorization |

    Scenario: A produced canary artifact is durably diagnostic-only
      Given the anchored corpus registration is development-only and void for confirmatory use
      When the harness records a completed review attempt
      Then the retained attempt and run identity are marked diagnostic-only without changing corpus provenance

    @rejection
    Scenario Outline: A successful development canary cannot become confirmation
      Given an anchored development-only corpus produced a completed canary
      And its artifact is presented as <artifact presentation>
      When a maintainer requests <confirmatory action> from it
      Then the request is rejected without changing the development artifacts

      Examples:
        | artifact presentation                    | confirmatory action              |
        | the original diagnostic artifact         | confirmatory estimates           |
        | the original diagnostic artifact         | confirmatory spend authorization |
        | an artifact with its local role marker removed while its development anchor remains | confirmatory estimates           |
        | an artifact with its local role marker removed while its development anchor remains | confirmatory spend authorization |
        | a copied artifact in a confirmatory path | confirmatory estimates           |
        | a copied artifact in a confirmatory path | confirmatory spend authorization |
        | an artifact locally relabeled confirmatory while its development anchor remains | confirmatory estimates           |
        | an artifact locally relabeled confirmatory while its development anchor remains | confirmatory spend authorization |
        | a development artifact with its local anchor removed | confirmatory estimates           |
        | a development artifact with its local anchor removed | confirmatory spend authorization |
        | a development artifact bearing a self-issued confirmatory anchor | confirmatory estimates           |
        | a development artifact bearing a self-issued confirmatory anchor | confirmatory spend authorization |
        | a development artifact presenting a genuine foreign confirmatory digest | confirmatory estimates           |
        | a development artifact presenting a genuine foreign confirmatory digest | confirmatory spend authorization |

    @rejection
    Scenario Outline: Trusted registration lookup failures deny confirmation
      Given a completed canary artifact has <trusted lookup failure>
      When a maintainer requests <confirmatory action> from it
      Then the request is rejected without changing the artifact

      Examples:
        | trusted lookup failure                              | confirmatory action              |
        | an unavailable trusted corpus registration         | confirmatory estimates           |
        | an unavailable trusted corpus registration         | confirmatory spend authorization |
        | a digest matching no trusted corpus registration   | confirmatory estimates           |
        | a digest matching no trusted corpus registration   | confirmatory spend authorization |
