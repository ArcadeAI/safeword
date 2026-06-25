# Spec: Auto-upgrade under Codex

## Intent

Codex users should receive safeword patch/minor updates automatically at session start, matching the Claude experience without requiring manual `safeword upgrade`.

The implementation must respect Codex's synchronous hook model and avoid racing the existing SAFEWORD.md context injection.

## References

- GitHub issue: https://github.com/ArcadeAI/safeword/issues/393
- Parent epic: `BJX7WR-auto-upgrade-cross-agent`
- Rollback hardening: `148-auto-upgrade-rollback`
- Current Claude hook: `packages/cli/templates/hooks/session-auto-upgrade.ts`
- Codex config template: `packages/cli/templates/codex/config.toml`

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Vocabulary

- **Shared apply core:** Agent-neutral auto-upgrade logic that returns typed outcomes instead of exiting the process.
- **Codex SessionStart dispatcher:** The single Codex SessionStart hook command that sequences auto-upgrade and SAFEWORD.md context output.
- **Normal notice:** A non-fatal user-facing outcome such as a major-version notification or successful applied upgrade.

## Jobs To Be Done

### auto-upgrade-codex.TB1 — Stay current in Codex without manual upgrades

**Persona:** Technical Builder (TB)

> When I start a Codex session in a safeword-managed project, I want patch and minor safeword updates to apply automatically without breaking startup context, so I can keep the guardrails current without managing safeword internals.

#### auto-upgrade-codex.TB1.AC1 — Codex startup uses one ordered safeword SessionStart path

#### auto-upgrade-codex.TB1.AC2 — Codex startup still loads SAFEWORD.md standing instructions

#### auto-upgrade-codex.TB1.AC3 — Codex notices never turn normal upgrade outcomes into hook failures

### auto-upgrade-codex.SM1 — Maintain one auto-upgrade policy across agents

**Persona:** Safeword Maintainer (SM)

> When I change safeword's auto-upgrade policy, I want the apply logic shared across Claude and Codex with agent-specific output adapters, so I can avoid drift while honoring each agent's hook contract.

#### auto-upgrade-codex.SM1.AC1 — Claude keeps its existing asyncRewake notice behavior

#### auto-upgrade-codex.SM1.AC2 — Failed upgrade applies leave no safeword-managed residue behind

## Outcomes

- A generated Codex config has exactly one safeword `SessionStart` command.
- A Codex session receives SAFEWORD.md context after the auto-upgrade check path completes.
- Claude major-version and successful-upgrade notices still surface through the existing exit-2 rewake path.
- Failed auto-upgrade attempts record strikes only after safeword-managed file residue has been rolled back.

## Open Questions

- defer: Real-world Codex timeout tuning needs timing data from an actual published upgrade; this slice uses a conservative bounded dispatcher timeout and keeps the apply gated by the existing 24h cache.
