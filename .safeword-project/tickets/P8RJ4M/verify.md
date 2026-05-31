# Verify: P8RJ4M — arcade coexistence conventions

Decision ticket — no code or tests of its own. Closed as **resolved by an existing
mechanism**, not by building a bridge. Full rationale in the ticket's
"Resolution (2026-05-31)" section.

## Outcome

- **Resolved by:** [K7N2QM](../K7N2QM/ticket.md) — configurable `paths.*` in
  `.safeword/config.json`. A both-tools user points `paths.personas` / `paths.glossary`
  at arcade's `.project/` files and safeword reads arcade's copies; the duplicate-
  maintenance pain is gone without any new code.
- **Decisions (all open questions):** independent / manual opt-in (no auto-detection,
  no magic), single-doc architecture (no per-area model), no `safeword sync` gesture,
  customer-facing coexistence doc deferred (YAGNI — one known dual-tool user).
- **Deferred / not built:** auto-detection of arcade, conflict resolution, sync command,
  per-area architecture model, customer docs. Reopen a fresh ticket if a both-tools
  customer hits friction the `paths` redirect doesn't cover.

## Checklist

**Test Suite:** ⏭️ N/A — decision ticket, no code.
**Build / Lint:** ⏭️ N/A — markdown only (lint-staged runs at commit).
**Scenarios:** ⏭️ N/A — no `test-definitions.md`; this ticket produces decisions, not behavior.
**Done-when:** ✓ Each open question has a documented decision; safeword's behavior when
`.project/personas.md` exists is specified (ignored unless `paths` points at it);
architecture coexistence specified (ignored, single-doc); setup detection decided (none);
customer docs explicitly deferred.

Ready to mark done.
