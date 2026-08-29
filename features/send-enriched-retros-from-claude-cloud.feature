@send-enriched-retros-from-claude-cloud @wip
Feature: Send enriched retros from Claude Cloud
  Eligible Claude Cloud sessions use the existing public-retro pipeline without
  asking the builder to operate it or creating a cloud-only transport.

  # skip: ticket 3F5Z6P owns the shared malformed-receipt and timeout matrix;
  # this feature adds representative v2 collector rejections for its new schema.
  # Its unsupported-host gate is re-exercised here only to prove that enabling
  # the new Claude Cloud carrier does not widen that existing allowlist.
  # skip: Ticket 3F5Z6P's collector contract owns both raw-body deduplication
  # and same-session-scope conflict after workspace reclamation. This feature
  # proves byte identity when canonical inputs match and preserves that conflict.
  # skip: Readiness is a human release gate; this ticket produces the verdict and
  # evidence but does not add a runtime feature flag.
  # skip: The manual verdict scenarios are process-local and intentionally have
  # no runtime surface tag; their live evidence scenario tags both real surfaces.
  # skip: GitHub issue #3429 owns degraded source field semantics; this feature
  # proves failure containment at the ephemeral cloud carrier boundary.
  # skip: Ticket 3F5Z6P owns the exact existing public eligibility threshold boundary.
  # skip: Ticket 3F5Z6P owns unchanged local Codex public-envelope behavior; this
  # ticket changes only the Claude sender and collector v2 intake.
  # skip: Ticket 3F5Z6P owns the shared transport client's failure semantics;
  # this feature proves immediate network-policy rejection at the cloud boundary.
  # skip: Ephemeral Claude Cloud retains no durable local spool; local spool
  # preservation remains unchanged and is owned by ticket 3F5Z6P.
  # skip: Recovery assertions observe unchanged candidate state but do not invoke
  # or alter the Retro Filer surface, whose filing and drain behavior stays owned
  # by ticket 3F5Z6P.
  # Examples convention: bare `unset` removes the variable; quoted values are
  # exact literals; `the empty string` sets a present zero-length value.

  @send-enriched-retros-from-claude-cloud.NTB1.R1
  Rule: send-enriched-retros-from-claude-cloud.NTB1.R1 — Each eligible Claude Cloud session yields at most one recorded public retro silently

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: An eligible cloud Stop records one matching durable receipt silently
      Given the installed Claude Cloud Stop carrier holds an eligible substantial session
      And public retrospective collection is enabled with a reachable collector
      When the Stop carrier completes through the real public collector client
      Then exactly one public retrospective attempt is accepted with a durable receipt carrying the accepted request identity
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Repeated completion of the same cloud session makes no second attempt
      Given an eligible Claude Cloud session has already recorded one accepted public retrospective attempt
      And its local attempt state is still present in the workspace
      When the installed Claude Cloud Stop carrier completes again
      Then the collector receives no additional public retrospective request
      And exactly one accepted attempt with the original request identity and durable receipt remains
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: A distinct cloud session receives its own request identity and receipt
      Given one eligible Claude Cloud session has recorded an accepted public retrospective
      When a distinct eligible Claude Cloud session completes in the same workspace
      Then the collector receives one additional public retrospective request
      And its request identity and durable receipt differ from the first session
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Reclaimed workspace changes cannot record a second retro for the same session
      Given an eligible Claude Cloud session has already recorded one accepted public retrospective
      And its workspace was reclaimed with no local attempt state
      When a new workspace completes the same session identity with different canonical request bytes
      Then no second retrospective is recorded for that session scope
      And the original durable receipt still resolves to the first raw request body
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: An ineligible cloud session makes no public attempt
      Given the installed Claude Cloud Stop carrier holds a session below the existing public eligibility threshold
      When the Stop carrier completes through the real public collector client
      Then the collector receives zero public retrospective attempts
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: A project opt-out prevents a cloud public attempt
      Given the installed Claude Cloud Stop carrier holds an otherwise eligible session
      And public retrospective collection is disabled in project configuration
      When the Stop carrier completes through the real public collector client
      Then the collector receives zero public retrospective attempts
      And the Stop exits successfully with empty stdout, stderr, and conversation context

  @send-enriched-retros-from-claude-cloud.NTB1.R2
  Rule: send-enriched-retros-from-claude-cloud.NTB1.R2 — Public delivery never prevents completion, narrates, or consumes existing recovery

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: An unreachable collector is bounded and leaves recovery unchanged
      Given the installed Claude Cloud Stop carrier holds an eligible session
      And the collector does not respond
      And the carrier has a controlled configured handoff deadline
      And a private recovery candidate holds the session findings unacknowledged
      When the Stop carrier completes through the real public collector client
      Then the public attempt ends without a receipt before the Stop exits
      And the collector observes exactly one public retrospective request attempt
      And the private recovery candidate still holds the same ordered findings with none acknowledged
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Cloud network-policy rejection leaves recovery unchanged silently
      Given the installed Claude Cloud Stop carrier holds an eligible session
      And the workspace network policy refuses the collector connection immediately
      And a private recovery candidate holds the session findings unacknowledged
      When the Stop carrier completes through the real public collector client
      Then the process boundary observes exactly one refused outbound connection and no retry
      And the private recovery candidate still holds the same ordered findings with none acknowledged
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Public acceptance does not consume the existing recovery candidate
      Given the installed Claude Cloud Stop carrier holds an eligible session with a reachable collector
      And a private recovery candidate holds the session findings unacknowledged
      When the Stop carrier completes through the real public collector client
      Then the private recovery candidate still holds the same ordered findings with none acknowledged
      And one public retrospective attempt has a matching durable receipt

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: No valid findings preserve the existing private recovery candidate
      Given the installed Claude Cloud Stop carrier holds no valid sanitized findings
      And a pre-existing private recovery candidate holds findings "first" and "second" unacknowledged
      When the Stop carrier completes through the real public collector client
      Then it remains the sole recovery candidate with findings "first" and "second" in order and none acknowledged
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: An oversized batch preserves every finding for recovery
      Given the installed Claude Cloud Stop carrier holds sanitized findings whose canonical v2 request would exceed the shared 65536-byte limit
      And a private recovery candidate holds every sanitized finding unacknowledged
      When the installed Claude Cloud Stop carrier completes through the real public collector client
      Then the private recovery candidate still holds every finding in extraction order with none acknowledged
      And the Stop exits successfully with empty stdout, stderr, and conversation context

    @surface.claude-code @surface.railway-public-retro-collector
    Scenario: Local v2 acceptance preserves every finding for private recovery
      Given the updated local Claude carrier holds multiple eligible sanitized findings
      And a private recovery candidate holds every finding unacknowledged
      When the local carrier completes through the real public collector client
      Then the private recovery candidate still holds every finding in extraction order with none acknowledged
      And one public retrospective attempt has a matching durable receipt
      And the local Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code @surface.railway-public-retro-collector
    Scenario: An unreachable collector preserves every local finding silently
      Given the updated local Claude carrier holds multiple eligible sanitized findings
      And the collector does not respond before the configured handoff deadline
      And the carrier has a controlled configured handoff deadline
      And a private recovery candidate holds every finding unacknowledged
      When the local carrier completes through the real public collector client
      Then the private recovery candidate still holds every finding in extraction order with none acknowledged
      And the collector observes exactly one public retrospective request attempt
      And the local Stop exits successfully with empty stdout, stderr, and conversation context

    @rejection @surface.claude-code @surface.railway-public-retro-collector
    Scenario: Local opt-out preserves recovery silently
      Given the updated local Claude carrier holds multiple otherwise eligible sanitized findings
      And public retrospective collection is disabled in project configuration
      And a private recovery candidate holds every finding unacknowledged
      When the local carrier completes through the real public collector client
      Then the collector receives zero public retrospective attempts
      And the private recovery candidate still holds every finding in extraction order with none acknowledged
      And the local Stop exits successfully with empty stdout, stderr, and conversation context

  @send-enriched-retros-from-claude-cloud.SWM1.R1
  Rule: send-enriched-retros-from-claude-cloud.SWM1.R1 — The carrier binds Claude Code and cloud host identity independently of payload claims

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Payload metadata cannot spoof cloud carrier identity
      Given the installed Claude Cloud Stop carrier holds an eligible candidate claiming harness "codex", host class "local", and a foreign session identity
      And GITHUB_ACTIONS is exactly "false", the remote marker is exactly "true", and the remote session identity is "cloud-session"
      When the installed cloud Stop carrier completes through the real public collector client
      Then the received request source identifies harness "claude-code" and host class "cloud"
      And its sessionScope matches the carrier-observed session identity

    @regression @surface.claude-code @surface.railway-public-retro-collector
    Scenario: A local-only invocation cannot activate the Claude Cloud route
      Given the updated local Claude carrier holds an eligible sanitized retrospective
      And CI and CONTINUOUS_INTEGRATION are exactly "true"
      And GITHUB_ACTIONS and Claude's two remote-session signals are unset
      When the updated local carrier completes through the real public collector client
      Then the received request source identifies harness "claude-code" and host class "unknown"

    @rejection @surface.claude-code-cloud @surface.github-actions-execution-sandbox @surface.railway-public-retro-collector
    Scenario Outline: Claude Code GitHub Actions remains disabled
      Given a Claude Code GitHub Actions completion holds an otherwise eligible session
      And GITHUB_ACTIONS is exactly "true"
      And its remote marker is <remote marker> with remote session identity <remote session identity>
      When that carrier completes through the real public collector client
      Then the collector receives zero public retrospective requests
      And the Stop exits successfully with empty stdout, stderr, and conversation context

      Examples:
        | remote marker | remote session identity |
        | unset         | unset                   |
        | "true"        | "cloud-session"        |

    @rejection @surface.claude-code @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario Outline: Partial or malformed Claude remote-session evidence fails closed
      Given an otherwise eligible installed Claude Stop carrier has remote marker <remote marker> and remote session identity <remote session identity>
      And GITHUB_ACTIONS is unset
      When that carrier completes through the real public collector client
      Then the collector receives zero public retrospective requests
      And the Stop exits successfully with empty stdout, stderr, and conversation context

      Examples:
        | remote marker | remote session identity |
        | "TRUE"        | "cloud-session"        |
        | "true "       | "cloud-session"        |
        | "true"        | the empty string        |
        | unset         | "cloud-session"        |

    @rejection @surface.openai-codex-cloud @surface.cursor-cloud-agents @surface.railway-public-retro-collector
    Scenario Outline: Unsupported cloud hosts remain disabled
      Given the installed completion carrier for <host> holds an otherwise eligible session
      And that host's cloud markers are present while Claude's remote marker and remote session identity are unset
      When that carrier completes through the real public collector client
      Then the collector receives zero public retrospective requests
      And the Stop exits successfully with empty stdout, stderr, and conversation context

      Examples:
        | host                |
        | Codex Cloud         |
        | Cursor Cloud Agents |

  @send-enriched-retros-from-claude-cloud.SWM1.R2
  Rule: send-enriched-retros-from-claude-cloud.SWM1.R2 — New senders use one bounded shared batch while the collector remains backward compatible

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Multiple findings use one ordered canonical batch
      Given the installed Claude Cloud Stop carrier holds multiple eligible sanitized findings
      And source discovery uses the real project identity and repository collaborators
      When the Stop carrier completes through the real public collector client
      Then the collector receives exactly one canonical v2 request containing every finding in extraction order
      And its version is "v2"
      And its only top-level fields are version, findings, source, and sessionScope
      And its sessionScope matches the originating session identity

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Real source collaborators populate the received cloud request
      Given the installed Claude Cloud Stop carrier holds eligible sanitized findings
      And the fixture project configuration contains identity "fixture-project-guid"
      And the fixture git remote is "https://github.com/fixture/example.git"
      When the Stop carrier completes through the real public collector client
      Then the received source project identity is "fixture-project-guid"
      And its repository identity is "https://github.com/fixture/example.git"
      And its source contains no fields outside harness, hostClass, projectUUID, safewordCliVersion, repository, agentVersion, model, safewordPluginVersion, and osFamily

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: One request identity correlates the batch with its receipt
      Given the installed Claude Cloud Stop carrier holds multiple eligible sanitized findings
      When the Stop carrier completes through the real public collector client
      Then exactly one public request is accepted with exactly one durable receipt
      And the same transport-independent request identity appears in the request header and durable receipt

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: The canonical v2 request is byte-identical for the same session and findings
      Given one Claude Cloud workspace has completed and recorded a durable receipt for a session and sanitized findings
      And a second independent workspace holds the same session, findings, and entire canonical source profile
      When the second workspace's installed Stop carrier completes through the real public collector client
      Then its raw request body received by the collector is byte-identical to the first
      And the collector returns the same durable receipt

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: One finding uses the same v2 batch contract
      Given the installed Claude Cloud Stop carrier holds one eligible sanitized finding
      When the Stop carrier completes through the real public collector client
      Then the collector receives one canonical v2 request containing a one-element findings array

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: Invalid findings are excluded from a mixed batch
      Given the installed Claude Cloud Stop carrier holds two valid sanitized findings around one invalid finding
      When the Stop carrier completes through the real public collector client
      Then the collector receives one canonical v2 request containing exactly the two valid findings in extraction order
      And the invalid finding content appears nowhere in the raw request body

    @surface.claude-code @surface.railway-public-retro-collector
    Scenario: The updated local carrier uses the same v2 batch and request identity
      Given the updated local Claude carrier holds multiple eligible sanitized findings
      When it completes through the real public collector client
      Then the collector receives one canonical v2 request containing every finding in extraction order
      And the same transport-independent request identity appears in the request header and durable receipt

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: No valid findings make no public attempt
      Given the installed Claude Cloud Stop carrier holds no valid sanitized findings
      When the Stop carrier completes through the real public collector client
      Then the collector receives zero public retrospective attempts

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: A batch exactly at the shared byte limit is accepted
      Given sanitized findings whose canonical v2 request is exactly 65536 bytes
      When the installed Claude Cloud Stop carrier completes through the real public collector client
      Then the collector receives one canonical v2 request of exactly 65536 bytes containing every finding in extraction order
      And the request is accepted with a durable receipt

    @rejection @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: An oversized batch makes no partial public attempt
      Given sanitized findings whose canonical v2 request would exceed the shared 65536-byte limit
      When the installed Claude Cloud Stop carrier completes through the real public collector client
      Then the collector receives zero public retrospective attempts

    @surface.railway-public-retro-collector
    Scenario: The collector remains compatible with released v1 senders
      Given a previously released v1 client with a valid canonical single-finding request
      When the released client submits its "v1" request through the real collector intake
      Then the collector accepts it and records one durable receipt
      And the request header identity matches the durable receipt identity

    @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: The collector accepts the exact v2 body emitted by the cloud carrier
      Given the exact canonical v2 request body emitted by the installed Claude Cloud Stop carrier
      When it is submitted through the real collector intake
      Then the collector accepts it and records one durable receipt
      And the request header identity matches the durable receipt identity

    @rejection @surface.railway-public-retro-collector
    Scenario Outline: The collector rejects invalid v2 envelopes
      Given a canonical public-retro request with <invalid shape>
      When the request is submitted through the real collector intake
      Then the collector rejects it without recording a durable receipt

      Examples:
        | invalid shape                         |
        | an empty findings array               |
        | an unknown top-level field            |
        | an unrecognized version discriminator |

  @send-enriched-retros-from-claude-cloud.SWM1.R3
  Rule: send-enriched-retros-from-claude-cloud.SWM1.R3 — Readiness requires real cloud evidence with a matching durable receipt

    @manual @readiness @surface.claude-code-cloud @surface.railway-public-retro-collector
    Scenario: A real Claude Cloud run proves the carrier before release
      Given the release candidate is installed in a real Claude Cloud workspace
      And the production public collector is reachable from that workspace
      When an eligible session completes through the installed Stop carrier
      Then operator evidence contains the exact accepted request identity and matching durable receipt
      And that request identity resolves to the same durable receipt through the production collector operator read

    @manual @readiness
    Scenario: Matching real cloud evidence marks the carrier proven
      Given a real Claude Cloud Stop execution produced a matching durable receipt
      When the Safeword Maintainer resolves its request identity through the production collector operator read
      Then the operator read returns the same durable receipt
      And the ticket work log records the checked identity pair as proven

    @manual @rejection @readiness
    Scenario Outline: Insufficient evidence cannot prove the carrier
      Given checked evidence consists of <evidence>
      When the Safeword Maintainer checks it through the production collector operator read
      Then it yields no accepted request identity with the same durable receipt
      And the ticket work log has no proven carrier entry

      Examples:
        | evidence                                                |
        | no recorded receipt                                     |
        | a receipt recorded under a different request identity   |
        | only a local Stop execution                              |
        | only an injected collector transport success            |
        | a matching receipt from a non-production collector      |
