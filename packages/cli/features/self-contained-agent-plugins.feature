Feature: Every agent delivery is self-contained
  Every supported agent executes its advertised workflows from one declared
  runtime authority while project reconciliation remains bounded to enrollment,
  authored knowledge, runtime state, and selected-host assets.

  @self-contained-plugins.TBU1.R1
  Rule: self-contained-plugins.TBU1.R1 — every advertised agent workflow executes from its one declared runtime authority without borrowing another delivery

    @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A plugin-backed agent executes quality review in a runtime-free enrolled project
      Given an enrolled project has no project-local Safeword hooks, skills, or scripts
      And the <host> plugin advertises the quality-review workflow
      When the Technical Builder invokes that workflow through <host>
      Then the workflow returns its quality-review result successfully
      And its resolved executable path is inside the installed <host> plugin root

      Examples:
        | host        |
        | Codex       |
        | Claude Code |
        | OpenCode    |

    @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A plugin-backed agent ignores a complete legacy project runtime
      Given an enrolled project contains a complete legacy project-local Safeword runtime
      And the <host> plugin is installed
      When the Technical Builder invokes the quality-review workflow through <host>
      Then its resolved executable path is inside the installed <host> plugin root
      And no project-local executable is executed

      Examples:
        | host        |
        | Codex       |
        | Claude Code |
        | OpenCode    |

    @surface.openai-codex
    Scenario: A packaged audit helper preserves its shared-shell contract
      Given a plugin-backed audit workflow uses the packaged audit-scope helper
      When the workflow initializes audit scope from that helper
      Then the caller shell retains the computed audit mode, base SHA, and changed-file scope
      And the helper path and version belong to the installed Codex plugin distribution

    @surface.cursor
    Scenario: Cursor executes from its selected project authority without another host
      Given an enrolled project selects Cursor and no other agent delivery
      And Cursor's declared project-local runtime is complete
      When the Technical Builder invokes a Safeword workflow through Cursor
      Then the workflow returns its expected result from Cursor's declared project authority
      And its resolved executable path is inside Cursor's declared project-local authority root

    @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Mixed hosts execute only from their own declared authority
      Given an enrolled project selects <invoked host> and <other host> and both deliveries are present
      When the Technical Builder invokes a workflow through <invoked host>
      Then its resolved executable path is inside <authority root>
      And no executable owned by <other host> is executed

      Examples:
        | invoked host | authority root                                  | other host  |
        | Cursor       | Cursor's declared project-local authority root | Codex       |
        | Cursor       | Cursor's declared project-local authority root | Claude Code |
        | Cursor       | Cursor's declared project-local authority root | OpenCode    |
        | Codex        | the installed Codex plugin root                | Cursor      |
        | Claude Code  | the installed Claude Code plugin root          | Cursor      |
        | OpenCode     | the installed OpenCode plugin root             | Cursor      |
        | Codex        | the installed Codex plugin root                | Claude Code |
        | Codex        | the installed Codex plugin root                | OpenCode    |
        | Claude Code  | the installed Claude Code plugin root          | Codex       |
        | Claude Code  | the installed Claude Code plugin root          | OpenCode    |
        | OpenCode     | the installed OpenCode plugin root             | Codex       |
        | OpenCode     | the installed OpenCode plugin root             | Claude Code |

    @rejection @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: An incomplete agent authority fails in a bounded way for every host
      Given <host>'s advertised workflow lacks an executable capability from its declared authority
      When the Technical Builder invokes that workflow through <host>
      Then the failure names the missing capability
      And no review or audit output artifact is written
      And no project installation, upgrade, or unrelated dependency change is proposed

      Examples:
        | host        |
        | Codex       |
        | Claude Code |
        | OpenCode    |
        | Cursor      |

  @self-contained-plugins.TBU1.R2
  Rule: self-contained-plugins.TBU1.R2 — invoking an agent workflow never requires a broader installation solely to recover executable code already owned by its delivery authority

    @surface.openai-codex
    Scenario: Codex audit does not escalate a missing project helper into installation
      Given an enrolled monorepo has the Codex plugin and no project-local audit helper
      When the Technical Builder invokes the Codex audit workflow
      Then the packaged audit helper returns the audit findings
      And the workflow proposes no Safeword installation or workspace dependency changes

    @rejection @surface.claude-code
    Scenario: Claude rejects installer escalation as plugin capability recovery
      Given a Claude plugin workflow is missing an executable capability from its distribution
      And the enrolled project contains a project-local copy of that capability
      When the workflow determines its recovery action
      Then it reports recovery scoped to the missing Claude plugin capability
      And it neither runs the project-local copy nor directs the builder to install or upgrade Safeword

  @self-contained-plugins.TBU1.R3
  Rule: self-contained-plugins.TBU1.R3 — agent execution reads enrolled project knowledge and writes project workflow state without turning either into a second runtime distribution

    @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Every host adapter enforces the enrollment boundary for lifecycle state
      Given a <enrollment> project uses <host>'s declared delivery authority and lacks framework-owned session state
      When <host> dispatches its session-start lifecycle event through its real host adapter
      Then <state outcome>
      And no executable runtime file is written to the project

      Examples:
        | host        | enrollment | state outcome                                                      |
        | Codex       | enrolled   | the declared session state is created at the framework-owned path  |
        | Claude Code | enrolled   | the declared session state is created at the framework-owned path  |
        | OpenCode    | enrolled   | the declared session state is created at the framework-owned path  |
        | Cursor      | enrolled   | the declared session state is created at the framework-owned path  |
        | Codex       | unenrolled | the session continues without creating knowledge, config, or state |
        | Claude Code | unenrolled | the session continues without creating knowledge, config, or state |
        | OpenCode    | unenrolled | the session continues without creating knowledge, config, or state |
        | Cursor      | unenrolled | the session continues without creating knowledge, config, or state |

    @shared-project-state
    Scenario: An agent workflow uses project knowledge without project executable files
      Given an enrolled project contains authored principles and no project-local Safeword executable runtime
      When the selected agent workflow resolves project knowledge
      Then it resolves and returns the principles from the enrolled project's authored knowledge path
      And no project-local executable is resolved during the lookup

    @shared-project-state
    Scenario: An enrolled lifecycle event performs its declared state effect
      Given an enrolled project is missing framework-owned session state
      When a plugin lifecycle event runs in that repository
      Then the lifecycle event creates its declared session state and the agent session continues
      And no executable runtime file is written to the project

    @shared-project-state
    Scenario: An unenrolled repository does not gain invented project knowledge or state
      Given a repository has a Safeword agent delivery but no Safeword enrollment
      When a plugin lifecycle event runs in that repository
      Then the lifecycle event completes without error and the agent session continues
      And no project knowledge, configuration, or workflow state is created

    @rejection @shared-project-state
    Scenario: A workflow invocation does not silently enroll a repository
      Given a repository has a Safeword agent delivery and no Safeword enrollment
      When the Technical Builder invokes an advertised agent workflow
      Then the workflow reports that the repository is not enrolled and gives a concrete enrollment action
      And no enrollment marker, project knowledge, configuration, runtime state, or ignore rule is created

    @rejection @shared-project-state
    Scenario: Malformed enrollment is preserved rather than repaired as runtime state
      Given a repository has unreadable or malformed authored Safeword enrollment
      When an agent workflow attempts to resolve project knowledge
      Then the workflow reports the malformed enrollment and a concrete repair action
      And the authored enrollment remains unchanged and no replacement knowledge or state is created

    @rejection @shared-project-state
    Scenario: Missing authored knowledge is not invented during lazy state initialization
      Given an enrolled project lacks both a required authored knowledge artifact and framework-owned runtime state
      When the selected agent workflow starts and requires both artifacts
      Then the framework-owned runtime state is created
      And no authored knowledge or configuration file is created
      And the workflow reports the missing authored artifact and a concrete authoring action

  @self-contained-plugins.TBU1.R4
  Rule: self-contained-plugins.TBU1.R4 — a workflow creates its missing framework-owned runtime state on demand without requiring an install or upgrade

    @shared-project-state @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Every host initializes a missing state file and parent directory
      Given an enrolled project using <host> lacks a durable framework-owned runtime state file and its parent directory
      When the Technical Builder invokes the workflow through <host>'s real entry point and it first needs that state
      Then the workflow creates the missing parent directory and required state file
      And it continues without installation

      Examples:
        | host        |
        | Codex       |
        | Claude Code |
        | OpenCode    |
        | Cursor      |

    @shared-project-state
    Scenario: Existing runtime state is reopened without replacement
      Given an enrolled project already has framework-owned runtime state containing prior session content
      When the selected agent workflow next needs that state
      Then the pre-existing state content remains byte-for-byte unchanged
      And no state file is recreated

    @rejection @shared-project-state
    Scenario: An unwritable state path does not escalate to lifecycle installation
      Given an enrolled project's required runtime state path cannot be written
      When the selected agent workflow first needs that state
      Then the workflow reports the unwritable state path as the failed operation
      And it does not direct the Technical Builder to install or upgrade Safeword

  @self-contained-plugins.TBU1.R5
  Rule: self-contained-plugins.TBU1.R5 — lazy initialization adds any required narrow gitignore rule idempotently while preserving existing project ignore content

    @shared-project-state @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Every host adds one precise ignore rule on first state initialization
      Given an enrolled project using <host> lacks transient runtime state and its precise ignore rule
      When the Technical Builder invokes the workflow through <host>'s real entry point and it initializes that state
      Then the project ignore file gains exactly one rule matching only that transient state path
      And no durable or authored Safeword path gains an ignore rule

      Examples:
        | host        |
        | Codex       |
        | Claude Code |
        | OpenCode    |
        | Cursor      |

    @shared-project-state
    Scenario: First state initialization creates a missing project ignore file
      Given an enrolled project lacks transient runtime state and has no project ignore file
      When the selected agent workflow initializes that state
      Then it creates the project ignore file with exactly the precise transient-state rule

    @shared-project-state
    Scenario: State initialization appends a precise rule without replacing customer ignore content
      Given an enrolled project's ignore file holds unrelated customer content and no transient-state rule
      When the selected agent workflow initializes that state
      Then the pre-existing ignore lines remain unchanged
      And exactly one rule for the transient state path is appended

    @shared-project-state
    Scenario Outline: Repeated state access does not duplicate or broaden ignore policy
      Given an enrolled project already has the precise transient-state ignore rule and unrelated ignore content
      When the plugin workflow <state access>
      Then the ignore file remains byte-for-byte unchanged
      And the transient state exists and the workflow continues without installation

      Examples:
        | state access             |
        | re-initializes the state |
        | reopens the existing state |

    @shared-project-state
    Scenario: A broader customer ignore rule is preserved without adding a narrower duplicate
      Given an enrolled project's existing customer ignore rule already covers the transient state path
      When a plugin workflow initializes that state
      Then the ignore file remains byte-for-byte unchanged
      And the transient state is created and the workflow continues without installation

    @rejection @shared-project-state
    Scenario: An unwritable ignore file prevents unignored transient state
      Given an enrolled project requires a transient-state rule but its ignore file cannot be written
      When the selected agent workflow initializes that state
      Then the transient state file is not created
      And the workflow reports the exact ignore path and a concrete recovery action

    @shared-project-state @surface.safeword-cli
    Scenario: Reconciliation preserves lazily initialized state policy
      Given an enrolled project's workflow already created its transient state and precise ignore rule
      When the maintainer previews and applies the same agent selection
      Then the ignore file remains byte-for-byte unchanged
      And the plan proposes no transient-state effects

  @self-contained-plugins.NTB1.R1
  Rule: self-contained-plugins.NTB1.R1 — selecting one agent never proposes another agent's files, skills, hooks, configuration, or dependencies

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: A single-agent plan contains no other agent delivery
      Given an uninitialized project selects only <agent>
      When the Non-Technical Builder previews Safeword installation
      Then the plan contains <agent>'s declared delivery and no unselected agent files, configuration, skills, hooks, or dependencies

      Examples:
        | agent       |
        | Codex       |
        | Claude Code |
        | OpenCode    |
        | Cursor      |

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A plugin-backed agent plan contains no project runtime copy
      Given an uninitialized project selects only <agent>
      When the Non-Technical Builder previews Safeword installation
      Then the plan contains <agent>'s plugin delivery
      And it contains no project-local executable runtime for <agent>

      Examples:
        | agent       |
        | Codex       |
        | Claude Code |
        | OpenCode    |

    @rejection @surface.safeword-cli
    Scenario: An unselected host asset makes a single-agent plan invalid
      Given an uninitialized project selects only one supported agent
      And its delivery catalogue declares an asset under another agent's owner
      When the Non-Technical Builder previews Safeword installation
      Then Safeword refuses the plan before changing any files
      And it names a concrete catalogue-repair action

  @self-contained-plugins.NTB1.R2
  Rule: self-contained-plugins.NTB1.R2 — an installation plan distinguishes the minimal shared project substrate from selected-agent delivery and optional workflow tooling, and explains why each effect is required

    @surface.safeword-cli
    Scenario: A native-plugin plan classifies every project effect by owner
      Given an uninitialized project selects a native agent plugin and optional workflow tooling
      When the Non-Technical Builder previews Safeword installation
      Then the enrollment effect is explained as needed by every selected agent
      And the plugin delivery effect is explained as already supplied for the selected agent
      And the workflow tooling effect is explained as safe to decline
      And every effect carries one concrete next action
      And no effect explanation uses executable runtime, shared substrate, authored state, durable state, transient state, host-specific asset, or optional tooling as user-facing labels

    @surface.safeword-cli
    Scenario: Declining optional workflow tooling produces no tooling effects
      Given an uninitialized project selects a native agent plugin and declines optional workflow tooling
      When the Non-Technical Builder previews Safeword installation
      Then the plan contains the selected agent's delivery and enrollment effect
      And it proposes no development dependency, lint, or BDD tooling changes in any workspace

    @surface.safeword-cli
    Scenario: A monorepo plan excludes unrelated language-tool fan-out
      Given an uninitialized monorepo contains many independently managed language workspaces
      And optional workflow tooling is selected for one declared workspace
      When the Non-Technical Builder previews installation for only Codex
      Then the plan proposes the declared tooling change only in that workspace
      And it proposes no development dependency changes in the unrelated workspaces

  @self-contained-plugins.NTB1.R3
  Rule: self-contained-plugins.NTB1.R3 — a single missing plugin capability fails with one bounded recovery action rather than expanding into repository-wide setup

    @surface.openai-codex
    Scenario: Missing packaged audit support reports one capability recovery
      Given Codex advertises audit but its packaged audit capability is unavailable
      When the Non-Technical Builder invokes audit
      Then recovery names the unavailable Codex audit capability
      And it proposes no Safeword installation, upgrade, or workspace dependency change

    @rejection @surface.openai-codex
    Scenario: Capability recovery cannot invoke the full project installer
      Given the selected agent workflow cannot execute one capability from its declared authority
      When the Non-Technical Builder invokes that workflow through its host
      Then plain-language recovery names that missing capability without invoking project install or adding unrelated project assets

  @self-contained-plugins.NTB1.R4
  Rule: self-contained-plugins.NTB1.R4 — automatic state initialization is silent when successful and names the exact state path and recovery when it cannot be created

    @shared-project-state
    Scenario: Successful state initialization does not interrupt the workflow
      Given the selected agent workflow can create its missing framework-owned state
      When the workflow initializes that state
      Then the required state exists afterward
      And the workflow returns its normal result without any setup prompt or setup message

    @rejection @shared-project-state
    Scenario: Failed state initialization does not masquerade as missing installation
      Given the Non-Technical Builder's selected agent workflow cannot create its required framework-owned state
      When the selected agent workflow first needs that state
      Then it names the exact state path and a plain-language state-specific recovery rather than installation as the failed operation

  @self-contained-plugins.SWM1.R1
  Rule: self-contained-plugins.SWM1.R1 — each host's delivery contract explicitly classifies executable runtime, shared project substrate, authored state, and host-specific assets

    @surface.safeword-cli
    Scenario Outline: Managed assets use their required lifecycle class
      Given Safeword's delivery catalogue contains a managed <asset>
      When the maintainer validates the delivery contract
      Then that asset is classified as <lifecycle class>

      Examples:
        | asset                      | lifecycle class     |
        | Codex packaged audit helper | executable runtime  |
        | .safeword enrollment marker | shared substrate    |
        | configured principles file  | authored state      |
        | persisted ticket index      | durable state       |
        | review-session state file   | transient state     |
        | Cursor workflow adapter     | host-specific asset |
        | selected BDD tooling        | optional tooling    |

    @surface.safeword-cli
    Scenario: Every managed asset has exactly one lifecycle class
      Given Safeword's delivery catalogue contains native and project assets
      When the maintainer validates the delivery contract
      Then validation passes with every managed asset reported under exactly one lifecycle ownership class

    @rejection @surface.safeword-cli
    Scenario: An unclassified executable asset fails contract validation
      Given a workflow references an executable asset absent from the delivery contract
      When the maintainer validates the delivery contract
      Then validation rejects the unclassified executable reference

    @rejection @surface.safeword-cli
    Scenario: An asset with two lifecycle classes fails contract validation
      Given the delivery catalogue declares one managed asset under two lifecycle ownership classes
      When the maintainer validates the delivery contract
      Then validation rejects the multiply classified asset and names both classes

  @self-contained-plugins.SWM1.R2
  Rule: self-contained-plugins.SWM1.R2 — selecting multiple agents produces the union of their declared requirements without duplicate runtime authorities or order-dependent output

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Every mixed-agent selection produces an order-independent plan
      Given a project selects <agents>
      When the maintainer previews that selection in forward and reverse order
      Then each plan contains the selected agents' declared effects
      And both plans are byte-for-byte identical, including effect ordering

      Examples:
        | agents                                  |
        | Codex and Claude Code                   |
        | Codex and OpenCode                      |
        | Codex and Cursor                        |
        | Claude Code and OpenCode                |
        | Claude Code and Cursor                  |
        | OpenCode and Cursor                     |
        | Codex, Claude Code, OpenCode, and Cursor |

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Every mixed-agent selection contains the complete authority union
      Given a project selects <agents>
      When the maintainer previews that selection
      Then the plan contains exactly the union of those agents' declared effects with one authority per agent

      Examples:
        | agents                                  |
        | Codex and Claude Code                   |
        | Codex and OpenCode                      |
        | Codex and Cursor                        |
        | Claude Code and OpenCode                |
        | Claude Code and Cursor                  |
        | OpenCode and Cursor                     |
        | Codex, Claude Code, OpenCode, and Cursor |

    @rejection @surface.safeword-cli @surface.cursor
    Scenario: Mixed selection cannot duplicate or replace Cursor's authority
      Given a project selects a plugin-backed agent and Cursor together
      When the maintainer previews Safeword installation
      Then the plan retains Cursor's declared project-local assets without adding plugin-runtime copies to the project

    @surface.safeword-cli
    Scenario: Repeated reconciliation has no additional effects
      Given a selected-agent plan has been installed and reconciled successfully
      When the maintainer previews the same selection again
      Then the second plan proposes no effects

  @self-contained-plugins.SWM1.R3
  Rule: self-contained-plugins.SWM1.R3 — release and parity checks reject any agent workflow that references an executable outside its declared runtime authority

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario: Complete agent catalogues pass executable-reference validation
      Given every supported agent workflow resolves executables from its declared runtime authority
      When the maintainer runs release and parity validation
      Then executable-reference validation passes for Codex, Claude Code, OpenCode, and Cursor

    @rejection @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario: A cross-authority executable reference blocks release
      Given an agent workflow references an executable owned by another runtime authority
      When the maintainer runs release and parity validation
      Then validation fails and names the workflow, reference, and owning authorities

    @rejection @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario: A plugin executable version mismatch blocks release
      Given a packaged agent workflow invokes an executable version different from its declared plugin version
      When the maintainer runs release and parity validation
      Then validation fails and names the workflow and mismatched versions

  @self-contained-plugins.SWM1.R4
  Rule: self-contained-plugins.SWM1.R4 — upgrades and uninstalls remove only proven host-owned runtime while preserving authored, ambiguous, and other selected-host content

    @surface.safeword-cli @surface.openai-codex @surface.claude-code
    Scenario: Proven plugins retire recognized obsolete project runtime
      Given an enrolled project has a proven replacement plugin and recognized unedited legacy runtime copies
      When the maintainer upgrades Safeword for that host
      Then the recognized obsolete runtime copies are no longer present
      And no other project content is removed

    @surface.safeword-cli @surface.cursor @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario: Plugin cleanup preserves selected Cursor delivery
      Given an enrolled project selects Cursor alongside a plugin-backed host with a proven replacement plugin
      When the maintainer upgrades Safeword
      Then Cursor's declared project-local delivery is preserved and only the plugin-backed host's obsolete copies are removed

    @surface.safeword-cli @surface.cursor @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario: Uninstall removes only the selected host's owned delivery
      Given an enrolled project selects Cursor alongside a plugin-backed host and contains authored project content and durable framework state
      When the maintainer uninstalls the plugin-backed host
      Then Cursor's declared project-local delivery and all authored project content remain unchanged
      And the enrollment marker and durable framework state remain byte-for-byte unchanged
      And Cursor still resolves the project as enrolled
      And the uninstalled host's exclusively owned assets are no longer present

    @rejection @surface.safeword-cli
    Scenario Outline: Unsafe legacy cleanup remains blocked
      Given an enrolled project has <legacy condition>
      When the maintainer upgrades Safeword for that host
      Then the legacy content is preserved and the plan names why cleanup is unsafe

      Examples:
        | legacy condition                         |
        | no proven replacement plugin             |
        | edited or ambiguously owned legacy files |
