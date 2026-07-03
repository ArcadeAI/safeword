---
id: ZRMDKD
slug: coverage-gate-blocking
type: task
phase: intake
status: backlog
created: 2026-06-03T04:42:30.504Z
last_modified: 2026-06-03T04:42:30.504Z
---

# Promote scenario-coverage to a blocking gate (split from NMSD94 SM1.AC1)

**Goal:** Promote the deliberately-advisory AC↔scenario coverage check to a skippable blocking gate, so test-definitions with an uncovered AC or an orphan scenario are denied (not just warned), with a measured alert-to-action ratio.

**Why:** Split from NMSD94 (which owns the two-tier review mechanism). The coverage logic lives in `packages/cli/src/utils/scenario-coverage.ts` (192 lines, 3 fns: `parseAcReferenceFromTitle`, `parseAcIdsByJtbd`, `buildCoverageReport`). A PreToolUse hook can't import from `src/` (the cross-runtime boundary), so promoting it to blocking needs a hook-side port + a differential test — a self-contained sub-build that shouldn't bloat NMSD94. It's also the "trial" piece (`check.ts` made it advisory on purpose to avoid over-fire), so it deserves its own alert-to-action measurement.

**Scope:**

- Port `scenario-coverage.ts`'s coverage computation into a hook lib (mirror, like `jtbd.ts` mirrors `markdown-sections.ts`), pinned by a **differential test** against the `src/` original (the P58R22 pattern).
- Wire it into `pre-tool-quality.ts` as a blocking gate on test-definitions.md creation: deny on an uncovered AC (naming it) or an orphan scenario (naming it); pass complete, well-covered work silently.
- Skip valve: `skip: <reason>` clears it, logged.

**Out of scope:** the two-tier review stamp mechanism (NMSD94 owns it).

**Dependency (added 2026-07-03):** V0NHT6 (rule-tier) adds a numbered-Rule lineage tier where a JTBD carries `R<n>` rules instead of ACs and scenarios reference `@<jtbd-id>.R<n>`. This gate's hook-side port must treat a rule reference as covering lineage (not an uncovered-AC denial) — sequence after V0NHT6 or port tier-aware coverage from the start.

**Done when:** uncovered-AC / orphan-scenario test-definitions are denied with a clear reason; complete work passes silently; alert-to-action measured before making it permanent; differential test pins the hook port to the CLI original; `templates/hooks/` ↔ `.safeword/hooks/` byte-identical; full suite + parity green.

**Owns:** NMSD94's SM1.AC1 scenarios (`uncovered_ac_blocks`, `orphan_scenario_blocks`, `complete_coverage_silent`).

## Work Log

- 2026-06-03T04:42:30.504Z Created: split from NMSD94 via /figure-it-out — the coverage gate needs a hook-side `scenario-coverage` port + differential test, separable from the two-tier review mechanism.
