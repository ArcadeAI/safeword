Feature: Correlate remote verification with authoritative results

  @wip @offload-tests.TBU1.R3
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R3 — An accepted dispatch immediately derives its correlated run destination from trusted repository identity and finishes with an authoritative result

    @live @real-github @public-cli @surface.safeword-cli
    Scenario: The disposable GitHub dispatch returns its authoritative run identity
      Given a disposable real GitHub repository is configured through the public Safeword CLI with the exact managed workflow and an independent transport recorder captures the raw response bytes
      When it dispatches through GitHub API version 2026-03-10
      Then it observes HTTP 200 with one canonical integer `workflow_run_id`
      And the authenticated pending record preserves that exact int64 value without numeric rounding
      And API and HTML URLs use that exact decimal ID with the frozen canonical repository identity

    @live @real-github @public-cli @surface.safeword-cli
    Scenario Outline: Live contract evidence distinguishes product incompatibility from fixture unavailability
      Given the harness independently records live authentication, repository provisioning, canonical request bytes and raw response evidence
      When <live-condition>
      Then <gate-outcome>
      Examples:
        | live-condition | gate-outcome |
        | prerequisites succeed and canonical GitHub differs from the versioned HTTP 200 run-ID contract | the product contract fails with captured request and response evidence |
        | authentication, provisioning, DNS or GitHub availability prevents the canonical request | the gate reports explicit infrastructure unavailability and remains incomplete rather than passing or silently skipping |

    @live @real-github @public-cli
    Scenario Outline: A live accepted run exposes each independent trust source
      Given a disposable real GitHub run was accepted
      When the public CLI compares frozen <field> with <independent-source>
      Then captured raw evidence exactly matches that field's frozen control and proceeds to the next ordered check
      Examples:
        | field | independent-source |
        | canonical repository owner | authenticated run API repository owner object |
        | canonical repository name | authenticated run API repository name |
        | canonical API origin | system-trust-validated TLS request origin captured by the HTTP transport |
        | workflow ID | run API workflow ID |
        | workflow path | workflow metadata API path |
        | workflow-source SHA | immutable run workflow-source SHA |
        | actor ID | run API actor ID |
        | actor login | run API actor login |
        | trusted workflow hash | independently decoded contents-API bytes at workflow-source SHA plus bundled literal hash |
        | managed workflow version | bundled literal version manifest plus supported pending reader |
        | pending-record schema | local authenticated record bytes parsed by versioned schema reader |
        | CLI compatibility | local record CLI version parsed by compatibility table |
        | request token | canonical run-name token compared with authenticated record bytes |
        | run-name target-ref digest | canonical run-name digest compared with SHA-256 of authenticated target-ref bytes |
        | run-name full SHA | canonical run-name SHA compared with authenticated record bytes |
        | lane | canonical run-name lane compared with authenticated record bytes |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Each isolated trust-source mismatch stops at its own boundary
      Given a recorded live accepted-run control and a test-owned adapter perturb only <field> at <independent-source>
      When the public CLI inspects that isolated response sequence
      Then it stops with that field-specific error, sends no later authority request, persists no terminal result, leaves pending bytes unchanged, and starts no fallback
      Examples:
        | field | independent-source |
        | canonical repository owner | authenticated run API repository owner object |
        | canonical repository name | authenticated run API repository name |
        | canonical API origin | system-trust-validated TLS request origin captured by the HTTP transport |
        | workflow ID | run API workflow ID |
        | workflow path | workflow metadata API path |
        | workflow-source SHA | immutable run workflow-source SHA |
        | actor ID | run API actor ID |
        | actor login | run API actor login |
        | trusted workflow hash | independently decoded contents-API bytes at workflow-source SHA plus bundled literal hash |
        | managed workflow version | bundled literal version manifest plus supported pending reader |
        | pending-record schema | local authenticated record bytes parsed by versioned schema reader |
        | CLI compatibility | local record CLI version parsed by compatibility table |
        | request token | canonical run-name token compared with authenticated record bytes |
        | run-name target-ref digest | canonical run-name digest compared with SHA-256 of authenticated target-ref bytes |
        | run-name full SHA | canonical run-name SHA compared with authenticated record bytes |
        | lane | canonical run-name lane compared with authenticated record bytes |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Noncanonical run names never supply frozen target identity
      Given an accepted run exposes <run-name-form>
      When Safeword parses correlation identity
      Then the run is not accepted as authoritative and no local fallback or redispatch occurs
      Examples:
        | run-name-form |
        | a malformed token |
        | a malformed target-ref digest |
        | a malformed SHA |
        | a malformed lane |
        | an abbreviated SHA |
        | a differently cased identity |
        | a percent-encoded identity |
        | duplicate token fields |
        | duplicate target-ref digest fields |
        | duplicate SHA fields |
        | duplicate lane fields |
        | an extra ambiguous separator |
        | an extra field |

    @rejection @public-cli @surface.safeword-cli @proof.pending-vitest
    Scenario: The run-identity mutation manifest covers every field-defect cell
      Given a test-owned literal field inventory contains
        | field |
        | repository owner |
        | repository name |
        | canonical API origin |
        | workflow ID |
        | workflow path |
        | workflow-source SHA |
        | actor ID |
        | actor login |
        | trusted workflow hash |
        | managed workflow version |
        | pending-record schema version |
        | compatible CLI version |
        | request token |
        | run-name target-ref digest |
        | run-name full SHA |
        | lane |
      And a test-owned raw-defect inventory contains
        | defect |
        | omitted |
        | duplicated with equal values |
        | duplicated with unequal values |
        | type-changed |
        | noncanonically encoded |
        | canonically encoded but mismatched |
      And an independent applicability manifest marks every field-defect cell applicable or impossible with a fixed reason and defines one concrete raw-source adapter for each applicable cell
      When the harness enumerates generated fixture IDs without invoking product authority decisions
      Then exact set and cardinality equality prove every applicable cell appears once, every impossible reason is asserted, and any collapsed, missing, extra or skipped applicable cell fails the harness

    @rejection @public-cli @surface.safeword-cli
    Scenario: Each complete run-identity mutation fixture fails authority independently
      Given the run-identity mutation manifest passed its independent completeness check and one accepted control
      When the harness starts one isolated public-CLI process per applicable cell while all other fields remain at control values
      Then it emits one uniquely labeled result per manifest cell
      And each isolated result preserves pending recovery and rejects authority
      And no result sends a POST or fallback or terminates the fixture loop early

    @live @real-github @public-cli
    Scenario: Interrupted correlation paginates to one exact visible run
      Given a disposable real GitHub request was interrupted before run-ID persistence and its exact run is beyond the first result page
      When the public CLI resumes within the filtered-result limit
      Then pages of 100 select exactly the run matching every frozen identity field by page 10 and send no POST

    @rejection
    Scenario Outline: Pagination and visibility stop at their exact boundaries
      Given an authenticated pending record has no run ID
      When <visibility-boundary>
      Then <visibility-outcome> and neither dispatch POST nor local fallback occurs
      Examples:
        | visibility-boundary | visibility-outcome |
        | the exact run is the final item on page 10 | that one run is accepted |
        | no exact run appears in the first 1,000 filtered results | the request remains pending with manual run-ID recovery |
        | no exact run appears before 60 seconds of injected monotonic visibility budget | the request remains pending with the resume command |

    @live @real-github @public-cli
    Scenario: Live GitHub rate-limit metadata reaches the production retry controller
      Given a disposable real GitHub run is accepted
      When the public CLI performs one observation GET
      Then a test-owned wire recorder verifies GitHub's real rate-limit header shape is parsed into the same production retry-controller input used by bounded tests

    @public-cli @surface.safeword-cli
    Scenario Outline: Injected rate-limited observation has one bounded terminal behavior
      Given an accepted run and injected production-HTTP responses, monotonic clock and backoff events
      When the public CLI applies bounded idempotent GET backoff and <retry-state>
      Then <rate-outcome> and no dispatch POST is sent
      Examples:
        | retry-state | rate-outcome |
        | the fifth GET succeeds within the two-minute budget | the exact run's observation continues to its terminal result |
        | five attempts or two minutes are exhausted | the pending record remains open and output gives the exact resume command |
        | Retry-After exceeds the remaining two-minute budget | the pending record remains open without waiting past budget and output gives the exact resume command |

    @public-cli
    Scenario Outline: HTTP 200 preserves every accepted int64 run-ID boundary exactly
      Given preflight froze trusted github.com repository and workflow identity
      When versioned dispatch returns HTTP 200 with workflow run ID <run-id>
      Then Safeword persists the exact decimal value without IEEE-754 rounding, derives its URLs from frozen identity, and watches that exact run
      Examples:
        | run-id |
        | 1 |
        | 9007199254740991 |
        | 9007199254740992 |
        | 9007199254740993 |
        | 9223372036854775807 |

    @public-cli
    Scenario Outline: Benign JSON framing does not change an exact run ID
      Given preflight froze trusted github.com repository and workflow identity
      When HTTP 200 contains run ID 9007199254740993 with <benign-framing>
      Then Safeword persists exact run ID 9007199254740993 and ignores only the unrelated framing
      Examples:
        | benign-framing |
        | legal leading and trailing JSON whitespace |

    @public-cli @proof.pending-vitest
    Scenario Outline: The pinned HTTP 200 response-member allowlist is independently frozen
      Given the pinned response manifest defines `workflow_run_id`, `run_url`, and `html_url`
      And it defines 26 stable fixtures covering control, omission, addition, duplication, and JSON-type replacement
      When an independent raw-token enumerator that imports no production allowlist compares production acceptance with <manifest-mutation>
      Then generated and executed fixture IDs exactly equal the manifest
      And only the unique correctly typed control is accepted
      And response URLs are ignored in favor of URLs derived from frozen identity and exact run ID
      Examples:
        | manifest-mutation |
        | the unchanged literal manifest |
        | each one-member omission |
        | each one-member addition |
        | a duplicate of each member with equal or unequal values |
        | each member changed to every other JSON type |

    @rejection
    Scenario Outline: A response without one canonical positive int64 run ID is never accepted
      Given Safeword sent one valid dispatch request
      When it receives <response>
      Then the result is indeterminate, the authenticated pending record remains open, and Safeword neither follows another host, infers a run, redispatches, nor falls back locally
      Examples:
        | response |
        | HTTP 200 without a run ID field |
        | HTTP 200 with numeric run ID 0, the first value below the accepted domain |
        | HTTP 200 with raw numeric run ID `-0` |
        | HTTP 200 with a leading-zero numeric token such as `01` |
        | HTTP 200 with a negative run ID |
        | HTTP 200 with a fractional run ID |
        | HTTP 200 with a string-encoded run ID |
        | HTTP 200 with run ID 9223372036854775808 |
        | HTTP 200 whose raw JSON contains duplicate run ID keys with different values |
        | HTTP 200 whose raw JSON contains duplicate run ID keys with the same value |
        | HTTP 200 whose raw JSON contains duplicate unrelated member keys |
        | HTTP 200 with one unique response member not in the pinned API-version allowlist |
        | HTTP 200 with `Workflow_Run_Id` instead of canonical `workflow_run_id` |
        | HTTP 200 with `workflowRunId` instead of canonical `workflow_run_id` |
        | HTTP 200 with a whitespace-altered run-ID key instead of canonical `workflow_run_id` |
        | HTTP 200 with a run ID in exponent notation |
        | HTTP 200 with malformed JSON |
        | HTTP 204 |
