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
