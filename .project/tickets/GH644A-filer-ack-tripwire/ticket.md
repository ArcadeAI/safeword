---
id: GH644A
slug: filer-ack-tripwire
type: feature
phase: shape
status: open
parent: RV9JT4-retro-transcript-mining
depends_on: [GH628F]
external_issue: https://github.com/ArcadeAI/safeword/issues/644
scope: |
  Harden GH628F's drain-as-ack (#644 G7: forgeable by the agent it polices,
  observed live). Decision from the 2026-07-03 figure-it-out pass: filer-stamped
  acks + bare-drain tripwire. (1) The safeword-retro-filer appends an ack record
  ({signature, issue}) to a per-session ack file immediately after each
  successful post, BEFORE draining that draft. (2) The stop gate detects a bare
  drain — spool empty while the last dispatched batch has unacked signatures —
  and captures a self-report signal through the existing telemetry pipeline
  (signature-keyed, deduped), so destroyed findings become a tracked upstream
  issue instead of silence. (3) The dispatch text and guide gain "only the
  safeword-retro-filer drains the spool." Inline-fallback filing writes the same
  ack records.
out_of_scope: |
  - Code-verified acks via GitHub search: unauthenticated /search/issues 403s
    through the cloud proxy (verified 2026-07-03), search indexing lags, and
    signature search already false-misses (#581, #628 data point). Rejected.
  - Tamper-proof local attestation: same filesystem principal; not achievable
    and not the threat model (cooperative drift, not adversaries).
done_when: |
  - Filer agent defs (all three harnesses) write per-signature ack records
    before draining; acks appended per successful post, not batched at the end.
  - The gate treats empty-spool-with-unacked-dispatched-batch as a bare drain
    and captures one deduped self-report signal naming the lost batch.
  - Dispatch text forbids parent-agent drains; guide's inline fallback documents
    ack-writing.
  - Honest-crash desync (filed but unacked) produces at most one deduped
    tripwire signal, never a blocking loop.
created: 2026-07-03T05:55:00Z
last_modified: 2026-07-03T05:55:00Z
---

# Filer ack + bare-drain tripwire

**Goal:** A drained spool no longer self-certifies filing: acks name the issues
created, and a drain without acks becomes tracked telemetry instead of silent
loss.

**Why:** #644 G7 — this session's parent agent satisfied the GH628F gate by
draining inline, proving the ack is forgeable by ordinary cooperative drift.

**GitHub:** [#644](https://github.com/ArcadeAI/safeword/issues/644) (G7);
decision recorded there and in the figure-it-out pass of 2026-07-03.
