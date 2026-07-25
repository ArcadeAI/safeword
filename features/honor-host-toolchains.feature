# Behavior source for 13E3EN. Executable proof lives in
# packages/cli/tests/hooks/host-toolchain.test.ts, which drives the real resolver,
# runner, and lint hook through isolated filesystem and subprocess fixtures.
# Cucumber steps would duplicate that harness without adding another boundary.
@wip
Feature: Honor host JavaScript toolchains during agent edits
  Safeword preserves a project's declared JavaScript quality owner while keeping
  its own workflow and evidence gates active.

  @honor-host-toolchains.SWM1.R1
  Rule: honor-host-toolchains.SWM1.R1 — A recognized host toolchain is the sole formatter and JavaScript policy fixer for edited files

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: An Ultracite Biome project uses its configured checked flow
      Given a nested JavaScript workspace with an Ultracite <preset> preset and a local Ultracite executable
      And a TypeScript file with an auto-fixable host-toolchain violation
      When an agent edits that TypeScript file
      Then Safeword invokes that workspace's local Ultracite executable from its configuration directory with `fix --` and then `check --`, each followed by the owner-relative file operand
      And Safeword does not run its generic ESLint or Prettier commands for that file

      Examples:
        | preset |
        | legacy v6 `ultracite/core` |
        | current `ultracite/biome/core` |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A direct Biome project is not rewritten by a Safeword JavaScript policy
      Given a nested JavaScript workspace with a direct Biome configuration and local Biome executable
      And a TypeScript file with a safe-fixable Biome violation
      When an agent edits that TypeScript file
      Then Safeword invokes that workspace's local Biome executable from its configuration directory with `check --write --` and then `check --`, each followed by the owner-relative file operand
      And Safeword does not run its generic ESLint or Prettier commands for that file

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: An Ultracite preset wins over direct-Biome detection
      Given a JavaScript workspace with a <configuration file> configuration that extends Ultracite's `<preset>` preset
      And that workspace has local Ultracite and Biome executables
      When an agent edits a TypeScript file in that workspace
      Then Safeword invokes the local Ultracite executable with `fix --` and then `check --`, each followed by the owner-relative file operand
      And Safeword does not invoke the local Biome executable or its generic ESLint or Prettier commands for that file

      Examples:
        | configuration file | preset |
        | `biome.json` | legacy v6 `ultracite/core` |
        | `.biome.json` | legacy v6 `ultracite/core` |
        | `biome.jsonc` | current `ultracite/biome/core` |
        | `.biome.jsonc` | current `ultracite/biome/core` |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each supported Biome configuration filename selects direct Biome
      Given a JavaScript workspace with a <configuration file> direct Biome configuration and local Biome executable
      When an agent edits a TypeScript file in that workspace
      Then Safeword invokes that local Biome executable from the configuration directory with exactly `check --write --` and then exactly `check --`, each followed by the owner-relative file operand
      And Safeword does not run its generic ESLint or Prettier commands for that file

      Examples:
        | configuration file |
        | `biome.json` |
        | `biome.jsonc` |
        | `.biome.json` |
        | `.biome.jsonc` |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A dash-prefixed source filename uses exact shell-disabled direct-Biome argv
      Given a direct Biome workspace with a local executable
      And an edited TypeScript file named `-generated.ts`
      When an agent edits that TypeScript file
      Then Safeword makes shell-disabled argv-array spawns with exactly `check --write -- -generated.ts` and then exactly `check -- -generated.ts`

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A dash-prefixed source filename uses exact shell-disabled Ultracite argv
      Given an Ultracite Biome workspace with a local executable
      And an edited TypeScript file named `-generated.ts`
      When an agent edits that TypeScript file
      Then Safeword makes shell-disabled argv-array spawns with exactly `fix -- -generated.ts` and then exactly `check -- -generated.ts`

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A host configuration that excludes an edited file does not trigger a competing fallback
      Given a direct Biome workspace whose configuration excludes an edited TypeScript file
      When an agent edits that excluded file
      Then Safeword invokes the selected local Biome executable with `check --write --` and then `check --`, each followed by the owner-relative file operand
      And Safeword does not run its generic ESLint or Prettier commands for that file

  @honor-host-toolchains.SWM1.R2
  Rule: honor-host-toolchains.SWM1.R2 — An existing Ultracite installation is adopted in place without configuration churn

    @rejection @surface.safeword-cli
    Scenario: An existing Ultracite installation remains byte-for-byte owned by the project
      Given a project with an existing Ultracite configuration, dependencies, editor settings, and agent hooks
      When Safeword prepares and runs its agent-edit quality hook
      Then before-and-after snapshots show those Ultracite-owned files and dependencies unchanged
      And the hook uses the existing local Ultracite executable

  @honor-host-toolchains.SWM1.R3
  Rule: honor-host-toolchains.SWM1.R3 — A recognized host toolchain's check result is surfaced to the agent as the JavaScript quality result for the edited file

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A host check failure identifies the edited file to the agent
      Given a recognized host toolchain whose check leaves a violation in an edited TypeScript file
      When the agent-edit quality hook completes
      Then the agent receives that host-toolchain diagnostic for the edited file

  @honor-host-toolchains.SWM1.R4
  Rule: honor-host-toolchains.SWM1.R4 — An unrecognized or unavailable host toolchain fails safely without suppressing Safeword's existing quality workflow

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A recognized owner without a project-local executable leaves the file untouched
      Given a recognized host-toolchain configuration with no executable on its canonical path to the Safeword project root
      And a distinguishable host executable is available only through global PATH or a package runner
      When an agent edits a TypeScript file owned by that configuration
      Then the agent receives an actionable missing-tool warning
      And Safeword invokes neither the canonical host command, global executable, package runner, download command, generic ESLint, nor Prettier for that file

    Scenario: An unsupported alternative formatter retains Safeword's existing no-Prettier behavior
      Given a project owned by an unsupported alternative formatter
      When an agent edits a TypeScript file
      Then Safeword does not run Prettier for that file
      And Safeword runs its existing generic ESLint security and complexity checks for that file

  @honor-host-toolchains.SWM1.R5
  Rule: honor-host-toolchains.SWM1.R5 — Safeword-owned generated files stay outside the host toolchain's edited-file scope

    @rejection @surface.safeword-cli
    Scenario: A Safeword-owned generated file is excluded from host dispatch
      Given a recognized host toolchain in a project with Safeword-managed files
      When an agent edit targets a file under a Safeword-owned generated directory
      Then Safeword returns its existing generated-file exclusion result without modifying that file
      And Safeword does not invoke the host toolchain for that file

  @honor-host-toolchains.SWM1.R6
  Rule: honor-host-toolchains.SWM1.R6 — Ambient process settings cannot replace the selected host toolchain's configuration or executable

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Biome environment overrides cannot escape the selected workspace owner
      Given an edited TypeScript file owned by a nested <host toolchain> workspace
      And the agent environment sets `BIOME_CONFIG_PATH` to `/outside/root/biome.json` and `BIOME_BINARY` to `/outside/root/biome`
      When the agent-edit quality hook runs
      Then the selected workspace's local configuration and executable are used
      And the spawned host process environment omits `BIOME_CONFIG_PATH` and `BIOME_BINARY`
      And no configuration or executable outside the Safeword project root is used

      Examples:
        | host toolchain |
        | direct Biome |
        | Ultracite Biome |

  @honor-host-toolchains.SWM1.R7
  Rule: honor-host-toolchains.SWM1.R7 — Nested workspace dispatch selects only a canonical in-project owner

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A nested configuration inherits its root toolchain and root-hoisted executable
      Given a nested TypeScript workspace whose Biome configuration extends its root configuration
      And the only Biome executable is hoisted at the Safeword project root
      When an agent edits a TypeScript file in the nested workspace
      Then Safeword invokes the root-hoisted executable with the nested configuration directory as its working directory
      And the edited file is passed as an owner-relative argument

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A sibling workspace cannot become the edited file's host owner
      Given an edited TypeScript file with a root Biome owner
      And a sibling workspace with a different Biome configuration and local executable
      When an agent edits the root-owned file
      Then Safeword invokes the root owner's local Biome executable from the root configuration directory for that file
      And Safeword invokes neither the sibling configuration nor its executable

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A canonical path outside the Safeword project cannot become a host owner
      Given an edited-file path that resolves through a symbolic link outside the Safeword project root
      When an agent-edit quality hook receives that path
      Then Safeword invokes no host configuration or executable for that path
      And the agent receives an actionable containment warning
