# Test Definitions: Formatter-aware lint hook

Feature source: `features/formatter-aware-lint-hook.feature`

test-definitions.md is the R/G/R ledger — Given/When/Then live in the `.feature` source.

**Coverage altitude:** behaviors are proven at the unit level in
`packages/cli/tests/hooks/lint-config.test.ts` — the formatter detector
(`detectAlternativeFormatter`), the hook's skip-gate predicate
(`projectOwnsAlternativeFormatter`), and the session-warning gate
(`shouldWarnMissingPrettier`) each have RED→GREEN tests; the `runPrettier`
early-return and `session-lint-check` wiring consume them. A full end-to-end hook
run on an installed Biome repo is deferred to /verify — the lint hook shells out
to `bunx eslint/prettier` and can trigger an upgrade on a bare dir, so it is not a
cheap unit test. SHAs point at the covering commit.

## Rule: A repo owned by a non-Prettier formatter keeps its own formatting

### Scenario: JS/TS edits are not restyled by Prettier in an <formatter> repo (Biome/dprint/oxfmt/deno)

- [x] RED db6361b9
- [x] GREEN fdc9f189
- [x] REFACTOR skip: minimal diff

### Scenario: Markup edits are not restyled by Prettier in a Biome repo

- [x] RED db6361b9
- [x] GREEN fdc9f189
- [x] REFACTOR skip: minimal diff

### Scenario: An alternative formatter wins when a Prettier config is also present

- [x] RED fdc9f189
- [x] GREEN fdc9f189
- [x] REFACTOR skip: minimal diff

## Rule: Safeword's code-quality ESLint checks still run on alternative-formatter repos

### Scenario: A security-rule violation is still surfaced in a Biome repo

- [x] RED skip: satisfied by existing formatter-agnostic eslint config — security via basePlugins
- [x] GREEN skip: no V7GGJZ change; recommendedTypeScript includes eslint-plugin-security
- [x] REFACTOR skip: none

### Scenario: ESLint does not restyle code in a Biome repo

- [x] RED skip: satisfied by existing config — formatting rules off via prettierConfig in recommendedTypeScript; no @stylistic plugin
- [x] GREEN skip: no V7GGJZ change
- [x] REFACTOR skip: none

## Rule: A repo with its own Prettier config is formatted with that config

### Scenario: Edits follow the customer's Prettier style, not safeword's

- [x] RED fdc9f189
- [x] GREEN fdc9f189
- [x] REFACTOR skip: minimal diff

## Rule: A greenfield repo is formatted with safeword's defaults

### Scenario: Edits use safeword's Prettier config when the repo has no formatter

- [x] RED fdc9f189
- [x] GREEN fdc9f189
- [x] REFACTOR skip: minimal diff

### Scenario: A disabled Prettier config does not count as a formatter

- [x] RED db6361b9
- [x] GREEN fdc9f189
- [x] REFACTOR skip: minimal diff

## Rule: The session lint check does not push Prettier on non-Prettier shops

### Scenario: No Prettier nag at session start in a Biome repo

- [x] RED 3e01a0e3
- [x] GREEN 3e01a0e3
- [x] REFACTOR skip: minimal diff
