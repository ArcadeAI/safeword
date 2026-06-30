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
  sweep (2026-06-30), grouped by WHEN deletion is safe. Do NOT pre-delete — drive
  removals with a knip/`/audit` pass once each path's callers are gone.

  TIER 1 — delete WITH ZFGWS1 (its own PR; callers removed there):
  - `searchByTitle` title-dedupe path: the transport method (github-rest.ts:70),
    the `IssueReference` port entry (triage.ts:39), and the call (triage.ts:82).
    ZFGWS1 replaces it with signature matching; nothing else calls it. Verify with
    knip after ZFGWS1's triage switch.
  - The fire-once boolean sentinel USE in `decideRetroRun` (replaced by the re-arm
    offset state). The sentinel helpers themselves stay until Tier 2.

  TIER 2 — delete WITH #551/#552 (Codex/Cursor invisibility):
  - The entire in-conversation nudge path: `decideRetroNudge` + `buildRetroNudge`
    + the boolean sentinel helpers (`hasNudged`/`markNudged`/`sentinelPath`/
    `sentinelName`) in retro-trigger.ts. For Claude these are ALREADY dead
    (stop-retro.ts uses `decideRetroRun`); they survive only because
    `codex/stop.ts` and `cursor/stop.ts` still nudge in-conversation. When those
    move out-of-band (the move 7D8PJP did for Claude), this FTCQGD-era path
    deletes wholesale.

  TIER 3 — consolidation design call (NOT a blind delete):
  - Two Stop-time self-observation systems overlap: the deterministic self-report
    spool (`stop-self-report.ts` + `lib/self-report.ts`; crashes/exits/gate-
    escalations → in-conversation `additionalContext` + the title-dedupe agent
    filing guide) and the qualitative invisible retro. Complementary at CAPTURE,
    but their FILING paths duplicate, and stop-self-report still surfaces
    in-conversation (the thing 7D8PJP made invisible for retro). Evaluate folding
    the deterministic signals INTO retro's invisible+egress pipeline (one filing
    path, one dedupe), retiring the separate in-conversation surfacing. Own ticket.

  TICKETS:
  - 1FGE1C (robust-tracker-dedup): signature dedupe is absorbed by ZFGWS1 →
    close/fold once ZFGWS1 lands (confirm ZFGWS1 covers its done_when first).
out_of_scope: |
  - The deletions themselves before ZFGWS1 / #551 / #552 land — this ticket is the
    PLAN + the post-merge knip-driven execution, not premature removal.
  - #563 (cost gate) and 7ZCKS6 (eval) — still live, not retired.
done_when: |
  - Tier 1 removed in ZFGWS1's PR (knip clean: no orphaned searchByTitle).
  - Tier 2 removed when #551/#552 land (knip clean: nudge + sentinel helpers gone).
  - Tier 3 has a decision (fold or keep separate) recorded in its own ticket.
  - 1FGE1C closed/annotated as absorbed by ZFGWS1.
created: 2026-06-30T17:20:00.000Z
last_modified: 2026-06-30T17:20:00.000Z
---

# Retire legacy retro paths after ZFGWS1 + Codex/Cursor invisibility

**Goal:** Track the dead-code retirement that the recall rework (ZFGWS1) and the
Codex/Cursor invisibility tickets (#551/#552) enable — so it isn't lost — and
drive the removals with a knip/`/audit` pass once each path's callers are gone.

**Parent:** RV9JT4. **Depends on:** ZFGWS1 (Tier 1), #551/#552 (Tier 2).

## Usage sweep (2026-06-30, grounded)

- `searchByTitle`: only caller is triage.ts:82 (+ github-rest.ts:70 impl,
  triage.ts:39 port). → Tier 1.
- `decideRetroNudge`/`buildRetroNudge`: used by codex/stop.ts + cursor/stop.ts
  only (Claude's stop-retro.ts uses `decideRetroRun`). → Tier 2.
- `hasNudged`/`markNudged`: retro-trigger.ts only, by both decideRetroNudge
  (Codex/Cursor) and decideRetroRun (Claude). Full delete waits on Tier 2.
- Self-report spool (`stop-self-report.ts`, `lib/self-report.ts`) coexists with
  retro at Stop; filing paths overlap. → Tier 3.

## Work Log

- 2026-06-30T17:20Z Captured the three-tier retirement plan from a usage sweep
  while scoping ZFGWS1. Pending /quality-review of the plan.
