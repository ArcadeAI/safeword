---
id: '081'
slug: auto-upgrade
title: 'Auto-upgrade safeword on session start'
type: Improvement
status: open
epic: setup-lifecycle
---

# Task: Auto-upgrade safeword on session start

**Type:** Improvement
**Epic:** setup-lifecycle

**Scope:** On Claude/Cursor session start, check if a newer version of safeword is available. If so, run `safeword upgrade` automatically. Controlled by a user setting so teams can opt out.

**Out of Scope:** Major version upgrades (breaking changes), upgrading without network access, changing how `safeword upgrade` works internally.

**Context:** Currently users must manually run `safeword upgrade` to get new hooks, guides, and linter configs. Most users don't know when a new version is available. The session-start hook (`session-version.ts`) already checks the installed version — extending it to trigger an upgrade is a natural progression.

## Design

**Detection (session-version.ts already does this):**

1. Read `.safeword/config.json` → installed version
2. Compare against latest published version (npm registry or bundled manifest)

**Upgrade trigger:**

1. If newer version available AND `autoUpgrade` setting is enabled (default: true)
2. Run `bunx safeword@latest upgrade --yes` (non-interactive)
3. Auto-commit the upgrade (uses ticket 078's auto-commit)
4. Log the upgrade in session output

**Settings:**

- `autoUpgrade: true | false` (default: `true`)
- Stored in `.safeword/config.json` alongside existing `version` and `installedPacks`

## Files

- `packages/cli/templates/hooks/session-version.ts` — add upgrade trigger
- `packages/cli/src/commands/upgrade.ts` — ensure `--yes` flag works non-interactively
- `.safeword/config.json` schema — add `autoUpgrade` setting

**Done When:**

- [ ] Session start auto-upgrades when newer version is available
- [ ] `autoUpgrade: false` in config.json disables auto-upgrade
- [ ] Upgrade is non-interactive (no prompts)
- [ ] Upgrade output is committed automatically (depends on 078)
- [ ] Network failure gracefully skipped with warning

## Work Log

### 2026-05-07 Resume notes (audit of `feature/auto-upgrade` branch)

Branch: `feature/auto-upgrade` (rebased onto current main locally; not pushed). 7 commits, 400 LOC across 8 files.

**Files on the branch:**

- `packages/cli/templates/hooks/session-auto-upgrade.ts` (160 LOC) — upgrade trigger hook
- `packages/cli/templates/hooks/session-update-check.ts` (60 LOC) — update detection
- `packages/cli/tests/utils/auto-upgrade.test.ts` (83 LOC) — `shouldAutoUpdate()` unit tests
- `packages/cli/src/packs/config.ts` + `src/schema.ts` + `src/templates/config.ts` — schema/config wiring (likely `autoUpgrade` setting)
- `.claude/skills/versioning/SKILL.md` (58 LOC) — semver-discipline skill
- `scripts/check-nested-configs.ts` — whitelist for new paths

**Done-when status (best read without running):**

| Criterion                          | Status                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Auto-upgrade on session start      | ✅ Likely done — `session-auto-upgrade.ts` covers it                          |
| `autoUpgrade: false` disables      | 🟡 Probably done — schema/config updates support a setting                    |
| Non-interactive (`--yes`)          | ❓ Verify — depends on `safeword upgrade --yes` working non-interactively     |
| Auto-commit upgrade                | ❌ **Blocked on ticket 078** — `078-auto-commit-setup` is also `status: open` |
| Network failure gracefully skipped | ❓ Verify in `session-update-check.ts`                                        |

**Divergence from spec:** Original design said "extend `session-version.ts`". Branch instead added two NEW hooks (`session-auto-upgrade.ts` + `session-update-check.ts`). May be a deliberate split-of-concerns refactor; reconcile in PR description.

**To resume:**

1. Decide on auto-commit (criterion 4): ship without it (TODO ref 078), or wait until 078 lands
2. Read `session-auto-upgrade.ts` + `session-update-check.ts` to confirm criteria 3 + 5
3. Manual end-to-end test: install older safeword globally, trigger session, watch it auto-upgrade
4. Reconcile two-new-hooks vs spec's "extend session-version.ts" in PR description
5. Open PR (estimated ~half-day from this point)
