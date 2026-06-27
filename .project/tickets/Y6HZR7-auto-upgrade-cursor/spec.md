# Spec: Auto-upgrade under Cursor

## Intent

Cursor users should receive safeword patch/minor upgrades at session start without running `safeword upgrade` manually and without weakening Cursor startup.

## References

- Parent epic: `BJX7WR-auto-upgrade-cross-agent`
- Shared apply core: PR #433
- Cursor wrapper: PR #447
- Cursor safety hardening: PR #463

## Personas

- Technical Builder (TB)

## Vocabulary

- **Silent auto-upgrade:** A Cursor `sessionStart` hook that applies safe safeword upgrades without surfacing hook output.
- **Durable record:** The git commit created by the shared auto-upgrade core when an upgrade applies.

## Jobs To Be Done

### auto-upgrade-cursor.TB1 — Stay current in Cursor without manual upgrade work

**Persona:** Technical Builder (TB)

> When I start a Cursor agent session in a safeword-managed project, I want safe safeword upgrades to apply automatically, so I can keep the guardrails current without remembering a manual command.

#### auto-upgrade-cursor.TB1.AC1 — Cursor startup runs context injection and silent auto-upgrade

#### auto-upgrade-cursor.TB1.AC2 — Cursor uses the same auto-upgrade implementation as the other agents

#### auto-upgrade-cursor.TB1.AC3 — Cursor edits do not race an in-flight silent upgrade

## Outcomes

- Cursor setup installs the SAFEWORD context hook first and silent auto-upgrade hook second.
- Cursor auto-upgrade exits `0` and stays silent when no upgrade applies.
- Cursor, Claude Code, and Codex wrappers share the same apply core.
- Cursor write and shell gates wait while silent auto-upgrade is running.

## Open Questions

- defer: Rich user-visible Cursor notifications for major-version or repeated-failure outcomes are a follow-up, not part of this slice.
