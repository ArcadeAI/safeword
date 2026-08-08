@preserve-cloud-retros-through-service-outages
Feature: Hand off cloud retros without interrupting builders

  A cloud carrier may use its locally generated public project installation ID
  only to submit one bounded, sanitized retro and best-effort runtime profile.
  Durable acceptance transfers recovery to an encrypted quarantine record; an
  unavailable route remains silent to the builder.

  @preserve-cloud-retros-through-service-outages.TBU1.R1
  Rule: preserve-cloud-retros-through-service-outages.TBU1.R1 — A cloud handoff is bounded and silent while returning a durable receipt only after acceptance

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents @surface.railway-hosted-relay
    Scenario: A supported carrier receives one durable receipt without adding task narration
      Given a supported cloud carrier has a reachable public intake endpoint and local project installation ID
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
      Given public intake has durably accepted one bounded retro and receipt
      When a caller reuses that request identity with a different sanitized retro payload
      Then the relay returns no durable receipt for the mutated retry
      And it retains the original quarantine record and receipt unchanged

  @preserve-cloud-retros-through-service-outages.TBU1.R2
  Rule: preserve-cloud-retros-through-service-outages.TBU1.R2 — An accepted cloud retro remains durably quarantined through a relay restart

    @surface.railway-hosted-relay
    Scenario: An accepted public retro survives a relay restart without a tracker write
      Given public intake has durably accepted a bounded retro for its configured repository
      When the relay restarts
      Then it retains one encrypted quarantine record with the original request identity and payload
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
      Given a cloud carrier has one sanitized retro and a 500 ms intake deadline
      And public intake is unreachable
      When the carrier completes its task
      Then it returns without a durable receipt within that deadline
      And the builder's task result contains no relay failure narration
      And it does not claim that an operator record exists

    @rejection @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario: Slow runtime-profile collection cannot consume the handoff budget
      Given a cloud carrier whose runtime-profile source exceeds 50 ms
      And public intake is reachable
      When the carrier completes its task with one sanitized retro
      Then it omits the unavailable profile field and attempts handoff within its remaining budget
      And the builder's task result contains no runtime-profile narration

  @preserve-cloud-retros-through-service-outages.NTB1.R1
  Rule: preserve-cloud-retros-through-service-outages.NTB1.R1 — Cloud handoff status does not add user-facing narration to an ordinary task result

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents
    Scenario Outline: Handoff transport outcome does not change the builder-facing result
      Given a <carrier outcome> cloud handoff attempt at task completion
      When the cloud carrier returns its ordinary task result
      Then that result contains no Safe Word transport status

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
      And it does not advance `05PR3F` or #834's supersession condition

  @preserve-cloud-retros-through-service-outages.SWM2.R1
  Rule: preserve-cloud-retros-through-service-outages.SWM2.R1 — Installation creates a stable public project ID locally and handoff carries bounded best-effort provenance

    @surface.safeword-cli
    Scenario: Installation creates a public project ID without contacting the relay
      Given a project without a Safe Word project installation ID
      When Safe Word installs without network access
      Then project config contains one UUIDv4 project installation ID
      And no relay enrollment request occurs

    @surface.railway-hosted-relay
    Scenario: A copied project ID remains a distinct source after a repository fork
      Given two projects carry the same public project installation ID
      And their normalized remote repositories differ
      When each project submits the same request identity to public intake
      Then the relay retains separate quarantine namespaces for their project ID and normalized repositories

    @surface.claude-code-cloud @surface.openai-codex-cloud @surface.cursor-cloud-agents @surface.railway-hosted-relay
    Scenario Outline: Handoff records available actor and runtime provenance without an identity lookup
      Given a project installation ID and a <actor source>
      And a cloud carrier has a sanitized retro for normalized repository "arcadeai/safeword"
      When the carrier submits the retro to reachable public intake
      Then its quarantine record contains the supplied project installation ID, repository, and available runtime-profile fields
      And the actor is recorded as <actor result>
      And no GitHub identity request or credential read occurs
      And no task result, tracker write, or operator log contains raw Git email

      Examples:
        | actor source                         | actor result                 |
        | `GITHUB_ACTOR` set to "octocat"     | GitHub login "octocat"      |
        | `GITHUB_ACTOR` "octocat" and local Git email "dev@example.com" | GitHub login "octocat" |
        | local Git email "dev@example.com"   | Git email "dev@example.com" |
        | no available actor identity           | no actor identity            |

  @preserve-cloud-retros-through-service-outages.SWM2.R2
  Rule: preserve-cloud-retros-through-service-outages.SWM2.R2 — Project ID and runtime provenance grant no relay operation, record read, GitHub credential, or cross-repository authority

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
        | file a retro for another repository    |

    @rejection @surface.railway-hosted-relay
    Scenario Outline: Invalid public intake cannot create a quarantine record
      Given a public project installation ID
      And a <invalid input> public handoff request
      When public intake receives the request
      Then it returns no durable receipt or tracker filing
      And it retains no quarantine record for that request identity

      Examples:
        | invalid input       |
        | malformed           |
        | oversized           |
        | rate-limited        |

    @surface.railway-hosted-relay
    Scenario: Existing bearer-authorized filing remains available after public ingress is added
      Given a valid bearer-authorized local filing client and a public project installation ID
      When the local client files a bounded retro for its authorized repository
      Then the relay accepts it through the existing bearer-authorized filing path

  @preserve-cloud-retros-through-service-outages.SWM2.R3
  Rule: preserve-cloud-retros-through-service-outages.SWM2.R3 — Public payload and profile expire after 30 days while their payload-free tombstone remains

    @surface.railway-hosted-relay
    Scenario: Public payload and runtime profile expire after 30 days
      Given public intake accepted a quarantine record exactly 30 days ago
      When public-retention maintenance runs
      Then the relay removes its encrypted payload and runtime profile
      And it retains a payload-free tombstone for the same public namespace

    @rejection @surface.railway-hosted-relay
    Scenario: A tombstone-only public namespace still dedupes its original request
      Given public-retention maintenance has removed a quarantine record's payload and runtime profile
      And the payload-free tombstone retains that record's public namespace and original receipt
      When a caller resubmits the same request identity to public intake
      Then the relay retains no new payload or runtime profile
      And it returns the original receipt without creating another quarantine record

    @rejection @surface.railway-hosted-relay
    Scenario: Public payload is retained before its 30-day lifetime ends
      Given public intake accepted a quarantine record one instant before its 30-day lifetime ends
      When public-retention maintenance runs
      Then the relay retains its encrypted payload and runtime profile
