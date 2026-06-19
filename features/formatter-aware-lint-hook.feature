Feature: Formatter-aware lint hook
  Safeword's auto-lint hook defers to the formatter a repo already uses. When a
  non-Prettier JS/TS formatter owns the repo, safeword skips Prettier; when the
  repo owns a Prettier config, safeword formats with it; only greenfield repos
  get safeword's defaults.

  Rule: A repo owned by a non-Prettier formatter keeps its own formatting

    @formatter-aware-lint-hook.DEV1.AC1
    Scenario Outline: JS/TS edits are not restyled by Prettier in an <formatter> repo
      Given a repo owned by <formatter> with no Prettier config
      And a TypeScript file styled to <formatter>'s conventions, which differ from Prettier's defaults
      When the agent edits that file
      Then the file's formatting is left as written, not reformatted to Prettier's defaults

      Examples:
        | formatter |
        | Biome     |
        | dprint    |
        | oxfmt     |
        | deno      |

    @formatter-aware-lint-hook.DEV1.AC2
    Scenario: Markup edits are not restyled by Prettier in a Biome repo
      Given a Biome repo with no Prettier config
      And a JSON file styled to Biome's conventions, which differ from Prettier's defaults
      When the agent edits that file
      Then the file's formatting is left as written, not reformatted to Prettier's defaults

    @formatter-aware-lint-hook.DEV1.AC1
    Scenario: An alternative formatter wins when a Prettier config is also present
      Given a repo with both a Biome config and a Prettier config
      And a TypeScript file styled to Biome's conventions, which differ from Prettier's defaults
      When the agent edits that file
      Then the file's formatting is left as written, not reformatted to Prettier's defaults

  # DEV1.AC3 asserts the EXISTING formatter-agnostic eslint config (security via
  # basePlugins; formatting rules off via eslint-config-prettier in
  # recommendedTypeScript; no @stylistic plugin) — verified by inspection. Its
  # end-to-end lane stays @wip: it needs the real safeword/eslint config
  # resolvable in the fixture (a full install), unlike the other scenarios.
  Rule: Safeword's code-quality ESLint checks still run on alternative-formatter repos

    @wip @formatter-aware-lint-hook.DEV1.AC3
    Scenario: A security-rule violation is still surfaced in a Biome repo
      Given a repo whose formatting is owned by Biome
      And a TypeScript file that contains a security-rule violation
      When the agent edits that file
      Then safeword surfaces the ESLint security finding

    @wip @formatter-aware-lint-hook.DEV1.AC3
    Scenario: ESLint does not restyle code in a Biome repo
      Given a Biome repo
      And a TypeScript file styled to Biome's conventions with no lint violations
      When the agent edits that file
      Then ESLint makes no formatting change to the file

  Rule: A repo with its own Prettier config is formatted with that config

    @formatter-aware-lint-hook.DEV2.AC1
    Scenario: Edits follow the customer's Prettier style, not safeword's
      Given a repo with its own Prettier config that uses double quotes
      When the agent edits a TypeScript file
      Then the file is formatted with double quotes

  Rule: A greenfield repo is formatted with safeword's defaults

    @formatter-aware-lint-hook.DEV3.AC1
    Scenario: Edits use safeword's Prettier config when the repo has no formatter
      Given a repo with no formatter configuration
      When the agent edits a TypeScript file
      Then the file is formatted with safeword's Prettier style

    @formatter-aware-lint-hook.DEV3.AC1
    Scenario: A disabled Prettier config does not count as a formatter
      Given a repo whose only Prettier-like file is a disabled ".prettierrc.bak"
      When the agent edits a TypeScript file
      Then the file is formatted with safeword's Prettier style

  Rule: The session lint check does not push Prettier on non-Prettier shops

    @formatter-aware-lint-hook.DEV4.AC1
    Scenario: No Prettier nag at session start in a Biome repo
      Given a repo whose formatting is owned by Biome
      When safeword runs its session lint check
      Then it emits no warning that Prettier is missing or should be installed
