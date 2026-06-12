---
id: P30CRP
slug: safeword-md-via-hooks
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-10T04:32:59.298Z
last_modified: 2026-06-10T04:32:59.298Z
---

# Load SAFEWORD.md via SessionStart + compact hooks, not CLAUDE.md/AGENTS.md @import

**Goal:** Stop injecting safeword's standing instructions by patching an `@./.safeword/SAFEWORD.md` import into the customer's CLAUDE.md (and a prose reference into AGENTS.md); instead inject SAFEWORD.md via a SessionStart hook and re-inject it via the compact hook — so safeword owns its delivery and leaves the customer's context files untouched.

**Why:** Today safeword edits the customer's _own_ CLAUDE.md + AGENTS.md (prepends the import / reference) — an intrusive ownership boundary. Delivering SAFEWORD.md through safeword's own hooks (which it already owns) keeps those files 100% the customer's, gives safeword exact control over what loads and when, and could unify loading across Claude Code / Cursor / Codex instead of leaning on each host's import behavior.

> Status: **intake**. This **re-litigates a deliberate decision** — the `@import` was chosen _specifically_ because it's compaction-resistant (CC re-inlines `@`-imports; schema.ts:706–707). The proposal must preserve that via the compact hook, and weigh an authority tradeoff (below). Warrants a `/figure-it-out` at resolution.

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

## Work Log

- 2026-06-10T04:32:59.298Z Started: Created ticket P30CRP
