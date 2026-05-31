---
id: JZXVKN
slug: extract-validation-helpers
type: task
phase: implement
status: in_progress
created: 2026-05-31T02:03:37.320Z
last_modified: 2026-05-31T02:04:00.000Z
scope:
  - Extract the byte-identical `findDuplicates` and near-identical `groupByLine` validator helpers from `src/utils/personas.ts` and `src/utils/glossary.ts` into a shared `src/utils/validation.ts` (`ValidationIssue` = `{ line; message }`; `groupByLine<T extends { lineNumber: number }>`). Import from both; delete the private copies.
  - Behavior-preserving — the existing personas/glossary unit tests lock duplicate detection; no test changes beyond imports.
out_of_scope:
  - Unifying the divergent `validate*`/`lookup*`/`validate*Reference` functions or check.ts's `find*Issues`/`find*Advisories` pairs — those genuinely differ (code-pattern vs alias-shadowing); risk the wrong abstraction. This ticket only lifts the two structurally-identical helpers (the lone jscpd clone left after WQ4RH3).
done_when:
  - `findDuplicates` + `groupByLine` live once in `validation.ts`; personas/glossary import them with zero private copies (net-negative LOC).
  - Full suite + lint green; jscpd clone between personas.ts/glossary.ts gone.
---

# Extract shared findDuplicates/groupByLine validator helpers

**Goal:** Collapse the duplicated `findDuplicates` (identical) and `groupByLine` (identical bar a type bound) helpers in personas.ts + glossary.ts into one `src/utils/validation.ts`.

**Why:** The remaining jscpd clone after WQ4RH3 — `personas.ts` ↔ `glossary.ts`, ~11 lines. Both helpers are generic primitives (group-by-key; emit `duplicate X (also at line Y)` errors); the error types are structurally `{ line; message }` and both parsed entries carry `lineNumber`, so the lift is clean. Same Rule-of-Three call as WQ4RH3's skip-mask — extract the identical helper, leave the divergent validators.

**Sourced from:** WQ4RH3 audit / `/refactor` 2026-05-31.

## Work Log

- 2026-05-31T02:03:37.320Z Started + scoped: extract findDuplicates/groupByLine to validation.ts. Behavior-preserving; existing tests lock it. Per-helper migration under /refactor.
