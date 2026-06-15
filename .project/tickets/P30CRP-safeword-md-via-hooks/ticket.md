---
id: P30CRP
slug: safeword-md-via-hooks
parent: VKNF1T-platform-uplift-epic
type: feature
phase: implement
status: in_progress
created: 2026-06-10T04:32:59.298Z
last_modified: 2026-06-14T00:00:00.000Z
scope:
  - Deliver SAFEWORD.md through safeword-owned hook/config surfaces instead of prepending safeword references into customer-owned CLAUDE.md and AGENTS.md files.
  - Add a shared session context hook that reads .safeword/SAFEWORD.md and emits model-visible context for Claude Code, Cursor, and Codex startup/session-start hooks.
  - Keep Claude Code compaction resilience by running the same SAFEWORD context injection from the existing compact SessionStart path.
  - Remove the setup/upgrade text patches and AGENTS.md self-healing hook that create or restore safeword references in customer context files.
  - Unmerge old safeword-managed CLAUDE.md and AGENTS.md blocks during upgrade/reset without deleting unrelated customer content.
out_of_scope:
  - Reworking Cursor's phase/LOC/done enforcement hooks; cursor-changelog-alignment owns beforeSubmitPrompt/preToolUse/beforeShellExecution gates.
  - Removing Cursor's safeword-core rule import in this slice; it is a Cursor-owned rule surface and will be revisited after sessionStart context is dogfooded.
  - Changing Codex trust requirements; project-local Codex hooks still require the user to trust the repo config.
  - Moving all SAFEWORD.md references out of docs, guides, skills, or audit checks that discuss context files as user-authored artifacts.
done_when:
  - Fresh setup no longer creates AGENTS.md or CLAUDE.md solely to point at .safeword/SAFEWORD.md.
  - Existing customer AGENTS.md and CLAUDE.md files are left unmodified by setup when they lack safeword-managed blocks.
  - Upgrade/reset removes prior safeword-managed AGENTS.md prose and CLAUDE.md @import blocks while preserving customer-authored content.
  - Claude settings, Cursor hooks, and Codex config all run the SAFEWORD context hook at session start.
  - Claude's compact matcher also runs the SAFEWORD context hook so compaction does not drop the standing instructions.
  - The SAFEWORD context hook emits the same standing instruction content for Claude/Cursor/Codex-compatible hook outputs.
---

# Load SAFEWORD.md via SessionStart + compact hooks, not CLAUDE.md/AGENTS.md @import

**Goal:** Stop injecting safeword's standing instructions by patching an `@./.safeword/SAFEWORD.md` import into the customer's CLAUDE.md (and a prose reference into AGENTS.md); instead inject SAFEWORD.md via a SessionStart hook and re-inject it via the compact hook — so safeword owns its delivery and leaves the customer's context files untouched.

**Why:** Today safeword edits the customer's _own_ CLAUDE.md + AGENTS.md (prepends the import / reference) — an intrusive ownership boundary. Delivering SAFEWORD.md through safeword's own hooks (which it already owns) keeps those files 100% the customer's, gives safeword exact control over what loads and when, and could unify loading across Claude Code / Cursor / Codex instead of leaning on each host's import behavior.

> Status: **implement**. The 2026-06-14 figure-it-out pass resolved the deliberate `@import` tradeoff by moving SAFEWORD.md delivery to safeword-owned SessionStart hooks and preserving Claude compaction resilience through the compact matcher.

## Current mechanism (verified)

