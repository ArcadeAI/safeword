Feature: Every agent delivery is self-contained
  Supported agents execute Safeword workflows from one declared authority,
  while projects retain only enrollment, authored knowledge, selected-host
  assets, and lazily initialized framework state.

  @self-contained-plugins.TBU1.R1
  Rule: self-contained-plugins.TBU1.R1 — Native plugin workflows do not borrow project or cross-host runtime

    @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A native agent selection installs no project executable runtime
      Given a project selects only <agent>
      When the Technical Builder previews project reconciliation
      Then the project plan contains no Safeword hooks, skills, scripts, or guides
      And the <agent> profile delivery remains the workflow authority

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
    Scenario: Codex helpers resolve through version-pinned package commands
      Given the generated Codex catalogue advertises every Safeword workflow
      When the maintainer validates its executable references
      Then every helper invocation resolves through the packaged Codex authority
      And no helper references a project-local Safeword executable

    @surface.opencode
    Scenario: OpenCode owns its full workflow catalogue in the profile
      Given an OpenCode profile has the Safeword plugin installed
      When Safeword reconciles the generated commands, agents, and skills
      Then the profile identity records every owned catalogue asset and digest
      And the project receives no OpenCode or Claude compatibility catalogue

  @self-contained-plugins.TBU1.R2
  Rule: self-contained-plugins.TBU1.R2 — Missing framework state initializes lazily after explicit enrollment

    @shared-project-state @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario: First workflow state write creates its precise ignore rule before state
      Given an enrolled project lacks a transient state file and project ignore file
      When a Safeword workflow first writes framework-owned state
      Then the project ignore file contains only the precise state rule
      And the transient state file is created without installing Safeword

    @shared-project-state
    Scenario: Lazy state initialization preserves customer ignore policy
      Given an enrolled project ignore file contains unrelated customer content
      When a Safeword workflow first writes framework-owned state
      Then the customer content remains byte-for-byte unchanged
      And one precise state rule is appended

    @shared-project-state
    Scenario: A broader customer ignore rule is not duplicated
      Given an enrolled project's existing ignore policy already covers transient state
      When a Safeword workflow first writes framework-owned state
      Then the ignore file remains byte-for-byte unchanged
      And the transient state is created

    @rejection @shared-project-state
    Scenario: An unenrolled repository remains untouched by lifecycle state
      Given a repository has a profile plugin but no Safeword enrollment marker
      When a Safeword lifecycle event observes project activity
      Then the event completes without creating project knowledge, ignore policy, or state

    @rejection @shared-project-state
    Scenario: A direct workflow does not silently enroll a repository
      Given a repository has no Safeword enrollment marker
      When the Technical Builder invokes a state-writing packaged workflow
      Then the workflow reports that explicit enrollment is required
      And no project namespace or executable runtime is created

  @self-contained-plugins.NTB1.R1
  Rule: self-contained-plugins.NTB1.R1 — Project reconciliation is bounded to selected delivery authorities

    @surface.safeword-cli
    Scenario Outline: A single-agent project schema excludes unselected hosts
      Given an uninitialized project selects only <agent>
      When the Non-Technical Builder previews Safeword installation
      Then the project schema contains only shared substrate and <agent>'s project authority

      Examples:
        | agent       |
        | Codex       |
        | Claude Code |
        | OpenCode    |
        | Cursor      |

    @surface.safeword-cli @surface.cursor
    Scenario: Mixed selection preserves Cursor without copying native runtimes
      Given a project selects Cursor and one native profile agent
      When the maintainer reconciles the project
      Then Cursor's project authority remains present
      And no native profile runtime is copied into the project

    @surface.safeword-cli
    Scenario: Selected-agent lifecycle contracts remain deterministic
      Given each supported project authority has been installed
      When the maintainer checks, upgrades, and uninstalls each selection
      Then the lifecycle results and managed trees match their accepted contracts

  @self-contained-plugins.SWM1.R1
  Rule: self-contained-plugins.SWM1.R1 — Package and profile ownership is enforced at release and reconciliation boundaries

    @surface.safeword-cli @surface.openai-codex @surface.opencode
    Scenario: Complete native catalogues pass executable-reference validation
      Given generated Codex and OpenCode catalogues use packaged commands
      When the maintainer runs release validation
      Then both catalogues pass runtime-authority validation

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

    @rejection @surface.opencode
    Scenario: OpenCode uninstall preserves drifted catalogue content
      Given an identity-owned OpenCode catalogue asset was edited after installation
      When Safeword uninstalls the OpenCode profile delivery
      Then uninstall reports managed-asset drift
      And the edited asset and unrelated profile content remain unchanged
