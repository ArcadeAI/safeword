# Test Definitions: cucumber-js lane as core setup (102b)

<!-- Lineage: gherkin-setup.DEV1.AC#.<name>. AC1 = setup scaffolds the lane
     (integration: built CLI on temp fixtures); AC2 = the non-JS package.json
     delta (integration); AC3 = the lane runs green out of the box (golden-path,
     TS + Go fixtures). Re-run safety scenarios protect customer edits. -->

## Rule: `safeword setup` scaffolds the cucumber-js lane as standard output

### Scenario: gherkin-setup.DEV1.AC1.ts_project_gets_the_lane_files

Given a TypeScript project with a package.json
When `safeword setup` runs
Then the project gains `cucumber.mjs`, a `features/` starter feature, and a `steps/` scaffold (world, shared steps, barrel)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: gherkin-setup.DEV1.AC1.deps_and_script_are_added

Given a TypeScript project with a package.json
When `safeword setup` runs
Then the package.json gains `@cucumber/cucumber` and `tsx` as devDependencies and a `test:bdd` script that invokes cucumber-js

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: gherkin-setup.DEV1.AC1.existing_package_json_content_is_preserved

Given a package.json with an existing `test` script and an existing devDependency
When `safeword setup` runs
Then those existing entries are unchanged alongside the added lane entries

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A repo with no package.json gets a minimal one to host the lane

### Scenario: gherkin-setup.DEV1.AC2.pure_go_repo_gets_a_minimal_package_json

Given a pure Go project (a `go.mod`, no package.json)
When `safeword setup` runs
Then a minimal private package.json is created and the lane files are scaffolded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: gherkin-setup.DEV1.AC2.polyglot_repo_merges_into_its_existing_package_json

Given a project with both a `go.mod` and a package.json
When `safeword setup` runs
Then no new package.json is created — the lane's deps and script merge into the existing one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The scaffolded lane runs green out of the box

### Scenario: gherkin-setup.DEV1.AC3.starter_feature_runs_green_in_a_ts_project

Given a freshly set-up TypeScript project with dependencies installed
When the `test:bdd` script runs
Then cucumber-js reports the starter scenario passing with zero undefined or pending steps and exits zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: gherkin-setup.DEV1.AC3.starter_feature_runs_green_in_a_pure_go_project

Given a freshly set-up pure Go project with dependencies installed
When the `test:bdd` script runs
Then cucumber-js reports the starter scenario passing and exits zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The lane's working files belong to the customer after creation

> Rationale: `features/` and `steps/` are where the customer writes their tests — safeword scaffolds them once; an upgrade or re-run must never clobber customer work. (Config like `cucumber.mjs` stays safeword-owned.)

### Scenario: gherkin-setup.DEV1.AC1.customer_edited_steps_survive_a_rerun

Given a set-up project where the developer has edited a scaffolded steps file
When `safeword setup` runs again
Then the edited steps file keeps the developer's content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: gherkin-setup.DEV1.AC1.customer_feature_files_survive_a_rerun

Given a set-up project where the developer has added their own `.feature` file
When `safeword setup` runs again
Then that `.feature` file is untouched

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>`.

- [ ] cross-scenario
