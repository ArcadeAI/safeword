---
id: 162
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:41:00Z
last_modified: 2026-05-18T05:41:00Z
scope: |
  Extend `session-verify-agents.ts` (or rename to `session-verify-config.ts`
  and broaden its scope) to also verify `.claude/settings.json` contains the
  expected safeword hook entries. Today the hook only self-heals the
  AGENTS.md → SAFEWORD.md link. Extension:
  - Read .claude/settings.json
  - For each hook event safeword owns (SessionStart, UserPromptSubmit,
    PreToolUse, PostToolUse, Stop), verify the safeword hook entries are
    present (matched by filterOutSafewordHooks pattern)
  - If missing, self-heal by re-adding them (using same merge function as
    `safeword setup`)
  - Log what was restored (matches existing "Created AGENTS.md" pattern)
out_of_scope: |
  - Detecting MANUAL hook customizations the user wants to keep
  - Re-running full safeword reconcile (this is just hook wiring)
  - Validating hook content / file existence (just the settings.json entries)
done_when: |
  - Hook detects and restores missing safeword hook entries in
    .claude/settings.json
  - Test: simulate user deleting safeword hooks from settings.json, session
    start restores them silently with one log line
  - Test: existing custom user hooks in settings.json are preserved
  - Template sync between `.safeword/hooks/` and templates
---

# Extend session-verify-agents.ts: also verify .claude/settings.json hook wiring

**Goal:** Catch (and self-heal) the case where safeword hooks have been stripped from `.claude/settings.json` — a user could disable hooks accidentally or by merge and not notice.

**Why:** Safeword's enforcement depends entirely on hooks being wired up in `.claude/settings.json`. If those entries are missing, every gate is silently disabled. Today nothing detects this. The session-verify-agents.ts hook already self-heals one piece of safeword config (the AGENTS.md link) — extending its scope to hook wiring is the natural fit.

## Work Log

- 2026-05-18T05:41:00Z Started: ticket created from 152 audit-skill improvement debate
