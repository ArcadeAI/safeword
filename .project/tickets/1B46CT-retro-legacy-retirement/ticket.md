---
id: 1B46CT
slug: retro-legacy-retirement
type: task
phase: todo
status: todo
parent: RV9JT4-retro-transcript-mining
scope: |
  Retire the retro code/paths that ZFGWS1 (delta re-arm + signature dedupe) and
  the Codex/Cursor invisibility tickets (#551/#552) make dead. Grounded in a usage
  sweep + an independent quality-review (2026-06-30). Grouped by WHEN deletion is
  safe.

  VERIFICATION (quality-review C1 — load-bearing): do NOT verify with knip. Both
  `knip.json` and `packages/cli/knip.json` IGNORE `templates/**` and `.safeword/**`
  (knip.json:2, packages/cli/knip.json:2), so knip reports zero orphans for these
  functions whether or not callers exist — the check is unfalsifiable. Verify with
  a REPO-WIDE GREP (`grep -rn "<symbol>" packages/cli/src packages/cli/templates
  .safeword tests`) returning zero hits, plus a green build + test run.

  EVERY deletion PR must, in the SAME PR (quality-review C2): edit the
  `templates/**` source, sync the `.safeword/**` byte-mirror, update `schema.ts`
  managed-file pairs if an entry is removed, AND drop the method from all test
  fakes — or the `IssueTracker` type check / live `.safeword` hooks break.

  TIER 1 — delete WITH ZFGWS1:
  - `searchByTitle` title-dedupe path: transport impl (github-rest.ts:70), the
    `IssueTracker` port entry (triage.ts:39), the call (triage.ts:82), AND the
    test fakes (triage.test.ts:50, github-rest.test.ts:67, tests/commands/
    retro.test.ts:19). Replaced by signature matching. Verified safe: no dynamic
    imports, no string refs, no guide calls it (the self-report + retro guides
    dedupe via `gh`/`--findings`, not this method).
  - The fire-once `hasNudged` gate INSIDE `decideRetroRun` (retro-trigger.ts:318)
    — replaced by the re-arm offset state. (File-based sentinel, not an in-memory
    boolean — C3 wording fix.) The `hasNudged`/`markNudged` helpers themselves
    STAY until Tier 2 (still used by `decideRetroNudge`).
  - Collateral (already in ZFGWS1 scope; note here so it's not forgotten):
    `model:'haiku'` at retro.ts:113 + retro-extract.ts:155 → sonnet; and
    `buildDigest`'s head-cap (retro-extract.ts:210-233) does NOT delete but
    CHANGES meaning (cap now applies to a pre-sliced window, not the head).

  TIER 2 — delete WITH #551/#552 (Codex/Cursor invisibility):
  - The in-conversation nudge path: `decideRetroNudge` + `buildRetroNudge` +
    `hasNudged`/`markNudged`/`sentinelPath`/`sentinelName` (retro-trigger.ts). For
    Claude these are ALREADY dead (stop-retro.ts uses `decideRetroRun`); they
    survive only via `codex/stop.ts` + `cursor/stop.ts`. Confirmed consumers
    (incl. tests: retro-trigger.test.ts, codex/cursor/stop-retro integration
    tests). Same-PR rule applies: templates + `.safeword` mirror + schema.ts +
    integration tests together.

  TIER 3 — consolidation design call (NOT a blind delete):
  - Deterministic self-report spool (`stop-self-report.ts` + `lib/self-report.ts`)
    vs qualitative invisible retro: different CAPTURE (allowlisted spool signals vs
    LLM extraction), CADENCE (every Stop w/ signals vs once+re-arm), and EGRESS
    (agent files w/ title-dedupe vs code files w/ signature-dedupe). Their FILING
    paths overlap. Folding the spool into retro's invisible+egress pipeline is a
    sound design QUESTION — BUT `stop-self-report.ts` is the ONLY remaining
    in-conversation `additionalContext` surface after 7D8PJP; folding MUST
    explicitly re-home that signal or it's lost. Own ticket; keep separate until
    decided.

  TICKETS: 1FGE1C (robust-tracker-dedup) — signature dedupe absorbed by ZFGWS1 →
  close/annotate once ZFGWS1 covers its done_when.
out_of_scope: |
  - The deletions before ZFGWS1 / #551 / #552 land — this is the PLAN + the
    post-merge grep-driven execution, not premature removal.
  - #563 (cost gate) and 7ZCKS6 (eval) — still live, not retired.
done_when: |
  - Tier 1 removed in ZFGWS1's PR; `grep -rn "searchByTitle" packages/cli .safeword`
    returns zero hits; build + tests green (NOT a knip check — knip ignores
    templates/.safeword).
  - Tier 2 removed when #551/#552 land; grep for the nudge+sentinel symbols returns
    zero; `.safeword` mirror + schema.ts + integration tests updated in the same PR.
  - Tier 3 has a recorded decision (fold w/ re-homed in-conversation surface, or
    keep separate) in its own ticket.
  - 1FGE1C closed/annotated as absorbed by ZFGWS1.
created: 2026-06-30T17:20:00.000Z
last_modified: 2026-06-30T17:20:00.000Z
---

# Retire legacy retro paths after ZFGWS1 + Codex/Cursor invisibility

**Goal:** Track + drive the dead-code retirement the recall rework (ZFGWS1) and
Codex/Cursor invisibility (#551/#552) enable, verified by grep + build/test (knip
is blind to `templates/**` and `.safeword/**`).

**Parent:** RV9JT4. **Depends on:** ZFGWS1 (Tier 1), #551/#552 (Tier 2).

## Usage sweep + quality-review (2026-06-30, grounded)

- `searchByTitle`: callers = triage.ts:82 (+ :39 port, github-rest.ts:70 impl) +
  3 test fakes. No dynamic imports / string refs / guide calls. → Tier 1.
- nudge path (`decideRetroNudge`/`buildRetroNudge`/`hasNudged`/`markNudged`/
  `sentinelPath`): codex/stop.ts + cursor/stop.ts + tests only. → Tier 2.
- knip IGNORES `templates/**` + `.safeword/**` (knip.json:2, packages/cli/
  knip.json:2) → verify with grep, not knip.

## Work Log

- 2026-06-30T17:20Z Captured the three-tier retirement plan from a usage sweep.
- 2026-06-30T17:27Z /quality-review (independent subprocess) → REQUEST CHANGES,
  folded in: (C1) knip is blind to templates/.safeword → verify by grep + build/
  test, not knip [the done_when fix]; (C2) every deletion PR must update templates
  + `.safeword` mirror + schema.ts + test fakes together; (C3) "boolean sentinel"
  → "fire-once `hasNudged` gate" (file-based). Added collateral (`model:'haiku'`
  ×2, buildDigest head-cap semantic change) and the Tier-3 nuance (folding must
  re-home stop-self-report's in-conversation surface). Tier 1/2 consumer lists
  confirmed correct + safe.
