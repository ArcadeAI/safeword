# Test Definitions: Test Codex plugin migration (4DK9H4)

Feature source: `features/test-codex-plugin-migration.feature`

test-definitions.md is the R/G/R ledger.

## Rule: test-codex-plugin-migration.TB1.R1 — A fresh repo can install and enable the Safe Word Codex plugin without `.agents/skills` or repo-local `.safeword/hooks`

### Scenario: Fresh repo installs the plugin without repo-local Safe Word implementation assets

- [x] RED bfb71fdf
- [x] GREEN 4e5ee2f5
- [x] REFACTOR skip: no structural improvement after single-manifest GREEN

### Scenario: Invalid local marketplace fails before claiming plugin install success

- [x] RED 5b4d62b6
- [x] GREEN b42ac294
- [x] REFACTOR skip: summary helper already centralizes the classification path

## Rule: test-codex-plugin-migration.TB1.R2 — Safe Word Codex skills are visible to the agent from the plugin with stable, intentional invocation names

### Scenario: Plugin skills expose the approved scoped invocation names

- [x] RED e15dfb17
- [x] GREEN a651e556
- [x] REFACTOR skip: plugin skill bundle is intentionally three small separate files

### Scenario: Bare-name compatibility shims are treated as repo-residue

- [x] RED 596b924a
- [x] GREEN 45e0e916
- [x] REFACTOR skip: scoped examples are explicit leaf content with no shared structure

## Rule: test-codex-plugin-migration.TB1.R3 — Safe Word Codex hooks execute the packaged CLI entrypoints and preserve the existing deny, allow, context, and continuation semantics

### Scenario: PreToolUse denial runs through the packaged CLI entrypoint

- [x] RED 257d2213
- [x] GREEN f21fc4be
- [x] REFACTOR skip: command is already split into parsing, target extraction, gate check, and output formatting

### Scenario: SessionStart context runs through the packaged CLI entrypoint

- [x] RED 4350e1b1
- [x] GREEN 433657da
- [x] REFACTOR skip: two-branch hook dispatcher and packaged template reader are already isolated

### Scenario: PreToolUse allow runs through the packaged CLI entrypoint

- [x] RED 19237ffb
- [x] GREEN d2b76011
- [x] REFACTOR skip: only cleanup candidate is Cucumber fixture duplication, and test files are not changed in REFACTOR commits

### Scenario: PostToolUse additional context runs through the packaged CLI entrypoint

- [x] RED 6316de52
- [x] GREEN 9a5d7127
- [x] REFACTOR skip: additional-context output and event dispatch are already shared after GREEN

### Scenario: UserPromptSubmit additional context runs through the packaged CLI entrypoint

- [x] RED f4b40603
- [x] GREEN 711977aa
- [x] REFACTOR a5d05c24

### Scenario: Stop continuation runs through the packaged CLI entrypoint

- [x] RED 73491db8
- [x] GREEN 59a83d49
- [x] REFACTOR skip: Stop continuation output is intentionally separate from additional-context helpers

### Scenario: Plugin hook commands never point at repo-local hook scripts

- [x] RED c06e85a8
- [x] GREEN 011cb21d
- [ ] REFACTOR

## Rule: test-codex-plugin-migration.TB1.R4 — Upgrading an old project-local Codex install leaves user-owned project data intact while removing or ignoring obsolete Safe Word implementation assets

### Scenario: Old project-local Codex install migrates to plugin-backed Codex support

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: User-authored Codex skills survive the migration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Customized Codex config is not clobbered while stale Safe Word hooks are removed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: test-codex-plugin-migration.SM1.R1 — Static and release checks prove the plugin manifest, marketplace entry, bundled files, and packed package contents are valid

### Scenario: Release check proves the packed package contains the plugin and hook entrypoints

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing packaged hook dependency blocks the release contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: test-codex-plugin-migration.SM1.R2 — An isolated plugin install harness proves Codex can discover, install, enable, and expose the Safe Word plugin under a temp CODEX_HOME

### Scenario: Plugin install harness mutates only the isolated Codex home

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Disabled plugin is reported as unavailable to the prompt surface

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: test-codex-plugin-migration.SM1.R3 — Deterministic hook contract tests exercise exact Codex hook JSON against packaged CLI entrypoints without involving the model

### Scenario: Exact Codex JSON fixtures cover every plugin hook command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Malformed Codex hook input fails open through the packaged entrypoint

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: test-codex-plugin-migration.SM1.R4 — A single opt-in live Codex smoke proves real `codex exec` invokes the installed plugin hooks, while model-mediated cost and flake stay out of default verification

### Scenario: Opt-in live smoke observes a plugin-installed hook denial

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Untrusted plugin hooks are reported as not active for normal Codex runs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Default verification skips the live Codex smoke with an explicit reason

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
