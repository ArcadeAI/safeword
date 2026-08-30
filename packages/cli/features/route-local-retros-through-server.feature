@route-local-retros-through-server @manual
Feature: Route local retros through the durable server

  Newly captured local retros move from one bounded client request into durable
  server ownership without customer setup. Legacy records remain inert, and a
  production-evidence gate controls the global cutover.

  @local-retro-cutover.NTB1.R1 @surface.claude-code @surface.openai-codex @surface.cursor @surface.safeword-cli @surface.railway-public-retro-collector
  Rule: local-retro-cutover.NTB1.R1 — Local submission requires no customer setup

    # Real installed-harness wiring is proven by the production canaries in SWM1.R1.

    Scenario Outline: A fresh local installation submits through its installed harness
      Given a newly installed project after the global cutover is enabled
      When an eligible finding is captured by <harness>
      Then the collector accepts a server-owned request without customer credentials or configuration

      Examples:
        | harness      |
        | Claude Code  |
        | OpenAI Codex |
        | Cursor       |

    @rejection
    Scenario: Missing project identity prevents public submission
      Given an installation without a valid project identity
      When an eligible finding is captured
      Then no public request is attempted and the finding remains locally recoverable

  @local-retro-cutover.NTB1.R2 @surface.safeword-cli
  Rule: local-retro-cutover.NTB1.R2 — Retrospective transport is silent and bounded

    Scenario Outline: Every transport outcome stays within the shared stop budget
      Given a session stop with <transport-outcome>
      When retrospective transport drains under a controlled transport and injected clock
      Then the session stop completes within the injected 750 millisecond budget
      And no retrospective output appears in the session-stop result
      And the controlled transport records the attempted request

      Examples:
        | transport-outcome |
        | collector accepts promptly |
        | collector returns a duplicate receipt promptly |
        | collector returns a typed rejection promptly |
        | receipt is lost after transport stalls beyond the budget |
        | server stalls beyond the budget |
        | unreachable connection attempt stalls beyond the budget |

    @rejection
    Scenario: An exhausted stop budget prevents transport
      Given retrospective preparation consumed the shared stop budget
      When the prepared request is considered for transport
      Then no network attempt begins and the request remains locally recoverable

    Scenario: Preparation and transport share one stop budget
      Given retrospective preparation consumed 400 milliseconds
      When transport begins under an injected clock
      Then the session stop completes within one 750 millisecond budget
      And transport receives a deadline of at most 350 milliseconds

  @local-retro-cutover.NTB1.R3 @surface.safeword-cli
  Rule: local-retro-cutover.NTB1.R3 — Collection remains disclosed and optional

    Scenario: Default installation documents the sanitized feedback path
      Given a default installation
      When the managed retrospective documentation is inspected
      Then the installed documentation identifies every transmitted metadata field, every excluded sensitive field, and the project opt-out

    @rejection
    Scenario: A project opt-out prevents collection
      Given a project has disabled public retrospective collection
      When an eligible local finding is captured
      Then no public request or server record is created

  @local-retro-cutover.TBU1.R1 @surface.safeword-cli @surface.railway-public-retro-collector
  Rule: local-retro-cutover.TBU1.R1 — One captured window keeps one request identity

    Scenario: A lost receipt retries the persisted request
      Given the collector accepted a request but its receipt did not reach the client
      When the same transcript window retries
      Then the collector returns the original receipt for the same request identity and bytes

    Scenario: Re-extracting the same transcript window reuses its durable identity
      Given a transcript window was extracted before its request was persisted
      When the same saved transcript offset is extracted again
      Then it produces the same session scope and durable request identity

    Scenario: A later transcript window is not suppressed by an earlier request
      Given an earlier transcript window already has an accepted request
      When newly captured findings advance the saved transcript offset
      Then they receive a distinct session scope and durable request identity

    Scenario: Conflicting retry bytes preserve both recovery records
      Given the collector already accepted one request identity with immutable bytes
      When that identity is retried with different bytes
      Then the collector preserves the original receipt and bytes and the client retains the divergent copy as a local diagnostic

  @local-retro-cutover.TBU1.R2 @surface.retro-filer @surface.railway-public-retro-collector
  Rule: local-retro-cutover.TBU1.R2 — Durable acceptance transfers recovery exactly once

    Scenario: Collector acceptance transfers recovery to the server
      Given a locally recoverable server-owned request
      When the collector durably accepts its exact bytes
      Then local filing ownership is released and direct GitHub filing stays disabled for that source

    @rejection
    Scenario: A legacy quarantine receipt does not transfer recovery
      Given a locally recoverable legacy v2 request
      When the collector returns a quarantine receipt
      Then the request remains locally recoverable with its original identity and bytes and the worker cannot lease it

    @rejection
    Scenario: A typed intake rejection preserves local diagnosis
      Given a locally recoverable server-owned v3 request
      When the collector returns an invalid-request rejection
      Then its original identity and bytes remain in local diagnostic recovery and direct GitHub filing is not attempted

    @rejection
    Scenario Outline: A transport failure before acceptance preserves local recovery
      Given a locally recoverable server-owned v3 request
      When the collector <failure> before returning a receipt
      Then the request remains locally recoverable with its original identity and bytes and direct GitHub filing is not attempted for that source

      Examples:
        | failure             |
        | times out           |
        | cannot be reached   |

  @local-retro-cutover.TBU1.R3 @surface.railway-hosted-relay
  Rule: local-retro-cutover.TBU1.R3 — Raw GitHub bodies are duplicate authority

    Scenario: Exact authority markers suppress a duplicate create
      Given one issue carries the request and authority markers in its raw REST body after a complete scan
      When the relay evaluates the accepted request
      Then it records an exact duplicate without creating another issue

    @rejection
    Scenario Outline: Non-authoritative evidence cannot suppress filing
      Given no create has been attempted for the request and duplicate investigation has only <evidence>
      When the relay evaluates the accepted request
      Then the relay proceeds to create the issue rather than suppressing it as a duplicate

      Examples:
        | evidence              |
        | a sanitized MCP read  |
        | a similar issue body without exact markers |
        | a lone request marker |
        | an incomplete scan    |

  @local-retro-cutover.TBU1.R4 @surface.safeword-cli @surface.railway-public-retro-collector @surface.railway-hosted-relay
  Rule: local-retro-cutover.TBU1.R4 — Accepted intake is safe and relay-compatible

    Scenario: The largest relay-compatible normalized batch is accepted
      Given fifty findings whose rendered issue body remains below sixty thousand bytes
      When the client and collector validate the complete envelope
      Then both accept it with every finding present

    Scenario: The largest accepted batch remains relay-compatible
      Given the largest relay-compatible fifty-finding envelope reaches the filing worker
      When the relay files it
      Then the relay records one created GitHub issue with every finding represented

    @rejection
    Scenario: An oversized envelope is rejected before storage
      Given a public request exceeds 256 KiB
      When the collector validates it
      Then it returns a typed rejection and stores no record

    @rejection
    Scenario: A malformed request identity is rejected before storage
      Given a public request with a non-v4 request identity
      When the collector validates it
      Then it returns a typed rejection and stores no record

    @rejection
    Scenario Outline: Prohibited finding content is rejected before storage
      Given a public request with <prohibited-content>
      When the collector validates it
      Then it returns a typed rejection and stores no record

      Examples:
        | prohibited-content          |
        | a user identity field       |
        | transcript or prompt text   |
        | tool output or file content |
        | secret material             |

    Scenario: Public intake holds no GitHub filing authority
      Given a valid credentialless public request
      When the collector accepts it under a controlled outbound transport
      Then no outbound GitHub request is recorded and the relay filing credential is absent from the collector process configuration

  @local-retro-cutover.TBU1.R5 @surface.railway-public-retro-collector @surface.railway-hosted-relay
  Rule: local-retro-cutover.TBU1.R5 — Server ownership survives interrupted filing

    Scenario: A claim crash is reclaimed and filed once
      Given a worker lease exists and the relay has not accepted the request
      When an injected clock advances past the lease deadline and the worker recovers
      Then the same request is reclaimed and the relay records one created GitHub issue for that request identity

    @rejection
    Scenario Outline: Ambiguous creation follows raw-body ground truth
      Given GitHub <github-state> but the relay did not receive the create response
      When server-side ambiguity recovery scans raw issue bodies
      Then the retained payload reaches <disposition> without a blind create

      Examples:
        | github-state                     | disposition               |
        | created the marked issue         | an exact-duplicate result |
        | created no matching marked issue | a filed result            |

    @rejection
    Scenario: Incomplete ambiguity scan retains the request for reconciliation
      Given a GitHub create response was lost and the raw-body scan cannot complete
      When server-side ambiguity recovery runs
      Then no create is issued and the retained payload remains retryable for another complete scan

  @local-retro-cutover.TBU1.R6 @surface.railway-public-retro-collector
  Rule: local-retro-cutover.TBU1.R6 — Routine operations do not expose findings

    Scenario: Lifecycle inspection returns metadata without payload
      Given accepted records exist in queued, retryable, and terminal states
      When an operator lists their lifecycle
      Then each result contains identity and state but no finding content

    @rejection
    Scenario: An ordinary operator credential cannot read raw payloads
      Given an accepted record contains a finding payload
      When the routine operator credential requests its raw body
      Then access is denied and no payload bytes are returned

    @rejection
    Scenario: An unauthenticated caller cannot inspect accepted work
      Given accepted records exist in the public collector
      When a caller without credentials requests lifecycle metadata or a raw body
      Then access is denied and no record metadata or payload bytes are returned

    Scenario: Break-glass payload access is audited
      Given an accepted record and a valid break-glass credential
      When its raw body is read for diagnosis
      Then the payload is returned and an audit entry records the reader and request identity

    Scenario: Authorized worker payload access is separately authenticated and audited
      Given an accepted record and a valid collector-worker credential
      When the worker leases and reads its raw body
      Then the payload is returned and an audit entry records the worker principal and request identity

  @local-retro-cutover.TBU1.R7 @surface.safeword-cli @surface.retro-filer
  Rule: local-retro-cutover.TBU1.R7 — Cutover preserves old work and routes new work only through the server

    Scenario: Cutover preserves a draft captured under the old route
      Given a draft was captured under the direct-filing route and global cutover is now enabled
      When the draft is drained
      Then the draft is filed through the established direct-filing path and its local record is released only after that completion

    Scenario: Cutover routes a newly captured finding only through the server
      Given global cutover is enabled
      When a new eligible finding is captured
      Then it produces only a server-owned request and never enters direct filing

  @local-retro-cutover.SWM1.R1 @surface.claude-code @surface.openai-codex @surface.cursor @manual @production-evidence
  Rule: local-retro-cutover.SWM1.R1 — Real harness canaries precede global cutover

    Scenario Outline: A real harness canary proves terminal production filing
      Given a build-attested <harness> canary with direct filing disabled for its captured source
      When its server-owned request completes in production
      Then its local artifact, collector receipt, and filed relay receipt bind the same request identity and session scope
      And the relay records one created GitHub issue with no parallel direct create for that captured source

      Examples:
        | harness      |
        | Claude Code  |
        | OpenAI Codex |
        | Cursor       |

  @local-retro-cutover.SWM1.R2 @surface.cursor
  Rule: local-retro-cutover.SWM1.R2 — Readiness proves truthful runtime provenance

    Scenario Outline: Cursor host detection records truthful provenance
      Given Cursor host detection observes <runtime-evidence>
      When it classifies the runtime
      Then the evidence records cursor and <host-class> with local-readiness eligibility <eligibility>

      Examples:
        | runtime-evidence                              | host-class    | eligibility |
        | no managed metadata socket in a local runtime | local         | eligible    |
        | metadata socket exists but does not prove locality | unknown    | ineligible  |
        | indeterminate metadata                        | unknown       | ineligible  |

  @local-retro-cutover.SWM1.R3 @surface.railway-public-retro-collector @surface.railway-hosted-relay @manual @production-evidence
  Rule: local-retro-cutover.SWM1.R3 — Production fault evidence proves recoverable ownership

    Scenario Outline: Server-owned work survives a filing fault
      Given an accepted request encounters <fault> with <ground-truth>
      When the responsible recovery path completes
      Then the request remains payload-free visible, reaches <disposition>, and its production fault artifact becomes eligible for the readiness manifest

      Examples:
        | fault                     | ground-truth                          | disposition                        |
        | a full worker outage      | no GitHub create occurred             | a filed disposition                |
        | a crash after claim       | no GitHub create occurred             | a filed disposition                |
        | retry deadline exhaustion | retry time is exhausted                | an alerted dead-letter disposition |
        | ambiguous GitHub creation | GitHub created the marked issue        | an exact-duplicate disposition     |
        | ambiguous GitHub creation | GitHub created no matching marked issue | a filed disposition              |

  @local-retro-cutover.SWM1.R4 @surface.railway-public-retro-collector @surface.railway-hosted-relay
  Rule: local-retro-cutover.SWM1.R4 — Intake and filing bounds contain anonymous volume

    Scenario: Admitted work drains oldest-first within filing quotas
      Given accepted requests have distinct acceptance times under an injected clock and exceed the current per-project filing quota
      When filing capacity becomes available
      Then the oldest eligible request is filed first and newer requests remain durably queued

    Scenario: Configured filing quota controls admitted filing volume
      Given the per-project filing quota is configured to one request per hour
      When two eligible requests are evaluated in that hour
      Then one request is filed and the other remains durably queued

    @rejection
    Scenario: Exhausted public intake rejects before storage
      Given the global public-intake allowance for the minute is exhausted
      When another otherwise-valid request reaches intake
      Then intake rejects it before storage with a retryable response

    @rejection
    Scenario: Prolonged filing quota exhaustion reaches an alerted terminal state
      Given a queued request that has been quota-blocked for 24 hours under an injected clock
      When filing maintenance evaluates it
      Then the request dead-letters with a payload-free alert

  @local-retro-cutover.SWM1.R5 @surface.claude-code @surface.openai-codex @surface.cursor @surface.safeword-cli
  Rule: local-retro-cutover.SWM1.R5 — Readiness rejects incomplete or untruthful evidence

    Scenario: Complete truthful evidence enables global cutover
      Given the readiness manifest contains terminal production evidence for all three local harnesses with truthful provenance and matching build ancestry
      When the readiness manifest is evaluated
      Then global cutover is enabled

    @rejection
    Scenario: Managed Cursor evidence cannot satisfy local readiness
      Given readiness evidence whose Cursor host class is managed cloud
      When the readiness manifest is evaluated
      Then the evidence is rejected and the global cutover remains disabled

    @rejection
    Scenario: Missing harness evidence keeps the global cutover disabled
      Given terminal production evidence is absent for one supported local harness
      When the readiness manifest is evaluated
      Then the evidence is rejected and the global cutover remains disabled

    @rejection
    Scenario: Indeterminate Cursor provenance cannot satisfy local readiness
      Given Cursor host detection cannot determine a local or managed-cloud runtime
      When the readiness manifest evaluates evidence whose host class is unknown
      Then the evidence is rejected and the global cutover remains disabled

    @rejection
    Scenario: Mismatched build ancestry cannot satisfy readiness
      Given canary evidence whose build attestation does not match the running implementation
      When the readiness manifest is evaluated
      Then the evidence is rejected and the global cutover remains disabled

    @rejection
    Scenario: A fault artifact without recovery evidence cannot enable cutover
      Given production evidence shows an injected fault but no authoritative terminal disposition
      When the readiness manifest is evaluated
      Then the global cutover remains disabled
