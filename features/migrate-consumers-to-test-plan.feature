Feature: migrate consumers to test-plan

  test-runner.ts and /verify must obtain their per-language test/build commands from
  `safeword test-plan` — one source of truth — instead of each carrying its own
  language logic. The stop-hook done-gate behavior is preserved (and upgraded).

  Rule: test-plan --format sh emits an eval-able plan

    @migrate-consumers.SM1.AC3
    Scenario: An available entry becomes a cd-scoped command
      Given a repo with a "go.mod"
      And the "go" toolchain is installed
      When I render the test plan as a shell script
      Then the script contains "( cd" and "go test ./..."

    @migrate-consumers.SM1.AC3
    Scenario: An unavailable entry becomes a visible skip, not a command
      Given a repo with a "go.mod"
      And the "go" toolchain is not installed
      When I render the test plan as a shell script
      Then the script reports the go suite as skipped
      And the script does not run "go test"

    @migrate-consumers.SM1.AC3
    Scenario: Evaluating the script runs the resolved suite
      Given a repo with a root "test" script that prints "RAN_SUITE"
      When I eval the rendered shell script
      Then the output contains "RAN_SUITE"

    @migrate-consumers.SM1.AC3
    Scenario: A polyglot repo renders every language's command
      Given a repo with a root "test" script and a "pyproject.toml"
      When I render the test plan as a shell script
      Then the script includes the javascript command
      And the script includes the python command

  Rule: the stop hook resolves its suite via test-plan (no per-language strings)

    @migrate-consumers.SM1.AC1
    Scenario: test-runner.ts holds no per-language command strings
      When I read templates/hooks/lib/test-runner.ts
      Then it contains no hardcoded "cargo test --workspace", "go test ./...", or "pytest" command
      And it invokes "test-plan" via the safeword CLI

    @migrate-consumers.DEV1.AC1
    Scenario: A JS project still runs its test script and the acceptance lane
      Given a project whose package.json has a "test" and a "test:bdd" script
      When the stop-hook test runner runs
      Then both the test script and the acceptance lane are executed

    @migrate-consumers.DEV1.AC1
    Scenario: A project with no runnable suite skips without blocking
      Given a project with no test script and no language manifest
      When the stop-hook test runner runs
      Then it reports skipped and does not block

  Rule: /verify obtains its commands from test-plan (no inline language bash)

    @migrate-consumers.SM1.AC2
    Scenario: verify section 2 evals test-plan with no inline language branches
      When I read the verify skill and command
      Then section 2 evaluates "test-plan --format sh"
      And it contains no inline "uv run pytest", "go test", or "cargo test" branch
