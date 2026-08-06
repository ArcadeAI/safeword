@feature @surface.railway-hosted-relay
Feature: Deploy the retro relay spike
  As a Safeword Maintainer
  I want to run the relay on disposable hosted infrastructure
  So that production rollout decisions are based on real persistence behavior

  Rule: Invalid runtime configuration never produces a deceptively healthy service

    @deploy-retro-relay-spike.SWM1.R1 @rejection
    Scenario Outline: Startup rejects each missing required runtime value
      Given an otherwise valid relay runtime missing "<variable>"
      When the production runtime configuration is parsed
      Then startup fails before opening the durable store

      Examples:
        | variable                        |
        | HOST                            |
        | PORT                            |
        | RELAY_DATA_DIR                  |
        | RELAY_PAYLOAD_KEY               |
        | RELAY_CREDENTIAL_PEPPER         |
        | RELAY_CREDENTIAL_ID             |
        | RELAY_CREDENTIAL_SECRET         |
        | RELAY_TENANT_ID                 |
        | RELAY_SUBJECT                   |
        | RELAY_HARNESS                   |
        | GITHUB_APP_ID                   |
        | GITHUB_APP_PRIVATE_KEY_BASE64   |
        | GITHUB_INSTALLATION_ID          |
        | GITHUB_REPOSITORY               |

    @deploy-retro-relay-spike.SWM1.R1 @rejection
    Scenario Outline: Startup rejects every malformed runtime value class
      Given an otherwise valid relay runtime with "<variable>" set to "<invalid value>"
      When the production runtime configuration is parsed
      Then startup fails before opening the durable store

      Examples:
        | variable                      | invalid value       |
        | HOST                          | 127.0.0.1           |
        | HOST                          | whitespace-only     |
        | PORT                          | 0                   |
        | PORT                          | 65536               |
        | PORT                          | not-a-port          |
        | GITHUB_APP_ID                 | 0                   |
        | GITHUB_APP_ID                 | 1.5                 |
        | RELAY_DATA_DIR                | relative/data       |
        | RELAY_DATA_DIR                | filesystem-root     |
        | RELAY_PAYLOAD_KEY             | invalid-base64      |
        | RELAY_PAYLOAD_KEY             | base64-16-byte-key  |
        | RELAY_CREDENTIAL_SECRET       | not-64-hex          |
        | RELAY_HARNESS                 | unknown             |
        | GITHUB_APP_ID                 | not-an-id           |
        | GITHUB_APP_PRIVATE_KEY_BASE64 | invalid-base64      |
        | GITHUB_APP_PRIVATE_KEY_BASE64 | base64-non-key      |
        | GITHUB_INSTALLATION_ID        | 0                   |
        | GITHUB_INSTALLATION_ID        | 1.5                 |
        | GITHUB_INSTALLATION_ID        | -1                  |
        | GITHUB_REPOSITORY             | missing-owner       |
        | GITHUB_REPOSITORY             | whitespace-only     |
        | RELAY_SUBJECT                 | empty-string        |
        | RELAY_TENANT_ID               | whitespace-only     |

  Rule: A healthy instance proves its durable store is open and ready

    @deploy-retro-relay-spike.SWM1.R2 @rejection
    @live
    Scenario: Railway health reports the hosted SQLite schema ready
      Given the newly created Railway spike project is deployed
      When I request its public health endpoint
      Then it reports the expected SQLite schema version
      And it reports a non-secret Railway replica identity

    @deploy-retro-relay-spike.SWM1.R2
    Scenario: Local shutdown closes the server, database, and process lock
      Given a running production relay
      When the process receives a shutdown request
      Then the listener, durable store, and process lock are released

    @deploy-retro-relay-spike.SWM1.R2
    Scenario: Health fails closed when the SQLite schema is unavailable
      Given the relay listener is running but the SQLite schema cannot be read
      When I request its health endpoint
      Then it responds unavailable rather than healthy

  Rule: Restarting the hosting instance preserves accepted request identity

    @deploy-retro-relay-spike.SWM1.R3
    @live
    Scenario: A request mismatch remains rejected after an actual Railway restart
      Given the hosted relay durably accepts a request before GitHub token acquisition fails
      And I record the healthy relay boot identity and Railway replica identity
      When I restart the Railway service
      And I poll observable health within a 120 second deadline until the replacement instance is ready
      And I observe a healthy relay boot identity different from the recorded identity
      And the Railway replica identity still identifies the hosted replica
      And I resend changed content with the same request identity
      Then it rejects the mismatch without attempting issue creation

    @deploy-retro-relay-spike.SWM1.R3
    @live
    Scenario: Live Railway topology has one replica and one mounted data volume
      Given the newly created Railway spike project is deployed
      When I inspect its live service and volume configuration through the Railway API
      Then exactly one replica serves the relay
      And exactly one persistent volume is mounted at "/data"
      And SQLite and the process lock are configured beneath "/data"

    @deploy-retro-relay-spike.SWM1.R3 @rejection
    Scenario Outline: Live smoke validation rejects each unsafe Railway topology class
      Given a live Railway target has "<topology defect>"
      When the hosted smoke validation runs
      Then it stops before the restart durability probe
      And it reports "<diagnostic>" without changing Railway

      Examples:
        | topology defect                   | diagnostic             |
        | zero running replicas             | replica count mismatch |
        | multiple running replicas         | replica count mismatch |
        | zero attached volumes             | volume count mismatch  |
        | multiple attached volumes         | volume count mismatch  |
        | one volume mounted outside /data  | volume mount mismatch  |

  Rule: The disposable spike cannot affect production systems

    @deploy-retro-relay-spike.SWM1.R4 @rejection
    @live
    Scenario: Provisioning creates a new clearly named Railway project
      Given the Railway projects that existed before this spike are recorded
      When the spike project is provisioned
      Then its name begins with "safeword-relay-spike-"
      And none of the previously existing Railway projects are selected or changed

    @deploy-retro-relay-spike.SWM1.R4
    @live
    Scenario: Generated credentials cannot create a GitHub issue
      Given the hosted Railway service matches the freshly generated spike credential and uninstalled GitHub App identity
      When a filing through its public endpoint reaches GitHub token acquisition
      Then hosted logs report a GitHub installation-token-stage failure
      And the GitHub network-boundary proof reports zero issue-create requests
      And the hosted relay retains the durable request

    @deploy-retro-relay-spike.SWM1.R4 @rejection
    Scenario Outline: Teardown refuses an unrecorded or non-disposable target
      Given the atomic spike state records exact project, service, and volume IDs
      When teardown is previewed for "<unsafe target>"
      Then teardown refuses without changing Railway

      Examples:
        | unsafe target                      |
        | an unrecorded project ID           |
        | an unrecorded service ID           |
        | an unrecorded volume ID            |
        | a project without the spike prefix |

    @deploy-retro-relay-spike.SWM1.R4
    Scenario: Teardown previews only the recorded disposable resource IDs
      Given the atomic spike state records exact project, service, and volume IDs
      And the recorded project has the required spike name prefix
      When teardown is previewed for the recorded target
      Then it prints only the exact recorded resource IDs
      And Railway remains unchanged until explicit execution is requested

  Rule: The spike leaves an actionable operational decision

    @deploy-retro-relay-spike.SWM1.R5
    Scenario: The spike report records evidence, limitations, promotion, and teardown
      Given the live deployment checks have completed
      When the spike report is finalized
      Then it records live topology, restart durability, and observed resource usage
      And it records cost provenance, limitations, and production promotion prerequisites
      And it records the exact project-specific teardown command

    @deploy-retro-relay-spike.SWM1.R5 @rejection
    Scenario Outline: Report validation distinguishes incomplete from secret-bearing evidence
      Given a spike report has "<report defect>"
      When report validation runs
      Then the ticket cannot advance to verified
      And the validation reports "<diagnostic>"

      Examples:
        | report defect                          | diagnostic               |
        | a missing required evidence section    | missing required section |
        | credential material in report content  | secret-bearing field      |
