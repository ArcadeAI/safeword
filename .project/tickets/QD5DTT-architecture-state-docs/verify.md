# Verify: Architecture state docs — Slice 1 (QD5DTT)

## Verify Checklist

**Test Suite:** ✓ 3207/3207 tests pass (5 skipped) — full `packages/cli` vitest suite, 216 files
**Gherkin:** ✅ Acceptance lane passes — 90 scenarios / 1049 steps green (`features/architecture-state-docs.feature` now executable via black-box CLI steps)
**Build:** ✅ Success — `safeword test-plan --kind build`
**Lint:** ✅ Clean — eslint + lint-gherkin + tsc --noEmit
**Scenarios:** All 16 scenarios marked complete (4 rules; 1 metamorphic Scenario Outline) + feature-level cross-scenario refactor row
**Dep Drift:** ✅ Clean — no new dependencies (Node stdlib only: `node:fs`, `node:crypto`, `node:path`, `node:child_process`)
**Parent Epic:** N/A (QD5DTT is the parent; Slices 2–4 are tracked as follow-ons in the ticket)
**Reconcile:** ✅ No pattern deviation — conformed to CLI layering (utils/commands/hooks); the module-enumeration choice (direct `src/` scan vs `DetectedArchitecture`) is recorded in impl-plan Decisions with rationale, not a sibling-pattern split

## Audit

Audit passed. `/audit` run clean:

- **Architecture:** no circular dependencies, no layer violations (depcruise over the 4 new modules + command).
- **Dead code:** knip clean after de-exporting 4 internal-only symbols (`PURPOSE_PLACEHOLDER`, `collectShapeInputs`, `ShapeInputs`, `SelfHealAction`).
- **Duplication:** 0 clones (jscpd, min-lines 10).
- **Dependencies:** none added; nothing to document in `ARCHITECTURE.md`.

## done_when — met end-to-end

- ✅ A fresh single-repo TS project gets a `.project/architecture.md` whose skeleton matches the real tree, with code references, a one-line `purpose` per node, and a frontmatter fingerprint (`safeword architecture` / SessionStart hook).
- ✅ A structural change made outside any agent session is re-synced (skeleton) and/or its lagging prose flagged (`⚠ stale`) at the next SessionStart.
- ✅ The drift signal and self-heal are LLM-free — no model call in the path (pure `node:*`; structural test + black-box lane).

## Safety note (beyond original scope)

Wiring revealed `selfHeal` would overwrite a hand-authored architecture doc. Added an ownership guard (`generator: safeword-architecture` marker → `skipped` for foreign docs). **Verified** the repo's own 52KB hand-written `ARCHITECTURE.md` is skipped byte-for-byte by a real `safeword architecture` run.

## Out of scope (Slice 1) — follow-ons

- Slice 2: enforcement gates (block on staleness markers).
- Slice 3: monorepo hierarchy (derived root index + workspace-discovered colocated leaves; per-node fingerprints).
- Slice 4: `architecture-guide.md` state-vs-ADR split; `eslint-plugin-boundaries` ↔ ESLint 10 reconciliation.

## Final whole-ticket review (post second-wave)

An independent fresh-context `/quality-review` over the **complete** branch diff (covering the CLI command, SessionStart hook, ownership guard, BDD steps, and registration that landed after the first whole-ticket pass) returned REQUEST CHANGES on one must-fix, now resolved:

- **Must-fix:** CRLF-round-tripped safeword doc was misclassified as foreign (the `\n`-anchored frontmatter regex), silently halting self-heal. Fixed — frontmatter parsing is CRLF-tolerant + exact-line marker match; regression tests added (CRLF-owned heals; `safeword-architecture-v2` treated as foreign).
- Applied: deterministic node ordering, dropped a vacuous purpose-floor BDD step (unit-tested instead), CLI exit-status assertion in the lane.
- Reviewer confirmed solid: registration parity across the three Claude surfaces, byte-identical template/dogfood hook, non-blocking hook, no ReDoS/injection.

Ready to mark done.
