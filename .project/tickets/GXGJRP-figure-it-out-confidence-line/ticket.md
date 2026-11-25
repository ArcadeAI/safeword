---
id: GXGJRP
slug: figure-it-out-confidence-line
type: patch
phase: intake
status: in_progress
created: 2026-10-24T04:46:26.000Z
last_modified: 2026-10-24T04:46:26.000Z
---

# Add a confidence and review-date line to figure-it-out's commit format

**Goal:** Every figure-it-out recommendation states a probability and a review date, e.g. `**Confidence:** 70% — review by 2027-01-15`, alongside Premortem and Next.

**Why:** The commit format forces a pick ("No hedging") but never records how sure, so miscalibration stays invisible. Executives' 80% intervals contained the outcome only ~33% of the time across 11,600+ CFO forecasts (Ben-David, Graham, Harvey; https://corpgov.law.harvard.edu/2010/09/15/managerial-miscalibration). A number is not a hedge, so "No hedging" stays. Premortems are written and never revisited; a review date is the hook to revisit them.

## Scope (proposed)

- `plugin/skills/figure-it-out/SKILL.md` Phase 4 format: add the Confidence line between Premortem and Next; one sentence on what the number means (probability the pick still looks right at the review date).
- Mirror in templates/dogfood copies per the skill-sync convention.

## Open questions

- Should the stop hook / re-entry brief read the review date the way it reads Next?
- Consumer of the line: Quack's `log_decision` (TheMostlyGreat/quack ticket 003) would ingest Claude's pick + the user's own probability. Does safeword need anything beyond emitting the line?

## Work Log

- 2026-10-24T04:46:26.000Z Started: Created ticket GXGJRP from Quack plugin design session.
