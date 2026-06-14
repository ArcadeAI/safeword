@codex-min-version-baseline
Feature: Codex minimum version baseline

  Safeword setup warns when the locally installed Codex CLI is too old for the
  supported hook gates.

  Rule: Setup reports unsupported Codex versions without blocking setup

    @codex-min-version-baseline.SM1.AC1
    Scenario: codex-min-version-baseline.SM1.AC1.old_codex_cli_gets_setup_warning
      Given a project has Codex CLI version `0.132.0` on PATH
      When safeword setup reconciles the project
      Then setup warns that Codex `0.132.0` is below the required `0.133.0` baseline
