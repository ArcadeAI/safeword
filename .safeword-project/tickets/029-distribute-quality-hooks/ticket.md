---
id: 029
slug: distribute-quality-hooks
type: feature
status: in_progress
phase: done
---

# Distribute Quality Gate Hooks to Consumer Projects

**Goal:** Ship all 4 quality enforcement hooks (`pre-tool-quality.ts`, `post-tool-quality.ts`, `pre-tool-config-guard.ts`, `post-tool-bypass-warn.ts`) + shared lib (`lib/quality-state.ts`) via `safeword setup` and `safeword upgrade` so consumer projects get the same TDD refactor gate, LOC gate, phase gate, config protection, and bypass warnings that the dogfood repo has.

**Scope:**

- Add 5 template files to `packages/cli/templates/hooks/`
- Register in `schema.ts` `ownedFiles`
- Add `PreToolUse` + additional `PostToolUse` entries to `SETTINGS_HOOKS` in `config.ts`
- Normalize `pre-tool-quality.ts` to use JSON `permissionDecision` API (not exit 2)
- Widen `post-tool-quality.ts` PostToolUse matcher to include `Bash` for commit detection
- Update tests in `config.test.ts`

**Out of scope:**

- Cursor hook equivalents (separate ticket if needed)
- New gate types beyond existing 3 (loc, refactor, phase)

**Context:** Discovered via quack project (v0.17.0) — agent ran 6 consecutive `feat:` commits without refactoring because quality gate hooks were never packaged for distribution. See conversation history.

## Work Log

- 2026-03-15T14:49Z Started: Ticket created from investigation
- 2026-03-15T14:50Z Complete: Phase 0-2 - Context established from prior investigation
- 2026-03-15T14:51Z Complete: Phase 3-4 - 8 scenarios defined and validated
- 2026-03-15T14:52Z Complete: Phase 5 - Decomposed into 7 tasks
