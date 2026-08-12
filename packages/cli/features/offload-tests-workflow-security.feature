@wip
Feature: Run remote verification with least privilege

  @offload-tests.TBU1.R7
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R7 — The managed workflow uses least privilege, treats dispatch inputs as data, and receives no Safeword-provided secrets

    @surface.github-actions-execution-sandbox
    Scenario: The managed workflow completes trusted validation before repository checkout
      Given a valid managed workflow invocation
      When the GitHub-hosted job starts
      Then a test-owned recorder observes raw input grammar and target-ref-digest checks
      And it observes immutable workflow-source validation and one contents-authorized branch-tip comparison
      And all checks precede checkout or repository code without an Actions metadata request

    @rejection
    Scenario: Authenticated dispatch never follows redirects or forwards authorization
      Given Safeword sends one authenticated request to the canonical GitHub Cloud dispatch endpoint
      When that endpoint returns an HTTP redirect
      Then Safeword follows no redirect, forwards no authorization, and reports an indeterminate dispatch

    @rejection @public-cli @surface.safeword-cli
    Scenario: Dispatch serialization has one exact nested JSON shape
      Given a test-owned literal expected JSON byte structure and independently chosen identity values
      When a test-owned TLS endpoint captures the real public CLI invocation's wire request
      Then exactly one POST targets the canonical workflow-dispatch path
      And headers contain one canonical authorization placement, API version, and GitHub JSON accept value
      And the body has exact top-level `ref` and five-field `inputs` with duplicates rejected before transmission

    @rejection @public-cli @surface.safeword-cli
    Scenario: Pending recovery is durably published before dispatch can escape
      Given a test-owned recorder captures pending-record filesystem events and the canonical TLS endpoint's first received network byte
      When the public CLI dispatches one eligible request
      Then record temp write, file fsync, atomic rename and parent-directory fsync all precede the first network byte, and interruption at every earlier event sends zero POST

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Request tokens use exactly 256 bits of production entropy
      Given the production OS entropy adapter <entropy-state>
      When the public CLI prepares a new pending request
      Then <token-outcome>
      Examples:
        | entropy-state | token-outcome |
        | returns a test-observed sequence of exactly 32 bytes | the record and dispatch encode those exact bytes once as 64 lowercase hexadecimal characters |
        | returns distinct 32-byte sequences to concurrent requests | every request receives the corresponding unique token before uniqueness commit |
        | returns seven already-open tokens then a distinct token on attempt eight | no duplicate is committed or dispatched and the final allowed attempt commits only the distinct token |
        | returns duplicates for all eight allowed attempts | no ninth attempt, pending record or network byte occurs and output reports secure entropy exhaustion |
        | fails before returning bytes | no pending record or network byte is created and output reports secure entropy failure |
        | returns fewer or more than exactly 32 bytes | no pending record or network byte is created and output reports secure entropy failure |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Pending-publication syscall failures send no dispatch
      Given one eligible request and a test filesystem injects <pending-failure> at the pending-record durability boundary
      When public invocation `failed-dispatch` attempts dispatch
      Then `failed-dispatch` records its own nonzero exit, error output, filesystem trace, and zero network bytes
      And pre-rename failure exposes no final record
      And post-rename failure exposes only a complete authenticated record or absence in the restart snapshot
      Examples:
        | pending-failure |
        | permission failure before the first write |
        | ENOSPC before the first write |
        | short write of record bytes |
        | record-file fsync failure |
        | atomic rename failure |
        | parent-directory fsync failure |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Dispatch safely retries from the frozen pending-record state
      Given `failed-dispatch` encountered <pending-failure> and the recorder froze its absent-or-complete authenticated pending-record state
      When public invocation `retry-dispatch` starts after the fault is removed
      Then `retry-dispatch` records a separate exit, output, filesystem trace, and network trace
      And it classifies only the frozen state and completes directory durability
      And it sends one POST without changing `failed-dispatch` evidence
      Examples:
        | pending-failure |
        | permission failure before the first write |
        | ENOSPC before the first write |
        | short write of record bytes |
        | record-file fsync failure |
        | atomic rename failure |
        | parent-directory fsync failure |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Pending-record paths reject hostile objects and replacement races
      Given the final record, temporary record or any parent path is independently subjected to <hostile-pending-path>
      When the public CLI prepares, publishes or compare-and-swap rewrites pending state while recording object identities
      Then it fails closed with zero network bytes, follows no link, writes outside no approved directory, overwrites no alias, and commits no stale compare-and-swap
      Examples:
        | hostile-pending-path |
        | a leaf symlink or Windows reparse point |
        | a parent symlink or reparse point |
        | a hard-linked regular file with link count greater than one |
        | a directory or special file at a required regular-file path |
        | leaf replacement between classification and open |
        | parent replacement between open and rename |
        | object identity change between open, write, fsync, rename and final verification |

    @rejection
    Scenario Outline: Unsafe workflow capabilities fail the trusted-workflow contract
      Given the candidate managed workflow <unsafe-property>
      When Safeword checks its trusted identity
      Then it refuses authoritative remote execution
      Examples:
        | unsafe-property |
        | grants write permission |
        | interpolates dispatch input into shell source |
        | executes an unpinned helper before validation |
        | requests a Safeword-provided secret |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Failed pre-checks execute no untrusted workflow step
      Given the managed job receives <invalid-boundary>
      When its pre-check sequence runs
      Then only the pinned trusted validator executes and no checkout, dependency install, repository helper or repository code starts
      Examples:
        | invalid-boundary |
        | an unsupported lane |
        | a mismatched run name |
        | a moved target branch ref |
        | a mismatched workflow-source identity observable before checkout |

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: Valid pre-checks reach immutable checkout exactly once
      Given the exact managed workflow receives a valid frozen request in a disposable real GitHub repository
      When its pinned trusted validator succeeds
      Then checkout of the immutable target occurs once without persisted credentials before any repository-controlled process

    @live @real-github @rejection @surface.github-actions-execution-sandbox
    Scenario: GitHub's contents-read job token is an explicit bounded non-Safeword exception
      Given a disposable private repository independently captures workflow AST mappings, effective runtime action inputs, canonical GitHub requests, checkout Git configuration, repository-process environment and arguments
      When the exact managed job validates the target ref, checks out the immutable SHA with `persist-credentials: false`, and runs one sentinel repository command
      Then the GitHub job token has effective permission exactly `contents: read`
      And it appears only in canonical API authorization and checkout's effective token input
      And it is absent from workflow source, persisted files, and repository-process inputs
      And no Safeword or local API credential reaches the job

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: One valid immutable checkout resolves and executes its plan once
      Given trusted pre-checks completed and the exact target SHA was checked out without persisted credentials
      When the pinned Safeword CLI resolves the dispatched plan kind
      Then every available manifested entry starts once in configured order, every unavailable entry is recorded without starting, and the exact aggregate result maps to the terminal job conclusion

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: A real managed job proves contents read succeeds and contents write fails
      Given the exact managed workflow runs in a disposable real GitHub repository
      When its trusted pre-checks and repository execution complete
      Then a unique attempted contents-write operation returns permission denied, creates no ref or file, and the job's required contents-read operation succeeds

    @rejection @surface.github-actions-execution-sandbox @proof.pending-vitest
    Scenario: The effective permission manifest is exactly contents read
      Given an independent manifest enumerates every supported GitHub permission scope
      When a version-pinned official GitHub workflow-schema artifact independently enumerates recognized permission keys and a separate YAML parser reads workflow-level and job-level permissions including defaults
      Then schema-to-manifest set equality succeeds, effective YAML yields only `contents: read`, every other recognized scope is `none`, and a fixture schema containing one future key fails equality until explicitly classified

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every extra permission mutation invalidates trusted workflow bytes
      Given an otherwise exact candidate adds <permission-mutation>
      When the independent permission parser and exact-byte trust check evaluate it
      Then authoritative remote execution is rejected before checkout
      Examples:
        | permission-mutation |
        | any enumerated non-contents scope at read or write |
        | `contents: write` |
        | `permissions: read-all` or `write-all` |
        | omitted permissions that would inherit repository defaults |
        | an unknown future permission key absent from the literal manifest |

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: Private-repository pre-checks need only contents read
      Given the exact managed job runs in a disposable private GitHub repository with effective permissions only `contents: read`
      When it validates event inputs and immutable workflow context and reads the target branch through the refs API
      Then all required pre-checks succeed, captured requests contain no Actions metadata endpoint, and checkout remains the next repository-controlled boundary

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: A real managed job persists no checkout credential
      Given the exact managed workflow reaches checkout in a disposable real GitHub repository
      When checkout completes
      Then repository Git configuration contains no persisted Actions credential

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every independently enumerated owned channel has its expected clean state
      Given a test-owned literal manifest independent of production discovery fixes <owned-channel> as <expected-state>
      When an opted-in request exercises real serializers, HTTP construction and bundled managed workflow bytes
      Then captured bytes and runtime events show the expected state without a Safeword secret
      And GitHub's job token appears only in the bounded runtime positions named by the row
      Examples:
        | owned-channel | expected-state |
        | project configuration serialization | present but never serialized into dispatch |
        | pending-record serialization | present but never serialized into dispatch |
        | HTTP request headers | canonical GitHub Authorization is transport-only; Accept, API version and user agent are nonsecret; no header is workflow-visible |
        | dispatch JSON body | present with only the five allowlisted identity fields |
        | workflow_dispatch input declarations | present with only the five allowlisted identity fields |
        | workflow, job, or step environment mappings | explicitly absent |
        | action with inputs | declared inputs are literal or derived only from allowlisted identity; effective runtime inputs additionally allow only GitHub's contents-read job token for canonical refs access and checkout |
        | run command source or resulting arguments | present and derived only from validated plan data |
        | files created by the managed workflow | explicitly absent before checkout |
        | Git or HTTP credential-helper configuration | explicitly absent in the job |

    @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox @proof.pending-vitest
    Scenario: The owned-channel manifest exactly covers captured production surfaces
      Given the fixed ten-category manifest and independent capture adapters for configuration, pending bytes, HTTP headers and body, workflow AST, process environment and argv, filesystem, action inputs and Git configuration
      When the harness enumerates capture-adapter category IDs without evaluating secret absence
      Then exact set and cardinality equality has one adapter per manifest category with no missing, extra, collapsed or skipped category

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Serializer data-flow sentinels cannot reach the dispatch wire
      Given a valid control request and a mutated public-CLI fixture that puts <sentinel-mutation> into <owned-channel> selected for emission
      When a test-owned TLS endpoint separately captures both real public-CLI attempts
      Then the mutation fails the <rejection-boundary> before POST, while the control sends exactly one canonical header set and five-field JSON body with no sentinel bytes
      Examples:
        | owned-channel | sentinel-mutation | rejection-boundary |
        | project configuration serialization | a `remote_secret` field selected for dispatch | configuration-to-dispatch allowlist |
        | pending-record serialization | a `secret_ref` field selected for dispatch | pending-to-dispatch allowlist |
        | HTTP request headers other than canonical Authorization | `X-Safeword-Secret: SAFEWORD_SENTINEL` | outbound header allowlist |
        | dispatch JSON body | a sixth `secret` input field | exact dispatch-body schema |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Workflow sink sentinels invalidate exact bytes before sandbox execution
      Given an independent YAML and byte fixture puts <sentinel-mutation> into <owned-channel>
      When the real trusted-workflow identity check evaluates the candidate and the sandbox recorder watches pre-check events
      Then exact-byte trust rejects the candidate and zero checkout or repository process event occurs
      Examples:
        | owned-channel | sentinel-mutation |
        | workflow_dispatch input declarations | a `secret` input declaration |
        | workflow, job, or step environment mappings | `SAFEWORD_SENTINEL: ${{ secrets.SAFEWORD_SENTINEL }}` |
        | action with inputs | `token: ${{ secrets.SAFEWORD_SENTINEL }}` |
        | run command source or resulting arguments | `${{ secrets.SAFEWORD_SENTINEL }}` as an argument |
        | files created by the managed workflow | a pre-check step writing the sentinel reference |
        | Git or HTTP credential-helper configuration | a pre-check credential helper containing the sentinel reference |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every enumerated workflow dependency position is immutable
      Given the candidate contains multiple action references and <dependency-mutation>
      When an independent test YAML parser lists every `uses` position and compares that literal list with Safeword validation before exact-byte identity
      Then authoritative execution is rejected unless every action uses a full commit SHA and no reusable workflow is referenced
      Examples:
        | dependency-mutation |
        | the first action uses a tag |
        | the middle action uses a branch |
        | the final action uses a shortened SHA |
        | one action reference is omitted from validator enumeration |
        | a local or third-party reusable workflow is referenced |
