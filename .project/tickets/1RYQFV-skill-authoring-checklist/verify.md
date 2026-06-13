# Verify — skill-authoring-checklist (1RYQFV)

Patch: a maintainer learning codifying the five new-skill parity steps.

## Verify Checklist

**Test Suite:** ✓ no code touched (learning + INDEX only); shared final full-suite run with 97BZ9S below
**Build:** ✅ N/A — markdown-only
**Lint:** ✅ Clean — formatter applied; sync-learnings regenerated INDEX
**Scenarios:** ⏭️ Skipped — patch
**Dep Drift:** ✅ N/A
**Parent Epic:** VKNF1T-platform-uplift-epic

## What changed

- New learning `.safeword-project/learnings/adding-a-skill-checklist.md` (`Covers:` line 3; cross-links `skill-description-design`).
- `INDEX.md` regenerated (`safeword sync-learnings`, 23 entries).

The five steps codified (each with the exact file path): template +
byte-identical dogfood; `SAFEWORD_SCHEMA` entry in `src/schema.ts`;
`SKILL_CURSOR_PAIRS` fixture entry; the action-skill vs model-invocable decision
(cursor command vs rule, `ACTION_SKILLS`); and run the FULL `bun run test`.

## Why a learning, not a guide

Skill-authoring is a maintainer-only activity in this repo — customers never
author safeword skills — so it lives in `.safeword-project/learnings/`, not the
customer-shipped `.safeword/guides/`. No new enforcement added: template↔dogfood
parity and schema parity are already guarded; the gap was the human/agent
_checklist_, which a learning fills.

**Next:** Close 1RYQFV; run the final full suite as shared done-evidence for 97BZ9S + 1RYQFV.
