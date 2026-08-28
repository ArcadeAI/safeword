@proof.vitest
Feature: Attach useful runtime context to retros without signup

  Background:
    Given cloud-suppression environment evidence is absent unless a scenario supplies it

  @retro-runtime-context.SWM1.R1 @surface.safeword-cli
  Rule: retro-runtime-context.SWM1.R1 — Every project keeps one opaque locally generated identity across installs and upgrades

    Scenario: First install creates distinct project identity locally
      Given two SafeWord projects have no project identity
      When SafeWord is installed in both projects
      Then each project contains a different lowercase UUID identity
      And the injected project-identity provider subprocess and network recorders are empty

    Scenario: Upgrade creates a missing project identity locally
      Given a previously installed SafeWord project has no project identity
      When SafeWord is upgraded in the project
      Then a newly generated lowercase UUID identity is persisted
      And the injected project-identity provider subprocess and network recorders are empty

    Scenario Outline: Project identity survives ordinary lifecycle operations
      Given a SafeWord project has a valid locally generated project identity
      When SafeWord is <operation> in the project
      Then the same project identity remains configured
      And the injected project-identity provider subprocess and network recorders are empty

      Examples:
        | operation   |
        | reinstalled |
        | upgraded    |

    @rejection
    Scenario: Malformed project identity is replaced locally
      Given a SafeWord project has malformed project identity "not-a-uuid"
      When SafeWord is installed in the project
      Then a newly generated lowercase UUID identity is persisted
      And "not-a-uuid" is absent from project configuration
      And the injected project-identity provider subprocess and network recorders are empty

    @rejection
    Scenario: Noncanonical uppercase project identity is normalized locally
      Given a SafeWord project has project identity "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"
      When SafeWord is installed in the project
      Then project identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" is persisted
      And "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA" is absent from project configuration
      And the injected project-identity provider subprocess and network recorders are empty

    Scenario: Recreated project identity is not derived from the project path
      Given a SafeWord project at a fixed path has a locally generated project identity
      And that identity is removed from project configuration
      When SafeWord is installed again at the same path
      Then a different lowercase UUID identity is persisted
      And the injected project-identity provider subprocess and network recorders are empty

  @retro-runtime-context.SWM1.R2 @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.cursor @surface.railway-public-retro-collector
  Rule: retro-runtime-context.SWM1.R2 — Every harness describes the same bounded runtime concepts through one versioned context contract

    Scenario Outline: Claude Code and Codex use one complete source contract
      Given a <harness> retrospective with every required source fact and a runnable public route
      And project identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", SafeWord CLI version "0.79.6", repository "github.com/arcadeai/safeword", agent version <agent_version>, model <model>, SafeWord plugin version "0.80.1", and operating-system family "darwin" are available
      When SafeWord prepares its public retrospective
      Then the canonical envelope version on the wire is "v1"
      And the v1 source contains exactly harness <harness_value>, host class "unknown", project identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", SafeWord CLI version "0.79.6", repository "github.com/arcadeai/safeword", agent version <agent_version>, model <model>, SafeWord plugin version "0.80.1", and operating-system family "darwin"

      Examples:
        | harness      | harness_value | agent_version | model          |
        | Claude Code  | claude-code   | "claude-1"    | "claude-model" |
        | OpenAI Codex | codex         | "codex-1"     | "codex-model"  |

    Scenario: Cursor omits signals its harness does not expose
      Given a Cursor retrospective with every required source fact and a runnable public route
      And project identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", SafeWord CLI version "0.79.6", repository "github.com/arcadeai/safeword", and operating-system family "darwin" are available
      And Cursor exposes no supported agent-version, model, or SafeWord plugin-version signal
      When SafeWord prepares its public retrospective
      Then the v1 source contains exactly harness "cursor", host class "unknown", project identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", SafeWord CLI version "0.79.6", repository "github.com/arcadeai/safeword", and operating-system family "darwin"
      And agent version, model, and SafeWord plugin version are omitted

    Scenario Outline: Every supported harness reaches the real collector
      Given a <harness> retrospective with every required source fact and a runnable public route
      When the existing retro CLI delivery boundary runs
      Then exactly one public submission reaches the real collector
      And exactly one retrospective is durably retained with harness <harness_value> and host class <host_class>

      Examples:
        | harness      | harness_value | host_class |
        | Claude Code  | claude-code   | "unknown"  |
        | OpenAI Codex | codex         | "unknown"  |
        | Cursor       | cursor        | "unknown"  |

    Scenario: Configured project identity is the emitted project identity
      Given project configuration contains identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
      When SafeWord prepares its public retrospective
      Then the v1 source project identity is "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    Scenario: Runtime metadata does not change duplicate identity
      Given one project harness session has a first snapshot and a later snapshot that differ in repository, model, agent version, SafeWord CLI version, SafeWord plugin version, and operating-system family
      When both snapshots run through the public delivery boundary
      Then exactly one public submission reaches the real collector
      And exactly one retrospective is durably retained
      And the retained retrospective contains the first snapshot unchanged

    Scenario Outline: Duplicate identity changes across its authoritative inputs
      Given two retrospective sessions differ only by <input>
      When both sessions run through the public delivery boundary
      Then exactly two public submissions reach the real collector
      And exactly two retrospectives are durably retained

      Examples:
        | input            |
        | harness          |
        | project identity |
        | session identity |

    Scenario Outline: Cursor conversation identity is the session-scope authority
      Given two Cursor retros from the same project use conversation identities <first_identity> and <second_identity>
      When both retros run through the real CLI-to-collector lifecycle
      Then exactly <retained_count> retrospectives are durably retained
      And each retained retrospective preserves its first canonical bytes

      Examples:
        | first_identity | second_identity | retained_count |
        | "cursor-1"     | "cursor-1"      | 1              |
        | "cursor-1"     | "cursor-2"      | 2              |

    Scenario: A released v0.79.6 envelope remains byte-identical
      Given a checked-in canonical v1 byte fixture captured from the released SafeWord v0.79.6 public-retro builder contains exactly `harness`, `hostClass`, `projectUUID`, `safewordCliVersion`, `repository`, `agentVersion`, `model`, `safewordPluginVersion`, `osFamily`, and legacy `userIdentity` in its source
      When it is submitted to the real collector and read by an operator
      Then the real collector accepts it
      And the operator receives the original canonical bytes unchanged

    Scenario Outline: Released local host classification remains accepted
      Given canonical v1 envelope bytes from a released client contain harness <harness>, host class "local", and legacy user identity "legacy-user-fixture"
      When it is submitted to the real collector and read by an operator
      Then the real collector accepts it
      And the operator receives the original canonical bytes unchanged

      Examples:
        | harness       |
        | "claude-code" |
        | "codex"       |

    @rejection
    Scenario: Cursor cannot claim the released-client local classification
      Given canonical v1 envelope bytes contain harness "cursor" and host class "local"
      When it is submitted to the real collector
      Then the retrospective is rejected without persistence

    Scenario: The collector preserves released optional-value rules
      Given canonical v1 envelope bytes from the released builder contain a model of `a` followed by 128 copies of `é`, totaling 257 UTF-8 bytes
      When it is submitted to the real collector and read by an operator
      Then the real collector accepts it
      And the operator receives the original canonical bytes unchanged

    @rejection
    Scenario: The collector rejects a body above its released byte limit
      Given canonical v1 envelope bytes total 65537 UTF-8 bytes
      When it is submitted to the real collector
      Then the retrospective is rejected without persistence

    Scenario: The collector accepts a body at its released byte limit
      Given canonical v1 envelope bytes total 65536 UTF-8 bytes
      When it is submitted to the real collector and read by an operator
      Then the real collector accepts it
      And the operator receives the original canonical bytes unchanged

    @rejection
    Scenario: An unrecognized source field is refused
      Given a v1 envelope contains source field `extra` outside the accepted current fields and released legacy field `userIdentity`
      When the collector validates the retrospective
      Then the retrospective is rejected without persistence

    @rejection
    Scenario Outline: The collector rejects an invalid envelope version
      Given canonical envelope bytes have version <version>
      When it is submitted to the real collector
      Then the retrospective is rejected without persistence

      Examples:
        | version |
        | omitted |
        | "v2"    |

    @rejection
    Scenario Outline: The collector rejects malformed allowlisted source values
      Given a canonical v1 envelope directly supplies JSON value <invalid_value> for allowlisted source field <field>
      When the collector validates the retrospective
      Then the retrospective is rejected without persistence

      Examples:
        | field                 | invalid_value                              |
        | model                 | 7                                          |
        | project identity      | "not-a-uuid"                               |
        | harness               | null                                       |
        | host class            | []                                         |
        | SafeWord CLI version  | {}                                         |

    @rejection
    Scenario Outline: The collector rejects omitted required source fields
      Given a canonical v1 envelope omits required source field <field>
      When the collector validates the retrospective
      Then the retrospective is rejected without persistence

      Examples:
        | field                     |
        | harness                   |
        | host class                |
        | project identity          |
        | SafeWord CLI version      |

    @rejection
    Scenario Outline: The collector rejects source vocabulary outside the local contract
      Given a canonical v1 envelope directly supplies <value> for source field <field>
      When the collector validates the retrospective
      Then the retrospective is rejected without persistence

      Examples:
        | field      | value       |
        | harness    | "other"     |
        | host class | "cloud"     |
        | host class | "hostname"  |

    Scenario: The collector preserves first-writer bytes for a duplicate session scope
      Given two canonical envelopes share harness, project identity, and session identity and differ only in model, agent version, and operating-system family
      When the first envelope and then the second envelope are submitted sequentially to the real collector with different request identities
      Then exactly one retrospective is durably retained
      And the retained retrospective contains the first envelope's canonical bytes unchanged

    Scenario: A current envelope round-trips through the real collector
      Given the real retro CLI prepares a canonical v1 envelope whose model is exactly 256 UTF-8 bytes and whose repository, agent version, and operating-system family are present
      When the real public collector accepts and an operator reads the retrospective
      Then the operator receives the prepared canonical bytes unchanged

  @retro-runtime-context.TBU1.R1 @surface.safeword-cli
  Rule: retro-runtime-context.TBU1.R1 — Runtime context contains only explicitly allowlisted facts and never transcript, source, machine, or arbitrary environment content

    Scenario: Available approved facts form the complete current source profile
      Given the runtime supplies harness "codex", host class "unknown", project identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", SafeWord CLI version "0.79.6", repository "github.com/arcadeai/safeword", agent version "agent-1.2.3", model "model-fixture", SafeWord plugin version "0.80.1", and operating-system family "darwin"
      And unapproved inputs contain transcript sentinel "transcript-private-9f2c", source-code sentinel "source-private-9f2c", command-argument sentinel "argv-private-9f2c", hostname sentinel "host-private-9f2c", credential sentinel "secret-private-9f2c", arbitrary environment sentinel "env-private-9f2c", and `GITHUB_ACTOR` sentinel "actor-private-9f2c"
      When SafeWord prepares its public retrospective
      Then its source contains exactly harness "codex", host class "unknown", project identity "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", SafeWord CLI version "0.79.6", repository "github.com/arcadeai/safeword", agent version "agent-1.2.3", model "model-fixture", SafeWord plugin version "0.80.1", and operating-system family "darwin"
      And none of "transcript-private-9f2c", "source-private-9f2c", "argv-private-9f2c", "host-private-9f2c", "secret-private-9f2c", "env-private-9f2c", or "actor-private-9f2c" appears in the envelope

    Scenario Outline: Representative direct optional string boundaries are enforced independently
      Given directly supplied optional source field <field> contains <value>
      And every other approved optional source field contains a valid distinct fixture value
      When SafeWord prepares its public retrospective
      Then the optional source field is <outcome> with its exact supplied value when retained
      And every other approved optional source field retains its exact fixture value

      Examples:
        | field                       | value                                                    | outcome  |
        | model                       | 128 copies of `é` totaling 256 UTF-8 bytes               | retained |
        | model                       | `a` followed by 128 copies of `é`, totaling 257 UTF-8 bytes | omitted  |
        | model                       | string containing U+0007                                 | omitted  |
        | agent version               | string containing U+0085                                 | omitted  |
        | operating-system family     | string containing U+0007                                 | omitted  |

    Scenario Outline: Derived optional string boundaries are enforced on authoritative inputs
      Given the Git origin is a `gitlab.com` remote whose canonical host-and-path identity totals <bytes> UTF-8 bytes
      And the supported package signal reports a SafeWord plugin version totaling <bytes> UTF-8 bytes
      When SafeWord prepares its public retrospective
      Then repository and SafeWord plugin version are <outcome>

      Examples:
        | bytes | outcome  |
        | 256   | retained |
        | 257   | omitted  |

    Scenario Outline: Supported repository remotes are canonicalized without credentials
      Given the Git origin is <remote>
      When SafeWord prepares its public retrospective
      Then repository is `github.com/arcadeai/safeword`
      And neither `creduser-9f2c` nor `credsecret-9f2c` appears in the envelope
      And retro preparation spawns no subprocess and makes no outbound request other than the public collector submission

      Examples:
        | remote |
        | https://creduser-9f2c:credsecret-9f2c@GitHub.com/ArcadeAI/safeword.git |
        | git@GitHub.com:ArcadeAI/safeword.git |

    Scenario: A supported non-GitHub remote preserves its public host and path
      Given the Git origin is `https://GitLab.com/Team/Repo.git`
      When SafeWord prepares its public retrospective
      Then repository is `gitlab.com/Team/Repo`

    Scenario Outline: Unsupported repository identity is omitted
      Given the Git origin is <unsupported_remote>
      When SafeWord prepares its public retrospective
      Then repository is omitted
      And <forbidden_sentinel> does not appear anywhere in the envelope

      Examples:
        | unsupported_remote                          | forbidden_sentinel        |
        | /Users/retro-path-private-9f2c/repo         | retro-path-private-9f2c   |
        | file:///Users/file-path-private-9f2c/repo   | file-path-private-9f2c    |
        | https://git-private-9f2c.internal.example/team/repo.git | git-private-9f2c |
        | https://github.com.attacker-9f2c.test/team/repo.git | attacker-9f2c |
        | https://evil-github-9f2c.com/team/repo.git  | evil-github-9f2c          |
        | https://gist.github.com/team/repo.git       | gist.github.com           |
        | not-a-remote-private-9f2c                  | not-a-remote-private-9f2c |

    Scenario Outline: Unavailable optional context produces a minimal source
      Given all optional runtime facts are <availability>
      When SafeWord prepares its public retrospective
      Then its source contains only harness, host class, project identity, and SafeWord CLI version

      Examples:
        | availability    |
        | absent          |
        | empty           |
        | whitespace-only |

    Scenario: Git email is not public runtime context
      Given Git configuration contains email address "private@example.test"
      When SafeWord prepares its public retrospective
      Then "private@example.test" does not appear anywhere in the envelope
      And retro preparation spawns no subprocess and makes no outbound request other than the public collector submission

  @retro-runtime-context.NTB1.R1 @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.cursor @surface.railway-public-retro-collector
  Rule: retro-runtime-context.NTB1.R1 — Context discovery never disrupts the user or existing recovery

    @rejection
    Scenario Outline: Invalid configured project identity keeps existing recovery behavior
      Given a Codex retrospective otherwise ready for public delivery whose configured project identity is <identity_state>
      And existing recovery owns retrospective candidate "candidate-fixture"
      When the existing retro CLI delivery boundary runs
      Then no public submission is attempted
      And existing recovery still owns exactly retrospective candidate "candidate-fixture"
      And the command exits successfully with empty stdout and stderr

      Examples:
        | identity_state |
        | absent         |
        | "not-a-uuid"   |

    Scenario: Context discovery failure cannot disrupt retro delivery
      Given a sanitized Cursor retrospective with a runnable public route and repository discovery fails
      When the existing retro CLI delivery boundary runs
      Then exactly one public retrospective is accepted with required source facts and no repository, model, or agent version
      And existing private recovery still completes successfully

    Scenario: One unavailable enrichment preserves the other optional context
      Given a sanitized retrospective with every required source fact and a runnable public route whose model signal is unavailable
      And repository "github.com/arcadeai/safeword", agent version "agent-1.2.3", and operating-system family "darwin" are available
      When the existing retro CLI delivery boundary runs
      Then exactly one public retrospective is accepted without model
      And repository remains "github.com/arcadeai/safeword", agent version remains "agent-1.2.3", and operating-system family remains "darwin"
      And existing private recovery still completes successfully

    Scenario: Disabled Cursor public retros do not disclose runtime context
      Given a sanitized Cursor retrospective with every required source fact and a runnable public carrier whose approved runtime facts contain distinct sentinels
      And public retrospective delivery is disabled for the project
      And existing recovery owns retrospective candidate "candidate-fixture"
      When the existing retro CLI delivery boundary runs
      Then no public submission is attempted
      And existing recovery still owns exactly retrospective candidate "candidate-fixture"
      And none of the runtime-fact sentinels appears in produced output or artifacts
      And the command exits successfully with empty stdout and stderr

    Scenario: A runtime without a runnable public carrier keeps existing recovery behavior
      Given a sanitized retrospective with every required source fact is produced where the public carrier cannot run
      And existing recovery owns retrospective candidate "candidate-fixture"
      When the existing retro completion boundary finishes
      Then no public submission is attempted
      And existing recovery still owns exactly retrospective candidate "candidate-fixture"
      And the boundary exits successfully with empty stdout and stderr

    @rejection
    Scenario: Claude Remote evidence keeps existing recovery behavior
      Given a Claude Code retrospective with every required source fact and a runnable public carrier
      And `CLAUDE_CODE_REMOTE_SESSION_ID` is present
      And existing recovery owns retrospective candidate "candidate-fixture"
      When the existing retro CLI delivery boundary runs
      Then no public submission is attempted
      And existing recovery still owns exactly retrospective candidate "candidate-fixture"
      And the command exits successfully with empty stdout and stderr

    Scenario Outline: Claude Remote evidence does not suppress other harnesses
      Given a <harness> retrospective with every required source fact and a runnable public route
      And <environment_evidence>
      When the existing retro CLI delivery boundary runs
      Then exactly one public submission reaches the real collector
      And its source host class is <host_class>
      And the command exits successfully with empty stdout and stderr

      Examples:
        | harness      | environment_evidence                         | host_class |
        | OpenAI Codex | `CLAUDE_CODE_REMOTE_SESSION_ID` is present    | `unknown`  |
        | Cursor       | `CLAUDE_CODE_REMOTE_SESSION_ID` is present    | `unknown`  |

    Scenario: Missing Cursor conversation identity keeps existing recovery behavior
      Given a Cursor retrospective with every required source fact and a runnable public carrier has no conversation identity
      And existing recovery owns retrospective candidate "candidate-fixture"
      When the existing retro CLI delivery boundary runs
      Then no public submission is attempted
      And existing recovery still owns exactly retrospective candidate "candidate-fixture"
      And the command exits successfully with empty stdout and stderr

    Scenario: Collector rejection keeps existing recovery behavior
      Given a sanitized retrospective with every required source fact and a runnable public route, and an injected collector transport that returns a rejection
      And existing recovery owns retrospective candidate "candidate-fixture"
      When the existing retro CLI delivery boundary runs
      Then exactly one public submission reaches the injected collector transport
      And no retrospective is durably retained
      And existing recovery still owns exactly retrospective candidate "candidate-fixture"
      And the command exits successfully with empty stdout and stderr

    Scenario Outline: Collector transport failure keeps existing recovery behavior
      Given a sanitized retrospective with every required source fact and a runnable public route
      And an injected collector transport that <transport_failure>
      And existing recovery owns retrospective candidate "candidate-fixture"
      When the existing retro CLI delivery boundary runs
      Then exactly one public submission reaches the injected collector transport
      And no retrospective is durably retained
      And existing recovery still owns exactly retrospective candidate "candidate-fixture"
      And the command exits successfully with empty stdout and stderr
      And no new worker or retry boundary is used

      Examples:
        | transport_failure |
        | raises a connection error |
        | is held open past the injected existing handoff deadline |
