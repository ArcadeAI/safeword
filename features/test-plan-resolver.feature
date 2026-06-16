Feature: test-plan resolver

  safeword needs one resolver that, given a repo, emits the test/build commands
  for EVERY language present — so consumers stop duplicating language logic and a
  polyglot done-gate cannot go green with a language untested. The resolver is
  plan-only: each entry carries the command string it WOULD run, never its result.

  Rule: Every detected language appears in the plan (no first-match)

    @test-plan-resolver.DEV1.AC1
    Scenario: A JS+Python repo yields exactly a javascript and a python entry
      Given a repo with a root "test" script and a "pyproject.toml"
      When I request the test plan
      Then the plan includes a "javascript" entry
      And the plan includes a "python" entry
      And the plan has exactly 2 entries

    @test-plan-resolver.DEV1.AC1
    Scenario: A Go+Rust repo yields both a go and a rust entry
      Given a repo with a "go.mod" and a "Cargo.toml"
      When I request the test plan
      Then the plan includes a "go" entry
      And the plan includes a "rust" entry

    @test-plan-resolver.DEV1.AC1
    Scenario: A package.json with an empty scripts object contributes no javascript entry
      Given a repo with a "go.mod" and a "package.json" with an empty scripts object
      When I request the test plan
      Then the plan includes a "go" entry
      And the plan has no "javascript" entry

    @test-plan-resolver.DEV1.AC1
    Scenario: A malformed manifest is skipped without dropping other languages
      Given a repo with a "go.mod" and a "package.json" containing invalid JSON
      When I request the test plan
      Then the plan includes a "go" entry
      And the plan has no "javascript" entry

    @test-plan-resolver.DEV1.AC1
    Scenario: A repo with no recognized manifest yields an empty plan
      Given a repo with no recognized language manifest
      When I request the test plan
      Then the plan is empty

  Rule: The command reflects the detected runner

    @test-plan-resolver.DEV1.AC2
    Scenario: Python with a tox.ini runs tox
      Given a Python repo with a "tox.ini"
      When I request the test plan
      Then the "python" entry command is "tox"

    @test-plan-resolver.DEV1.AC2
    Scenario: Python with no pytest falls back to unittest
      Given a Python repo with no pytest configuration
      And only the "python" toolchain is installed
      When I request the test plan
      Then the "python" entry command is "python -m unittest discover"

    @test-plan-resolver.DEV1.AC2
    Scenario: A uv-locked Python repo runs pytest through uv
      Given a Python repo with a "uv.lock" and pytest configured
      And the "uv" and "pytest" toolchains are installed
      When I request the test plan
      Then the "python" entry command is "uv run pytest"

    @test-plan-resolver.DEV1.AC2
    Scenario: Rust uses nextest when it is installed
      Given a Rust repo
      And the "cargo" and "cargo-nextest" toolchains are installed
      When I request the test plan
      Then the "rust" entry command is "cargo nextest run --workspace && cargo test --doc"

    @test-plan-resolver.DEV1.AC2
    Scenario: Rust falls back to cargo test --workspace without nextest
      Given a Rust repo
      And only the "cargo" toolchain is installed
      When I request the test plan
      Then the "rust" entry command is "cargo test --workspace"

    @test-plan-resolver.DEV1.AC2
    Scenario: A Go workspace expands its modules in the emitted command
      Given a Go repo with a "go.work"
      When I request the test plan
      Then the "go" entry command is "go test $(go list -f '{{.Dir}}/...' -m | xargs)"

    @test-plan-resolver.DEV1.AC2
    Scenario: A pnpm JS repo runs its test script through pnpm
      Given a repo with a root "test" script and a "pnpm-lock.yaml"
      When I request the test plan
      Then the "javascript" entry command is "pnpm run test"

  Rule: Missing toolchains stay visible, never dropped

    @test-plan-resolver.DEV1.AC3
    Scenario: A Go repo with no go binary still appears, marked unavailable
      Given a repo with a "go.mod"
      And the "go" toolchain is not installed
      When I request the test plan
      Then the plan includes a "go" entry
      And the "go" entry is marked unavailable

  Rule: Nested and vendored manifests are handled

    @test-plan-resolver.DEV1.AC4
    Scenario: A manifest in a sub-directory is discovered
      Given a repo with a "services/api/pyproject.toml" and no root manifest
      When I request the test plan
      Then the plan includes a "python" entry

    @test-plan-resolver.DEV1.AC4
    Scenario: A manifest inside an excluded directory is ignored
      Given a repo with a "Cargo.toml" only under "target"
      When I request the test plan
      Then the plan has no "rust" entry

  Rule: The build plan emits native build commands

    @test-plan-resolver.DEV1.AC5
    Scenario: Build plan emits per-language build commands
      Given a repo with a "go.mod", a "Cargo.toml", and a root "build" script
      When I request the build plan
      Then the "go" entry command is "go build ./..."
      And the "rust" entry command is "cargo build --workspace"
      And the plan has no "python" entry

    @test-plan-resolver.DEV1.AC5
    Scenario: Build plan omits a JS entry when there is no build script
      Given a repo with a "go.mod" and a "package.json" with no "build" script
      When I request the build plan
      Then the plan includes a "go" entry
      And the plan has no "javascript" entry

  Rule: The resolver is reachable as one CLI surface

    @test-plan-resolver.SM1.AC1
    Scenario: The CLI prints the resolved plan as JSON
      Given a repo with a "go.mod"
      When I run the test-plan CLI as JSON
      Then the output is a JSON array containing an entry with language "go"
      And that entry has a non-empty "command" and a boolean "available"
