---
id: 6CT4D0
slug: cursor-self-contained-skills
type: feature
phase: intake
status: in_progress
relates_to: J611KP
scope:
  - Give Cursor its own skill copy so .mdc rules stop @-referencing .claude/skills
  - Generate the Cursor copy from the one source template; parity-guard it
out_of_scope:
  - The Claude Code plugin promotion itself (J611KP)
  - The bundle-CLI install flow (J0Q9RZ)
done_when:
  - No .cursor rule or command @-references or reads .claude/skills
  - Reasoning skills can leave .claude/skills without breaking Cursor
  - Full suite + lint + real parity-check green
created: 2026-06-28T03:14:58.855Z
last_modified: 2026-06-28T03:14:58.855Z
---

# Make Cursor's skills self-contained (stop reaching into `.claude/skills`)

**Goal:** Give Cursor its own copy of each skill so its `.mdc` rules and commands stop `@`-referencing `.claude/skills/<name>/SKILL.md` — making each tool's skill surface self-contained.

**Why:** This is the one prerequisite that unblocks moving the reasoning skills (`debug`, `figure-it-out`, `quality-review`, `bdd`, …) into the Claude Code plugin (J611KP). Today Cursor has no copy of its own — its rules dereference Claude's folder in place, so removing a skill from `.claude/skills` leaves Cursor dangling. It's a pre-existing wart, not an inherent coupling: in the target, each tool's plugin carries its own copy generated from the one source template (`packages/cli/templates/skills/`), with zero runtime cross-references. Codex is already self-contained this way (`.agents/skills/<name>` is a separate copy); Cursor is the only tool still reaching across.

## Scope

- Give Cursor its own skill copy (a Cursor-local `skills/<name>` or an `.mdc`/command that points at a Cursor-owned path), generated from the one source template — never hand-maintained.
- Remove every `@.claude/skills/...` reference and "read `.claude/skills/...`" instruction from `.cursor/rules/*` and `.cursor/commands/*`.
- Extend parity so the Cursor copy stays byte-identical to the template (same model as J611KP's `checkPluginSkills`).

## Out of scope

- The Claude Code plugin promotion of reasoning skills (J611KP) — this ticket only removes its blocker.
- The bundle-CLI / smooth-install work (J0Q9RZ).
- Codex — already self-contained; no change.

## Done when

- No `.cursor/rules/*` or `.cursor/commands/*` references or reads `.claude/skills`.
- A reasoning skill can be removed from `.claude/skills` without breaking any Cursor rule/command.
- Cursor skill copies are parity-guarded against the source template.
- Full suite + lint + real parity-check green.

## Open questions

- **Cursor-native skill vs pointer.** Ship the content as a native Cursor skill (`SKILL.md` in the Cursor plugin), or keep a thin `.mdc`/command that points at a Cursor-owned local path? The first is cleaner long-term; the second is a smaller diff from today. Decide with `/figure-it-out` before building.
- **Where the copy lives pre-plugin.** Until the Cursor plugin exists, the CLI still writes `.cursor/`. The interim copy may live under `.cursor/` (CLI-written) and migrate into the Cursor plugin later — confirm that doesn't reintroduce a cross-reference.

## Work Log

- 2026-06-28T03:14:58.855Z Started: Created ticket 6CT4D0
- 2026-06-28T03:15:00.000Z Split out of J611KP as the one mechanical prerequisite to unblocking reasoning-skill promotion. Per-tool self-contained skills, generated from one template; remove Cursor's `@.claude/skills` cross-references.
