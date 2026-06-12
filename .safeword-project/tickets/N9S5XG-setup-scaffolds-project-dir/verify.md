# Verify — N9S5XG setup scaffolds .project/

Date: 2026-06-12 · Branch: feat/AQJ95G-project-namespace-default · Fresh build, frozen tree.

## Verify Checklist

**Test Suite:** ✓ 2711/2711 tests pass (1 skipped; re-verified after post-done quality-review/refactor pass — repo-root config edge fix + hoisted test import, 12th scenario added)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + tsc --noEmit, exit 0)
**Scenarios:** All 11 scenarios marked complete (33/33 R/G/R boxes)
**Dep Drift:** ✅ Clean (zero dependency changes; node builtins only)
**Parent Epic:** AQJ95G (siblings: 1/2 done — TAGWZ8 done; 9MMWS7 backlog, depends on TAGWZ8)
**Reconcile:** ✅ No pattern deviation (single translation seam at reconcile entry per impl plan; one recorded deviation — optional `namespaceRoot` on ProjectContext for older callers)

## Audit

Audit passed (0 errors).

- Architecture: 0 errors; 8 pre-existing cucumber.mjs `no-orphans` baseline warnings (unrelated).
- Dead code: knip flags only the pre-existing personas constants; nothing from this ticket.
- Duplication: 0.67% (10 clones, unchanged baseline).
- Config drift: sync-config clean; 127 pairs + 3 contracts in sync.

## Done-when evidence

- Fresh repo: setup scaffolds `.project/{learnings,tickets,tickets/completed,tmp}` + personas/glossary templates; no `.safeword-project/` appears.
- Arcade adoption: existing `.project/personas.md` byte-identical after setup; missing pieces filled alongside; both-dirs repos reconcile `.project/` only, legacy byte-unchanged.
- Legacy continuity: setup and upgrade on a legacy-only repo operate entirely in `.safeword-project/`; no `.project/` is created.
- Lifecycle agreement: configured `paths.projectRoot` scaffolds there; upgrade rescaffolds at `.project/` on a `.project/` repo; diff reports no legacy-path drift after fresh setup; reset removes empty preserved dirs at the resolved root while user tickets survive.
- The 43 full-suite failures during implementation were all post-setup fixtures seeding legacy paths — flipped to the resolved root (8 files, 134 tests), the exact split-brain the feature eliminates for real users.
