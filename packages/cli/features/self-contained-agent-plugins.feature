@proof.vitest
Feature: Every agent delivery is self-contained
  Supported agents execute Safeword workflows from one declared authority,
  while shared project substrate means only enrollment, authored knowledge,
  selected-host assets, and lazily initialized framework state.

  @self-contained-plugins.TBU1.R1
  Rule: self-contained-plugins.TBU1.R1 — Every agent workflow executes from its declared authority without borrowing runtime

    # Proof boundary: a real Bash caller sources the generated command and executes a following command.
    @surface.openai-codex
    Scenario: A packaged shared-shell helper executes without project runtime
      Given an enrolled feature branch has a known merge base and two changed files
      And the project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder sources the packaged Codex audit-scope command
      Then the caller shell receives diff mode and the known merge-base SHA
      And the caller shell receives exactly the two changed files
      And the emitted output contains no installation or dependency-change directive
      And the project still contains no Safeword hooks, skills, scripts, or guides

    # Proof boundary: a real Bash caller remains available after the sourced helper returns an error.
    @rejection @surface.openai-codex
    Scenario: A sourced helper failure preserves the caller shell
      Given an enrolled feature branch has no resolvable merge base
      And the project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder sources the packaged Codex audit-scope command
      Then the caller shell reports the merge-base failure and remains available for the next command
      And no partial diff mode or changed-file values are exported

    # Proof boundary: a real Bash caller sources the generated command and executes a following command.
    @surface.openai-codex
    Scenario: A packaged shared-shell helper exports an empty changed-file list
      Given an enrolled feature branch has a known merge base and no changed files
      And the project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder sources the packaged Codex audit-scope command
      Then the caller shell receives diff mode, the known merge-base SHA, and an empty changed-file list
      And the caller shell remains available for the next command

    # Proof boundary: the generated command runs from a versioned cache; any available legacy helper writes a sentinel if executed.
    @surface.openai-codex
    Scenario Outline: Legacy project runtime cannot regain native workflow authority
      Given an enrolled project contains <legacy runtime> and authored project knowledge
      When the Technical Builder invokes the packaged Codex audit workflow
      Then the audit result names the pinned Codex plugin package as its entry point
      And the authored project knowledge remains unchanged
      And the emitted output contains no installation directive
      And no legacy-runtime marker is created

      Examples:
        | legacy runtime                 |
        | a complete legacy runtime      |
        | a partially missing runtime    |

    # Proof boundary: the generated profile skill runs through its pinned runtime and a real reviewer subprocess records the dispatch.
    @surface.opencode
    Scenario: A packaged OpenCode workflow executes without project runtime
      Given an enrolled project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder invokes the generated OpenCode quality-review workflow
      Then the workflow dispatches a review using its profile-packaged reviewer instructions
      And the emitted output contains no installation or cross-host-runtime directive
      And the project still contains no Safeword hooks, skills, scripts, or guides

    @rejection @surface.opencode
    Scenario: Legacy project hooks cannot regain OpenCode workflow authority
      Given an enrolled project contains a complete legacy runtime whose hook reports a legacy-only marker
      When the Technical Builder invokes a packaged OpenCode hook
      Then the caller receives exit status 2 and an unsupported-output diagnostic
      And the legacy-only marker is absent

    # Proof boundary: a real Bash caller sources Cursor's installed project helper and executes a following command.
    @surface.cursor
    Scenario: A Cursor workflow executes from its complete project authority
      Given a Cursor-only enrolled project has a known merge base and two changed files
      And the project contains no Claude Code, Codex, or OpenCode runtime
      When the Technical Builder invokes the generated Cursor audit workflow
      Then the workflow reports the known merge-base SHA and exactly the two changed files
      And the emitted output contains no installation or cross-host-runtime directive
      And no Claude Code, Codex, or OpenCode runtime is created

    # Proof boundary: a real Bash caller remains available after Cursor's sourced project helper returns an error.
    @rejection @surface.cursor
    Scenario: A sourced Cursor helper failure preserves the caller shell
      Given a Cursor-only enrolled project has no resolvable merge base
      And the project contains no Claude Code, Codex, or OpenCode runtime
      When the Technical Builder sources the installed Cursor audit helper
      Then the caller shell reports the merge-base failure and remains available for the next command
      And no partial diff mode or changed-file values are exported

    # Proof boundary: a real Bash caller sources Cursor's installed project helper and executes a following command.
    @surface.cursor
    Scenario: A sourced Cursor helper exports an empty changed-file list
      Given a Cursor-only enrolled project has a known merge base and no changed files
      And the project contains no Claude Code, Codex, or OpenCode runtime
      When the Technical Builder sources the installed Cursor audit helper
      Then the caller shell receives diff mode, the known merge-base SHA, and an empty changed-file list
      And the caller shell remains available for the next command

    # Proof boundary: the generated pinned command runs with its cache entry absent beside a marker-emitting legacy helper.
    @rejection @surface.openai-codex
    Scenario: An unavailable pinned package never falls back to project runtime
      Given an enrolled project cannot resolve the packaged workflow's pinned Safeword version
      And the project contains a complete legacy runtime
      When the Technical Builder invokes the packaged Codex workflow
      Then the workflow reports the unavailable pinned package
      And the emitted output contains no installation or dependency-change directive
      And no legacy-runtime marker is created

    # Proof boundary: the generated plugin skill runs through its bundled runtime and a real reviewer subprocess records the dispatch.
    @surface.claude-code
    Scenario: A packaged Claude workflow executes without project runtime
      Given an enrolled project contains no Safeword hooks, skills, scripts, or guides
      When the Technical Builder invokes the generated Claude quality-review workflow through the plugin
      Then the workflow dispatches a review using its packaged reviewer instructions
      And the emitted output contains no installation or cross-host-runtime directive
      And the project still contains no Safeword hooks, skills, scripts, or guides

  @self-contained-plugins.TBU1.R2
  Rule: self-contained-plugins.TBU1.R2 — Missing framework state initializes lazily after explicit enrollment

    # Proof boundary: each row executes the generated workflow through that host's real declared authority, mocking only the external process boundary.
    @shared-project-state @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Every host lazily creates missing workflow state and its precise ignore rule
      Given an enrolled version-controlled project configures <host> with its declared Safeword authority
      And the enrolled project lacks the framework state directory, transient state file, and project ignore file
      When the Technical Builder invokes the generated <host> state-writing workflow through that authority for the first time
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
      Then no authored knowledge or project configuration is created
      And the framework state file is created

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

    @shared-project-state @surface.safeword-cli
    Scenario: Enrolled lifecycle state initializes lazily
      Given an enrolled repository with a Codex profile plugin lacks framework state
      When the Technical Builder triggers a Safeword lifecycle event that attempts to record framework-owned state
      Then its precise ignore rule and framework state are created without installing Safeword

    @rejection @shared-project-state @surface.safeword-cli
    Scenario: Unenrolled lifecycle state remains absent without blocking
      Given an unenrolled repository with a Codex profile plugin lacks framework state
      When the Technical Builder triggers a Safeword lifecycle event that attempts to record framework-owned state
      Then the event completes without a blocking error
      And no project knowledge, ignore policy, or framework state is created

    @rejection @shared-project-state @surface.safeword-cli
    Scenario: A direct workflow does not silently enroll a repository
      Given a repository has no Safeword enrollment marker
      When the Technical Builder invokes a state-writing packaged workflow
      Then the workflow reports that explicit enrollment is required
      And the workflow exits successfully without an approval prompt or blocking error
      And no project namespace, framework state, ignore rule, or executable runtime is created

  @self-contained-plugins.NTB1.R1
  Rule: self-contained-plugins.NTB1.R1 — Project reconciliation is bounded to selected delivery authorities

    @surface.safeword-cli @surface.opencode
    Scenario: Public installation reports when OpenCode V2 activation is unavailable
      Given the project has no admitted OpenCode V2 delivery
      When the builder selects OpenCode in a public install
      Then installation reports that V2 admission is required
      And preserves the existing OpenCode profile settings without installing a project runtime

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A native single-agent project schema excludes project delivery
      Given an uninitialized project selects only <agent>
      When the Non-Technical Builder previews Safeword installation
      Then the installation plan includes the <agent> profile delivery
      And the plan contains no profile or project delivery for any unselected agent
      And the project schema declares only enrollment, authored knowledge, configuration, and workflow-created lazy state
      And it declares no project-delivered hooks, skills, scripts, guides, templates, commands, rules, or agents
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

    @surface.safeword-cli @surface.cursor @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: Mixed selection preserves Cursor without copying native runtimes
      Given an enrolled project selects Cursor and <native agent>
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
      Given an enrolled project contains Cursor delivery, an installed Codex profile, authored knowledge, and unrelated content
      When the Non-Technical Builder uninstalls only Codex
      Then the Codex profile delivery is removed
      And Cursor's project hooks, rules, commands, and skills remain present
      And authored knowledge, enrollment state, and unrelated content remain unchanged

    @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode @surface.cursor
    Scenario Outline: Removing one selection retains enrollment for another native host
      Given an enrolled project has <removed> delivery and an installed <remaining> plugin
      And no other agent delivery is installed
      When the Non-Technical Builder uninstalls only <removed>
      Then the <removed> delivery is removed
      And the <remaining> plugin remains installed
      And the project enrollment and configuration remain byte-for-byte unchanged

      Examples:
        | removed | remaining |
        | Codex   | Claude Code |
        | Claude Code | Codex |
        | Codex   | OpenCode |
        | Cursor  | Claude Code |

    @surface.safeword-cli @surface.openai-codex @surface.cursor
    Scenario: Reconciliation preserves selected authorities without restoring native project runtime
      Given an enrolled project selects Codex and Cursor with no project-local Codex runtime
      And the project contains authored knowledge, enrollment state, and unrelated content
      When the Non-Technical Builder reconciles the project
      Then no project-local Codex runtime is created
      And the Codex profile delivery remains the sole Codex runtime authority
      And Cursor's project authority, authored knowledge, enrollment state, and unrelated content remain unchanged

    @surface.safeword-cli @surface.openai-codex @surface.claude-code
    Scenario: Explicit project removal leaves installed profile plugins alone
      Given an enrolled project has installed Codex and Claude Code plugins and authored knowledge
      When the Non-Technical Builder explicitly removes project enrollment with no agent selected
      Then the project enrollment is removed
      And both profile plugins remain installed
      And authored knowledge remains byte-for-byte unchanged

  @self-contained-plugins.NTB1.R2
  Rule: self-contained-plugins.NTB1.R2 — Profile lifecycle preserves customer content by identity

    @rejection @surface.safeword-cli @surface.opencode
    Scenario: OpenCode enrollment preserves a conflicting plugin declaration
      Given the user configured the selected package with different options
      When Safeword attempts to enroll the project
      Then enrollment fails
      And preserves the profile configuration without creating an enrollment

    @surface.safeword-cli @surface.opencode
    Scenario: An enrolled project can refresh its selected OpenCode package
      Given the selected package runtime has changed
      When the controller refreshes it with the matching prior enrollment
      Then the refreshed enrollment identifies the new runtime for the same project
      But repeating the refresh with a stale enrollment preserves the current enrollment and user settings

    @surface.safeword-cli @surface.opencode
    Scenario: OpenCode removal preserves other projects sharing the plugin
      Given two projects use the same OpenCode plugin
      When the builder removes one project enrollment
      Then the other enrollment and the shared plugin declaration remain
      And removal of the last enrollment preserves settings and enrollment if the declaration changes after preview
      And removing the last enrollment with the recognized declaration removes only Safeword’s entry

  @self-contained-plugins.SWM1.R1
  Rule: self-contained-plugins.SWM1.R1 — Package authority is enforced at release boundaries

    # Proof boundary: each generated bundle runs its real packaged CLI against an isolated temporary project.
    @surface.safeword-cli @surface.openai-codex @surface.claude-code
    Scenario: Native plugin bundles execute template-backed commands from shipped resources
      Given generated Codex and Claude Code plugin bundles isolated from the source checkout
      When the Safeword Maintainer runs template-backed commands through each bundled CLI
      Then both commands succeed using only resources shipped inside their plugin bundle

    # Proof boundary: the real dispatcher validates a copied plugin cache before reaching any aggregate hook command.
    @rejection @surface.claude-code
    Scenario: A damaged Claude Code plugin cache remains recoverable
      Given an installed Claude Code plugin cache fails integrity validation
      When a lifecycle event could execute a packaged Safeword hook
      Then a blockable action asks for approval without applying a Safeword hook result
      And non-blockable lifecycle events warn without applying a Safeword hook result
      And a repair action remains available without executing the damaged cache

    @surface.safeword-cli
    Scenario: Generated workflow skills pass executable-reference validation
      Given the Codex, Claude Code, OpenCode, and Cursor workflow skill sources
      When the Safeword Maintainer runs release validation
      Then all four deliveries accept their workflow skills with their intended runtime references

    @rejection @surface.safeword-cli @surface.openai-codex
    Scenario: An unpinned Codex helper blocks release
      Given a generated Codex helper invocation omits the pinned plugin package version
      When the Safeword Maintainer runs release validation
      Then validation fails and names the unpinned catalogue asset

    @rejection @surface.safeword-cli @surface.openai-codex @surface.claude-code @surface.opencode
    Scenario Outline: A project-runtime reference blocks native plugin release
      Given the generated <native host> catalogue contains a project-local executable reference
      When the Safeword Maintainer runs release validation
      Then validation fails and names the offending catalogue asset

      Examples:
        | native host |
        | Codex       |
        | Claude Code |
        | OpenCode    |

    @rejection @surface.safeword-cli @surface.cursor
    Scenario: A cross-host executable reference blocks Cursor release
      Given a Cursor catalogue asset references a Claude Code executable
      When the Safeword Maintainer runs release validation
      Then validation fails and names the offending catalogue asset
