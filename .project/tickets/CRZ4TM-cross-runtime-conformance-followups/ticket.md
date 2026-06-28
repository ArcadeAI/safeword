---
id: CRZ4TM
slug: cross-runtime-conformance-followups
type: task
phase: intake
status: todo
created: 2026-06-28T21:20:00.000Z
last_modified: 2026-06-28T21:20:00.000Z
scope:
  - Cursor Skills migration — expose safeword's existing SKILL.md workflows as Cursor Skills (`.cursor/skills/<name>/SKILL.md`, or confirm Cursor already discovers `.claude/skills/`) ahead of Cursor deprecating `.cursor/commands/`. Track Cursor's deprecation timeline; migrate when it lands.
  - Codex dead-code cleanup — remove the `CODEX_THREAD_ID` env branch in `run-identity.ts` (detect + resolve). Codex never sets it (FR openai/codex#8923 open/unimplemented); Codex runtime detection + id already work via hook stdin `session_id`/`turn_id`. Behavior-preserving cleanup; update run-identity tests + the template/installed mirror together.
out_of_scope:
  - The marketplace-catalog path move (.claude-plugin/marketplace.json) — already fixed on branch claude/cross-runtime-conformance.
  - The Codex/Cursor gate-proof docs-accuracy correction — already fixed on the same branch.
  - Any change to how the architecture command or language packs work — runtime-agnostic, unaffected.
done_when:
  - Cursor exposure decision recorded — either safeword ships a Cursor Skills surface, or it's verified that Cursor already discovers `.claude/skills/` and no action is needed until `.cursor/commands/` deprecation is announced.
  - The dead `CODEX_THREAD_ID` branch is removed (or an explicit comment documents why it is kept), run-identity tests + parity stay green.
  - No regression: Claude/Codex/Cursor gate-proof + hook flows behave as before.
---

# Cross-runtime conformance follow-ups

**Origin:** the 2026-06-28 doc-grounded cross-runtime audit (Claude Code / OpenAI
Codex / Cursor) verified safeword's integration against each runtime's current
official docs. Two findings were fixed immediately on branch
`claude/cross-runtime-conformance`:

1. **Marketplace catalog path (HIGH)** — moved root `marketplace.json` →
   `.claude-plugin/marketplace.json` (the documented discovery location for
   `/plugin marketplace add owner/repo`).
2. **Codex/Cursor gate-proof docs (MED)** — corrected the skill "Invocation log"
   sentence that falsely claimed the helper auto-resolves Codex thread ids from
   the runtime environment (Codex exposes the session id only to hooks via
   stdin; there is no env var — FR openai/codex#8923).

This ticket tracks the two **non-urgent** remainders that were deliberately not
rushed:

## 1. Cursor Skills migration (LOW — watch-item)

`.cursor/commands/*.md` works today and is still documented, but current Cursor
docs steer toward **Skills** (`SKILL.md`), and Cursor Skills already load from
`.claude/skills/` — which safeword ships. So nothing is broken; building a new
`.cursor/skills/` surface now would be speculative. Action: confirm `.claude/skills/`
discovery under current Cursor, and migrate `.cursor/commands/` → Cursor Skills
when Cursor announces deprecation.

## 2. Remove dead `CODEX_THREAD_ID` branch (LOW — cleanup)

`run-identity.ts` reads `env.CODEX_THREAD_ID` for both runtime detection and id
resolution. Codex never sets it (FR openai/codex#8923 is open/unimplemented);
real Codex sessions bind via hook stdin `session_id`/`turn_id`, which already
work. The env read is harmless but misleading. Remove it (or document why it
stays), keeping run-identity tests, the template/installed mirror, and parity in
sync.
