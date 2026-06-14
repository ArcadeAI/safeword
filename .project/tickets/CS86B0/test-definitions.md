# Test Definitions: `safeword codify` — emit vitest skeletons (CS86B0)

<!-- Scenario lineage: codify.DEV1.AC<#>.<name>. AC1 = faithful scenario→test
     mapping + valid-module/robustness; AC2 = pending-vs-red body style; AC3 =
     output sink + bad-input errors. AC1/AC2 are unit tests of the pure emitter
     (assert the emitted string); AC3 is command-level (temp dir: stdout / file
     written / exit code). Strengthened at the scenario-gate (independent review,
     2026-06-07): pinned the describe-name transform + escaping, broadened G/W/T
     to And-lines + no-body, added one-to-one count, added the --out I/O failure.
     RED/GREEN shas: AC1+AC2 → 0fa7bc1d (emitter); AC3 → e4fc8d91 (command). -->

## Rule: Each scenario becomes one test, grouped under its rule, lineage-named, with steps as comments

### Scenario: codify.DEV1.AC1.scenario_emits_one_named_it

Given a test-definitions.md with one rule holding one scenario titled `codify.DEV1.AC1.example`
When the skeleton is emitted with default options
Then the output is a vitest module containing exactly one test whose name is `codify.DEV1.AC1.example`

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.given_when_then_and_render_as_comments

Given a scenario whose body has a Given, a When, a Then, and an And line
When the skeleton is emitted
Then all four lines appear in order as `//` comments attached to that test

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.scenario_without_body_still_emits_a_stub

Given a scenario that has a title but no Given/When/Then lines
When the skeleton is emitted
Then a stub test named for that title is produced with no step comments

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.scenarios_group_under_their_rule_describe

Given a rule heading `## Rule: emits one test per scenario` followed by two scenarios
When the skeleton is emitted
Then both tests sit inside a single `describe` whose name is the heading text with the `Rule:` prefix removed

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.rule_heading_with_special_chars_emits_valid_module

Given a rule heading containing a backtick, a quote, and parentheses
When the skeleton is emitted
Then the emitted module parses without a syntax error because the describe name is an escaped string literal

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.rules_and_scenarios_map_one_to_one

Given a test-definitions.md with two rules holding three scenarios in total
When the skeleton is emitted
Then the output has one `describe` per rule and exactly three tests

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.free_text_scenario_still_emits_a_test

Given a scenario whose title is free text with no AC lineage
When the skeleton is emitted
Then a test named for that title is still present in the output

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.fenced_and_commented_scenarios_are_skipped

Given a scenario heading inside a fenced code block and another inside an HTML comment
When the skeleton is emitted
Then neither heading produces a test

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC1.non_rule_section_scenarios_are_excluded

Given a `## Invariants` section that contains a `### Scenario:`-shaped heading
When the skeleton is emitted
Then that heading produces no test, because only `## Rule:` sections open a describe

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

## Rule: Stubs are pending by default; `--red` makes every stub fail

> Rationale: `it.todo` keeps the suite green (a pending inventory that fits commit-on-GREEN); `--red` gives a true-RED "make them pass" board. Two boards from one source — the body style is the only difference.

### Scenario: codify.DEV1.AC2.default_emits_pending_it_todo

Given a test-definitions.md with one scenario
When the skeleton is emitted with default options
Then that scenario's body is `it.todo`

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC2.red_flag_emits_throwing_body

Given a test-definitions.md with one scenario
When the skeleton is emitted with the `--red` option
Then that scenario's body is an `it(...)` whose function throws an error

- [x] RED 0fa7bc1d
- [x] GREEN 0fa7bc1d
- [x] REFACTOR skip: cleanup folded into GREEN; pure emitter, no per-scenario refactor

## Rule: Output goes to stdout by default, or to a file that is never clobbered

### Scenario: codify.DEV1.AC3.default_prints_to_stdout

Given a ticket with a test-definitions.md and no `--out` option
When `safeword codify` runs
Then stdout holds a vitest module with one test per scenario and no file is created

- [x] RED e4fc8d91
- [x] GREEN e4fc8d91
- [x] REFACTOR skip: thin command over the emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC3.out_writes_the_file

Given a ticket with a test-definitions.md and an `--out` path that does not exist
When `safeword codify` runs
Then that path holds a vitest module with one test per scenario

- [x] RED e4fc8d91
- [x] GREEN e4fc8d91
- [x] REFACTOR skip: thin command over the emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC3.out_refuses_to_overwrite_an_existing_file

Given an `--out` path that already holds a file
When `safeword codify` runs
Then it exits non-zero with a refuse-to-overwrite message and leaves the file unchanged

- [x] RED e4fc8d91
- [x] GREEN e4fc8d91
- [x] REFACTOR skip: thin command over the emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC3.out_parent_dir_missing_errors

Given an `--out` path whose parent directory does not exist
When `safeword codify` runs
Then it exits non-zero with a message naming the path and writes nothing

- [x] RED e4fc8d91
- [x] GREEN e4fc8d91
- [x] REFACTOR skip: thin command over the emitter, no per-scenario refactor

## Rule: Bad input fails loudly and never emits an empty test file

### Scenario: codify.DEV1.AC3.missing_test_definitions_errors

Given a ticket folder with no test-definitions.md
When `safeword codify` runs
Then it exits non-zero with a message naming the missing file

- [x] RED e4fc8d91
- [x] GREEN e4fc8d91
- [x] REFACTOR skip: thin command over the emitter, no per-scenario refactor

### Scenario: codify.DEV1.AC3.scenario_less_input_errors

Given a test-definitions.md that contains no scenarios
When `safeword codify` runs
Then it exits non-zero with a "no scenarios" message and writes no output

- [x] RED e4fc8d91
- [x] GREEN e4fc8d91
- [x] REFACTOR skip: thin command over the emitter, no per-scenario refactor

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>`.

- [x] cross-scenario skip: scenarios share src/utils/test-skeleton.ts (parse + emit) and the command composes it — no cross-scenario duplication to extract
