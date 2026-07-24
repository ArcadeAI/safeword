# Work Log: Let new Codex users install Safe Word without a migration

**Anchored to:** `.project/tickets/Q7Q7H8-install-codex-plugin-for-new-users/ticket.md`

---

## Session: 2026-07-21

- [23:30] Found: `migrate codex-plugin` installs and verifies a fresh profile plugin, but setup, upgrade, and public docs use its migration-only name for new users.
- [23:35] Decision: add `codex install` for profile installation; reserve `codex migrate --remove-legacy-hooks` for explicit hook cleanup; preserve the old route as a compatibility alias.
- [23:40] Defined behavior dimensions and executable feature scenarios before implementation.
- [23:45] RED: `bun run --cwd packages/cli test:bdd -- features/install-codex-plugin-for-new-users.feature` found six undefined new steps. It also exposed the pre-existing missing-Bun scenario failure in `migrate-codex-to-plugin.feature`.
- [23:50] Plan: profile installation and legacy project cleanup share verification code but have separate CLI routes; the old route stays a compatibility facade.
- [00:00] GREEN: focused command integration passed 49/49; targeted BDD passed 6/6 scenarios and 72/72 steps.
- [00:05] REFACTOR: Reused the existing upgrade acceptance action; all scenario loops are complete and no further shared abstraction is warranted.
- [00:10] REVIEW: Current OpenAI documentation confirms `codex plugin marketplace add`, `codex plugin add --json`, and `codex plugin list --json`; it also requires a new Codex session before newly installed plugin capabilities are available. Added that user-facing step with a red/green regression test.
- [00:15] VERIFY: Focused command regression 49/49; new BDD lane 6/6 scenarios, 73/73 steps; CLI and website builds, lint, typecheck, changed-source formatting, config drift, dependency-cruiser, and Knip passed. Repaired the missing-Bun fixture, then full BDD passed 490 scenarios with 3 intentional skips. Verify, audit, and quality-review invocation records now use the current Codex thread identity. The broad Vitest suite stalled without output after eleven minutes and was stopped; ticket remains in progress pending an independently reproducible full-suite result and audit-dependency triage.
