# This is a BDD specification with delegated executable proof. The adjacent
# .bdd-proof.json maps every scenario to exact, normally collected Vitest tests.
@proof.vitest @operate-retry-safe-retro-relay
Feature: Operate the retry-safe retro relay

  The shared safeword retro command durably hands off one immutable request
  without delaying a user session. Operators can enforce and observe the
  request lifecycle while uniqueness and raw-marker behavior remain unchanged
  and gated on #1474, #1481, and post-fix collision measurement.

  Rule: One immutable persisted request crosses every harness without acquiring a new identity

    @operate-retry-safe-retro-relay.TBU1.R1
    @surface.claude-code @surface.claude-code-cloud
    @surface.openai-codex @surface.openai-codex-cloud
    @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    Scenario Outline: Each harness submits the exact request persisted by another harness
      Given a sanitized retro request was persisted before delivery
      When <harness> submits it through its real shared CLI entry point
      Then the relay receives the original opaque requestId and exact payload bytes
      And the response receipt addresses that original request

      Examples:
        | harness             |
        | Claude Code         |
        | Claude Code Cloud   |
        | OpenAI Codex        |
        | OpenAI Codex Cloud  |
        | Cursor              |
        | Cursor Cloud Agents |

    @operate-retry-safe-retro-relay.TBU1.R1 @rejection
    Scenario: A retry cannot replace the persisted payload or request identity
      Given a sanitized retro request was persisted before delivery
      When another harness supplies re-rendered payload bytes for its requestId
      Then the shared operation rejects the local mutation before acknowledgement
      And the original persisted request remains unchanged and retryable

  Rule: An unreachable relay returns control within one second and leaves a visible retryable draft

    @operate-retry-safe-retro-relay.TBU1.R2 @rejection
    Scenario: Relay unavailability preserves the draft without delaying the session
      Given a sanitized draft is persisted with an opaque requestId
      And the relay network boundary does not respond
      When the shared filing operation reaches its one-second budget
      Then it returns without acknowledging the draft
      And the exact request remains visibly retryable on disk
      And the GitHub-native fallback is not invoked after the relay attempt

    @operate-retry-safe-retro-relay.TBU1.R2 @rejection
    Scenario: A multi-draft drain shares one aggregate latency budget
      Given several sanitized drafts are durably pending
      And the relay network boundary does not respond
      When the shared filing operation reaches its one-second budget
      Then it returns without acknowledging any unaccepted draft
      And every unaccepted request remains visibly retryable on disk

    @operate-retry-safe-retro-relay.TBU1.R2 @rejection
    Scenario: An active spool claim excludes another session
      Given one session has atomically claimed a persisted retro spool
      When another session attempts to claim it before the lease expires
      Then the second session receives no draft ownership

    @operate-retry-safe-retro-relay.TBU1.R2
    Scenario: An expired spool claim is rearmed without changing the request
      Given a persisted retro spool claim has expired
      When another session claims that spool
      Then it receives the original requestId and exact payload

    @operate-retry-safe-retro-relay.TBU1.R2
    Scenario: Persisting a new request while another request drains cannot lose either draft
      Given one immutable relay request is being acknowledged
      When another process atomically persists a different relay request
      Then the acknowledged request has an authoritative receipt
      And the different request remains retryable with its exact bytes

  Rule: A local draft is acknowledged only after the relay durably accepts that exact request

    @operate-retry-safe-retro-relay.TBU1.R3
    Scenario: Durable acceptance drains the local draft
      Given a claimed draft has not been acknowledged
      When the relay durably accepts it and returns a receipt
      Then the local ack names the original requestId and receipt
      And the draft is atomically drained

    @operate-retry-safe-retro-relay.TBU1.R3 @rejection
    Scenario: Losing the durable receipt response leaves the same draft retryable
      Given a claimed draft has not been acknowledged
      When the relay accepts it but the receipt response is lost
      Then no local acknowledgement is written
      And the original requestId and exact payload remain retryable
      And the GitHub-native fallback is not invoked

  Rule: Relay routing is fail-closed until the canonical readiness prerequisites are proven

    @operate-retry-safe-retro-relay.TBU1.R4 @rejection
    Scenario: Incomplete readiness proof preserves the existing filing path
      Given relay credentials are configured without complete prerequisite and measurement proof
      When any harness invokes the shared filing operation
      Then no request is sent to the relay
      And the existing filing path remains unchanged

    @operate-retry-safe-retro-relay.TBU1.R4
    Scenario: Complete fresh readiness proof selects the relay path
      Given a versioned readiness manifest records closed issues 1474 and 1481
      And each prerequisite merge is an ancestor of the manifest evidence commit
      And the evidence commit is an ancestor of the immutable build commit
      And both post-fix measurement artifacts are fresh and hash-valid
      When any harness invokes the shared filing operation with that readiness proof
      Then the exact persisted request is sent to the relay

    @operate-retry-safe-retro-relay.TBU1.R4 @rejection
    Scenario: Stale or malformed readiness proof fails closed
      Given an enabled readiness manifest is stale malformed or hash-mismatched
      When any harness invokes the shared filing operation
      Then no request is sent to the relay
      And the existing filing path remains unchanged

    @operate-retry-safe-retro-relay.TBU1.R4 @rejection
    Scenario: Closed but unlanded or wrong-repository evidence fails closed
      Given an enabled readiness manifest cites a closed prerequisite without a reachable merge
      When any harness invokes the shared filing operation
      Then no request is sent to the relay
      And the existing filing path remains unchanged

    @operate-retry-safe-retro-relay.TBU1.R4 @rejection
    Scenario: Readiness for another build fails closed
      Given an enabled readiness manifest evidence commit is not reachable from the immutable build commit
      When any harness invokes the shared filing operation
      Then no request is sent to the relay
      And the existing filing path remains unchanged

    @operate-retry-safe-retro-relay.TBU1.R4 @rejection
    Scenario: Headless extraction receives no filing credential
      Given relay routing is configured for a supported harness
      When the shared command invokes its headless extractor
      Then the extractor environment contains no relay client relay server or GitHub credential

  Rule: Authentication and repository authorization vary by principal while request identity does not

    @operate-retry-safe-retro-relay.SWM1.R1
    Scenario: Production startup authenticates separate harness and operator principals
      Given production configuration contains Claude Codex Cursor and operator credentials
      When the real relay runtime starts
      Then each configured principal authenticates with its own credential

    @operate-retry-safe-retro-relay.SWM1.R1
    Scenario: Rotating one harness credential leaves the other principals active
      Given the production relay authenticates separate harness principals
      When the Claude credential is replaced
      Then the old Claude credential is rejected
      And the Codex Cursor and operator credentials still authenticate

    @operate-retry-safe-retro-relay.SWM1.R1 @rejection
    Scenario: A principal cannot cross its repository boundary
      Given a valid harness principal is authorized for one installation and repository
      When it files against another repository
      Then the relay rejects the request before durable or GitHub access

    @operate-retry-safe-retro-relay.SWM1.R1 @rejection
    Scenario: A harness principal cannot read operator operations
      Given a valid harness principal lacks the operator role
      When it reads relay operations
      Then the relay returns a non-enumerating authorization response

    @operate-retry-safe-retro-relay.SWM1.R1 @rejection
    Scenario: Each principal is denied every excluded role
      Given production starts with the exact harness and operator role matrix
      When an operator attempts filing and a harness attempts reconciliation
      Then both requests are rejected before durable or GitHub access

    @operate-retry-safe-retro-relay.SWM1.R1 @rejection
    Scenario: Spike mode exposes health only
      Given the runtime starts with explicit spike credentials
      When callers attempt filing status reconciliation and operations routes
      Then every request is rejected before authentication durable or GitHub access
      And the health route remains available

    @operate-retry-safe-retro-relay.SWM1.R1
    Scenario Outline: GitHub installation tokens remain opaque inside the relay
      Given GitHub returns a <format> installation token
      When the real relay collaborator files the accepted request
      Then GitHub accepts the complete token and returns the filed issue
      And no client response durable record log or metric contains the token

      Examples:
        | format                |
        | classic opaque        |
        | stateless dotted ghs_ |

    @operate-retry-safe-retro-relay.SWM1.R1 @rejection
    Scenario: Production filing requests are resource bounded
      Given an authenticated harness can reach the production filing route
      When it exceeds the body field timeout or per-principal rate boundary
      Then the relay rejects the request before durable or GitHub access

  Rule: Retry grace dead-letter compaction and tombstone deadlines are durable and alertable

    @operate-retry-safe-retro-relay.SWM1.R2
    Scenario Outline: Maintenance enforces each lifecycle boundary exactly once
      Given a durable request is in <state> immediately before its <boundary>
      When maintenance runs at and after that boundary across a process restart
      Then the request becomes <outcome> exactly once
      And the durable identity is retained

      Examples:
        | state       | boundary                        | outcome     |
        | retryable   | 24-hour retry deadline           | dead-letter |
        | dispatching | 1-hour late-dispatch grace end   | ambiguous   |
        | filed       | 30-day payload retention end     | tombstone   |

    @operate-retry-safe-retro-relay.SWM1.R2
    Scenario: Durable retry scheduling survives restart
      Given one retryable request is due and another is not due
      When maintenance runs before and after a process restart
      Then the due request dispatches once
      And the not-due request does not dispatch
      And exponential backoff remains durable and capped at 1 hour and the 24-hour deadline

    @operate-retry-safe-retro-relay.SWM1.R2 @rejection
    Scenario: No new dispatch starts at the retry deadline
      Given a retryable request is scheduled immediately before its 24-hour retry deadline
      When a worker and maintenance race at the deadline
      Then no new GitHub dispatch starts
      And the request becomes dead-letter exactly once

    @operate-retry-safe-retro-relay.SWM1.R2
    Scenario: A late dispatch resolves or becomes ambiguous by one CAS winner
      Given a request began GitHub dispatch before its 24-hour retry deadline
      When a known-issue result and maintenance race at its 1-hour late-dispatch grace end
      Then exactly one filed or ambiguous terminal transition wins

    @operate-retry-safe-retro-relay.SWM1.R2 @rejection
    Scenario: Interrupted schema migration rolls back atomically
      Given a valid version-one relay database
      When an injected failure interrupts the version-two migration
      Then reopening observes the intact version-one schema

    @operate-retry-safe-retro-relay.SWM1.R2 @rejection
    Scenario Outline: Unsupported schema metadata is rejected before listen
      Given a relay database has <schema condition>
      When the production runtime attempts to open it
      Then the listener does not open

      Examples:
        | schema condition       |
        | a partial layout       |
        | a newer version        |
        | duplicate version rows |
        | no version row         |

    @operate-retry-safe-retro-relay.SWM1.R2 @rejection
    Scenario: Terminal identity cannot be deleted or silently reidentified
      Given maintenance produced a dead-letter or tombstone for a requestId
      When a caller submits changed payload bytes for that requestId
      Then the original durable identity remains authoritative
      And the changed payload is rejected
      And the original request identity remains permanently non-reusable

    @operate-retry-safe-retro-relay.SWM1.R2
    Scenario: A compacted request immediately replays its original filed result
      Given a filed request has crossed its 30-day payload retention boundary
      When another harness resubmits its original requestId and exact payload hash
      Then the relay immediately returns the original receipt and issue
      And no new GitHub dispatch starts

  Rule: Operational state is readable without exposing approved payloads or credentials

    @operate-retry-safe-retro-relay.SWM1.R3 @rejection
    Scenario: The operator sees lifecycle counts through the real HTTP route without secret content
      Given the durable store contains accepted retryable ambiguous dead-letter filed and tombstone requests
      When an authorized operator reads relay operations
      Then the response reports each lifecycle count and oldest queued age
      But no approved title body client credential or GitHub token is observable

    @operate-retry-safe-retro-relay.SWM1.R3
    Scenario: Maintenance emits a deduplicable structured alert for each newly terminal request
      Given maintenance newly transitions requests to ambiguous and dead-letter
      When the production runtime records the maintenance result
      Then each transitioned receipt owns one durable payload-free alert event
      And repeated delivery uses the same eventId

    @operate-retry-safe-retro-relay.SWM1.R3
    Scenario: Immediate ambiguous outcomes are durably alertable
      Given a claimed request becomes ambiguous before maintenance
      When the ambiguous transition commits
      Then its payload-free alert event commits in the same transaction

  Rule: Routing evidence and handoff storage are durable rather than nominal

    @operate-retry-safe-retro-relay.TBU1.R4 @rejection
    Scenario: Empty or semantically irrelevant readiness evidence fails closed
      Given the readiness manifest names fresh hash-attested measurement files
      But a measurement is empty or describes a different metric
      When the running build validates relay readiness
      Then the existing native filing path remains selected

    @operate-retry-safe-retro-relay.TBU1.R1
    Scenario: One external durable outbox survives disposable harness workspaces
      Given one harness persists a request in the configured durable outbox
      When its project workspace is destroyed and another harness retries
      Then the second harness submits the same requestId and exact payload
      And no request is manually copied or reseeded

    @operate-retry-safe-retro-relay.TBU1.R3
    Scenario: Persistence success is not reported before file and directory sync
      Given a relay draft has been written to a temporary file
      When file or directory synchronization fails
      Then persistence fails without reporting durable success

    @operate-retry-safe-retro-relay.SWM1.R2
    Scenario: GitHub create classification ignores undocumented response prose
      Given GitHub rejects issue creation with a documented response status
      When its response message changes
      Then the relay chooses the same certain retry or ambiguous outcome

    @operate-retry-safe-retro-relay.SWM1.R1
    Scenario: The built production process files through every real collaborator
      Given the compiled production entrypoint has environment configuration and a local GitHub fixture
      When an authenticated harness submits a filing request
      Then the process stores it in SQLite and the fixture receives one issue