- [schema.ts:704–715](../../../packages/cli/src/schema.ts) — the `CLAUDE.md` text-patch prepends `@./.safeword/SAFEWORD.md` (the `@` import inlines SAFEWORD.md into CLAUDE.md's _compaction-resistant_ context).
- [schema.ts:699–702](../../../packages/cli/src/schema.ts) — the `AGENTS.md` text-patch adds a `.safeword/SAFEWORD.md` prose reference (for tools that read AGENTS.md but don't honor `@`-imports).

## Proposed shape

- Drop the CLAUDE.md `@import` and the AGENTS.md reference text-patches from `SAFEWORD_SCHEMA`; **unmerge them from existing customers on upgrade** so nothing's duplicated.
- Inject SAFEWORD.md content from the **SessionStart** hook (additionalContext) on startup.
- Re-inject from the **compact** hook ([session-compact-context.ts](../../../packages/cli/templates/hooks/session-compact-context.ts) already injects post-compaction context — extend it) to replicate the `@import`'s compaction survival.

## Open questions (converge before spec)

- **Authority / persistence (load-bearing).** CLAUDE.md `@import` content is part of CLAUDE.md's _memory_ (full authority — cf. `project_memory_architecture`). Does SessionStart `additionalContext` carry the same authority and persistence, or weaker? If weaker, moving SAFEWORD.md out of CLAUDE.md-memory could dilute its standing. Verify how CC treats the two.
- **Compaction-resistance.** Confirm SessionStart(startup) + the compact hook fully replicate the `@import`'s compaction survival — the import's entire reason for being. (Does SessionStart fire with a `compact` source, or does the compact hook own re-injection?)
- **Cross-tool parity.** Do Cursor and Codex support a SessionStart-equivalent hook with context injection? If not, the import/AGENTS.md path may still be needed there — the hook approach could be CC-only, splitting the mechanism per tool.
- **Token cost.** Full SAFEWORD.md (~200 lines) injected every session + every compaction vs the import's once-and-re-inline. Roughly equal — confirm, don't assume.
- **Migration.** Test the unmerge: existing customers' CLAUDE.md `@import` + AGENTS.md reference must be removed cleanly on upgrade (no orphan lines, no double-load).

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md) (delivery/robustness).
- [session-compact-context.ts](../../../packages/cli/templates/hooks/session-compact-context.ts) — the compact hook to extend; the SessionStart hooks.
- `schema.ts:699–715` — the text-patches to drop + unmerge.
- The cursor/codex parity epics — the cross-tool half of this decision.

## Work Log

- 2026-06-10T04:32:59.298Z Started: Created ticket P30CRP.
- 2026-06-10T04:34:00Z Framed against the current mechanism (verified schema.ts:699–715): CLAUDE.md gets the compaction-resistant `@import`, AGENTS.md a prose reference. Proposal: drop both, inject SAFEWORD.md via SessionStart + the compact hook (re-injection preserves compaction survival), unmerge the old import on upgrade. Flagged the load-bearing risk — SessionStart additionalContext may carry less authority/persistence than CLAUDE.md memory — and the cross-tool parity question (hooks may be CC-only). Re-litigates the deliberate @import-for-compaction-resistance choice → /figure-it-out at resolution. Parented under VKNF1T.
- 2026-06-14T00:00:00.000Z Revalidated: Ticket still in_progress/intake; spec was a blank template. User clarified the product goal: remove safeword as a CLAUDE.md/AGENTS.md import/reference without losing behavior, so safeword is more resilient to user error and does not edit customer files across Cursor, Claude, and Codex.
- 2026-06-14T00:00:00.000Z Figure-it-out: Recommend a shared SAFEWORD session context hook wired into Claude SessionStart, Cursor sessionStart, and Codex SessionStart. Evidence: Claude docs say SessionStart and compact matchers add stdout/additionalContext to context; Codex docs support SessionStart hookSpecificOutput.additionalContext; Cursor docs/tickets support sessionStart additional_context while beforeSubmitPrompt cannot inject context. Keep Claude compact re-injection. Remove CLAUDE/AGENTS text patches and the AGENTS self-healing hook.
- 2026-06-14T00:00:00.000Z Implemented: Added `session-safeword-context.ts`, wired it into Claude, Cursor, and Codex startup/session-start surfaces, added Claude compact re-injection, removed the old AGENTS self-heal hook, and moved CLAUDE.md/AGENTS.md patches into cleanup-only legacy unpatches.
- 2026-06-14T00:00:00.000Z Verified: focused migration/setup suites passed (69 tests); hook/schema/setup suites passed (158 tests); `bun run --cwd packages/cli lint:gherkin` passed; `bun run --cwd packages/cli typecheck` passed.
- 2026-06-14T00:00:00.000Z Quality-review follow-up: Fixed stdin `cwd`/`workspace_root` handling for the SAFEWORD context hook and made legacy unpatching preserve customer YAML frontmatter. Reverified focused migration/setup suites (71 tests), hook/schema/setup suites (159 tests), Gherkin lint, and typecheck.
