---
id: XEP59N
slug: assess-validator-reference-dup
type: task
phase: done
status: done
created: 2026-05-31T02:13:49.179Z
last_modified: 2026-05-31T02:20:00.000Z
---

# Assess + selectively unify validator-reference / check find\* duplication

**Goal:** Decide — via `/figure-it-out` — whether the remaining persona/glossary validator duplication is safe to unify, and extract only the genuinely-identical parts; leave the divergent parts documented.

**Why:** After WQ4RH3 (skip-mask) and JZXVKN (findDuplicates/groupByLine), this is the last cluster of persona↔glossary duplication. Unlike those, it is NOT a clean mechanical lift — so it needs a design call before any extraction, not a reflex `/refactor`.

**The cluster (candidates):**

- `validatePersonaReference` ↔ `validateGlossaryReference` (`src/utils/personas.ts`, `glossary.ts`) — both do `try { resolveConfiguredPath + readFileSync } catch { return { status: 'unknown' } }; return lookup(...)`. The configured-file-read half is near-identical (a likely-safe extract); the lookup half diverges.
- `lookupPersonaReference` ↔ `lookupGlossaryReference` — same exact→casing-suggestion→unknown shape, but different match fields (persona code/name vs glossary name/alias). Divergent — unifying risks the wrong abstraction.
- `check.ts` `findPersonaIssues`/`findGlossaryIssues` and `findPersonaAdvisories`/`findGlossaryAdvisories` — near-identical override-path patterns differing only by validate fn + message prefix.

**Important:** This is the duplication YR6C49's log and old code comments called "deferred to M6D315" — that attribution was wrong (M6D315 is the arcade Phase-2 impl-plan epic; corrected in WQ4RH3). This ticket is the real owner.

## Scope

- Run `/figure-it-out`: per candidate, is unification correct + elegant, or the "wrong abstraction" (looks alike, evolves apart)? Weigh extract vs. document-the-divergence.
- Extract only the parts that pass that bar (e.g. a shared `readConfiguredFileOrUndefined`), into `src/utils/validation.ts` or a sibling. Behavior-preserving; existing tests lock it.
- For parts that don't pass, leave a one-line code comment noting the deliberate divergence (so the next reader doesn't re-flag it).

## Out of scope

- Forcing a single `validateReference`/`lookup` abstraction over genuinely-different match logic.
- The personas/glossary parser internals (parse\*, field handling) — not duplicated.

## Done when

- A `/figure-it-out` verdict per candidate is recorded.
- The safe extractions are landed (or an explicit "none safe — documented divergence" outcome); full suite + lint green.
- No persona↔glossary duplication remains un-owned or misattributed.

## Work Log

- 2026-05-31T02:20:00.000Z Done: assessed all four candidates (validate*Reference / lookup* / find*Issues / find*Advisories). **Verdict: no extraction warranted** — all 2-occurrence persona/glossary parallels, below Rule of Three, with divergent cores (or a dedup that costs clarity). Documented the intentional parallelism in check.ts. 108/108 targeted tests green; lint clean; no behavior change. verify.md records the per-candidate reasoning. → done.
- 2026-05-31T02:14:00.000Z Created to own the last persona↔glossary duplication cluster (validate*Reference / lookup* / check find\* pairs) — previously un-ticketed and misattributed to M6D315. Gated on `/figure-it-out` because, unlike WQ4RH3/JZXVKN, these candidates diverge and a blind extract risks the wrong abstraction.
