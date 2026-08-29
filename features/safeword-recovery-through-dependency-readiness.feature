Feature: Safeword recovery through dependency readiness

  @keep-safeword-recovery-runnable.TBU1.R1
  Rule: keep-safeword-recovery-runnable.TBU1.R1 — Safeword recovery remains reachable when dependency-backed commands are unavailable

    @surface.claude-code
    Scenario Outline: A recovery command remains available while dependencies are broken
      Given project dependency readiness is <readiness>
      When the builder invokes "<command>"
      Then the dependency-readiness guard allows the command

      Examples:
        | readiness | command                       |
        | missing   | bunx safeword@latest setup    |
        | stale     | bunx safeword@0.73.0 status   |
        | stale     | bunx safeword@latest setup           |
        | missing   | FOO=bar bunx safeword@latest setup   |
        | stale     | bunx safeword@latest status --json   |
        | stale     | bunx --bun safeword@latest doctor    |
        | stale     | bunx --bun safeword@0.82.0 retro run --transcript session.jsonl --auto-extract |
        | missing   | bunx safeword@latest plan --offline  |
        | missing   | bunx safeword@latest --cwd . setup   |
        | stale     | bunx safeword@latest --cwd=. setup   |
        | stale     | bunx safeword@latest --quiet doctor  |
        | stale     | bunx safeword@latest setup && bunx safeword@latest doctor |
        | missing   | bunx safeword@latest status benign-positional-argument |
        | missing   | bunx safeword@latest --cwd 'a && b' setup |

  @keep-safeword-recovery-runnable.TBU1.R2
  Rule: keep-safeword-recovery-runnable.TBU1.R2 — The recovery exception does not make unrelated package executors runnable

    @rejection @surface.claude-code
    Scenario Outline: A non-recovery package command remains guarded
      Given project dependency readiness is <readiness>
      When the builder invokes "<command>"
      Then the dependency-readiness guard denies the command with its install recovery

      Examples:
        | readiness | command                                |
        | missing   | bunx vitest run                        |
        | stale     | bunx vitest run                        |
        | missing   | bunx safeword-tools setup              |
        | missing   | bunx @scope/safeword setup             |
        | missing   | bunx safeword                          |
        | stale     | bunx safeword setup                    |
        | missing   | bunx safeword ticket list              |
        | stale     | bunx safeword setupx                   |
        | missing   | bunx safeword --unknown-flag setup     |
        | missing   | bunx safeword --cwd setup              |
        | stale     | bunx safeword setup && bunx vitest run |
        | missing   | bunx safeword setup; bunx vitest run   |
        | stale     | bunx safeword setup \|\| bunx vitest run |
        | missing   | bunx safeword setup \| bunx vitest run |
        | stale     | bunx safeword setup & bunx vitest run  |
        | missing   | bunx safeword setup $(bunx vitest run) |
        | stale     | bunx safeword setup `bunx vitest run`  |
        | missing   | bunx safeword setup <(bunx vitest run) |
        | stale     | bunx safeword setup >(bunx vitest run) |
        | missing   | FOO=$(vitest) bunx safeword setup |
        | stale     | FOO=bar BAR=$(vitest) bunx safeword setup |
        | missing   | bunx vitest run && bunx safeword setup |

    @rejection @surface.claude-code
    Scenario: A newline cannot hide a guarded command after recovery
      Given project dependency readiness is missing
      When the builder invokes this shell command:
        """sh
        bunx safeword setup
        bunx vitest run
        """
      Then the dependency-readiness guard denies the command with its install recovery

  @keep-safeword-recovery-runnable.TBU1.R3
  Rule: keep-safeword-recovery-runnable.TBU1.R3 — Parity recovery guidance names a command that the current CLI supports

    @rejection @surface.safeword-cli
    Scenario: Dogfood parity drift names the canonical install command
      Given the release parity check found drift in "hooks/lib/dependency-readiness.ts"
      When it reports that drift to the maintainer
      Then the report names the drifted file
      And its recovery guidance names "bunx safeword@latest install"
      And its recovery guidance does not name "bunx safeword setup"
