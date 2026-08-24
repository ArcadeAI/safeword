---
id: R9TLC3
slug: surface-degraded-review-independence
type: task
phase: intake
status: todo
related: [ZRV8D5, DR6M6N]
scope:
  - tell the reader when a review was not independent, at the point of use
  - keep the signal to one line, and print nothing when independence is intact
out_of_scope:
  - blocking or failing a review because it degraded
  - route diagnostics, setup advice, or recovery commands
  - changing which fallback routes are permitted
done_when:
  - a degraded same-agent review states plainly that it was not independent
  - an intact cross-agent review adds no extra output
---

# Say when a review was not independent

**Goal:** Make `independence: degraded` visible to the person reading the verdict.

**Why:** A degraded review is a self-review wearing the label of an independent
one. Presenting it as standard coverage means nobody can tell the difference
between a real second opinion and the same agent grading its own work.

## The mechanism

The coordinator records a permitted same-agent fallback as
`independence: degraded`, and current guidance is to present it "to people as
standard coverage" and keep route detail "quiet by default".

Observed 2026-08-23: a stale local `node_modules/safeword` build stripped
`--output-schema` from the Codex dispatch, so Codex returned findings the
validator rejected as `invalid_output` and every review fell back to Claude
reviewing Claude's own work. Three consecutive reviews reported as normal
coverage. The skew was only found by reading the raw result envelope by hand.

## Direction

Emit one qualifier line when and only when independence is degraded — naming who
actually reviewed and that it was not independent. No advice, no recovery
command, nothing on the intact path.

## Known deviation

This deliberately reverses an existing design choice to keep the fallback quiet.
The trade-off accepted here: a small amount of recurring output in exchange for
the reader being able to trust what "reviewed" means.

## Premortem

The likely failure is alert fatigue if degradation becomes routine. Mitigate by
keeping it a one-line verdict qualifier, never a block, and never printing on
the healthy path.

## Provenance

Diagnosed this session by differential-testing the Codex dispatch with and
without `--output-schema`, then tracing the resolved CLI to a stale artifact.
