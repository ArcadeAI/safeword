---
id: Z10A9Q
slug: reload-skills-on-upgrade
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.534Z
last_modified: 2026-05-31T21:05:09.534Z
---

# Emit reloadSkills:true from setup/upgrade SessionStart

**Goal:** Make freshly installed/upgraded safeword skills available in the same session instead of requiring a restart.

**Why:** Safeword auto-upgrades on SessionStart and installs skills during setup, but those skills only become usable after a CC restart. CC `2.1.152` added a SessionStart signal that fixes exactly this.

## Finding (CC 2.1.152)

> `SessionStart` hooks can return `reloadSkills: true` to make installed skills available same session
> Added `/reload-skills` to re-scan directories without restart

## Evidence in safeword

- `.safeword/hooks/session-auto-upgrade.ts` performs the upgrade then `console.log`s plain text and `process.exit(0)` (`:124`, `:149`) — it never emits structured `hookSpecificOutput`, so newly written skills aren't loaded until restart.
- A working JSON-output model already exists: `.safeword/hooks/session-start-reentry.ts:86` emits `{ hookSpecificOutput: { additionalContext } }`.

## Approach

- After a successful auto-upgrade (and after `safeword setup` when run via a SessionStart path), emit `{ hookSpecificOutput: { hookEventName: 'SessionStart', reloadSkills: true } }` so CC re-scans skill dirs.
- Only set it when files actually changed (avoid needless re-scan on no-op sessions).
- Confirm the exact JSON shape/key against current CC hook docs before wiring.

## Done when

- A successful auto-upgrade emits `reloadSkills: true`; a no-op session does not.
- Verified that upgraded skills are invocable in the same session (dogfood).
- Output shape confirmed against current CC docs; both template (`packages/cli/templates/hooks/`) and installed copy updated.

## Out of scope

- Setup flows that don't run inside a session (plain CLI `bunx safeword setup` in a shell) — no session to reload.

## Work Log

- 2026-05-31T21:05:09.534Z Started: Created ticket Z10A9Q
- 2026-05-31 Confirmed auto-upgrade hook emits only plain text; reentry hook shows the JSON pattern to reuse.
