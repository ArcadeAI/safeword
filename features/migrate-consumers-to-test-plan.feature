Feature: migrate consumers to test-plan

  test-runner.ts and /verify must obtain their per-language test/build commands from
  `safeword test-plan` — one source of truth — instead of each carrying its own
  language logic. The stop-hook done-gate behavior is preserved (and upgraded):
  the eval-able plan runs the right suites and still fails when a suite fails.

  Rule: test-plan --format sh emits an eval-able plan

    @migrate-consumers.SM1.AC3
    Scenario: An available entry becomes a cd-scoped command
      Given a repo with a "go.mod"
      And the "go" toolchain is installed
      When I render the test plan as a shell script
      Then the script contains "( cd" and "go test ./..."

    @migrate-consumers.SM1.AC3
    Scenario: An unavailable entry becomes a visible skip line, not a command
      Given a repo with a "go.mod"
      And the "go" toolchain is not installed
      When I render the test plan as a shell script
      Then the script contains the line "echo \"⏭️ Skipped — go not installed\""
      And the script contains no runnable "go test" command outside that echo

    @migrate-consumers.SM1.AC3
    Scenario: Evaluating the script runs the resolved suite
      Given a repo with a root "test" script that prints "RAN_SUITE"
      When I eval the rendered shell script
      Then the output contains "RAN_SUITE"
      And the eval exits zero

    @migrate-consumers.SM1.AC3
    Scenario: Evaluating the script fails when a suite fails
      Given a repo with a root "test" script that exits non-zero
      When I eval the rendered shell script
      Then the eval exits non-zero

    @migrate-consumers.SM1.AC3
    Scenario: An empty plan evals to a clean no-op
      Given a repo with no recognized language manifest and no test script
      When I eval the rendered shell script
      Then the eval exits zero
      And no suite command is run

    @migrate-consumers.SM1.AC3
    Scenario: A polyglot repo renders every language's command
      Given a repo with a root "test" script and a "pyproject.toml"
      And the "pytest" toolchain is installed
      When I render the test plan as a shell script
      Then the script contains "run test"
      And the script contains "pytest"

    @migrate-consumers.SM1.AC3
    Scenario: The shell plan honors --kind build
      Given a repo with a "go.mod"
      And the "go" toolchain is installed
      When I render the build plan as a shell script
      Then the script contains "go build"

  Rule: the stop hook resolves its suite via test-plan (no per-language strings)

    @migrate-consumers.SM1.AC1
    Scenario: test-runner.ts holds no per-language command strings
      When I read templates/hooks/lib/test-runner.ts
      Then it contains no hardcoded "cargo test", "go test", "pytest", or "uv run pytest" command
      And it does not define "nativeTestCommand", "getJsTestCommands", or "pythonTestCommand"
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
    Scenario: verify section 2 evals test-plan for both test and build, with no inline language branches
      When I read the verify skill and the verify command
      Then section 2 of each evaluates "test-plan --format sh"
      And section 2 of each contains no inline language test branch ("uv run pytest", "go test", "cargo test")
      And section 2 of each contains no inline language build branch ("go build", "cargo build")
