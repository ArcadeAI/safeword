---
id: WQ4RH3
slug: extract-section-walk-skip-mask
type: task
phase: implement
status: in_progress
created: 2026-05-30T22:30:16.117Z
last_modified: 2026-05-30T22:33:00.000Z
scope:
  - Extract the byte-identical-logic `computeSkipMask` (CommonMark block-comment + code-fence skip mask) and `stripInlineComments` into a new `packages/cli/src/utils/markdown-sections.ts`; have `personas.ts`, `glossary.ts`, and `scenario-coverage.ts` import them and delete their private copies.
  - Behavior-preserving refactor — the existing personas/glossary/scenario-coverage unit tests lock the skip-mask behavior; no test changes beyond import paths.
  - Fix the stale "shared extraction belongs to M6D315" attribution in the three src file headers, the hook-side `jtbd.ts` header, and XT1FFM's ticket log/verify.md — point them at WQ4RH3 (or just drop the claim), since M6D315's charter is the arcade Phase-2 impl-plan epic and never owned a parser refactor.
out_of_scope:
  - Hook-side `.safeword/hooks/lib/jtbd.ts` (+ its template mirror) — it uses a different single-pass `stripComment` across the deployed-hook runtime boundary (can't import the CLI dist); that copy stays, documented as intentional.
  - Unifying the per-consumer heading parsers (`parseHeaderLine` name+code, `parseTermHeader` term, `parseHeading` level+text) — genuinely different return shapes, not shared primitives.
  - Adding a markdown AST dependency (remark/micromark) — wrong tool for a per-line skip mask and bloat for dependency-light hooks (rejected in XT1FFM's /figure-it-out).
done_when:
  - One `markdown-sections.ts` exports `computeSkipMask` + `stripInlineComments`; personas/glossary/scenario-coverage import them with zero private copies remaining (net-negative LOC).
  - Full suite + lint green; no behavior change.
  - No code/comment/ticket still claims M6D315 owns this refactor.
---

# Extract src section-walk skip-mask into a shared markdown-sections util

**Goal:** Collapse the three logic-identical copies of `computeSkipMask` (+ two of `stripInlineComments`) in `src/utils` into one shared `markdown-sections.ts`, so the CommonMark comment/fence-skip primitive has a single source of truth.

**Why:** Rule of Three is exactly met — three identical-logic copies (personas.ts, glossary.ts, scenario-coverage.ts), already drifting at the comment level. The skip-mask state machine is the bug-prone part; the next behavioral fix will land in one copy and miss the others. Extraction is net-negative LOC with behavior already test-locked. Decided in XT1FFM's `/figure-it-out` (option D: extract src-side, keep the cross-runtime hook copy, re-own off M6D315).

**Sourced from:** XT1FFM audit finding + `/figure-it-out` 2026-05-30. Sibling cleanup under epic DZ2NM5 (which made the original deferral decision that was wrongly pinned to M6D315).

## Work Log

- 2026-05-30T22:30:16.117Z Started: Created ticket WQ4RH3
- 2026-05-30T22:33:00.000Z Scoped from XT1FFM /figure-it-out (option D). Intake → implement: behavior-preserving refactor, existing tests lock the skip-mask. Extract `computeSkipMask` + `stripInlineComments` to `src/utils/markdown-sections.ts`; hook-side jtbd.ts out of scope (runtime boundary). Also corrects the stale M6D315 attribution.
