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
  - Codex run-identity bridge — give Codex the auto-resolving gate-proof that Cursor already has. Cursor's `before-shell-execution.ts` captures `conversation_id` from the hook payload right before the `record-skill-invocation.ts` shell command and caches it (`cursor-run-identity.ts`) for the helper to read back. Codex has no equivalent and instead reads the nonexistent `CODEX_THREAD_ID` env var (FR openai/codex#8923 open), so its skill-body gate proof fails closed. Build a `codex-run-identity` bridge mirroring Cursor's (a Codex PreToolUse/shell hook captures stdin `session_id` → cache → helper reads), then remove the dead `CODEX_THREAD_ID` branch. Update run-identity tests + template/installed mirror + parity together.
out_of_scope:
  - The marketplace-catalog path move (.claude-plugin/marketplace.json) — already fixed on branch claude/cross-runtime-conformance.
  - The Codex/Cursor gate-proof docs-accuracy correction — already fixed on the same branch.
  - Any change to how the architecture command or language packs work — runtime-agnostic, unaffected.
done_when:
  - Cursor exposure decision recorded — either safeword ships a Cursor Skills surface, or it's verified that Cursor already discovers `.claude/skills/` and no action is needed until `.cursor/commands/` deprecation is announced.
  - Codex gate proof auto-resolves like Cursor's via a stdin→cache bridge (or the limitation is explicitly documented as accepted); the dead `CODEX_THREAD_ID` branch is removed; run-identity tests + parity stay green.
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

## 2. Codex run-identity bridge (MED — real functional gap)

Cursor already auto-resolves the skill-body gate proof: `before-shell-execution.ts`
reads `conversation_id` from the hook payload immediately before the
`record-skill-invocation.ts` shell command and stashes it in a short-lived cache
(`cursor-run-identity.ts`); the helper reads it back via `readFreshCursorRunIdentity`.
Codex has **no equivalent bridge** — it reads the nonexistent `CODEX_THREAD_ID`
env var (FR openai/codex#8923 open) — so a Codex user's gate proof fails closed
and the done-gate blocks unless they hand-pass an id.

Fix: build a `codex-run-identity` bridge mirroring Cursor's — a Codex PreToolUse
(or shell) hook captures stdin `session_id` before the helper command and caches
it; the helper reads it back. Then remove the dead `CODEX_THREAD_ID` branch in
`run-identity.ts`. Keep run-identity tests, the template/installed mirror, and
parity in sync. (Surfaced 2026-06-28 when verifying whether Cursor shared Codex's
gap — it does not; Codex is the only runtime missing the bridge.)
