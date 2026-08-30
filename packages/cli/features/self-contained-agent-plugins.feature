Feature: Every agent delivery is self-contained
  Supported agents execute Safeword workflows from one declared authority,
  while shared project substrate means only enrollment, authored knowledge,
  selected-host assets, and lazily initialized framework state.

  @self-contained-plugins.TBU1.R1
  Rule: self-contained-plugins.TBU1.R1 — Native plugin workflows do not borrow project or cross-host runtime

    @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A native agent selection resolves its profile entry point
      Given a project selects only <agent>
      When the Technical Builder previews project reconciliation
      Then the plan reports the <agent> profile as the workflow entry point

      Examples:
        | agent       |
        | Codex       |
        | Claude Code |
        | OpenCode    |

    @surface.cursor
    Scenario: Cursor retains its complete selected project authority
      Given a project selects only Cursor
      When the Technical Builder previews project reconciliation
      Then the plan contains Cursor's declared project hooks, rules, commands, and skills
      And it contains no Claude Code, Codex, or OpenCode project delivery

    @surface.openai-codex
    Scenario: A packaged shared-shell helper executes without project runtime
      Given an enrolled feature branch has a known merge base and two changed files
      And the project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder sources the packaged Codex audit-scope command
      Then the caller shell receives diff mode and the known merge-base SHA
      And the caller shell receives exactly the two changed files
      And no project installation or dependency change is proposed

    @surface.openai-codex
    Scenario Outline: Legacy project runtime cannot regain native workflow authority
      Given an enrolled project contains <legacy runtime> and authored project knowledge
      When the Technical Builder invokes the packaged Codex audit workflow
      Then the audit result names the pinned Codex plugin package as its entry point
      And the authored project knowledge remains unchanged
      And no broader installation is proposed

      Examples:
        | legacy runtime                 |
        | a complete legacy runtime      |
        | a partially missing runtime    |

    @surface.opencode
    Scenario: OpenCode owns its full workflow catalogue in the profile
      Given an OpenCode profile has no Safeword catalogue
      When the Technical Builder installs Safeword with OpenCode selected
      Then the OpenCode profile holds the complete generated command, agent, skill, and reference catalogue
      And the project receives no OpenCode or Claude compatibility catalogue

    @surface.claude-code
    Scenario: A packaged Claude workflow executes without project runtime
      Given an enrolled project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder invokes a generated Claude workflow through the plugin
      Then the workflow loads its packaged skill and reference material
      And no project installation or cross-host runtime is requested

  @self-contained-plugins.TBU1.R2
  Rule: self-contained-plugins.TBU1.R2 — Missing framework state initializes lazily after explicit enrollment

    @shared-project-state @surface.safeword-cli
    Scenario: First workflow state write creates its missing parent and precise ignore rule before state
      Given an enrolled project lacks the framework state directory, transient state file, and project ignore file
      When a state-writing packaged workflow first writes framework-owned state
      Then the framework state directory and project ignore file are created
      And the state path is already ignored when the transient state write begins
      And the project ignore file contains only the precise state rule
      And the transient state file is created without installing Safeword

    @shared-project-state @surface.safeword-cli
    Scenario: Lazy state initialization preserves customer ignore policy
      Given an enrolled project ignore file contains unrelated customer content
      When a Safeword workflow first writes framework-owned state
      Then the customer content remains byte-for-byte unchanged
      And one precise state rule is appended

    @shared-project-state @surface.safeword-cli
    Scenario Outline: Existing effective ignore policy is not duplicated
      Given an enrolled project's ignore policy covers transient state with <coverage>
      When a Safeword workflow first writes framework-owned state
      Then the ignore file remains byte-for-byte unchanged
      And the transient state is created

      Examples:
        | coverage                |
        | the exact state rule    |
        | a broader customer rule |

    @shared-project-state @surface.safeword-cli
    Scenario: Existing framework state is updated without reinitialization
      Given an enrolled project's framework state contains in-flight workflow values
      And its ignore policy already covers the state file
      When a state-writing packaged workflow updates framework-owned state
      Then the newly written workflow value is readable from framework state
      And the in-flight workflow values are preserved
      And the ignore file remains byte-for-byte unchanged

    @rejection @shared-project-state @surface.safeword-cli
    Scenario Outline: Lifecycle state respects explicit enrollment
      Given a repository with a profile plugin is <enrollment>
      When a Safeword lifecycle event observes project activity
      Then <state outcome>

      Examples:
        | enrollment | state outcome                                                        |
        | enrolled   | its precise ignore rule and framework state are created               |
        | unenrolled | no project knowledge, ignore policy, or framework state is created   |

    @rejection @shared-project-state @surface.safeword-cli
    Scenario: A direct workflow does not silently enroll a repository
      Given a repository has no Safeword enrollment marker
      When the Technical Builder invokes a state-writing packaged workflow
      Then the workflow reports that explicit enrollment is required
      And the workflow exits successfully and the agent session continues
      And no project namespace or executable runtime is created

  @self-contained-plugins.NTB1.R1
  Rule: self-contained-plugins.NTB1.R1 — Project reconciliation is bounded to selected delivery authorities

    @surface.safeword-cli
    Scenario Outline: A native single-agent project schema excludes project delivery
      Given an uninitialized project selects only <agent>
      When the Non-Technical Builder previews Safeword installation
      Then the installation plan includes the <agent> profile delivery
      And the project schema contains shared substrate and no project-delivered workflow authority

      Examples:
        | agent       |
        | Codex       |
        | Claude Code |
        | OpenCode    |

    @surface.safeword-cli @surface.cursor
    Scenario: A Cursor-only project schema retains Cursor authority
      Given an uninitialized project selects only Cursor
      When the Non-Technical Builder previews Safeword installation
      Then the project schema contains shared substrate and Cursor's project authority

    @surface.safeword-cli @surface.cursor
    Scenario Outline: Mixed selection preserves Cursor without copying native runtimes
      Given a project selects Cursor and <native agent>
      When the Non-Technical Builder reconciles the project
      Then Cursor's project authority remains present
      And no native profile runtime is copied into the project

      Examples:
        | native agent |
        | Codex        |
        | Claude Code  |
        | OpenCode     |

    @surface.safeword-cli
    Scenario: Removing a native selection preserves Cursor and project content
      Given an enrolled project contains Cursor delivery, an obsolete Codex runtime copy, authored knowledge, and unrelated content
      When the Non-Technical Builder uninstalls only Codex
      Then the obsolete Codex runtime copy is removed from the project plan
      And Cursor's project hooks, rules, commands, and skills remain present
      And authored knowledge, enrollment state, and unrelated content remain unchanged

  @self-contained-plugins.SWM1.R1
  Rule: self-contained-plugins.SWM1.R1 — Package and profile ownership is enforced at release and reconciliation boundaries

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario: Complete native catalogues pass executable-reference validation
      Given generated Codex, Claude Code, and OpenCode catalogues use their packaged authorities
      When the maintainer runs release validation
      Then all three catalogues pass runtime-authority validation
      And Codex helper invocations name the pinned plugin package version

    @surface.opencode
    Scenario: OpenCode profile identity records the complete owned catalogue
      Given Safeword generates the OpenCode plugin, commands, agents, and skills
      When Safeword installs the profile delivery
      Then the profile identity records every owned catalogue asset and digest

    @rejection @surface.safeword-cli
    Scenario: A project-runtime reference blocks native plugin release
      Given a native catalogue contains a project-local executable reference
      When the maintainer validates its runtime authority
      Then validation fails and names the offending catalogue asset

    @surface.opencode
    Scenario: OpenCode upgrade removes only prior identity-owned catalogue bytes
      Given an OpenCode profile contains the previously recorded catalogue
      When Safeword upgrades the profile delivery
      Then prior identity-owned assets are replaced by the current catalogue
      And unrelated profile content remains unchanged

    @surface.opencode
    Scenario: OpenCode uninstall removes its recognized catalogue
      Given an OpenCode profile contains an unchanged identity-owned catalogue
      When Safeword uninstalls the OpenCode profile delivery
      Then every identity-owned catalogue asset is removed
      And unrelated profile content remains unchanged

    @rejection @surface.opencode
    Scenario: OpenCode uninstall preserves drifted catalogue content
      Given an identity-owned OpenCode catalogue asset was edited after installation
      When Safeword uninstalls the OpenCode profile delivery
      Then uninstall reports managed-asset drift
      And the edited asset and unrelated profile content remain unchanged
      And no other managed profile content is removed
