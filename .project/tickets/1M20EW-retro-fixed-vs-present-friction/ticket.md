---
id: 1M20EW
slug: retro-fixed-vs-present-friction
type: task
phase: intake
status: todo
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

## Sketch (not yet designed — intake)

Candidate directions to weigh in spec/figure-it-out:

- Tighten the extraction system prompt to require findings be friction that is
  STILL present at the end of the window (ignore problems the session resolved).
- Post-filter: drop findings whose surface/title was touched by a commit in the
  same session (the transcript shows the fix landing).
- Accept-and-dedupe: rely on the occurrence ledger + human triage (weakest —
  still files the false issue once).

## Out of scope

- ZFGWS1's shipped mechanism (delta re-arm, sonnet, async hook, signature dedupe)
  — all validated by the live fire; this is a follow-up refinement, not a regression.

## Work Log

- 2026-06-30T20:43Z Created from the ZFGWS1 live fire — extractor reported 5/6
  already-fixed bugs as current friction. Backlog (todo); needs intake/spec.
