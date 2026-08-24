---
id: R9TLC3
slug: surface-degraded-review-independence
type: task
phase: done
status: done
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

## Resolution — delivered differently than Direction stated

Direction proposed a CLI qualifier line. That was **not** the route taken.

Investigation found the CLI already tells the truth: `degradedDescription` in
`review/coordinator.ts` emits a `warning`-severity `REVIEW_INDEPENDENCE_DEGRADED`
finding reading "This review was not independent: the same agent (X) checked its
own work". The suppression lived one layer up, in this skill's own guidance,
which instructed agents to present a same-agent fallback "to people as standard
coverage" — and paired it with "keep optional setup advice quiet by default",
which read as licence to bury the independence signal too.

A CLI change would also have reversed `clarify-review-coverage.NTB1.R1`, a
codified feature titled "Make review coverage clear without false alarms", whose
Examples pin the exact strings `Review complete — standard coverage.` versus
`… independent coverage.`. Reversing a delivered spec under a different ticket's
authority was the wrong call for a wording fix.

Shipped instead: the "as standard coverage" clause is removed from
`quality-review/SKILL.md`, replaced with an explicit instruction to state
degraded independence plainly and never call it independent, cross-agent, or
standard coverage; and the quiet-by-default sentence now scopes itself to
recovery commands and install hints, never the review's independence. Applied
across all five parity copies plus the regenerated Claude/Codex plugin assets
and historical catalogue.

`review-presentation.ts` and `clarify-review-coverage.feature` are unchanged, so
NTB1 stands as specified. The premortem's alert-fatigue mitigation still holds:
one line, never a block, nothing on the healthy path.

## Work Log

- 2026-08-24T06:03:14.948Z Phase: intake → done
