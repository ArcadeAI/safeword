---
id: DC6276
slug: ship-explain-to-cursor
parent: K6CAJN-ntb-experience-epic
type: task
phase: intake
status: backlog
created: 2026-06-22T03:46:00Z
last_modified: 2026-06-22T03:46:00Z
---

# Ship /explain to Cursor

**Goal:** Give Cursor users the `/explain` plain-English lifeline they currently don't have — so an NTB on Cursor can decode a block or "where am I" the same way Claude Code and Codex users can.

**Why (cross-agent figure-it-out, 2026-06-22):** Cursor ships 11 workflow commands (`audit`, `bdd`, `verify`, …) but **not `/explain`** — `.cursor/commands/` has no explain.md, and the schema only maps explain to the Claude skill + Codex skill. This is the deepest Cursor NTB gap: the 5XOUDJ offer rule we shipped tells the agent to point users at `/explain`, but on Cursor that command doesn't exist. Parity, and an NTB safety lifeline.

## Scope sketch

- Add `.cursor/commands/explain.md` mirroring the `/explain` skill's behavior, adapted to Cursor's command model (commands are prompt templates the user invokes; no `disable-model-invocation` / read-only skill semantics — encode the read-only "translate, don't change" contract in the prompt text itself).
- Register it in `packages/cli/src/schema.ts` (source of truth) and update the CLI-parity tests (`tests/schema.test.ts`) so the three-agent parity matrix expects explain on Cursor.
- Sync the dogfood copy via the install/upgrade path; confirm `.cursor/commands/explain.md` lands.
- Out of scope: 19E2XQ's block-hint reliability (Claude); changing the Claude/Codex explain skills.

## Open question (resolve in the per-item figure-it-out)

- Cursor commands can't be marked read-only the way a skill can. Does the prompt-text contract ("read-only; never edit") hold reliably enough, or does Cursor need a different guardrail? Decide before implementing.

## Work Log

- 2026-06-22T03:46:00Z Created from the cross-agent figure-it-out — the real Cursor gap behind 19E2XQ (Cursor has no `/explain` at all).
