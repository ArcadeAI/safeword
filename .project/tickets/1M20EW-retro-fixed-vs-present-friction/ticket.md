---
id: 1M20EW
slug: retro-fixed-vs-present-friction
type: task
phase: implement
status: in_progress
created: 2026-06-30T20:43:24.401Z
last_modified: 2026-06-30T20:43:24.401Z
---

# Retro extractor reports fixed/discussed bugs as current friction

**Goal:** Stop the invisible retro from filing issues for bugs the session
already FIXED (or merely discussed) — only surface friction that is still live.

**Why:** Discovered during the ZFGWS1 live fire (2026-06-30). Sonnet mined the
back half of the ZFGWS1 build session and returned 6 sanitized findings — 5 of
which described the very bugs ZFGWS1 *fixed in that session* (haiku default,
once-per-session sentinel, title dedupe, blocking hook, missing session id),
phrased as present-tense friction. The extractor can't distinguish "we fixed X
this session" from "X is broken." For a self-reporting feature this is high-impact:
**any** session that fixes safeword bugs will file false issues for the bugs it
just resolved — exactly the sessions most likely to be substantial and trigger
retro. (The 6th finding — the GitHub-indexing risk — was genuine and was filed +
then closed as #581 after the indexing assumption was empirically confirmed.)

## Evidence

- Live-fire transcript window: `--window-start 2000000` over the ZFGWS1 session;
  `model=sonnet rawFindings=9 encounters=6`.
- 5/6 encounters were fixed-this-session bugs framed as current friction.
- Egress + signature + filing + dedupe all worked correctly — the gap is purely
  the extractor's temporal framing of findings.

## Approach (decided — /quality-review, web-grounded)

**Positive label + deterministic filter.** The extractor labels each finding with
`status: present | resolved` (a POSITIVE extraction task — "tell me the state"),
and code drops `resolved` before filing. The decision moves from "trust the model
to silently omit" to "model labels, code filters" — observable and unit-testable.

- Schema: add `status` to the raw finding; `EXTRACT_SYSTEM_PROMPT` asks for it in
  positive framing ("set status:resolved if the session already fixed this in
  safeword; present if it remains at session end").
- `normalizeFinding`: default missing/unknown → `present` (backward-safe — files,
  never silently drops everything if the model omits the field).
- `prepareEncounters`: skip `status === 'resolved'`. Over-suppression is the
  project's safe direction; the egress pipeline is otherwise untouched.

### Rejected

- **Prompt-only "do NOT report resolved bugs"** — negative instructions are
  empirically unreliable; models follow "do X" better than "don't do Y", and
  Anthropic's prompt guidance endorses positive framing (16x.engineer "Pink
  Elephant Problem"; verified 2026-06-30). Replaced by the positive `status` label.
- **Commit cross-reference post-filter** (drop findings whose file was committed
  this session) — suppresses real friction in the MOST-edited files (false
  negatives where signal is highest) and needs git-log/surface-mapping machinery.
- **Accept-and-dedupe / human triage** — abandons the autonomy that is the point.

### Validation (eval — explicitly insufficient as one fixture)

The live-fire `drafts.json` (5 resolved + 1 present) is a SEED, not a sufficient
eval — tuning to one session overfits (small-set memorization, verified). A real
eval needs several diverse transcripts: a fixed-bug session, a hit-and-worked-
around session (status should be `present`), and a no-fix session. This ticket
ships the mechanism + a deterministic filter test + an N=1 live smoke-eval; the
multi-transcript eval set is follow-on (pairs with ZFGWS1's deferred eval scorer).

## Out of scope

- ZFGWS1's shipped mechanism (delta re-arm, sonnet, async hook, signature dedupe)
  — all validated by the live fire; this is a follow-up refinement, not a regression.

## Work Log

- 2026-06-30T20:43Z Created from the ZFGWS1 live fire — extractor reported 5/6
  already-fixed bugs as current friction. Backlog (todo); needs intake/spec.
- 2026-06-30T22:50Z Implemented (label-then-filter) + N=1 live smoke-eval. Re-ran
  real sonnet over the same window with the new prompt: 11 findings → 5 labeled
  `resolved`, 6 `present`. The 5 resolved were EXACTLY this session's fixed bugs
  (haiku→sonnet, title→signature dedupe, blocking→async hook, OVERLAP_BYTES rename,
  pid-uniqueness) — including refactors done late in the session; the filter dropped
  all 5. The positive-label approach works (sonnet's temporal call was accurate).
  The 6 `present` were genuine live friction (TDD-misses-tsc, commit-time naming
  lint, manual mirror-sync, cross-model-unavailable, verify-suite-timeout, the
  GitHub-indexing risk); they were dropped by the EXISTING resolveSurface
  fail-closed guard (process-level surfaces, not file paths) — net filed 0 vs ~6
  false issues pre-change. Caveat: N=1 — multi-transcript eval still owed.
  Observation (separate ticket candidate): resolveSurface drops process-level
  friction that has no single file surface; out of scope here.
