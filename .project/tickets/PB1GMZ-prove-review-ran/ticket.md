---
id: PB1GMZ
slug: prove-review-ran
type: task
subtype: bug-investigated
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

## Root Cause

Receipt verification ran before either gate selected the scope it needed, so
every coordinator-claiming entry in the append-only ledger started a separate
lookup with its own timeout budget. This was confirmed by tracing both
PreToolUse and Stop through `verifiedStamps`, which iterated the complete parsed
ledger and called `readReviewReceipt` once per matching claim.

Receipt target binding normalized path segments but never anchored them to the
configured namespace's `tickets` directory. A genuine approval of a decoy such
as `docs/T1-slug/spec.md` therefore matched the real ticket by basename alone.

Ruled out: the coordinator's integrity signature and source-staleness check are
not the cause; they correctly prove the reviewed decoy and correctly detect
changes to it. The missing information is exact expected-ticket containment at
the gate. Also ruled out: the per-route timeout itself is not unbounded; the
amplification comes from resetting its total deadline for every ledger entry.
