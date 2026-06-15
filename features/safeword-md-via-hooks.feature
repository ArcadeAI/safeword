Feature: Load SAFEWORD.md through safeword-owned hooks

  Rule: Setup preserves customer context files

    @safeword-md-via-hooks.DEV1.AC1
    Scenario: Fresh setup does not create context files just to point at safeword
      Given a project without AGENTS.md or CLAUDE.md
      When safeword setup installs managed assets
      Then no AGENTS.md or CLAUDE.md file is created solely for a safeword reference
      And safeword-owned hook configuration still includes startup SAFEWORD context loading

    @safeword-md-via-hooks.DEV1.AC1
    Scenario: Setup preserves existing customer context files
      Given a project with customer-authored AGENTS.md and CLAUDE.md files
      When safeword setup installs managed assets
      Then the customer-authored context file contents are unchanged
      And no safeword import or read-first prose is prepended

  Rule: Upgrade removes old safeword-managed context-file patches

    @safeword-md-via-hooks.DEV1.AC2
    Scenario: Upgrade removes prior managed blocks without deleting customer content
      Given a project with prior safeword-managed AGENTS.md prose and CLAUDE.md import blocks
      And each file also contains customer-authored instructions
      When safeword upgrade reconciles managed assets
      Then the safeword-managed context-file blocks are removed
      And the customer-authored instructions remain

  Rule: Supported agents receive SAFEWORD context from owned hook surfaces

    @safeword-md-via-hooks.DEV1.AC3
    Scenario: Startup hooks are wired for Claude Cursor and Codex
      Given safeword's generated Claude settings Cursor hooks and Codex config
      When the generated hook wiring is inspected
      Then Claude SessionStart runs the SAFEWORD context hook
      And Cursor sessionStart runs the SAFEWORD context hook
      And Codex SessionStart runs the SAFEWORD context hook

    @safeword-md-via-hooks.DEV1.AC3
    Scenario: SAFEWORD context hook emits agent-compatible context
      Given an installed safeword project with .safeword/SAFEWORD.md
      When the SAFEWORD context hook runs for Claude, Cursor, and Codex modes
      Then each output contains the SAFEWORD.md standing instructions as model-visible context
      And the output shape matches that agent's hook context contract

  Rule: Claude compaction restores SAFEWORD context

    @safeword-md-via-hooks.DEV1.AC4
    Scenario: Claude compact path re-injects SAFEWORD context
      Given safeword's generated Claude settings
      When the SessionStart compact matcher is inspected
      Then it runs the SAFEWORD context hook
      And the compact context hook still restores active ticket context
