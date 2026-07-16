@surface.openai-codex @surface.safeword-cli
Feature: Give Codex users the full Safe Word workflow

  @codex-workflow.TBU1.R1
  Rule: codex-workflow.TBU1.R1 - Every canonical workflow is available with the reference material it dispatches to

    Scenario: Complete profile plugin exposes every workflow entry and phase reference
      Given the canonical Safe Word catalogue contains workflows with supporting phase material
      And the generated plugin is installed in an otherwise empty Codex profile
      When the builder starts a new Codex session
      Then every canonical workflow is available as a scoped Safe Word skill
      And each workflow's supporting phase material is available from that skill

    @rejection
    Scenario: Missing phase material rejects the plugin release
      Given a canonical workflow requires supporting phase material
      And the generated plugin omits that material
      When the plugin release contract runs
      Then the release is rejected

  @codex-workflow.TBU1.R2
  Rule: codex-workflow.TBU1.R2 - A project's Safe Word workflow files stay outside the repository throughout Codex setup and migration

    Scenario: Fresh setup keeps workflow material out of the project
      Given an empty project has no Safe Word workflow material
      When the builder sets up Safe Word for Codex
      Then Safe Word directs the builder to the explicit Codex plugin migration command
      And the project contains no Safe Word workflow tree in .agents, .codex, or .safeword

    @rejection
    Scenario: Project-local workflow output rejects the integration
      Given a generated plugin writes Safe Word workflow material into the target project
      When the Codex integration contract runs
      Then the integration is rejected

  @codex-workflow.TBU1.R3
  Rule: codex-workflow.TBU1.R3 - Migration retains legacy Safe Word hooks until the builder explicitly completes the trusted-plugin handoff

    Scenario: Initial plugin migration preserves legacy hooks and explains the handoff
      Given a project has Safe Word legacy hooks and custom Codex configuration
      And the Safe Word plugin is installed but its hooks have not been reviewed
      When the builder migrates Codex to the plugin
      Then the legacy Safe Word hooks remain in the project
      And the builder is told to review the Safe Word hooks in Codex before cleanup

    Scenario: Completed handoff removes only legacy Safe Word hooks
      Given a project has Safe Word legacy hooks and custom Codex configuration
      And the Safe Word plugin is installed and the legacy hooks remain
      When the builder explicitly confirms hook review and requests handoff cleanup
      Then the project has no legacy Safe Word hooks
      And the custom Codex configuration remains unchanged

    @rejection
    Scenario: Initial migration does not clean up hooks without an explicit handoff request
      Given a project has Safe Word legacy hooks
      And the Safe Word plugin is already installed
      When the builder runs the initial Codex plugin migration without requesting handoff cleanup
      Then Safe Word reports the installed plugin and the required hook-review handoff
      And the legacy Safe Word hooks remain unchanged

    @rejection
    Scenario: Failed plugin installation retains legacy hooks
      Given a project has Safe Word legacy hooks
      And the Safe Word plugin cannot be installed
      When the builder migrates Codex to the plugin
      Then the migration fails with remediation instructions
      And the legacy Safe Word hooks remain unchanged

  @codex-workflow.TBU1.R4
  Rule: codex-workflow.TBU1.R4 - An unreviewed or changed Safe Word plugin hook is visibly skipped until the builder trusts it in Codex

    Scenario: New plugin hooks require review before they run
      Given the generated Safe Word plugin is installed in a fresh isolated Codex profile
      And an unreviewed Safe Word plugin hook writes a unique marker when invoked
      When the builder starts a real Codex session without a hook-trust bypass flag
      Then the session displays Codex's review-required warning with /hooks remediation
      And the Safe Word hook marker is absent

    @rejection
    Scenario: Changed plugin hooks require review again
      Given the builder previously reviewed a Safe Word plugin hook through Codex /hooks
      And the generated Safe Word plugin is installed in an isolated Codex profile
      And the reviewed hook definition changed and writes a unique marker when invoked
      When the builder starts a real Codex session without a hook-trust bypass flag
      Then the session displays Codex's review-required warning with /hooks remediation
      And the Safe Word hook marker is absent

  @workflow-maintenance.SWM1.R1
  Rule: workflow-maintenance.SWM1.R1 - The packaged Codex catalogue is a deterministic, allowlisted transformation of the canonical workflow catalogue

    Scenario: Allowed adaptations preserve workflow meaning
      Given a canonical Safe Word workflow
      When Safe Word generates its Codex plugin skill
      Then the output differs only in supported metadata, scoped invocation, and reference-path adaptations

    Scenario: Generated skill metadata fits Codex's documented fallback discovery budget
      Given the generated Safe Word plugin catalogue
      When the release contract measures its skill metadata inventory
      Then the inventory is no more than 8000 characters

    @rejection
    Scenario: Over-budget skill metadata rejects the plugin release
      Given a generated Safe Word plugin catalogue has metadata inventory over 8000 characters
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
      Given the generated Safe Word plugin catalogue
      When Safe Word packs a release package
      Then the package contains every generated skill and reference asset

    @rejection
    Scenario: Missing packed plugin asset rejects publication
      Given a packed Safe Word package omits a generated plugin asset
      When the package release contract runs
      Then publication is rejected

  @workflow-maintenance.SWM1.R3
  Rule: workflow-maintenance.SWM1.R3 - Isolated Codex installation proves the cached plugin exposes the generated workflow without project-local workflow assets

    Scenario: Cached installation exposes scoped workflow skills without project files
      Given a packed Safe Word package is installed in an isolated Codex profile
      And the target project is empty
      When the builder starts a new Codex session
      Then the cached plugin exposes the generated scoped Safe Word skills
      And the target project contains no Safe Word workflow tree

    @rejection
    Scenario: Project copies cannot mask a missing cached plugin asset
      Given a target project contains a copy of a required Safe Word workflow asset
      And the installed plugin cache omits that asset
      When the isolated installation contract runs
      Then the installation is rejected

  @workflow-maintenance.SWM1.R4
  Rule: workflow-maintenance.SWM1.R4 - Plugin hook commands use version-pinned Bunx and never bypass Codex hook trust

    Scenario: Plugin hooks invoke the pinned Safe Word CLI through Bunx
      Given the generated Safe Word plugin hooks
      When the hook release contract runs
      Then every Safe Word hook invokes a version-pinned Bunx command

    @rejection
    Scenario Outline: Unsafe hook execution path rejects the plugin release
      Given a Safe Word plugin hook violates the "<policy>" policy
      When the hook release contract runs
      Then the release is rejected for "<policy>"

      Examples:
        | policy                 |
        | npx execution          |
        | unpinned CLI version   |
        | hook-trust bypass flag |
