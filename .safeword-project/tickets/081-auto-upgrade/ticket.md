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

Branch: `feature/auto-upgrade` (rebased onto current main locally; **not** force-pushed — origin tip is 4 weeks stale). 7 commits, 400 LOC across 8 files. Build + typecheck pass on the rebased state.

**Files on the branch:**

- `packages/cli/templates/hooks/session-auto-upgrade.ts` (160 LOC) — upgrade trigger hook
- `packages/cli/templates/hooks/session-update-check.ts` (60 LOC) — async npm registry fetch with 24h cooldown
- `packages/cli/tests/utils/auto-upgrade.test.ts` (83 LOC) — `shouldAutoUpdate()` unit tests
- `packages/cli/src/packs/config.ts` + `src/schema.ts` + `src/templates/config.ts` — schema/config wiring
- `.claude/skills/versioning/SKILL.md` (58 LOC) — semver-discipline skill
- `scripts/check-nested-configs.ts` — whitelist for new paths

**Done-when status (verified by reading the hook code, not just file names):**

| Criterion                          | Status                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto-upgrade on session start      | ✅ Done                                                                                                                                            |
| `autoUpgrade: false` disables      | ⚠️ Done, but **field name in hook is `autoUpdate`, not `autoUpgrade`**. Spec uses `autoUpgrade`. Reconcile naming before PR.                       |
| Non-interactive (`--yes`)          | ⚠️ **Verify**: hook runs `bunx safeword@${latest} upgrade` _without_ `--yes`. Either upgrade is non-interactive by default, or this is a real bug. |
| Auto-commit upgrade                | ✅ Done — hook does inline `git add` + `git commit`. **Not blocked on ticket 078**; bypasses 078's mechanism entirely.                             |
| Network failure gracefully skipped | ✅ Done — `session-update-check.ts` try/catches the fetch ("Network failure is fine"); auto-upgrade hook exits early if cache missing              |

**Spec creep (good design, but call out in PR):**

- Patch-only auto-upgrade — minor/major bumps just notify, don't auto-apply
- Dirty working tree skip
- CI environment skip (`process.env.CI`)
- Additional env opt-out: `SAFEWORD_NO_AUTO_UPDATE`
- 24h cooldown between update checks
- Two new hooks (`session-auto-upgrade.ts` + `session-update-check.ts`) instead of extending `session-version.ts` as the spec said

**To resume (estimated ~half-day):**

1. **Decide on field name**: rename hook's `config.autoUpdate` → `autoUpgrade`, or update spec to match `autoUpdate`. Pick one. Update tests + docs accordingly.
2. **Verify `--yes` behavior**: read `packages/cli/src/commands/upgrade.ts` to confirm it's non-interactive by default. If it prompts, fix the command or pass `--yes` from the hook.
3. **Manual end-to-end smoke test**: install older safeword globally, populate `.safeword/.update-cache.json` with a newer version, trigger a session, watch the auto-upgrade run + commit.
4. **Run tests**: `bun run --cwd packages/cli test`. Confirm `auto-upgrade.test.ts` passes; check no regressions.
5. **Force-push**: `git push --force-with-lease origin feature/auto-upgrade`.
6. **Open PR**: `feat(081): auto-upgrade safeword on session start`. Body lists the spec-creep items.
