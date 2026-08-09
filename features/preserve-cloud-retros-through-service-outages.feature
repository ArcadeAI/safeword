@preserve-cloud-retros-through-service-outages
Feature: Hand off cloud retros without interrupting builders

  A cloud carrier may use its locally generated public project installation ID
  only to submit one bounded, sanitized retro and best-effort runtime profile.
  Durable acceptance transfers recovery to an encrypted operator queue; an
  unavailable route remains silent to the builder.

  @preserve-cloud-retros-through-service-outages.TBU1.R1
  Rule: preserve-cloud-retros-through-service-outages.TBU1.R1 — A cloud handoff is bounded and silent while returning a durable receipt only after acceptance

    @surface.railway-hosted-relay
    Scenario: A supported carrier receives one durable receipt without adding task narration
      Given a supported cloud carrier has a reachable public intake endpoint, local project installation ID, and injected monotonic clock
      And the carrier has one sanitized retro with a persisted request identity
      When the carrier submits the retro at task completion
      Then the relay durably retains one quarantine record with that original request identity
      And the carrier receives the matching durable receipt within the 500 ms handoff budget
      And the builder's task result contains no relay status narration

    @rejection @surface.railway-hosted-relay
    Scenario: A client disconnect after durable acceptance preserves the same receipt on retry
      Given public intake has durably accepted one bounded retro but its response cannot reach the carrier
      When the carrier retries the same request identity and payload
      Then the relay retains one quarantine record and returns its original receipt

    @rejection @surface.railway-hosted-relay
    Scenario: A mutated retry cannot replace an accepted quarantine record
      Given public intake has durably accepted one bounded retro and receipt under one quarantine key
      When a caller reuses that same quarantine key with a different sanitized retro payload
      Then the relay returns no durable receipt for the mutated retry
      And it retains the original quarantine record and receipt unchanged

  @preserve-cloud-retros-through-service-outages.TBU1.R2
  Rule: preserve-cloud-retros-through-service-outages.TBU1.R2 — An accepted cloud retro remains durably quarantined through a relay restart

    @surface.railway-hosted-relay
    Scenario: An accepted public retro survives a relay restart without a tracker write
      Given public intake has durably accepted a bounded retro for its configured repository
      When the relay restarts
      Then it retains one quarantine record with the original request identity and payload
      And the tracker receives no issue creation

    @rejection @surface.railway-hosted-relay
    Scenario: A public intake persistence failure creates neither receipt nor tracker filing
      Given public intake cannot persist a valid bounded retro
      When the carrier submits that retro
      Then the relay returns no durable receipt
      And it retains no quarantine record for that request identity
      And the tracker receives no issue creation

  @preserve-cloud-retros-through-service-outages.TBU2.R1
  Rule: preserve-cloud-retros-through-service-outages.TBU2.R1 — An unavailable intake never delays, blocks, or claims durable acceptance for a cloud task

    @rejection @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: An unavailable intake leaves a cloud task quiet and unacknowledged
      Given a cloud carrier has one sanitized retro, a 500 ms intake deadline, and an injected monotonic clock
      And public intake is unreachable
      When the carrier completes its task
      Then it returns without a durable receipt within that deadline
      And the builder's task result contains no relay failure narration
      And it does not claim that an operator record exists

    @rejection @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: A reachable but slow intake times out quietly before durable acceptance
      Given a cloud carrier has one sanitized retro, a 500 ms intake deadline, and an injected monotonic clock
      And public intake is reachable but withholds its response past that deadline
      When the carrier completes its task
      Then it returns without a durable receipt within that deadline
      And the builder's task result contains no relay failure narration
      And it does not claim that an operator record exists

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: Slow runtime-profile collection cannot consume the handoff budget
      Given a cloud carrier whose runtime-profile source exceeds 50 ms on an injected monotonic clock
      And public intake is reachable
      When the carrier completes its task with one sanitized retro
      Then the accepted quarantine record omits the unavailable profile field
      And the carrier receives a durable receipt within the 500 ms handoff budget
      And the builder's task result contains no runtime-profile narration

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: A malformed runtime-profile source is omitted without delaying handoff
      Given a cloud carrier has a malformed runtime-profile source and an injected monotonic clock
      And public intake is reachable
      When the carrier completes its task with one sanitized retro
      Then the accepted quarantine record omits the malformed profile field
      And the carrier receives a durable receipt within the 500 ms handoff budget
      And the builder's task result contains no runtime-profile narration

  @preserve-cloud-retros-through-service-outages.NTB1.R1
  Rule: preserve-cloud-retros-through-service-outages.NTB1.R1 — Cloud handoff status does not add user-facing narration to an ordinary task result

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario Outline: Handoff transport outcome does not change the builder-facing result
      Given a <carrier outcome> cloud handoff attempt at task completion
      When the cloud carrier returns its ordinary task result
      Then that result still contains the requested-work result
      And that result contains no Safe Word transport status

      Examples:
        | carrier outcome             |
        | durably accepted             |
        | unavailable before acceptance |
        | rejected before acceptance   |

  @preserve-cloud-retros-through-service-outages.SWM1.R1
  Rule: preserve-cloud-retros-through-service-outages.SWM1.R1 — Only an actual supported carrier with durable-acceptance evidence counts toward activation

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents @surface.railway-hosted-relay
    Scenario: A real carrier with a durable-receipt proof is recorded as a candidate route
      Given one cloud provider has a supported completion carrier and hosted-network evidence
      And that carrier has received a durable public-ingest receipt for its configured repository
      When release readiness evaluates that provider
      Then it records that provider's carrier evidence without enabling any unevidenced provider route

    @rejection @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: An endpoint without a real cloud carrier cannot count toward activation
      Given a cloud provider has public intake configuration but no supported completion carrier proof
      When release readiness evaluates that provider
      Then it records the provider route as disabled
      And it does not count toward #1479 relay activation, `05PR3F`, or #834's supersession condition

  @preserve-cloud-retros-through-service-outages.SWM2.R1
  Rule: preserve-cloud-retros-through-service-outages.SWM2.R1 — Installation creates a stable public project ID locally and handoff carries bounded best-effort provenance

    @surface.safeword-cli
    Scenario: Installation creates a public project ID without contacting the relay
      Given a project without a Safe Word project installation ID
      And network access is available
      When Safe Word installs
      Then project config contains one UUIDv4 project installation ID
      And no relay enrollment request occurs

    @surface.safeword-cli
    Scenario: Reinstalling Safe Word preserves the existing public project ID
      Given a project config with an existing Safe Word project installation ID
      When Safe Word installs again
      Then project config retains that exact project installation ID
      And no relay enrollment request occurs

    @rejection @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: A project without a normalized remote skips public handoff quietly
      Given a cloud carrier has no normalized remote repository
      When the carrier completes its task with one sanitized retro
      Then it returns without a durable receipt
      And public intake receives no request
      And the builder's task result contains no relay failure narration

    @surface.railway-hosted-relay
    Scenario: A copied project ID remains a distinct source after a repository fork
      Given two projects carry the same public project installation ID
      And their normalized remote repositories differ
      When each project submits the same request identity to public intake
      Then the relay retains separate quarantine keys for their project ID and normalized repositories

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents @surface.railway-hosted-relay
    Scenario Outline: Handoff records available actor and runtime provenance without an identity lookup
      Given a project installation ID and a <actor source>
      And a cloud carrier has a sanitized retro for normalized repository "arcadeai/safeword"
      When the carrier submits the retro to reachable public intake
      Then its quarantine record contains the supplied project installation ID, repository, and available runtime-profile fields
      And the actor is recorded as <actor result>
      And no GitHub identity request or credential read occurs

      Examples:
        | actor source                         | actor result                 |
        | `GITHUB_ACTOR` set to "octocat"     | GitHub login "octocat"      |
        | `GITHUB_ACTOR` "octocat" and local Git email "dev@example.com" | GitHub login "octocat" |
        | local Git email "dev@example.com"   | Git email "dev@example.com" |
        | no available actor identity           | no actor identity            |

  @preserve-cloud-retros-through-service-outages.SWM2.R2
  Rule: preserve-cloud-retros-through-service-outages.SWM2.R2 — Public intake cannot use privileged relay capabilities while authenticated operators can inspect queued data

    @rejection @surface.railway-hosted-relay
    Scenario Outline: A public project ID cannot use a privileged relay capability
      Given a public project installation ID and a claimed runtime profile
      When it attempts to <privileged capability>
      Then the relay denies the attempt without exposing a record or GitHub credential

      Examples:
        | privileged capability                  |
        | read a receipt                         |
        | list relay operations                  |
        | reconcile a filing                     |
        | recover a filing                       |
        | enter the GitHub filing worker for its configured repository |
        | enter the GitHub filing worker for another repository |

    @surface.railway-hosted-relay
    Scenario: An authenticated operator can inspect an accepted public retro
      Given public intake has accepted one encrypted quarantine record
      And an operator holds the existing relay operator credential
      When the operator requests that record by its receipt
      Then the relay returns the retro and available runtime profile to that operator
      And the request does not create a tracker issue

    @surface.railway-hosted-relay
    Scenario: An authenticated operator can remove an inspected public retro
      Given an operator has exported one accepted public retro from the queue
      When the operator deletes that retro by its receipt
      Then the relay removes only that quarantine record
      And the queue can accept a fresh public quarantine key when capacity is available
      And the request does not create a tracker issue

    @rejection @surface.railway-hosted-relay
    Scenario: A Git email remains encrypted metadata and never reaches public output
      Given a cloud carrier has local Git email "dev@example.com" and no `GITHUB_ACTOR`
      And public intake accepts the carrier's sanitized retro
      When the carrier completes its handoff
      Then the quarantine record records Git email "dev@example.com" as actor metadata
      And no task result, tracker write, or operator log contains "dev@example.com"
      And direct SQLite inspection contains no plaintext "dev@example.com"
      And direct SQLite inspection contains no plaintext retro payload or runtime profile

    @rejection @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: Handoff excludes host-local and credential data from its outbound payload
      Given a cloud carrier has hostname "build-host.internal", local path "/private/project", and credential "secret-token" available
      And public intake records its received request body
      When the carrier submits one sanitized retro
      Then that request body includes none of "build-host.internal", "/private/project", or "secret-token"

    @rejection @surface.railway-hosted-relay
    Scenario Outline: Invalid public intake cannot create a quarantine record
      Given a public project installation ID whose request identity has no accepted quarantine record
      And a <invalid input> public handoff request
      When public intake receives the request
      Then it returns no durable receipt or tracker filing
      And it retains no quarantine record for that request identity

      Examples:
        | invalid input       |
        | malformed           |
        | oversized           |
        | unrecognized public ingest key |

    @rejection @surface.railway-hosted-relay
    Scenario: A configured public rate limit rejects a fresh quarantine key
      Given public intake permits one submission per project installation ID in its current window
      And that project installation ID has already submitted once in that window
      When it submits a valid retro under a fresh quarantine key
      Then the relay returns no durable receipt or tracker filing
      And it retains no quarantine record for that fresh quarantine key

    @surface.railway-hosted-relay
    Scenario: A retained quarantine key still dedupes after its rate limit is reached
      Given public intake permits one submission per project installation ID in its current window
      And it retains one accepted quarantine key for that project installation ID
      And that project installation ID has reached its configured limit in that window
      When a caller resubmits that retained quarantine key with its original payload
      Then the relay returns the original receipt without creating another quarantine record

    @surface.railway-hosted-relay
    Scenario: Existing bearer-authorized filing remains available after public ingress is added
      Given a valid bearer-authorized local filing client and a public project installation ID
      When the local client files a bounded retro for its authorized repository
      Then the relay accepts it through the existing bearer-authorized filing path

  @preserve-cloud-retros-through-service-outages.SWM2.R3
  Rule: preserve-cloud-retros-through-service-outages.SWM2.R3 — Public data remains available to authenticated operators within a fixed queue capacity

    @rejection @surface.railway-hosted-relay
    Scenario: A full public queue rejects a new identity without replacing stored data
      Given public intake has reached its configured bounded record capacity
      When a caller submits a fresh public quarantine key
      Then the relay returns no durable receipt
      And it retains every existing quarantine record unchanged
      And it records one sanitized capacity alert for an operator

    @surface.railway-hosted-relay
    Scenario: An operator is alerted before the public queue reaches capacity
      Given public intake reaches 80 percent of its configured record capacity
      When it accepts the record that crosses that threshold
      Then it records one sanitized queue-fill alert for an operator

    @surface.railway-hosted-relay
    Scenario: The last available public queue slot accepts one new identity
      Given public intake has one remaining configured record slot
      When a caller submits a fresh valid public quarantine key
      Then the relay retains that new quarantine record and returns its durable receipt

    @surface.railway-hosted-relay
    Scenario: A retained public quarantine key still dedupes its original request
      Given public intake is at its configured record capacity and retains one quarantine record with its original receipt
      When a caller resubmits the same request identity and payload
      Then the relay returns the original receipt without creating another quarantine record

    @surface.railway-hosted-relay
    Scenario: Concurrent duplicate public handoffs produce one record and receipt
      Given two callers hold the same public quarantine key and sanitized retro payload
      And a controlled write barrier will release both submissions together
      When both submissions cross that barrier
      Then the relay retains one quarantine record and returns one matching receipt to both callers

    @rejection @surface.railway-hosted-relay
    Scenario: Concurrent new keys cannot exceed the last available queue slot
      Given public intake has one remaining configured record slot
      And two callers hold different fresh public quarantine keys
      And a controlled write barrier will release both submissions together
      When both submissions cross that barrier
      Then exactly one caller receives a durable receipt
      And the other caller receives no receipt and one capacity alert is recorded
      And the relay record count does not exceed its configured capacity
