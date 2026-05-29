---
id: 975N5T
slug: auto-upgrade-skip-dogfood-repo
type: task
phase: intake
status: in_progress
created: 2026-05-29T22:28:18.306Z
last_modified: 2026-05-29T22:28:18.306Z
---

# Auto-upgrade should skip the safeword dev (dogfood) repo

**Goal:** Make `session-auto-upgrade.ts` detect the safeword dev (dogfood) repo and skip the auto-upgrade entirely — e.g. if `packages/cli/templates/` exists (the canonical source) or the root `package.json` name is the safeword package itself, no-op instead of re-installing the published version.

**Why:** In the dogfood repo the source of truth is `packages/cli/templates/`; `.safeword/` + `.claude/` are deployed mirrors of those LOCAL templates, which are routinely ahead of the published npm version. The auto-upgrade re-installs the _published_ files over the deployed mirrors — a regression (this session it stripped the unreleased SW1SE5 wiring out of `.safeword/hooks/stop-quality.ts`) — then tries to commit, which the pre-commit dogfood-direction guard correctly blocks. Net: every session the upgrade fails, leaves a dirty/regressed working tree that must be `git restore`d by hand, and re-fires next session (deployed version stays behind the package). A self-skip guard ends the loop. Consider also: the guard should be reliable even mid-merge; and decide whether the deployed `.safeword/version` should track local (canonical) rather than published. Observed 2026-05-29 (v0.39.0→0.39.1).

## Work Log

- 2026-05-29T22:28:18.306Z Started: Created ticket 975N5T
