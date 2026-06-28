---
id: 6CT4D0
slug: cursor-self-contained-skills
type: feature
phase: intake
status: in_progress
relates_to: J611KP
scope:
  - Delete the .cursor/rules skill-pointers that @-reference .claude/skills
  - Point Cursor at the shared .agents/skills standard location it reads natively
  - Retire skill-pointer .cursor/commands (fold into native skills)
out_of_scope:
  - The Claude Code plugin promotion itself (J611KP)
  - The bundle-CLI install flow (J0Q9RZ)
  - A new .cursor/skills copy (rejected — .agents/skills already serves Cursor)
done_when:
  - No .cursor rule or command @-references or reads .claude/skills
  - Cursor loads each skill exactly once (no duplicate from .claude + .agents)
  - Reasoning skills can leave .claude/skills without breaking Cursor
  - Full suite + lint + real parity-check green
created: 2026-06-28T03:14:58.855Z
last_modified: 2026-06-28T03:35:00.000Z
---

# Make Cursor's skills self-contained (use the shared `.agents/skills/` standard)

**Goal:** Stop Cursor reaching into `.claude/skills` for skill content. Cursor reads the cross-vendor standard location `.agents/skills/` natively — which this repo already populates in full for Codex — so the fix is to delete the `.cursor/rules` skill-pointers (and the pointer-commands) and let Cursor consume `.agents/skills/`.

**Why:** Unblocks moving the reasoning skills (`debug`, `figure-it-out`, `quality-review`, `bdd`, …) into the Claude Code plugin (J611KP). Today Cursor's `.cursor/rules/*.mdc` are thin `@.claude/skills/<name>/SKILL.md` pointers — an undocumented cross-folder reach — so removing a skill from `.claude/skills` leaves Cursor dangling. Each tool should source the same `SKILL.md` template independently; Cursor is the only one not doing so.

## Decision (from `/figure-it-out`, 2026-06-28)

**Cursor consumes the shared `.agents/skills/` standard location natively; delete the `.cursor/rules` skill-pointers.** Chosen over minting a new `.cursor/skills/` copy.

Evidence:

- Cursor now has **native Agent Skills** (`SKILL.md`) on the same open standard (agentskills.io) as Claude/Codex — `name`+`description` core; extra Claude keys (`allowed-tools`, etc.) are ignored, not breaking. ([cursor.com/docs/skills](https://cursor.com/docs/skills))
- `.agents/skills/` is a **first-class native Cursor skill location** (alongside `.cursor/skills/`); `.claude/skills`/`.codex/skills` are explicitly "for compatibility." The `@`-into-`.claude` path safeword uses today is undocumented/unsupported. Cursor is migrating rules+commands → skills (`/migrate-to-skills`).
- This repo **already** ships full `SKILL.md` copies at `.agents/skills/<name>` (for Codex). Cursor reads that location by spec — so "self-contained Cursor skills" is a **deletion**, not a new copy.

Why not a dedicated `.cursor/skills/` copy: it adds a *third* byte-identical copy under parity for labeling comfort, when a copy Cursor reads natively already exists. Lowest-bloat + most consistent is to reuse the shared standard location. Codex is unaffected (`.agents/skills` is its home already).

This also collapses incidental bloat: the 7 `bdd-*.mdc` rules become the one `.agents/skills/bdd/` dir, and skill-pointer commands disappear (native skills with `disable-model-invocation: true` give the same `/name` invocation).

## Riskiest assumption (verify first — cheapest test)

**Cursor must load each skill exactly once.** Cursor natively loads `.agents/skills/` AND (for compat) `.claude/skills/`. While both hold `<name>/SKILL.md`, the same skill could appear twice in Cursor. Cheapest test: in a real Cursor session with both `.claude/skills/debug` and `.agents/skills/debug` present, check whether `debug` lists once or twice. If Cursor dedupes by `name`, this ticket is a near-pure deletion. If not, ensure each skill is Cursor-visible in exactly one location (the J611KP plugin migration trends that way as reasoning skills leave `.claude/skills`).

## Scope

- Delete the `.cursor/rules/*.mdc` skill-pointers (`safeword-*.mdc`, `bdd-*.mdc`) that `@`-reference `.claude/skills`, and the pointer-commands (`bdd`, `debug`, `quality-review`, `refactor`, `testing`).
- Ensure Cursor sources skills from `.agents/skills/` (already CLI-written, full copies from the one template).
- Drop/relax the `checkCursorRulesThin` parity rule — once the pointer-rules are gone, the invariant it guards is moot.

## Out of scope

- The Claude Code plugin promotion of reasoning skills (J611KP) — this only removes its blocker.
- The bundle-CLI / smooth-install work (J0Q9RZ).
- A new `.cursor/skills/` copy — rejected (above).
- Codex — `.agents/skills` is already its home; no change.

## Open wrinkle (build detail, not direction)

A couple of `.cursor/commands` (`verify`, `audit`) carry invocation-logging `!`-bash lines the bare `SKILL.md` doesn't. Retiring those commands needs the proof-logging handled separately, or those two stay as commands.

## Done when

- No `.cursor/rules/*` or `.cursor/commands/*` references or reads `.claude/skills`.
- Cursor loads each skill exactly once (duplicate-load question resolved).
- A reasoning skill can be removed from `.claude/skills` without breaking Cursor.
- Full suite + lint + real parity-check green.

## Work Log

- 2026-06-28T03:14:58.855Z Created — split out of J611KP as the prerequisite to unblocking reasoning-skill promotion.
- 2026-06-28T03:35:00.000Z `/figure-it-out` decided: Cursor reads the shared `.agents/skills/` standard location (native, already populated for Codex); delete the `.cursor/rules` skill-pointers rather than mint a new `.cursor/skills` copy — lowest bloat, most consistent. Riskiest assumption is Cursor's dedup across `.claude/skills` + `.agents/skills`; verify before building. Reframed scope from "add a Cursor copy" to "delete pointers, reuse the standard location."
