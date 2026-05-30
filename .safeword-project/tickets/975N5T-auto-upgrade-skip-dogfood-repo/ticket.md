---

id: 975N5T
slug: auto-upgrade-skip-dogfood-repo
type: task
phase: implement
status: in_progress
created: 2026-05-29T22:28:18.306Z
last_modified: 2026-05-30T15:46:00.000Z
scope:

- New pure helper `isDogfoodRepo(projectDirectory)` in `templates/hooks/lib/` — returns true when `packages/cli/templates/` exists OR a root `package.json` is named `safeword`. Plain file reads (mid-merge-safe).
- Guard at the top of `session-auto-upgrade.ts` (right after the `.safeword/` existence check): if `isDogfoodRepo(projectDir)` → `process.exit(0)` silently, before any version compare, cache read, "available" message, or `bunx safeword upgrade`.
- Unit tests for the helper; register the lib in `schema.ts`; sync template ↔ `.safeword/` mirror.
  out_of_scope:
- Making `.safeword/version` track the local/canonical version instead of published — the skip guard already stops the destructive upgrade; the stale version file is inert once nothing reads it to trigger an install. Separate follow-up if notify-noise remains.
- Changing the consumer-repo auto-upgrade path — untouched; only the dogfood repo is skipped.
- The pre-commit dogfood-direction guard — already correctly blocks the bad commit; this removes the upstream cause.
  done_when:
- In the safeword dev repo, session start runs no auto-upgrade and prints no "vX available" / "Auto-upgrading" message.
- A consumer-shaped project (has `.safeword/`, no `packages/cli/templates/`, package.json not named `safeword`) still auto-upgrades as before.
- `isDogfoodRepo` unit tests cover: templates-dir present, package-name `safeword`, neither (consumer), unreadable/absent package.json.
- Full suite + lint green; templates synced.

# Auto-upgrade should skip the safeword dev (dogfood) repo

**Goal:** Make `session-auto-upgrade.ts` detect the safeword dev (dogfood) repo and skip the auto-upgrade entirely — e.g. if `packages/cli/templates/` exists (the canonical source) or the root `package.json` name is the safeword package itself, no-op instead of re-installing the published version.

**Why:** In the dogfood repo the source of truth is `packages/cli/templates/`; `.safeword/` + `.claude/` are deployed mirrors of those LOCAL templates, which are routinely ahead of the published npm version. The auto-upgrade re-installs the _published_ files over the deployed mirrors — a regression (this session it stripped the unreleased SW1SE5 wiring out of `.safeword/hooks/stop-quality.ts`) — then tries to commit, which the pre-commit dogfood-direction guard correctly blocks. Net: every session the upgrade fails, leaves a dirty/regressed working tree that must be `git restore`d by hand, and re-fires next session (deployed version stays behind the package). A self-skip guard ends the loop. Consider also: the guard should be reliable even mid-merge; and decide whether the deployed `.safeword/version` should track local (canonical) rather than published. Observed 2026-05-29 (v0.39.0→0.39.1).

## Work Log

- 2026-05-29T22:28:18.306Z Started: Created ticket 975N5T
