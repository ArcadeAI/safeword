---
id: VAX3Z2
slug: cursor-changelog-alignment-epic
type: feature
phase: intake
status: open
epic: cursor-changelog-alignment
created: 2026-05-31T21:09:47.366Z
last_modified: 2026-05-31T21:09:47.366Z
---

# Epic: Cursor changelog + docs alignment (placeholder)

**Goal:** Keep safeword's Cursor integration aligned with Cursor's evolving rules/hooks/commands/MCP surfaces — same exercise as the Claude Code epic (8R54HV), for Cursor.

**Why:** Safeword already ships a real Cursor integration; when Cursor changes its agent config surfaces, our gates can silently break or miss new capabilities — exactly the risk the CC review uncovered.

## ⚠️ Placeholder — not yet researched

This epic is a stub. The findings, tiers, and child tickets do not exist yet. **Do the TODO below before treating any of this as actionable.**

## TODO — fill this out

- [ ] Read Cursor's changelog/release notes (find the canonical source — changelog.cursor.com / Cursor docs) and its current agent docs (rules `.mdc`, hooks, slash commands, MCP).
- [ ] Diff against the safeword surfaces we ship (see "Known surfaces" below).
- [ ] Triage each relevant change as **Breaks** / **Adopt** / **Watch** (same tiering as 8R54HV).
- [ ] File a child ticket per actionable finding; populate the Tickets table.
- [ ] Establish a tracked `cursor-version` baseline (mirror ticket 116's approach for CC).

## Known safeword surfaces to review against

- `.cursor/rules/*.mdc` — safeword + bdd rule set (generated).
- `.cursor/commands/*.md` — testing, lint, audit, debug, bdd, refactor, quality-review, cleanup-zombies, verify.
- `.cursor/hooks.json` — `afterFileEdit` → `.safeword/hooks/cursor/after-file-edit.ts`; `stop` → `.safeword/hooks/cursor/stop.ts`.
- `.cursor/mcp.json`.
- CLI generation: `packages/cli/src/schema.ts`, `reconcile.ts`, `templates/config.ts`.

Open question to resolve during research: does Cursor have a Stop-hook block-cap / gate-bypass analogue to CC's `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (ticket EKNEW0)? The cursor `stop.ts` hook may have the same hidden weakness.

## Tickets

_(none yet — populate after research)_

## Work Log

- 2026-05-31T21:09:47.366Z Started: Created ticket VAX3Z2
- 2026-05-31 Placeholder created. Cursor integration confirmed present (.cursor/* + .safeword/hooks/cursor/*); research pending.
