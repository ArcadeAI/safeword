Feature: Safeword recovery through dependency readiness

  @keep-safeword-recovery-runnable.TBU1.R1
  Rule: keep-safeword-recovery-runnable.TBU1.R1 — Safeword recovery remains reachable when dependency-backed commands are unavailable

    @surface.safeword-cli
    Scenario Outline: A recovery command remains available while dependencies are broken
      Given project dependency readiness is <readiness>
      When the builder invokes "<command>"
      Then the dependency-readiness guard allows the command

      Examples:
        | readiness | command                         |
        | missing   | bunx safeword@latest setup      |
        | stale     | bunx safeword@0.73.0 status     |
        | stale     | bunx safeword setup             |
        | missing   | FOO=bar bunx safeword setup     |
        | stale     | bunx safeword status --json     |
        | stale     | bunx --bun safeword doctor      |
        | missing   | bunx safeword plan --offline    |

  @keep-safeword-recovery-runnable.TBU1.R2
  Rule: keep-safeword-recovery-runnable.TBU1.R2 — The recovery exception does not make unrelated package executors runnable

    @rejection @surface.safeword-cli
    Scenario Outline: A non-recovery package command remains guarded
      Given project dependency readiness is <readiness>
      When the builder invokes "<command>"
      Then the dependency-readiness guard denies the command with its install recovery

      Examples:
        | readiness | command                                |
        | missing   | bunx vitest run                        |
        | stale     | bunx vitest run                        |
        | missing   | bunx safeword-tools setup              |
        | missing   | bunx safeword                          |
        | missing   | bunx safeword ticket list              |
        | stale     | bunx safeword setup && bunx vitest run |
        | missing   | bunx safeword setup; bunx vitest run   |
        | stale     | bunx safeword setup \|\| bunx vitest run |
        | missing   | bunx safeword setup \| bunx vitest run |
        | stale     | bunx safeword setup & bunx vitest run  |
        | missing   | bunx safeword setup $(bunx vitest run) |
        | stale     | bunx safeword setup `bunx vitest run`  |
        | missing   | bunx safeword setup <(bunx vitest run) |

    @rejection @surface.safeword-cli
    Scenario: A newline cannot hide a guarded command after recovery
      Given project dependency readiness is missing
      When the builder invokes this shell command:
        """sh
        bunx safeword setup
        bunx vitest run
        """
      Then the dependency-readiness guard denies the command with its install recovery

  @keep-safeword-recovery-runnable.TBU1.R3
  Rule: keep-safeword-recovery-runnable.TBU1.R3 — Recovery guidance names a command that the current CLI supports

    @rejection @surface.safeword-cli
    Scenario: Dogfood parity drift names the supported setup command
      Given Safeword's installed dogfood files differ from their canonical templates
      When the release parity check reports the drift
      Then its recovery guidance names "bunx safeword setup"
      And its recovery guidance does not name "bunx safeword install"
