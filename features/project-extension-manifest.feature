Feature: Let projects extend safeword guardrails without forking safeword

  Projects need a supported manifest for their own guides, templates, skills,
  and hooks so safeword can preserve and validate those extensions across
  setup, upgrade, reset, and check.

  Rule: Extension inventory is explicit and project-owned

    @project-extension-manifest.TB1.AC1
    Scenario Outline: Missing or empty extension inventory is a safe no-op
      Given a project has "<inventory state>" in safeword config
      When safeword reads the project extension manifest
      Then safeword returns a normalized extension inventory with empty guides, templates, skills, and hooks
      And `safeword check` succeeds with zero extension diagnostics

      Examples:
        | inventory state       |
        | no extensions section |
        | empty extensions      |

    @project-extension-manifest.TB1.AC1
    Scenario: Populated extension inventory declares every supported extension kind
      Given a project declares a guide, template, skill, and hook extension in safeword config
      When safeword reads the project extension manifest
      Then the extension inventory contains the declared guide, template, skill, and hook
      And each extension source path resolves from the project root

  Rule: Lifecycle commands preserve customer source files

    @project-extension-manifest.TB1.AC2
    Scenario Outline: Setup and upgrade refresh adapters without changing extension source files
      Given a project has customer-owned extension source files
      And safeword-owned adapters already exist or can be created
      When the builder runs `safeword <command>`
      Then safeword creates or updates only safeword-owned extension adapters
      And the customer-owned extension source files are unchanged

      Examples:
        | command |
        | setup   |
        | upgrade |

    @project-extension-manifest.TB1.AC2
    Scenario: Reset removes extension adapters without deleting extension source files
      Given a project has customer-owned extension source files
      And safeword-owned extension adapters exist
      When the builder runs `safeword reset`
      Then safeword removes the safeword-owned extension adapters
      And the customer-owned extension source files remain in place

  Rule: Supported adapters expose requested extensions

    @project-extension-manifest.TB1.AC3
    Scenario Outline: Supported extension mappings expose adapters without copying source content
      Given a project declares a "<kind>" extension for "<agent>"
      And the Claude, Codex, and Cursor compatibility matrix supports that mapping
      When the builder runs `safeword setup`
      Then safeword exposes the extension through "<adapter surface>"
      And the adapter points at the customer-owned "<kind>" source
      And the customer-owned source content is not copied into safeword-owned templates

      Examples:
        | kind     | agent  | adapter surface                 |
        | guide    | Claude | Claude project memory reference |
        | guide    | Codex  | Codex AGENTS.md reference       |
        | guide    | Cursor | Cursor rule reference           |
        | template | Claude | Claude command/template pointer |
        | template | Codex  | Codex template pointer          |
        | template | Cursor | Cursor template pointer         |
        | skill    | Claude | Claude skill inventory          |
        | skill    | Codex  | Codex skill inventory           |
        | hook     | Claude | Claude hook settings            |
        | hook     | Codex  | Codex hook config               |
        | hook     | Cursor | Cursor hook config              |

    @project-extension-manifest.TB1.AC3
    Scenario: Upgrade refreshes an existing extension adapter without copying source content
      Given a project declares a guide extension for Claude
      And the Claude adapter already points at the customer-owned guide source
      When the builder runs `safeword upgrade`
      Then safeword refreshes the safeword-owned Claude adapter
      And the adapter still points at the customer-owned guide source
      And the customer-owned guide source content is not copied into safeword-owned templates

    @project-extension-manifest.TB1.AC3
    Scenario: Customer skill extensions appear through the shared skill inventory
      Given a project declares a customer-owned skill extension
      And safeword has framework-managed skills
      When safeword builds the agent skill inventory
      Then the generated skill inventory lists both framework-managed and customer-owned skills
      And `safeword check` validates the combined skill inventory as one source

  Rule: Invalid extension manifests fail before an agent depends on them

    @project-extension-manifest.TB1.AC4
    Scenario: Check reports a missing extension source path
      Given a project declares one extension whose source path is missing
      When the builder runs `safeword check`
      Then the check reports the missing extension source path
      And the report identifies the affected extension entries

    @project-extension-manifest.TB1.AC4
    Scenario Outline: Check reports duplicate extension names
      Given a project declares "<duplicate scope>" extensions with the same name
      When the builder runs `safeword check`
      Then the check reports the duplicate extension name
      And the report identifies the affected extension entries

      Examples:
        | duplicate scope |
        | same-kind       |
        | cross-kind      |

    @project-extension-manifest.TB1.AC4
    Scenario Outline: Check rejects extension source paths outside customer-owned project files
      Given a project declares an extension source path at "<source path>"
      When the builder runs `safeword check`
      Then the check rejects the extension source path
      And the report explains that extension source files must be customer-owned project files

      Examples:
        | source path                   |
        | .safeword/guides/team.md     |
        | .claude/skills/team/SKILL.md |
        | ../shared/team.md            |
        | /tmp/team.md                 |

    @project-extension-manifest.TB1.AC4
    Scenario Outline: Check reports unsafe hook declarations before installation
      Given a project declares a hook extension with "<unsafe condition>"
      When the builder runs `safeword check`
      Then the check reports "<diagnostic>" for the hook extension
      And the report identifies the affected hook extension entry

      Examples:
        | unsafe condition             | diagnostic                  |
        | no agent                     | missing target agent        |
        | no event                     | missing hook event          |
        | no matcher                   | missing hook matcher        |
        | no command                   | missing hook command        |
        | no timeout                   | missing hook timeout        |
        | no blocking mode             | missing blocking mode       |
        | free-form shell command      | unsafe hook command shape   |
        | remote URL command target    | remote hook command target  |
        | runtime without local script | missing local script target |
        | runtime script outside root  | command outside project     |
        | direct script outside root   | command outside project     |

    @project-extension-manifest.SM1.AC3
    Scenario: Unsupported agent or event mappings fail without changing customer content
      Given a project declares an extension mapping not supported by the compatibility matrix
      And existing customer-owned files are present
      When the builder runs `safeword check`
      Then the check reports the unsupported agent or event mapping
      And the existing customer-owned files are unchanged

  Rule: Hooks compose safely across agent surfaces

    @project-extension-manifest.SM1.AC1
    Scenario Outline: Setup and upgrade preserve customer hooks while refreshing safeword hooks
      Given Claude, Codex, and Cursor each have an existing customer-authored hook
      And Cursor has a customer hook on the same event as a safeword-owned hook
      When the builder runs `safeword <command>`
      Then each existing customer-authored hook remains configured
      And safeword-owned hooks are added or updated
      And Cursor keeps both same-event hooks configured

      Examples:
        | command |
        | setup   |
        | upgrade |

    @project-extension-manifest.SM1.AC2
    Scenario: Hook extension with explicit safety semantics is accepted
      Given a project declares a hook extension with agent, event, matcher, command, args, timeout, blocking mode, and project-local script target
      When safeword validates the project extension manifest
      Then the hook extension is accepted
      And the hook can be exposed through a supported agent adapter

    @project-extension-manifest.SM1.AC2
    Scenario Outline: Ambiguous or unsafe hook declarations are rejected
      Given a project declares a hook extension with "<unsafe condition>"
      When safeword validates the project extension manifest
      Then the hook extension is rejected
      And the validation message explains the missing or unsafe safety semantic

      Examples:
        | unsafe condition             |
        | no agent                     |
        | no event                     |
        | no matcher                   |
        | no command                   |
        | no timeout                   |
        | no blocking mode             |
        | free-form shell command      |
        | remote URL command target    |
        | runtime without local script |
        | runtime script outside root  |
        | direct script outside root   |

    @project-extension-manifest.SM1.AC2
    Scenario: Allowed runtime command is accepted only with a project-local script argument
      Given a project declares a hook extension using an allowed runtime command
      And the first script argument resolves to a project-local file
      When safeword validates the project extension manifest
      Then the hook extension is accepted
      And the accepted hook records the project-local script target
