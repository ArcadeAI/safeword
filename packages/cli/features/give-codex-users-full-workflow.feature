@surface.openai-codex @surface.safeword-cli
Feature: Give Codex users the full Safeword workflow

  @codex-workflow.TBU1.R1
  Rule: codex-workflow.TBU1.R1 - Every canonical workflow is available with the reference material it dispatches to

    @live
    Scenario: Complete profile plugin exposes every workflow entry and phase reference
      Given the canonical Safeword catalogue contains workflows with supporting phase material
      And the generated plugin is installed in an otherwise empty Codex profile
      When the builder starts a new Codex session
      Then every canonical workflow is available as a scoped Safeword skill
      And each workflow's supporting phase material is available from that skill

    @rejection
    Scenario: Missing phase material rejects the plugin release
      Given a canonical workflow requires supporting phase material
      And the generated plugin omits that material
      When the plugin release contract runs
      Then the release is rejected

  @codex-workflow.TBU1.R2
  Rule: codex-workflow.TBU1.R2 - A project's Safeword workflow files stay outside the repository throughout Codex installation and migration

    Scenario: Fresh Codex installation keeps workflow material out of the project
      Given an empty project has no Safeword workflow material
      When the builder installs Safeword for Codex
      Then the project bootstrap will enroll each Codex profile automatically
      And no Codex or Cursor workflow tree is written into the project

    @rejection
    Scenario: Project-local workflow output rejects the integration
      Given a generated plugin writes Safeword workflow material into the target project
      When the Codex integration contract runs
      Then the integration is rejected

  @codex-workflow.TBU1.R3
  Rule: codex-workflow.TBU1.R3 - Migration retains legacy Safeword hooks until the builder explicitly completes the trusted-plugin handoff

    Scenario: Initial plugin migration preserves legacy hooks and explains the handoff
      Given a project has Safeword legacy hooks and custom Codex configuration
      And the Safeword plugin is installed but its hooks have not been reviewed
      When the builder migrates Codex to the plugin
      Then the legacy Safeword hooks remain in the project
      And the builder is told to review the Safeword hooks in Codex before cleanup

    Scenario: Completed handoff removes only legacy Safeword hooks
      Given a project has Safeword legacy hooks and custom Codex configuration
      And the Safeword plugin is installed and the legacy hooks remain
      When the builder explicitly confirms hook review and requests handoff cleanup
      Then the project has no legacy Safeword hooks
      And the custom Codex configuration remains unchanged

    @rejection
    Scenario: Initial migration does not clean up hooks without an explicit handoff request
      Given a project has Safeword legacy hooks
      And the Safeword plugin is already installed
      When the builder runs the initial Codex plugin migration without requesting handoff cleanup
      Then Safeword reports the installed plugin and the required hook-review handoff
      And the legacy Safeword hooks remain unchanged

    @rejection
    Scenario: Full-workflow installation failure retains legacy Codex hooks
      Given a project has Safeword legacy hooks
      And the Safeword plugin cannot be installed
      When the builder migrates Codex to the plugin
      Then the migration fails with remediation instructions
      And the legacy Safeword hooks remain unchanged

  @codex-workflow.TBU1.R4
  Rule: codex-workflow.TBU1.R4 - An unreviewed or changed Safeword plugin hook is visibly skipped until the builder trusts it in Codex

    @live @manual
    Scenario: New plugin hooks require review before they run
      Given the generated Safeword plugin is installed in a fresh isolated Codex profile
      And an unreviewed Safeword plugin hook writes a unique marker when invoked
      When the builder starts a real Codex session without a hook-trust bypass flag
      Then the session displays Codex's review-required warning with /hooks remediation
      And the Safeword hook marker is absent

    @rejection @live @manual
    Scenario: Changed plugin hooks require review again
      Given the builder previously reviewed a Safeword plugin hook through Codex /hooks
      And the generated Safeword plugin is installed in an isolated Codex profile
      And the reviewed hook definition changed and writes a unique marker when invoked
      When the builder starts a real Codex session without a hook-trust bypass flag
      Then the session displays Codex's review-required warning with /hooks remediation
      And the Safeword hook marker is absent

  @workflow-maintenance.SWM1.R1
  Rule: workflow-maintenance.SWM1.R1 - The packaged Codex catalogue is a deterministic, allowlisted transformation of the canonical workflow catalogue

    Scenario: Allowed adaptations preserve workflow meaning
      Given a canonical Safeword workflow
      When Safeword generates its Codex plugin skill
      Then the output differs only in supported metadata, scoped invocation, and reference-path adaptations

    Scenario: Generated skill metadata fits Codex's documented fallback discovery budget
      Given the generated Safeword plugin catalogue
      When the release contract measures its skill metadata inventory
      Then the inventory is no more than 8000 characters

    @rejection
    Scenario: Over-budget skill metadata rejects the plugin release
      Given a generated Safeword plugin catalogue has metadata inventory over 8000 characters
      When the plugin release contract runs
      Then the release is rejected

    @rejection
    Scenario: Unexpected workflow drift rejects generation
      Given a generated Codex workflow differs from its canonical workflow outside the allowed adaptations
      When the source-to-plugin contract runs
      Then generation is rejected

  @workflow-maintenance.SWM1.R2
  Rule: workflow-maintenance.SWM1.R2 - A published package contains every generated skill and reference asset

    Scenario: Packed package contains the complete generated plugin
      Given the generated Safeword plugin catalogue
      When Safeword packs a release package
      Then the package contains every generated skill and reference asset

    @rejection
    Scenario: Missing packed plugin asset rejects publication
      Given a packed Safeword package omits a generated plugin asset
      When the package release contract runs
      Then publication is rejected

  @workflow-maintenance.SWM1.R3
  Rule: workflow-maintenance.SWM1.R3 - Isolated Codex installation proves the cached plugin exposes the generated workflow without project-local workflow assets

    @live
    Scenario: Cached installation exposes scoped workflow skills without project files
      Given a packed Safeword package is installed in an isolated Codex profile
      And the target project is empty
      When the builder starts a new Codex session
      Then the cached plugin exposes the generated scoped Safeword skills
      And the target project contains no Safeword workflow tree

    @rejection
    Scenario: Project copies cannot mask a missing cached plugin asset
      Given a target project contains a copy of a required Safeword workflow asset
      And the installed plugin cache omits that asset
      When the isolated installation contract runs
      Then the installation is rejected

  @workflow-maintenance.SWM1.R4
  Rule: workflow-maintenance.SWM1.R4 - Plugin hook commands use the bundled runtime and never bypass Codex hook trust

    Scenario: Plugin hooks invoke the bundled Safeword CLI
      Given the generated Safeword plugin hooks
      When the hook release contract runs
      Then every Safeword hook invokes the bundled plugin runtime

    @rejection
    Scenario Outline: Unsafe hook execution path rejects the plugin release
      Given a Safeword plugin hook violates the "<policy>" policy
      When the hook release contract runs
      Then the release is rejected for "<policy>"

      Examples:
        | policy                 |
        | npx execution          |
        | package bootstrap      |
        | hook-trust bypass flag |
