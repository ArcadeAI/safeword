---
id: HKR3F9
slug: retro-hook-lib-refactor-followups
parent: RV9JT4-retro-transcript-mining
type: task
phase: backlog
status: backlog
created: 2026-07-02T15:42:00.000Z
last_modified: 2026-07-02T15:42:00.000Z
scope: |
  Low-value structural polish surfaced by a refactor scout of the retro hook-side
  modules, deferred out of PR #601 because each touches byte-parity-mirrored
  `templates/hooks/**` ↔ `.safeword/hooks/**` files and/or live importers, and #601
  was under active review — not worth growing that diff for cosmetic gain. Do these
  as a standalone post-merge refactor pass (one change → test → commit each, mirror
  each edit):
    1. Residual JSONL parse-loop duplication. `readJsonlRecords` (lib/jsonl-spool.ts),
       `sumOverJsonlEntries` (lib/retro-trigger.ts), and `buildDigest`
       (lib/retro-extract.ts) each re-implement the same torn-tolerant
       split/skip-blank/JSON.parse/swallow-bad-line kernel. Extract one
       `iterateJsonlEntries(text)` generator into jsonl-spool.ts (its declared home)
       and have all three consume it, keeping only their per-entry fold. Highest value.
    2. Naming collision: two exported `decideRetroNudge` with different signatures —
       lib/retro-trigger.ts (retro-available nudge) and lib/retro-nudge.ts (cloud
       unfiled-drafts filing nudge). Rename to intent-revealing names
       (e.g. decideRetroAvailableNudge / decideRetroFilingNudge); update importers
       (codex/stop.ts, cursor/stop.ts, prompt-retro-nudge.ts) + mirrors.
    3. In-file byte-identical session-id sanitizer at two spots in lib/retro-trigger.ts
       (`sessionId.replace(/[^\w.-]/g, '_')`) — extract a local `sanitizeSessionId`.
       (The cross-file copies vary intentionally; leave them.)
  Optional lower-value polish (only if in the area): name the bare `.slice(0, 300)`
  tool-use input cap in lib/retro-extract.ts; a shared MAX_TOKEN_LEN in
  lib/self-report.ts; extract a pure computeFireWindow from decideRetroRun.
out_of_scope: |
  - Any behavior change — these are behavior-preserving refactors only.
  - src/retro/* — scouted the same pass and found effectively clean (the one genuine
    src-only dup, toEncounterInput, was already extracted in 63a7157).
done_when: |
  - Items 1-3 done as separate mirror-complete refactor commits, tests green, parity
    check clean; OR each is explicitly struck as not-worth-it with a recorded reason.
---

# Retro hook-lib refactor follow-ups (deferred from #601)

**Goal:** Land the low-value structural polish a refactor scout found in the retro
hook-side modules, as a standalone post-merge pass rather than churning
parity-mirrored files on the in-review #601.

**Why:** Both retro refactor scouts this session concluded the subsystem is
effectively clean. The only genuine remaining wins (a residual JSONL parse loop,
a `decideRetroNudge` name collision, an in-file duplicated sanitizer) all touch
mirrored templates and/or live importers — not worth adding to a 128-file PR that
is trying to merge. This ticket keeps them from being forgotten.

## Work Log

- 2026-07-02T15:42Z Created from a `/refactor` scout of the retro subsystem. src/retro
  was clean save one dup already fixed (63a7157, toEncounterInput). Hook-side items
  deferred here for a post-merge parity-complete pass.
