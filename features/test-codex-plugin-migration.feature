Feature: Test Codex plugin migration

  Safe Word's Codex migration is proven before it ships: Codex discovers the
  plugin, exposes scoped Safe Word skills, runs packaged hook entrypoints, and
  upgrades old project-local installs without leaving customer repos dependent
  on reusable Safe Word implementation files.

  @test-codex-plugin-migration.TB1.R1 @surface.openai-codex
  Rule: test-codex-plugin-migration.TB1.R1 — A fresh repo can install and enable the Safe Word Codex plugin without `.agents/skills` or repo-local `.safeword/hooks`

    Scenario: Fresh repo installs the plugin without repo-local Safe Word implementation assets
      Given a fresh git repo with no Safe Word Codex assets
      And an isolated CODEX_HOME configured with a local Safe Word marketplace
      And the repo file tree has been recorded
      When the plugin install harness installs the Safe Word Codex plugin
      Then `codex plugin list --json` reports the Safe Word plugin as installed and enabled
      And the repo file tree is unchanged
      And the repo contains no Safe Word-owned directories under `.agents`, `.codex`, `.safeword`, `.claude`, and `.cursor`
      And the plugin install has not created `AGENTS.md`

    @rejection
    Scenario: Invalid local marketplace fails before claiming plugin install success
      Given a fresh git repo with no Safe Word Codex assets
      And an isolated CODEX_HOME configured with a local marketplace missing the Safe Word plugin manifest
      When the plugin install harness tries to install the Safe Word Codex plugin
      Then the install result names the plugin manifest validation failure
      And the repo still has no `.agents/skills` Safe Word skill directory
      And the repo still has no `.safeword/hooks/codex` directory

  @test-codex-plugin-migration.TB1.R2 @surface.openai-codex
  Rule: test-codex-plugin-migration.TB1.R2 — Safe Word Codex skills are visible to the agent from the plugin with stable, intentional invocation names

    Scenario: Plugin skills expose the approved scoped invocation names
      Given a fresh repo with the Safe Word Codex plugin installed and enabled
      And the repo has no repo-local Safe Word skills
      When the prompt surface is inspected with `codex debug prompt-input`
      Then the available skills include `safeword:bdd`
      And the available skills include `safeword:verify`
      And the available skills include `safeword:explain`

    @rejection
    Scenario: Bare-name compatibility shims are treated as repo-residue
      Given a fresh repo with the Safe Word Codex plugin installed and enabled
      When the generated repo files are inspected
      Then no Safe Word-owned `.agents/skills/bdd/SKILL.md` alias exists
      And no Safe Word-owned `.agents/skills/verify/SKILL.md` alias exists
      And user-facing Codex examples name `safeword:<skill>` instead of bare skill names

  @test-codex-plugin-migration.TB1.R3 @surface.openai-codex
  Rule: test-codex-plugin-migration.TB1.R3 — Safe Word Codex hooks execute the packaged CLI entrypoints and preserve the existing deny, allow, context, and continuation semantics

    Scenario: PreToolUse denial runs through the packaged CLI entrypoint
      Given the Safe Word package has been packed and installed into a fixture project
      And the fixture has a feature ticket missing intake prerequisites
      When the packaged Codex PreToolUse entrypoint receives a supported edit payload for that ticket's `test-definitions.md`
      Then the hook output denies the edit with the existing Safe Word phase-gate reason
      And the denial tells the Codex user to run the Safe Word explain guidance

    Scenario: SessionStart context runs through the packaged CLI entrypoint
      Given the Safe Word package has been packed and installed into a fixture project
      When the packaged Codex SessionStart entrypoint receives a SessionStart JSON fixture
      Then the hook output includes Safe Word standing instructions as Codex additional context
      And the entrypoint does not read standing instructions from repo-local `.safeword/SAFEWORD.md`

    Scenario: PreToolUse allow runs through the packaged CLI entrypoint
      Given the Safe Word package has been packed and installed into a fixture project
      And the fixture has a feature ticket with completed intake prerequisites
      When the packaged Codex PreToolUse entrypoint receives a supported edit payload for that ticket's `test-definitions.md`
      Then the hook output allows the edit without a denial payload

    Scenario: PostToolUse additional context runs through the packaged CLI entrypoint
      Given the Safe Word package has been packed and installed into a fixture project
      When the packaged Codex PostToolUse entrypoint receives a supported edit payload fixture
      Then the hook output is valid Codex `PostToolUse` additional context JSON
      And the additional context contains the fixture's Safe Word guidance line
      And the entrypoint does not import hook code from the source checkout

    Scenario: UserPromptSubmit additional context runs through the packaged CLI entrypoint
      Given the Safe Word package has been packed and installed into a fixture project
      And the fixture has queued Safe Word prompt context for Codex
      When the packaged Codex UserPromptSubmit entrypoint receives a prompt JSON fixture
      Then the hook output returns the queued context and current timestamp as Codex additional context

    Scenario: Stop continuation runs through the packaged CLI entrypoint
      Given the Safe Word package has been packed and installed into a fixture project
      And the fixture has a Codex stop payload that should produce a Safe Word continuation
      When the packaged Codex Stop entrypoint receives the stop JSON fixture
      Then the hook output is valid Codex continuation JSON with `decision` set to `block`
      And the continuation reason contains the fixture's Safe Word continuation message

    @rejection
    Scenario: Plugin hook commands never point at repo-local hook scripts
      Given the Safe Word Codex plugin hook manifest
      When the hook commands are inspected
      Then no command contains `.safeword/hooks`
      And no command depends on `git rev-parse --show-toplevel` to find Safe Word hook code
      And each command invokes a packaged Safe Word command entrypoint

  @test-codex-plugin-migration.TB1.R4 @surface.openai-codex
  Rule: test-codex-plugin-migration.TB1.R4 — Upgrading an old project-local Codex install leaves user-owned project data intact, removes obsolete skills, and preserves legacy hook runtime assets for an explicit handoff

    Scenario: Old project-local Codex install migrates to plugin-backed Codex support
      Given a repo installed with today's project-local Codex assets
      And the repo contains user-owned tickets and learnings under the namespace root
      When the plugin migration upgrade runs
      Then the user-owned tickets and learnings remain byte-identical
      And Safe Word no longer requires repo-local `.agents/skills` to expose Codex skills
      And legacy Safe Word Codex hook runtime files remain until explicit handoff cleanup

    Scenario: User-authored Codex skills survive the migration
      Given an old project-local Codex install with a user-authored `.agents/skills/company-workflow/SKILL.md`
      When the plugin migration upgrade runs
      Then the user-authored skill remains byte-identical
      And Safe Word-owned Codex skill files no longer appear as active repo-local skills

    @rejection
    Scenario: Customized Codex config is not clobbered while stale Safe Word hooks await explicit migration
      Given an old project-local Codex install with user-authored Codex config entries
      And the config also contains old Safe Word hook commands pointing at `.safeword/hooks/codex`
      When the plugin migration upgrade runs
      Then the user-authored Codex config entries remain
      And the stale Safe Word project-local hook commands remain until explicit migration

  @test-codex-plugin-migration.SM1.R1 @surface.openai-codex
  Rule: test-codex-plugin-migration.SM1.R1 — Static and release checks prove the plugin manifest, marketplace entry, bundled files, and packed package contents are valid

    Scenario: Release check proves the packed package contains the plugin and hook entrypoints
      Given the Safe Word package has been packed from the working tree
      When the release contract inspects the package contents
      Then the package contains the Safe Word Codex plugin manifest
      And the package contains the bundled Codex skill files
      And the package contains the bundled Codex hook manifest
      And the package contains every CLI entrypoint referenced by plugin hook commands

    @rejection
    Scenario: Missing packaged hook dependency blocks the release contract
      Given the Safe Word package omits a helper required by a Codex hook entrypoint
      When the release contract runs against the packed package
      Then the release contract fails before any live Codex smoke can run
      And the failure names the missing packaged reference

  @test-codex-plugin-migration.SM1.R2 @surface.openai-codex
  Rule: test-codex-plugin-migration.SM1.R2 — An isolated plugin install harness proves Codex can discover, install, enable, and expose the Safe Word plugin under a temp CODEX_HOME

    Scenario: Plugin install harness mutates only the isolated Codex home
      Given a temporary CODEX_HOME with no installed Safe Word plugin
      And the developer's real Codex home has a recorded plugin list
      When the isolated plugin install harness runs
      Then the temporary CODEX_HOME contains the Safe Word plugin install state
      And the developer's real Codex plugin list is unchanged

    @rejection
    Scenario: Disabled plugin is reported as unavailable to the prompt surface
      Given a temporary CODEX_HOME where the Safe Word plugin is installed but disabled
      When the prompt surface is inspected with `codex debug prompt-input`
      Then the expected `safeword:bdd` skill is not reported as available
      And the harness result says the plugin is disabled rather than treating the prompt as valid

  @test-codex-plugin-migration.SM1.R3 @surface.openai-codex
  Rule: test-codex-plugin-migration.SM1.R3 — Deterministic hook contract tests exercise exact Codex hook JSON against packaged CLI entrypoints without involving the model

    Scenario: Exact Codex JSON fixtures cover every plugin hook command
      Given the Safe Word Codex plugin hook manifest
      When deterministic hook contract tests enumerate the hook commands
      Then every hook command has at least one exact Codex JSON fixture
      And each fixture runs through the packaged CLI entrypoint
      And no fixture imports hook code from the source checkout

    @rejection
    Scenario: Malformed Codex hook input fails open through the packaged entrypoint
      Given a packaged Safe Word Codex hook entrypoint
      When the entrypoint receives malformed JSON on stdin
      Then the malformed hook entrypoint exits successfully
      And it emits the event's silent success payload
      And the Safe Word self-report spool remains unchanged

  @test-codex-plugin-migration.SM1.R4 @surface.openai-codex
  Rule: test-codex-plugin-migration.SM1.R4 — A single opt-in live Codex smoke proves real `codex exec` invokes the installed plugin hooks, while model-mediated cost and flake stay out of default verification

    @live
    Scenario: Opt-in live smoke observes a plugin-installed hook denial
      Given the live Codex plugin smoke is explicitly enabled
      And a fresh repo has the Safe Word Codex plugin installed, enabled, and live-authenticated under an isolated CODEX_HOME
      When `codex exec --json --dangerously-bypass-hook-trust` attempts a supported edit that violates a Safe Word gate
      Then the JSONL output contains the Safe Word hook denial
      And the fixture records whether Codex also reports a known file-change interception boundary

    Scenario: Untrusted plugin hooks are reported as not active for normal Codex runs
      Given a fresh repo has the Safe Word Codex plugin installed and enabled under an isolated CODEX_HOME
      And the Safe Word plugin hooks have not been trusted in Codex
      When the plugin verification runs without `--dangerously-bypass-hook-trust`
      Then the verification reports that Safe Word plugin hooks require Codex hook trust review
      And it does not claim Safe Word edit gates are active for normal Codex runs

    @rejection
    Scenario: Default verification skips the live Codex smoke with an explicit reason
      Given the live Codex plugin smoke is not explicitly enabled
      When the default verification suite runs
      Then no live `codex exec` session starts
      And the skipped live smoke reports the missing opt-in flag
