Feature: migrate consumers to test-plan

  test-runner.ts and /verify must obtain their per-language test/build commands from
  `safeword project test-plan` — one source of truth — instead of each carrying its own
  language logic. The shell plan and stop-hook runner both consume the resolved
  plan, execute available suites, and fail closed when a suite or required runner
  is unavailable; the active scenarios below exercise both consumers.

  Rule: test-plan --format sh emits an eval-able plan

    @migrate-consumers.SM1.AC3
    Scenario: An available entry becomes a cd-scoped command
      Given a repo with a "go.mod"
      And the "go" toolchain is installed
      When I render the test plan as a shell script
      Then the script contains "( cd" and "go test ./..."

    @migrate-consumers.SM1.AC3
    Scenario: An unavailable entry becomes a visible failing lane, not a command
      Given a repo with a "go.mod"
      And the "go" toolchain is not installed
      When I eval the rendered shell script
      Then the script contains the line "Go test lane skipped: go is not installed."
      And the script contains no runnable "go test" command outside that diagnostic
      And the eval exits non-zero

    @migrate-consumers.SM1.AC3
    Scenario: Evaluating the script runs the resolved suite
      Given a repo with a root "test" script that prints "RAN_SUITE"
      When I eval the rendered shell script
      Then the eval output contains "RAN_SUITE"
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
      And the rendered plan is empty

    @migrate-consumers.SM1.AC3
    Scenario: A polyglot repo renders every language's command
      Given a repo with a root "test" script and a "pyproject.toml"
      And a repo with a "bun.lock"
      And the repo has a discoverable Python test file
      And the "bun" toolchain is installed
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
    Scenario: test-runner.ts holds no native-language test commands
      When I read templates/hooks/lib/test-runner.ts
      Then it contains no hardcoded "cargo test", "go test", or "pytest" command
      And it does not define "nativeTestCommand", "getJsTestCommands", or "pythonTestCommand"
      And it invokes "project test-plan" via the safeword CLI

    @migrate-consumers.TB1.AC1
    Scenario: A JS project still runs its test script and the acceptance lane
      Given a project whose package.json has a "test" and a "test:bdd" script
      When the stop-hook test runner runs
      Then both the test script and the acceptance lane are executed

    @migrate-consumers.TB1.AC1
    Scenario: A failing JS suite still blocks the stop hook
      Given a repo with a root "test" script that exits non-zero
      When the stop-hook test runner runs
      Then the stop-hook reports the failing suite and blocks

    @migrate-consumers.TB1.AC1
    Scenario: An unavailable required runner blocks the stop hook
      Given a repo with a "go.mod"
      And the "go" toolchain is not installed
      When the stop-hook test runner runs
      Then the stop-hook reports the missing runner and blocks

    @migrate-consumers.TB1.AC1
    Scenario: A project with no runnable suite skips without blocking
      Given a project with no test script and no language manifest
      When the stop-hook test runner runs
      Then it reports skipped and does not block

  Rule: /verify obtains its commands from test-plan (no inline language bash)

    @migrate-consumers.SM1.AC2
    Scenario: verify section 2 evals test-plan for both test and build, with no inline language branches
      When I read the verify source surfaces
      Then the verify command points to the verify skill
      And section 2 of the verify skill evaluates "project test-plan --format sh"
      And section 2 of the verify skill contains no inline language test branch ("uv run pytest", "go test", "cargo test")
      And section 2 of the verify skill contains no inline language build branch ("go build", "cargo build")
