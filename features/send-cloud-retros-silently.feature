@send-cloud-retros-silently @wip
Feature: Send retros silently from supported local harnesses
  SafeWord preserves sanitized retros without signup, prompting, or weakening
  the private GitHub filing boundary.

  @send-cloud-retros-silently.NTB1.R1 @surface.claude-code @surface.openai-codex @surface.safeword-cli
  Rule: send-cloud-retros-silently.NTB1.R1 — Each eligible supported local session makes at most one silent bounded attempt

    Scenario Outline: Install wires only the selected harness completion lifecycle
      Given a project has no SafeWord completion entries
      And both harness completion configurations contain distinct unrelated user entries
      When SafeWord is installed with only <selected> selected
      Then the <selected> completion configuration contains the SafeWord entry
      And the <unselected> completion configuration is byte-unchanged

      Examples:
        | selected          | unselected        |
        | Claude Code local | Codex local       |
        | Codex local       | Claude Code local |

    Scenario: Installing both supported harnesses preserves both completion entries
      Given a project already contains the SafeWord Claude Code local completion entry
      When SafeWord is installed with Claude Code local and Codex local selected
      Then each supported harness completion configuration contains exactly one SafeWord entry

    Scenario Outline: Reinstalling a selected harness keeps one completion entry
      Given a project already contains the SafeWord <harness> completion entry
      When SafeWord is reinstalled with only <harness> selected
      Then the <harness> completion configuration contains exactly one SafeWord entry

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    Scenario Outline: Install preserves unrelated harness completion entries
      Given the <harness> completion configuration contains an unrelated user entry
      When SafeWord is installed with <harness> selected
      Then the unrelated user entry is unchanged
      And exactly one SafeWord entry is present beside it

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    @rejection
    Scenario Outline: Install preserves malformed harness completion configuration
      Given the <harness> completion configuration is <state>
      And the project tree is snapshotted
      When SafeWord is installed with <selection> selected
      Then installation is rejected without changing that configuration
      And no other harness completion configuration is changed
      And the project tree matches the snapshot
      And installation exits nonzero with an actionable error

      Examples:
        | harness           | state      | selection                |
        | Claude Code local | unreadable | Claude Code local        |
        | Claude Code local | malformed  | Claude Code local        |
        | Codex local       | unreadable | Codex local              |
        | Codex local       | malformed  | Codex local              |
        | Codex local       | malformed  | both supported harnesses |

    Scenario Outline: An installed completion entry fires through its harness lifecycle
      Given SafeWord is installed with <harness> selected
      And a test-only build compiles the real collector origin as its sole built-in HTTPS origin
      And its project has no collection opt-out
      And the session has exactly 3 completed tool-use events and has not been claimed
      And host-specific extraction will hand off one retrospective candidate
      When the session completes through the <harness> lifecycle
      Then the installed SafeWord entry sends exactly one POST to "/v1/public-retros" with content type "application/json; charset=utf-8"
      And the real collector durably accepts it and returns a receipt
      And that receipt is recorded beside the local session scope
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    Scenario Outline: Eligibility counts completed event pairs
      Given an enabled <harness> session has 4 total tool-use events, one of which is incomplete
      And host-specific extraction hands off one retrospective candidate
      And the session has not been claimed
      When the shared completion hook entrypoint runs
      Then exactly one public retrospective attempt is made
      And one local attempt marker is created
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    @rejection
    Scenario Outline: An eligible session without an extracted candidate makes no attempt
      Given an enabled <harness> session has a readable transcript with 3 completed tool-use events
      And host-specific extraction produces no retrospective candidate
      When the shared completion hook entrypoint runs
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the public delivery stage does not write private or spool state
      And existing private or spool handling receives the unchanged empty extraction result
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    @rejection
    Scenario Outline: An eligible session with multiple extracted candidates makes no public attempt
      Given an enabled <harness> session has a readable transcript with 3 completed tool-use events
      And host-specific extraction produces multiple retrospective candidates
      When the shared completion hook entrypoint runs
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the public delivery stage does not write private or spool state
      And existing private or spool handling receives the unchanged multiple-candidate extraction result
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    Scenario Outline: A substantial supported local session makes one silent attempt
      Given an enabled <harness> session has a readable transcript with 3 completed tool-use events
      And host-specific extraction hands off one retrospective candidate
      And the session has not been claimed
      When the shared completion hook entrypoint runs
      Then exactly one public retrospective attempt is made
      And one local attempt marker is created
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    @rejection
    Scenario Outline: An ineligible session makes no network attempt
      Given an enabled <harness> session has <transcript_state>
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs
      Then no public retrospective attempt is made
      And the hook exits successfully with empty stdout and stderr
      And no local attempt marker is created
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"

      Examples:
        | harness           | transcript_state                  |
        | Claude Code local | 2 completed tool-use events       |
        | Claude Code local | no transcript                      |
        | Claude Code local | an unreadable transcript           |
        | Claude Code local | a malformed transcript             |
        | Claude Code local | 3 total events, one of which is incomplete |
        | Codex local       | 2 completed tool-use events       |
        | Codex local       | no transcript                      |
        | Codex local       | an unreadable transcript           |
        | Codex local       | a malformed transcript             |
        | Codex local       | 3 total events, one of which is incomplete |

    @rejection
    Scenario Outline: A session without a stable identifier is not eligible
      Given an enabled local session has a readable substantial transcript
      And the host supplies <identifier_state>
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the hook exits successfully with empty stdout and stderr
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"

      Examples:
        | identifier_state                    |
        | no stable session identifier        |
        | an empty stable session identifier  |
        | a whitespace session identifier     |

    @rejection
    Scenario: A claimed eligible session is not attempted again
      Given an enabled local session has already been atomically claimed
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs again
      Then no public retrospective attempt is made
      And the existing claim remains unchanged
      And the hook exits successfully with empty stdout and stderr
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"

    @rejection
    Scenario Outline: A malformed marker store fails closed
      Given an enabled eligible local session has a <state> local marker store
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs
      Then no public retrospective attempt is made
      And the existing marker store remains unchanged
      And the hook exits successfully with empty stdout and stderr
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"

      Examples:
        | state      |
        | unreadable |
        | malformed  |

    Scenario: Concurrent completion hooks claim one attempt
      Given two completion hooks reach the same unclaimed eligible session
      And both are blocked immediately before the atomic claim
      And the collector returns a valid durable receipt
      When both claim attempts are released together
      Then exactly one hook owns the claim
      And exactly one public retrospective attempt is made
      And exactly one local marker exists with that durable receipt
      And the losing hook does not create or alter a local marker
      And the losing hook exits successfully with empty stdout and stderr

    Scenario: A previously ineligible session can become eligible
      Given an enabled local session previously completed with only 2 completed tool-use events
      And that completion created no local attempt marker
      When the same session later completes with 3 completed tool-use events
      Then exactly one public retrospective attempt is made
      And one local attempt marker is created

    @rejection
    Scenario: A failed atomic claim makes no public attempt
      Given an eligible session reaches the final preparation operation
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      And its local marker store cannot record that atomic claim
      When the shared completion hook entrypoint runs
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"
      And the hook exits successfully with empty stdout and stderr

    @rejection
    Scenario: A crash after claim cannot cause a second attempt
      Given an eligible session was claimed before its public attempt began
      And the hook crashed before submission
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs again
      Then no public retrospective attempt is made
      And the existing claim remains unchanged
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"
      And the hook exits successfully with empty stdout and stderr

  @send-cloud-retros-silently.NTB1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex
  Rule: send-cloud-retros-silently.NTB1.R2 — A retrospective contains only the approved sanitized body and source allowlist

    Scenario: Available allowlisted source context is collected
      Given an eligible session exposes every approved source value including Git user email "fixture@example.test"
      And its sanitized finding passes the finding-only pre-transmission validator
      When SafeWord prepares its retrospective envelope
      Then the envelope contains exactly version "v1", sanitized finding, closed source profile, and opaque session scope
      And the source profile contains exactly harness, host class, project UUID, SafeWord CLI version, repository, agent version, model, SafeWord plugin version, operating-system family, and user identity
      And host class is "local"
      And user identity is transmitted unchanged as "fixture@example.test"
      And the opaque session scope is 64-character lowercase hexadecimal

    Scenario Outline: Sanitization protects canonical bytes and the local marker
      Given an eligible <harness> session's raw retrospective contains benign sentinel "keep-this-finding", secret sentinel "ghp_raw_fixture_123", path sentinel "/Users/fixture/private", and email sentinel "private@example.test"
      And its approved source inputs contain none of those sentinels
      And its raw session identifier is "session-fixture-42"
      When the shared completion hook entrypoint runs successfully
      Then the <harness> adapter's complete HTTP request URL, query, headers, or body contains no sensitive sentinel
      And the <harness> adapter's complete HTTP request URL, query, headers, or body contains no "session-fixture-42"
      And the transmitted finding contains "keep-this-finding"
      And the local marker contains only the opaque session scope and durable receipt

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    @rejection
    Scenario Outline: Contaminated sanitizer output is rejected before persistence
      Given the sanitizer's pre-transmission validator receives a finding containing sensitive sentinel <sentinel>
      And host-specific extraction handed off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs
      Then preparation is rejected before any network attempt
      And no local attempt marker is created
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | sentinel               |
        | ghp_raw_fixture_123    |
        | /Users/fixture/private |
        | private@example.test   |

    @rejection
    Scenario Outline: An empty sanitized finding is rejected before persistence
      Given the sanitizer output contains <content>
      And host-specific extraction handed off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs
      Then preparation is rejected before any network attempt
      And no local attempt marker is created
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | content         |
        | an empty string |
        | only whitespace |

    Scenario: Unavailable optional source context is omitted
      Given an eligible session exposes no optional source values
      When SafeWord prepares its retrospective envelope
      Then its source profile contains exactly harness, host class, project UUID, and SafeWord CLI version

    Scenario Outline: Empty optional source context is omitted
      Given optional source field <field> resolves to <content>
      When SafeWord prepares its retrospective envelope
      Then <field> is omitted from the source profile

      Examples:
        | field                   | content         |
        | repository              | an empty string |
        | repository              | only whitespace |
        | agent version           | an empty string |
        | agent version           | only whitespace |
        | model                   | an empty string |
        | model                   | only whitespace |
        | SafeWord plugin version | an empty string |
        | SafeWord plugin version | only whitespace |
        | operating-system family | an empty string |
        | operating-system family | only whitespace |
        | user identity            | an empty string |
        | user identity            | only whitespace |

    Scenario Outline: Repository remotes normalize or are omitted
      Given the source collector reads origin remote <remote>
      When SafeWord prepares the source profile
      Then repository identity is <repository>

      Examples:
        | remote                                | repository          |
        | git@github.com:ArcadeAI/safeword.git | github.com/arcadeai/safeword |
        | https://github.com/ArcadeAI/safeword/ | github.com/arcadeai/safeword |
        | ssh://git@github.com/ArcadeAI/safeword.git | github.com/arcadeai/safeword |
        | git@gitlab.example:Team/Repo.git     | gitlab.example/Team/Repo |
        | https://gitlab.example/Team/Repo.git | gitlab.example/Team/Repo |
        | https://user@gitlab.example:443/Team/Repo.git?token=ghp_fixture_secret_1234567890#readme | gitlab.example/Team/Repo |
        | https://x-access-token:ghp_fixture_secret_1234567890@github.com/ArcadeAI/Safeword.git | github.com/arcadeai/safeword |
        | https://GitHub.COM/ArcadeAI/Safeword.git | github.com/arcadeai/safeword |
        | https://Evil-GitHub.com/Team/Repo.git | evil-github.com/Team/Repo |
        | https://api.github.com/Team/Repo.git | api.github.com/Team/Repo |
        | /Users/fixture/private/repo          | omitted             |
        | file:///Users/fixture/private/repo   | omitted             |
        | ://malformed remote                  | omitted             |
        | ../safeword                           | omitted             |

    Scenario: Repository credentials never enter the envelope
      Given the source collector reads origin remote "https://x-access-token:ghp_fixture_secret_1234567890@github.com/ArcadeAI/Safeword.git"
      When SafeWord prepares the source profile
      Then repository identity is "github.com/arcadeai/safeword"
      And "ghp_fixture_secret_1234567890" appears nowhere in the envelope or request

    Scenario: An absent repository remote is omitted
      Given no origin remote is configured
      When SafeWord prepares the source profile
      Then repository identity is omitted

    Scenario Outline: User identity follows documented precedence
      Given runtime identity is <runtime_identity>
      And repository-local Git email is <local_email>
      And global Git email is <global_email>
      When SafeWord prepares the source profile
      Then user identity is <expected>

      Examples:
        | runtime_identity | local_email       | global_email       | expected          |
        | octocat          | local@example.com | global@example.com  | octocat           |
        | octocat          | absent            | absent              | octocat           |
        | whitespace       | local@example.com | global@example.com  | local@example.com |
        | an empty string  | local@example.com | global@example.com  | local@example.com |
        | whitespace       | absent            | global@example.com  | global@example.com |
        | an empty string  | absent            | global@example.com  | global@example.com |
        | absent           | local@example.com | global@example.com  | local@example.com |
        | absent           | absent            | global@example.com  | global@example.com |
        | absent           | whitespace        | global@example.com  | global@example.com |
        | absent           | whitespace        | absent              | omitted           |
        | absent           | absent            | whitespace          | omitted           |
        | absent           | absent            | absent              | omitted           |

    @rejection
    Scenario Outline: Forbidden source metadata cannot enter the envelope
      Given the raw untyped source candidate contains forbidden field <field> with sentinel <value>
      When the shared completion hook entrypoint runs
      Then preparation is rejected before any network attempt
      And the hook exits successfully with empty stdout and stderr
      And no local attempt marker is created

      Examples:
        | field               | value                         |
        | credential          | ghp_fixture_secret_1234567890 |
        | rawTranscript       | fixture-raw-session-line      |
        | environment         | SAFEWORD_SECRET=fixture       |
        | networkAddress      | 192.0.2.10                    |
        | hardwareIdentifier  | fixture-hardware-id           |
        | hostname            | fixture-host.example          |
        | unknownMetadata     | fixture-unknown-value          |

  @send-cloud-retros-silently.NTB1.R3 @surface.safeword-cli @surface.claude-code @surface.openai-codex
  Rule: send-cloud-retros-silently.NTB1.R3 — Project identity needs no signup and an explicit project opt-out prevents collection

    Scenario: First install creates project identity locally
      Given a project has no SafeWord project UUID
      When SafeWord is installed
      Then a UUID is generated and stored without a network request
      And install succeeds without a SafeWord service credential

    Scenario Outline: Existing project identity is preserved
      Given a project already contains a valid SafeWord project UUID
      When the project is <operation>
      Then the same project UUID remains configured

      Examples:
        | operation   |
        | reinstalled |
        | upgraded    |

    Scenario Outline: Install and upgrade preserve the collection setting
      Given a project has `publicRetrospectiveCollection` explicitly set to <stored_value>
      When the project is <operation>
      Then `publicRetrospectiveCollection` remains <stored_value>

      Examples:
        | operation   | stored_value |
        | reinstalled | false        |
        | upgraded    | false        |
        | reinstalled | true         |
        | upgraded    | true         |

    @rejection
    Scenario Outline: Install and upgrade reject a malformed collection setting atomically
      Given a project has a malformed `publicRetrospectiveCollection` value
      And the project tree is snapshotted
      When the project is <operation>
      Then the operation is rejected and the project tree matches the snapshot
      And the operation exits nonzero with an actionable error

      Examples:
        | operation   |
        | reinstalled |
        | upgraded    |

    Scenario: First install in a clone preserves project identity
      Given a cloned project contains a valid SafeWord project UUID
      When SafeWord is installed in the clone
      Then the same project UUID remains configured

    Scenario Outline: The local CLI turns public retros off or on
      Given a project contains valid SafeWord configuration whose `publicRetrospectiveCollection` key state is <initial_value>
      When the user runs "safeword project public-retros <state>"
      Then `publicRetrospectiveCollection` is stored as <stored_value>
      And the project UUID is unchanged
      And no network request is made
      And the command exits successfully

      Examples:
        | state | initial_value | stored_value |
        | off   | true          | false        |
        | off   | absent        | false        |
        | off   | false         | false        |
        | on    | false         | true         |
        | on    | absent        | true         |
        | on    | true          | true         |

    @rejection
    Scenario Outline: Invalid public-retro control leaves configuration unchanged
      Given the SafeWord command context is <condition>
      When the user runs `safeword project public-retros` with <state>
      Then the command is rejected without changing project configuration
      And the command creates no file or directory
      And no network request is made
      And the command exits nonzero with an actionable error

      Examples:
        | condition                    | state   |
        | valid                        | invalid |
        | valid                        | OFF     |
        | valid                        | no state argument |
        | missing                      | off     |
        | unparseable                  | off     |
        | valid with an unwritable config file | off |
        | outside a SafeWord project   | off     |

    Scenario: Install repairs malformed project identity locally
      Given project config contains a malformed SafeWord project UUID
      When SafeWord is installed
      Then a valid replacement UUID is stored without a network request

    Scenario: Uppercase project identity is serialized canonically
      Given project config contains project UUID "018F0F2E-ABCD-7DEF-8ABC-DEF012345678"
      When SafeWord prepares the source profile
      Then source project UUID is "018f0f2e-abcd-7def-8abc-def012345678"

    Scenario: Cloned projects still distinguish sessions
      Given two clones share one valid SafeWord project UUID
      And each clone has a different stable host session identifier
      When each prepares an eligible retrospective
      Then their opaque session scopes differ

    Scenario Outline: The same project session derives one opaque scope
      Given two fresh processes use project UUID <project_uuid> and stable session identifier "session-fixture-42"
      And both processes use harness "claude-code"
      And the digest byte preimage is UTF-8 "safeword-retro-session-scope:v1", one 0x00 byte, UTF-8 harness, one 0x00 byte, the canonical lowercase ASCII project UUID, one 0x00 byte, and the UTF-8 session identifier with no trailing byte
      And an out-of-band Node crypto SHA-256 over that byte sequence fixes expected scope digest "724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0"
      When each derives an opaque session scope
      Then both scopes equal the expected scope digest

      Examples:
        | project_uuid                               |
        | 018f0f2e-abcd-7def-8abc-def012345678 |
        | 018F0F2E-ABCD-7DEF-8ABC-DEF012345678 |

    Scenario: Different harnesses cannot collide on one host session identifier
      Given Claude Code local and Codex local use the same project UUID and stable host session identifier
      When each derives an opaque session scope
      Then their opaque session scopes differ

    Scenario: Different projects distinguish the same host session
      Given two fresh processes use different project UUIDs and stable session identifier "session-fixture-42"
      When each derives an opaque session scope
      Then their opaque session scopes differ

    Scenario: Distinct sessions in one project each receive one attempt
      Given one project has a claimed eligible session with its local marker
      And a second eligible session has a different stable session identifier
      When the shared completion hook entrypoint runs for the second session
      Then exactly one new public retrospective attempt is made
      And a second distinct local marker is created for the second session scope

    @rejection
    Scenario: A project opt-out prevents collection
      Given `.safeword/config.json` sets `publicRetrospectiveCollection` to false
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When an otherwise eligible local completion hook runs
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the hook exits successfully with empty stdout and stderr
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"

    @rejection
    Scenario Outline: An invalid project config fails closed
      Given project config is <config_state>
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When an otherwise eligible local completion hook runs
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the hook exits successfully with empty stdout and stderr
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"

      Examples:
        | config_state                                      |
        | missing                                           |
        | unparseable JSON                                  |
        | a malformed `publicRetrospectiveCollection` value |

    Scenario Outline: An absent collection setting defaults on silently
      Given `.safeword/config.json` has no `publicRetrospectiveCollection` key
      And a <harness> session is otherwise eligible
      When the shared completion hook entrypoint runs
      Then exactly one public retrospective attempt is made
      And no SafeWord service credential or approval input is requested
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    Scenario Outline: An explicit enabled collection setting is honored silently
      Given `.safeword/config.json` sets `publicRetrospectiveCollection` to true
      And a <harness> session is otherwise eligible
      When the shared completion hook entrypoint runs
      Then exactly one public retrospective attempt is made
      And no SafeWord service credential or approval input is requested
      And the hook exits successfully with empty stdout and stderr

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

  @send-cloud-retros-silently.SWM1.R1 @surface.claude-code @surface.openai-codex @surface.safeword-cli
  Rule: send-cloud-retros-silently.SWM1.R1 — Every supported harness uses one deterministic envelope and transport-independent request identity

    Scenario: Both adapters preserve a prepared request unchanged
      Given one prepared request with identity and canonical bytes is supplied to the Claude Code and Codex adapter boundaries
      When each adapter submits that request
      Then each transmits the original canonical bytes unchanged
      And each transmits the same request identity only in the "X-Safeword-Request-Id" header
      And each transmits content type "application/json; charset=utf-8"
      And each transmits no query string and no Authorization, Cookie, or X-Api-Key header
      And each raw REST body is byte-identical to the canonical bytes

    Scenario Outline: Both adapters use only the built-in HTTPS collector
      Given a prepared request and a <redirection_vector>
      When the <adapter> adapter submits it
      Then it addresses the built-in HTTPS public collector origin
      And it sends no bytes to the alternate origin
      And its socket peer and TLS server name never identify a configured proxy endpoint

      Examples:
        | adapter           | redirection_vector               |
        | Claude Code local | project-config endpoint override |
        | Claude Code local | environment endpoint override    |
        | Claude Code local | proxy environment state          |
        | Claude Code local | collector HTTP redirect response |
        | Claude Code local | host-supplied endpoint input     |
        | Codex local       | project-config endpoint override |
        | Codex local       | environment endpoint override    |
        | Codex local       | proxy environment state          |
        | Codex local       | collector HTTP redirect response |
        | Codex local       | host-supplied endpoint input     |

    @post-attempt-failure
    Scenario Outline: Collector redirects are never accepted as preservation
      Given an eligible <adapter> session is claimed and submits to the built-in collector
      When the collector returns a redirect with a receipt-shaped body
      Then no request is sent to the redirect destination
      And no durable receipt is recorded beside the local session scope
      And the local state remains claimed without a receipt

      Examples:
        | adapter           |
        | Claude Code local |
        | Codex local       |

    Scenario: Request identity is generated once outside the envelope
      Given an eligible session has completed every preparation step before claiming
      And the random UUID source returns "01911111-2222-7333-8444-55555555555A"
      When the shared builder claims the session and creates its prepared request
      Then exactly one request UUID is generated for the attempt
      And the request UUID is canonical lowercase "01911111-2222-7333-8444-55555555555a"
      And the canonical bytes contain only version, finding, source, and session scope

    Scenario: Distinct attempts receive distinct request identities
      Given two eligible sessions independently complete every preparation step before claiming
      When the shared builder creates each prepared request
      Then the two request UUIDs differ

    Scenario: Independent preparation is deterministic
      Given two fresh processes receive injected fixture values for every approved source field in different key insertion orders
      And the canonical UTF-8 preimage is exactly '{"version":"v1","finding":"fixture finding","source":{"harness":"claude-code","hostClass":"local","projectUUID":"018f0f2e-abcd-7def-8abc-def012345678","safewordCliVersion":"0.78.8","repository":"github.com/arcadeai/safeword","agentVersion":"1.2.3","model":"fixture-model","safewordPluginVersion":"0.78.8","osFamily":"macos","userIdentity":"fixture@example.test"},"sessionScope":"724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0"}' with no trailing byte
      When each independently prepares a canonical envelope
      Then each process's canonical bytes are byte-identical to the pinned canonical preimage
      And those produced bytes are 445 UTF-8 bytes whose out-of-band SHA-256 is "a6701f5fea50ec66e811833d67ff2b51fc8ea3808d9562005690c49ff07cd2df"

    Scenario: Escapable and non-ASCII findings serialize deterministically
      Given two fresh processes receive a raw finding containing a double quote, backslash, newline, "café" whose "é" is U+00E9, and "🚀" at U+1F680
      And each receives the required source values and session scope from the canonical fixture
      When each independently prepares a canonical envelope
      Then each process produces the exact canonical UTF-8 preimage '{"version":"v1","finding":"quote \" slash \\ newline\n café 🚀","source":{"harness":"claude-code","hostClass":"local","projectUUID":"018f0f2e-abcd-7def-8abc-def012345678","safewordCliVersion":"0.78.8"},"sessionScope":"724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0"}' with no trailing byte
      And each result is 287 UTF-8 bytes with SHA-256 "faca4b56d5afdfc6cd034567907e93dc017b083e32b57146130521b757f402dd"

    Scenario: A partial source profile keeps canonical key order
      Given two fresh processes receive optional model value "fixture-model" with every other optional source value absent
      And the canonical UTF-8 preimage is exactly '{"version":"v1","finding":"fixture finding","source":{"harness":"claude-code","hostClass":"local","projectUUID":"018f0f2e-abcd-7def-8abc-def012345678","safewordCliVersion":"0.78.8","model":"fixture-model"},"sessionScope":"724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0"}' with no trailing byte
      When each independently prepares a canonical envelope
      Then each process produces 288 byte-identical UTF-8 bytes with SHA-256 "0ea1c8bbb15e4556e646ae88043a1a6d2e01406239cd0a323c9de3f99f98805f"

  @send-cloud-retros-silently.SWM1.R2 @surface.railway-public-retro-collector @surface.claude-code @surface.openai-codex
  Rule: send-cloud-retros-silently.SWM1.R2 — Public intake deduplicates transactionally from exact raw REST bytes

    Scenario Outline: An exact retry returns the original receipt
      Given the real shared builder prepares a canonical envelope from an eligible <harness> session
      And that request identity and the builder's exact bytes were durably accepted by the real collector schema
      When the same request identity and exact bytes are submitted again
      Then the original durable receipt is returned
      And the response contains exactly the matching request identity and a non-empty opaque receipt
      And no second record is created

      Examples:
        | harness           |
        | Claude Code local |
        | Codex local       |

    Scenario: Concurrent first submissions converge
      Given two callers concurrently submit the same new request identity and exact raw REST body
      And both submissions arrive before either acceptance is observed
      When the collector serializes both transactions
      Then both callers receive the identical durable receipt stored on the single record
      And exactly one record exists

    @rejection
    Scenario: Concurrent byte-different bodies cannot share one request identity
      Given two concurrent submissions have the same new request UUID and byte-different raw REST bodies
      And both submissions arrive before either acceptance is observed
      When the collector serializes both transactions
      Then exactly one record is accepted
      And the other submission is rejected without changing that record

    @rejection
    Scenario: Concurrent fresh identities cannot share one session scope
      Given two concurrent valid submissions have distinct request UUIDs and the same opaque session scope
      And both submissions arrive before either acceptance is observed
      When the collector serializes both transactions
      Then exactly one record is accepted
      And the other submission is rejected

    Scenario: Distinct submissions remain independent
      Given two valid submissions have distinct request UUIDs, distinct session scopes, and byte-different raw REST bodies
      When the public collector accepts both
      Then both are durably accepted with different receipts
      And exactly two records exist

    Scenario: Source metadata never becomes duplicate authority
      Given two valid submissions have the same complete source profile
      And they have distinct request UUIDs, distinct session scopes, and byte-different raw REST bodies
      When the public collector accepts both
      Then both are durably accepted with different receipts
      And exactly two records exist

    Scenario: A minimal source profile is accepted
      Given a valid v1 raw REST envelope contains only harness, host class, project UUID, and SafeWord CLI version in its source profile
      When the public caller submits it with a well-formed new request UUID
      Then the response contains exactly the matching request identity and a non-empty opaque receipt
      And it is durably accepted

    Scenario Outline: The raw v1 envelope size boundary is enforced
      Given a valid v1 raw REST envelope with <content> is <bytes> UTF-8 bytes
      When the public caller submits it with a well-formed new request UUID
      Then the submission is <outcome>

      Examples:
        | content                                      | bytes | outcome                                 |
        | ASCII content                                | 65536 | durably accepted with a receipt         |
        | ASCII content                                | 65537 | rejected without persistence or receipt |
        | multibyte content under 65,536 characters    | 65536 | durably accepted with a receipt         |
        | multibyte content under 65,536 characters    | 65537 | rejected without persistence or receipt |

    @rejection
    Scenario: Reusing a request identity with different bytes is rejected
      Given a request identity and its validated raw REST body were durably accepted
      When that request identity is submitted with byte-different raw REST body
      Then the submission is rejected without changing the stored record

    @rejection
    Scenario: Semantic equivalence cannot override byte-different raw bodies
      Given a request identity and its validated raw REST body were durably accepted
      And a byte-different JSON body represents the same semantic values after formatting or sanitization
      When that request identity is submitted with the byte-different body
      Then the submission is rejected without changing the stored record

    @rejection
    Scenario: Reusing a session scope with different bytes is rejected
      Given an opaque session scope and its validated raw REST body were durably accepted
      When a fresh request UUID reuses that scope with a byte-different raw REST body
      Then the submission is rejected without changing the stored record

    @rejection
    Scenario: A fresh request identity cannot reuse an accepted session scope
      Given an opaque session scope and its validated raw REST body were durably accepted
      When a fresh request UUID submits that same scope and exact raw REST body
      Then the submission is rejected without changing the stored record

    @rejection
    Scenario Outline: A malformed request identity is rejected
      Given a valid canonical envelope is paired with <request_identity>
      When the public caller submits it
      Then the submission is rejected without persistence

      Examples:
        | request_identity                      |
        | no X-Safeword-Request-Id header       |
        | an empty X-Safeword-Request-Id header |
        | two X-Safeword-Request-Id headers     |
        | a non-UUID request identity           |
        | an uppercase UUID request identity    |
        | a brace-wrapped UUID request identity |

    @rejection
    Scenario Outline: Invalid envelope schema is rejected
      Given a public request contains <schema_state>
      When the public caller submits it with a well-formed new request UUID
      Then the submission is rejected without persistence or receipt

      Examples:
        | schema_state               |
        | an unknown envelope version |
        | a missing required field    |
        | an unknown top-level field  |
        | an unknown source-profile field |
        | a missing required source project UUID |
        | a non-UUID source project UUID |
        | an uppercase source project UUID |
        | an invalid source host class |
        | source host class "cloud" |
        | an out-of-allowlist source harness |
        | a wrong-typed required field |
        | an empty-string required field |
        | a whitespace-only required field |
        | an empty-string optional source field |
        | a whitespace-only optional source field |
        | a whitespace-only finding |
        | a 12-character session scope |
        | a 63-character lowercase hexadecimal session scope |
        | a 65-character lowercase hexadecimal session scope whose first 64 characters are valid |
        | an uppercase hexadecimal session scope |
        | a 64-character non-hexadecimal session scope |
        | a non-JSON raw body          |
        | a JSON array raw body        |
        | a JSON null raw body         |
        | an empty raw body             |
        | a raw body with duplicate JSON keys |
        | a non-UTF-8 raw body          |
        | no Content-Type header        |
        | a non-JSON Content-Type header |

  @send-cloud-retros-silently.SWM1.R3 @surface.railway-public-retro-collector
  Rule: send-cloud-retros-silently.SWM1.R3 — Public records remain physically and authoritatively quarantined from private filing

    Scenario: Public intake stores a quarantined record without GitHub access
      Given the public collector has its own process and SQLite volume
      When it accepts a valid public retrospective
      Then the record is durable in the public collector store
      And the private GitHub collaborator receives no call

    Scenario: Public collector has no private filing authority
      Given the built public collector artifact and its deployment configuration
      When its module graph and configured credentials are inspected
      Then it contains no private GitHub filing import or credential
      And its deployment contains no private relay database path or credential

    Scenario: Public submission needs no credential
      Given a valid v1 public retrospective carries no caller credential
      And it is a POST to "/v1/public-retros" with content type "application/json; charset=utf-8"
      When the public caller submits it
      Then it is durably accepted with a receipt

    @rejection
    Scenario Outline: Credential-bearing public submissions are rejected
      Given a valid v1 public retrospective carries <credential>
      When the public caller submits it
      Then it is rejected without persistence or receipt

      Examples:
        | credential                  |
        | an operator read credential |
        | a private filing credential |
        | an unknown bearer credential |
        | an unrecognized Authorization credential |
        | a credential-bearing cookie  |
        | a benign analytics cookie     |
        | an X-Api-Key credential       |
        | a query-string credential     |
        | Authorization header value "not-a-secret" |
        | query string "?utm_source=fixture" |

    Scenario: An authorized operator can inspect a quarantined record
      Given a public retrospective was accepted
      When an operator with the collector read credential requests it
      Then the byte-identical submitted raw REST body and receipt are returned

    @rejection
    Scenario Outline: Non-operator credentials cannot read public records
      Given a public retrospective was accepted
      When a caller requests it using <credential>
      Then the collector reveals no record

      Examples:
        | credential                    |
        | no operator credential         |
        | an empty operator credential   |
        | duplicated ambiguous operator credentials |
        | a malformed operator credential |
        | an invalid operator credential |
        | a private filing credential    |

    @rejection
    Scenario: Anonymous callers cannot enumerate public records
      Given multiple public retrospectives were accepted
      When an anonymous caller requests a collection or record listing
      Then the collector reveals no record or collection metadata

    @rejection
    Scenario Outline: Public correlation values grant no read or filing authority
      Given a public retrospective was accepted
      When a caller presents only <value>
      Then the collector reveals no record
      And private GitHub filing receives no call

      Examples:
        | value            |
        | project UUID     |
        | request identity |
        | durable receipt  |
        | harness identity |

    @rejection
    Scenario: Collector failure cannot fall through to private filing
      Given the public collector store is unavailable
      When a valid public retrospective arrives
      Then no public record is acknowledged
      And private GitHub filing receives no call

    @rejection
    Scenario Outline: The public route cannot mutate accepted records
      Given a public retrospective was accepted
      When a public caller attempts to <operation> that record
      Then the operation is rejected without changing the stored record

      Examples:
        | operation |
        | overwrite |
        | delete    |

    Scenario: Existing private filing remains operational beside public collection
      Given a valid public retrospective and a separately authorized private filing are ready
      When both are submitted through their respective boundaries
      Then the public record is quarantined without a GitHub call
      And the private filing creates its expected GitHub issue
