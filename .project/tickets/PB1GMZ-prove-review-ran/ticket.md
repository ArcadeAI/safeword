---
id: PB1GMZ
slug: prove-review-ran
type: task
phase: intake
status: in_progress
created: 2026-09-04T23:56:30.616Z
last_modified: 2026-09-04T23:56:30.616Z
---

# Make a review stamp prove the review actually ran

**Goal:** A stamp claiming an independent review must cite a real, fresh, approving review

**Why:** Today the agent writes the stamp itself, so a review that never happened leaves the same record as one that did

## Approach

A stamp claiming `independence: cross-agent` or `degraded` must cite the
coordinator review that produced the verdict (`--review-id`). The hook
reimplements no verification: `review status <id>` already revalidates the job
record's integrity signature and re-fingerprints the reviewed sources, so a
forged record reads as invalid and a review whose sources moved reads as stale.
The decision itself is a pure core (`hooks/lib/review-receipt.ts`), testable
without spawning anything.

Two bindings stop a real-but-unrelated review standing in: a phase stamp must
match the review's kind, and an artifact stamp must appear among the review's
targets. Completed results did not previously carry their own id, kind or
targets — only the pending and failed paths did — so `withReviewProvenance` adds
them where the record is already in hand.

**Deliberately unchanged:** self-review (claims no independence) and `--skip`
(claims no review happened). Neither asserts a second opinion, so neither needs
a witness.

**Honest limit:** this does not make forgery impossible — an agent can read the
integrity key. It moves the act from typing a plausible log line to deliberately
forging a signature, the same jump SLSA describes from L1 to L2.

## Work Log

- 2026-09-04T23:56:30.616Z Started: Created ticket PB1GMZ
- Receipt core + stamp wiring implemented; skills cite `--review-id`; parity and
  schema registration updated.
