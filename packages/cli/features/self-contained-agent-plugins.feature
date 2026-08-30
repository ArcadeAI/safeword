@proof.vitest
Feature: Every agent delivery is self-contained
  Supported agents execute Safeword workflows from one declared authority,
  while shared project substrate means only enrollment, authored knowledge,
  selected-host assets, and lazily initialized framework state.

  @self-contained-plugins.TBU1.R1
  Rule: self-contained-plugins.TBU1.R1 — Every agent workflow executes from its declared authority without borrowing runtime

    @surface.openai-codex
    Scenario: A packaged shared-shell helper executes without project runtime
      Given an enrolled feature branch has a known merge base and two changed files
      And the project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder sources the packaged Codex audit-scope command
      Then the caller shell receives diff mode and the known merge-base SHA
      And the caller shell receives exactly the two changed files
      And no project installation or dependency change is proposed

    @rejection @surface.openai-codex
    Scenario: A sourced helper failure preserves the caller shell
      Given an enrolled feature branch has no resolvable merge base
      And the project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder sources the packaged Codex audit-scope command
      Then the caller shell reports the merge-base failure and remains available for the next command
      And no partial diff mode or changed-file values are exported

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
    Scenario: A packaged OpenCode workflow executes without project runtime
      Given an enrolled project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder invokes the generated OpenCode quality-review workflow
      Then the workflow dispatches a review using its profile-packaged reviewer instructions
      And no project installation or cross-host runtime is requested

    @rejection @surface.opencode
    Scenario: Legacy project hooks cannot regain OpenCode workflow authority
      Given an enrolled project contains a complete legacy runtime
      When the Technical Builder invokes a packaged OpenCode hook
      Then the hook executes from the installed OpenCode plugin package
      And no project-local executable runtime is loaded

    @surface.cursor
    Scenario: A Cursor workflow executes from its complete project authority
      Given a Cursor-only enrolled project has a known merge base and two changed files
      And the project contains no Claude Code, Codex, or OpenCode runtime
      When the Technical Builder invokes the generated Cursor audit workflow
      Then the workflow reports the known merge-base SHA and exactly the two changed files
      And no cross-host runtime is requested

    @rejection @surface.openai-codex
    Scenario: An unavailable pinned package never falls back to project runtime
      Given an enrolled project cannot resolve the packaged workflow's pinned Safeword version
      And the project contains a complete legacy runtime
      When the Technical Builder invokes the packaged Codex workflow
      Then the workflow reports the unavailable pinned package
      And no project installation, dependency change, or project-local runtime is proposed

    @surface.claude-code
    Scenario: A packaged Claude workflow executes without project runtime
      Given an enrolled project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder invokes the generated Claude quality-review workflow through the plugin
      Then the workflow dispatches a review using its packaged reviewer instructions
      And no project installation or cross-host runtime is requested

  @self-contained-plugins.TBU1.R2
  Rule: self-contained-plugins.TBU1.R2 — Missing framework state initializes lazily after explicit enrollment

    @shared-project-state @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Every host lazily creates missing workflow state and its precise ignore rule
      Given an enrolled project lacks the framework state directory, transient state file, and project ignore file
      When the Technical Builder invokes a state-writing <host> workflow for the first time
      Then the framework state directory and project ignore file are created
      And the transient state file never appears in the project's version-control status
      And the project ignore file contains only the precise state rule
      And the transient state file is created without installing Safeword

      Examples:
        | host        |
        | Codex       |
        | Claude Code |
        | OpenCode    |
        | Cursor      |

    @shared-project-state @surface.safeword-cli
    Scenario: First workflow state write reuses an existing framework directory
      Given an enrolled project has a framework state directory with an unrelated sibling file but no transient state file
      When the Technical Builder invokes a state-writing packaged workflow for the first time
      Then the unrelated sibling file remains byte-for-byte unchanged
      And the precise ignore rule and transient state file are created without installing Safeword

    @rejection @shared-project-state @surface.safeword-cli
    Scenario: Lazy state never invents missing authored knowledge or configuration
      Given an enrolled project lacks authored knowledge and project configuration
      When the Technical Builder invokes a state-writing packaged workflow
      Then the workflow reports the missing authored inputs
      And no authored knowledge or project configuration is created

    @shared-project-state @surface.safeword-cli
    Scenario: Lazy state initialization preserves customer ignore policy
      Given an enrolled project ignore file contains unrelated customer content
      When the Technical Builder invokes a Safeword workflow that first writes framework-owned state
      Then the customer content remains byte-for-byte unchanged
      And one precise state rule is appended

    @shared-project-state @surface.safeword-cli
    Scenario Outline: Existing effective ignore policy is not duplicated
      Given an enrolled project's ignore policy covers transient state with <coverage>
      When the Technical Builder invokes a Safeword workflow that first writes framework-owned state
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
      When the Technical Builder invokes a state-writing packaged workflow that updates framework-owned state
      Then the newly written workflow value is readable from framework state
      And the in-flight workflow values are preserved
      And the ignore file remains byte-for-byte unchanged

    @rejection @shared-project-state @surface.safeword-cli
    Scenario Outline: Lifecycle state respects explicit enrollment
      Given a repository with a Codex profile plugin is <enrollment>
      When the Technical Builder triggers a Safeword lifecycle event that attempts to record framework-owned state
      Then <state outcome>

      Examples:
        | enrollment | state outcome                                                        |
        | enrolled   | its precise ignore rule and framework state are created               |
        | unenrolled | the event completes without a blocking error and creates no project knowledge, ignore policy, or framework state |

    @rejection @shared-project-state @surface.safeword-cli
    Scenario: A direct workflow does not silently enroll a repository
      Given a repository has no Safeword enrollment marker
      When the Technical Builder invokes a state-writing packaged workflow
      Then the workflow reports that explicit enrollment is required
      And the workflow exits successfully without an approval prompt or blocking error
      And no project namespace or executable runtime is created

  @self-contained-plugins.NTB1.R1
  Rule: self-contained-plugins.NTB1.R1 — Project reconciliation is bounded to selected delivery authorities

    @surface.safeword-cli @surface.opencode
    Scenario: OpenCode installation delivers no project runtime
      Given an OpenCode profile has no Safeword catalogue
      When the Non-Technical Builder installs Safeword with OpenCode selected
      Then the OpenCode profile receives its complete packaged catalogue
      And no OpenCode executable runtime is delivered into the project

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A native single-agent project schema excludes project delivery
      Given an uninitialized project selects only <agent>
      When the Non-Technical Builder previews Safeword installation
      Then the installation plan includes the <agent> profile delivery
      And the plan contains no profile or project delivery for any unselected agent
      And the project schema contains only enrollment, authored knowledge, configuration, and lazy state
      And it contains no project-delivered workflow authority
      And the plan creates no framework state directory or transient state file

      Examples:
        | agent       |
        | Codex       |
        | Claude Code |
        | OpenCode    |

    @surface.safeword-cli @surface.cursor @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario: A Cursor-only project schema retains Cursor authority
      Given an uninitialized project selects only Cursor
      When the Non-Technical Builder previews Safeword installation
      Then the project schema contains enrollment, authored knowledge, configuration, lazy state, and Cursor's project authority
      And the plan contains no profile or project delivery for any unselected agent
      And the plan creates no framework state directory or transient state file

    @surface.safeword-cli @surface.cursor
    Scenario Outline: Mixed selection preserves Cursor without copying native runtimes
      Given a project selects Cursor and <native agent>
      When the Non-Technical Builder reconciles the project
      Then Cursor's project authority remains present
      And the <native agent> profile delivery is present
      And no native profile runtime is copied into the project

      Examples:
        | native agent |
        | Codex        |
        | Claude Code  |
        | OpenCode     |

    @surface.safeword-cli @surface.cursor @surface.openai-codex
    Scenario: Removing a native selection preserves Cursor and project content
      Given an enrolled project contains Cursor delivery, an obsolete Codex runtime copy, authored knowledge, and unrelated content
      When the Non-Technical Builder uninstalls only Codex
      Then the obsolete Codex runtime copy is removed from the project
      And Cursor's project hooks, rules, commands, and skills remain present
      And authored knowledge, enrollment state, and unrelated content remain unchanged

    @surface.safeword-cli @surface.openai-codex @surface.cursor
    Scenario: Reconciliation removes an obsolete native runtime while preserving selected authorities
      Given an enrolled project selects Codex and Cursor and contains an obsolete project-local Codex runtime copy
      And the project contains authored knowledge, enrollment state, and unrelated content
      When the Non-Technical Builder reconciles the project
      Then the obsolete Codex runtime copy is removed from the project
      And the Codex profile delivery remains the sole Codex runtime authority
      And Cursor's project authority, authored knowledge, enrollment state, and unrelated content remain unchanged

  @self-contained-plugins.SWM1.R1
  Rule: self-contained-plugins.SWM1.R1 — Package and profile ownership is enforced at release and reconciliation boundaries

    @surface.safeword-cli
    Scenario: Complete agent catalogues pass executable-reference validation
      Given generated Codex, Claude Code, OpenCode, and Cursor catalogues use their declared authorities
      When the Safeword Maintainer runs release validation
      Then all four catalogues pass runtime-authority validation

    @rejection @surface.openai-codex
    Scenario: An unpinned Codex helper blocks release
      Given a generated Codex helper invocation omits the pinned plugin package version
      When the Safeword Maintainer runs release validation
      Then validation fails and names the unpinned catalogue asset

    @surface.safeword-cli
    Scenario: Current-ticket resolution ignores completed child-ticket lineage
      Given current work changes one in-progress epic and completed child tickets
      When the Safeword Maintainer resolves the current ticket
      Then the in-progress epic is selected without treating completed children as competing work

    @surface.opencode
    Scenario: OpenCode profile identity records the complete owned catalogue
      Given a generated OpenCode catalogue of plugin, commands, agents, and skills
      When the Technical Builder installs the profile delivery
      Then the complete command, agent, skill, and reference catalogue is installed
      And the profile identity records every owned catalogue asset and digest

    @rejection @surface.safeword-cli
    Scenario: A project-runtime reference blocks native plugin release
      Given a native catalogue contains a project-local executable reference
      When the Safeword Maintainer runs release validation
      Then validation fails and names the offending catalogue asset

    @rejection @surface.cursor
    Scenario: A cross-host executable reference blocks Cursor release
      Given a Cursor catalogue asset references a Claude Code executable
      When the Safeword Maintainer runs release validation
      Then validation fails and names the offending catalogue asset

    @rejection @surface.opencode
    Scenario: OpenCode install preserves an unrecognized catalogue collision
      Given an OpenCode profile has unrelated content at a catalogue path with no recorded Safeword identity
      When the Technical Builder installs the profile delivery
      Then installation reports the catalogue collision
      And the unrelated profile content remains byte-for-byte unchanged
      And no catalogue asset is installed

    @surface.opencode
    Scenario: OpenCode upgrade removes only prior identity-owned catalogue bytes
      Given an OpenCode profile's recorded prior catalogue includes an asset absent from the current catalogue
      When the Technical Builder upgrades the profile delivery
      Then current identity-owned assets are replaced by the current catalogue
      And the retired identity-owned asset is removed
      And unrelated profile content remains unchanged

    @rejection @surface.opencode
    Scenario: OpenCode upgrade preserves a drifted catalogue asset
      Given an identity-owned OpenCode catalogue asset differs from its recorded digest
      When the Technical Builder upgrades the profile delivery
      Then upgrade reports managed-asset drift
      And the edited asset and unrelated profile content remain unchanged
      And no other identity-owned catalogue asset is changed

    @surface.opencode
    Scenario: OpenCode uninstall removes its recognized catalogue
      Given an OpenCode profile contains an unchanged identity-owned catalogue
      When the Technical Builder uninstalls the OpenCode profile delivery
      Then every identity-owned catalogue asset is removed
      And unrelated profile content remains unchanged

    @rejection @surface.opencode
    Scenario: OpenCode uninstall preserves drifted catalogue content
      Given an identity-owned OpenCode catalogue asset differs from its recorded digest
      When the Technical Builder uninstalls the OpenCode profile delivery
      Then uninstall reports managed-asset drift
      And the edited asset and unrelated profile content remain unchanged
      And no other managed profile content is removed
