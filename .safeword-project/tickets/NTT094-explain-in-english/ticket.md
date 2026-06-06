---
id: NTT094
slug: explain-in-english
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-06T18:05:01.598Z
last_modified: 2026-06-06T18:05:01.598Z
---

# Explain in English: plain-language translation of safeword artifacts and state

**Goal:** An on-demand `/explain` capability that renders safeword's dense internal artifacts and current session state into plain English — what this is, why it matters, what happens next — with the internal vocabulary (phases, gates, sizing, propose-and-converge, verdict shapes) stripped out.

**Why:** SAFEWORD.md's "Talking to the user" mandate says speak plainly and don't make the user learn safeword's vocabulary — yet the system's own artifacts are the densest jargon in the repo: ticket `scope`/`out_of_scope`/`done_when` frontmatter, gate-block messages, ADRs, test-definitions, Stop-hook verdicts. A user (or a teammate who didn't write the ticket) routinely needs "wait — what is this actually saying, and what does it want from me?" A translation layer answers that without diluting the precise artifacts themselves.

> Status: **intake**. This records intent and a lead proposal. Scope / out_of_scope / done_when and the Phase-0 spec (JTBD + ACs) come after the open questions below converge.

## Proposed direction

Lead read: a dedicated `/explain` skill that takes a target — defaulting to "current state" — and emits one scannable plain-English brief: _what this is_ → _why it matters now_ → _what to do next_. Same output discipline SAFEWORD.md already enforces (lead with the answer, front-load load-bearing words, end with the call). It reads the artifact/state, it does not change it.

The highest-leverage target is safeword's own surfaces, because that is where the jargon gap actually bites — a blocked gate the user doesn't understand, a ticket's `done_when` written in shorthand, a verdict that reads like an internal memo. General code/PR explanation is already well-served by base Claude, so that is a weaker candidate for v1.

## Open questions (converge before spec)

- **Input scope.** What can you point it at? (a) current state — "where am I, what's blocking, why"; (b) a named ticket/artifact; (c) a code diff; (d) a figure-it-out verdict. Lean: (a)+(b) for v1; defer (c).
- **Skill vs. inline.** A dedicated `/explain` skill, or fold "explain plainly on request" into existing output discipline / the prompt hook? Lean: skill, so it's invocable and testable — but verify it isn't just re-stating what good prose already does.
- **Audience.** The user driving the session, or a generated hand-off artifact for a teammate / PR reviewer with zero safeword context? Changes the output shape (transient reply vs. durable doc).
- **Output shape.** One short brief, or a layered "one-liner → expand on demand" form for big artifacts (an epic spec) where one paragraph can't carry it.

## Related

- Pairs with [ZBVGPF-embed-figure-it-out](../ZBVGPF-embed-figure-it-out/ticket.md) — both make safeword's reasoning legible: `figure-it-out` makes the _decision_ rigorous, `/explain` makes the _result_ readable.
- SAFEWORD.md "Talking to the user" — the discipline `/explain` output must itself obey.

## Work Log

- 2026-06-06T18:05:01.598Z Started: Created ticket NTT094
