# Test Definitions: Gherkin foundation (102a)

<!-- Lineage: gherkin-typescript.<persona><#>.AC#.<name>. DEV1.AC1 = Gherkin emission
     fidelity + validity (unit, pure renderer; emitted feature parsed with the official
     @cucumber/gherkin parser); DEV1.AC2 = format selection (unit + command); SM1.AC1 =
     cucumber-js runs .feature in safeword's repo, separate from vitest (integration).
     Strengthened at the scenario-gate (independent review, 2026-06-09): de-vacuumed the
     vitest-exclusion scenario (tied to the dogfood feature, not vitest's glob), added a
     hostile-title parser-validity scenario (Gherkin has no JSON.stringify escape) + a
     bodyless-scenario edge, and made the dogfood green-path assert cucumber's summary.
     R/G/R shas: AC1 → 4a9afd94 (renderer); AC2 → f4fb8374 (--format); SM1 → a088da1d (runner). -->

## Rule: Each scenario becomes a tagged Gherkin scenario under a Feature/Rule

### Scenario: gherkin-typescript.DEV1.AC1.doc_becomes_a_feature_with_rules

Given a test-definitions.md with a title and two `## Rule:` sections
When the skeleton is emitted as Gherkin
Then the output is one `Feature:` named for the title, with one `Rule:` per rule section

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC1.scenario_becomes_a_named_scenario

Given a rule holding one scenario titled `gherkin-typescript.DEV1.AC1.example`
When the skeleton is emitted as Gherkin
Then the output contains a `Scenario:` whose name is `gherkin-typescript.DEV1.AC1.example`

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC1.steps_render_as_given_when_then_and

Given a scenario whose body has a Given, a When, a Then, and an And line
When the skeleton is emitted as Gherkin
Then those lines render in order as Gherkin `Given` / `When` / `Then` / `And` steps

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC1.lineage_becomes_a_tag

Given a scenario titled `gherkin-typescript.DEV1.AC1.example`
When the skeleton is emitted as Gherkin
Then the line directly above its `Scenario:` is exactly `@gherkin-typescript.DEV1.AC1`

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC1.free_text_scenario_emits_untagged

Given a scenario whose title is free text with no AC lineage
When the skeleton is emitted as Gherkin
Then it is still emitted as a `Scenario:` with no lineage tag

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC1.hostile_title_emits_a_valid_feature

Given a scenario titled `gherkin-typescript.DEV1.AC1.has spaces (parens) and @at`
When the skeleton is emitted as Gherkin
Then the feature parses with the official `@cucumber/gherkin` parser, and the scenario's tag is exactly `@gherkin-typescript.DEV1.AC1` (the parsed AC ref, never the raw title)

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC1.bodyless_scenario_emits_a_stepless_scenario

Given a scenario with a title but no Given/When/Then lines
When the skeleton is emitted as Gherkin
Then it emits a `Scenario:` with no step lines and the feature still parses

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC1.emitted_feature_parses_with_official_parser

Given a test-definitions.md with at least one rule and scenario
When the skeleton is emitted as Gherkin
Then the output parses without error using the official `@cucumber/gherkin` parser

- [x] RED 4a9afd94
- [x] GREEN 4a9afd94
- [x] REFACTOR skip: pure renderer; cleanup folded into GREEN, no per-scenario refactor

## Rule: Gherkin is opt-in; the default stays native vitest

### Scenario: gherkin-typescript.DEV1.AC2.default_emits_vitest

Given a test-definitions.md
When codify runs with no `--format`
Then the output is native vitest — it contains `describe(` and no `Feature:`

- [x] RED f4fb8374
- [x] GREEN f4fb8374
- [x] REFACTOR skip: additive flag on the command; no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC2.format_gherkin_emits_feature

Given a test-definitions.md with two scenarios
When codify runs with `--format gherkin`
Then the output is a Gherkin feature — it contains `Feature:`, one `Scenario:` per scenario, and no `describe(`

- [x] RED f4fb8374
- [x] GREEN f4fb8374
- [x] REFACTOR skip: additive flag on the command; no per-scenario refactor

### Scenario: gherkin-typescript.DEV1.AC2.unknown_format_errors

Given a test-definitions.md
When codify runs with `--format bogus`
Then it exits non-zero with a message naming the allowed formats

- [x] RED f4fb8374
- [x] GREEN f4fb8374
- [x] REFACTOR skip: additive flag on the command; no per-scenario refactor

## Rule: safeword's own repo runs .feature via cucumber-js, separate from vitest

### Scenario: gherkin-typescript.SM1.AC1.dogfood_feature_runs_green

Given safeword's repo with cucumber-js wired and a dogfood `.feature` bound to real step definitions
When `bun run test:bdd` runs
Then cucumber-js reports `1 scenario (1 passed)` with zero undefined or pending steps and exits zero

- [x] RED a088da1d
- [x] GREEN a088da1d
- [x] REFACTOR skip: thin runner wiring; no per-scenario refactor

### Scenario: gherkin-typescript.SM1.AC1.vitest_excludes_the_dogfood_feature

Given the dogfood `.feature` that `test:bdd` runs green
When the vitest `test` script runs
Then that `.feature` is not among vitest's collected tests — the acceptance layer and the unit suite partition the tree, neither double-runs it

- [x] RED a088da1d
- [x] GREEN a088da1d
- [x] REFACTOR skip: thin runner wiring; no per-scenario refactor

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>`.

- [x] cross-scenario skip: AC1 renderer + AC2 flag + SM1 runner share parseScenarios + the codify command — no cross-scenario duplication to extract
