---
id: PHATHE
slug: catch-me-up
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: superseded
created: 2026-06-09T20:16:05.452Z
last_modified: 2026-06-09T20:16:05.452Z
---

# Catch-me-up skill: on-demand session recap (where you are + what's next)

**Goal:** An on-demand `/catch-me-up` that, when you return to a task after time away, gives a plain-English recap — where you are, what's been done, and what's next — synthesized from the trail safeword already keeps.

**Why:** Safeword already captures the trajectory (ticket work-logs, the re-entry session log, "Next:" imperatives, phase/gate state, recent commits) — but it's scattered across files, and after a long absence the user has to reassemble "where was I?" by hand. One command that stitches the durable signals into a short recap removes that friction.

> Status: **superseded by [explain-in-english](../NTT094-explain-in-english/ticket.md) (NTT094)** — 2026-06-12. The load-bearing open question (distinct skill or same?) resolved: **same**. Catch-me-up is now `/explain`'s default (no-target) invocation, not a separate skill — one verb, one mental model, no "which do I type?" burden. This ticket stays as the **data-source reference** (re-entry trail + work-log tail + recent commits + unchecked `done_when`) that /explain's default path stitches.

## Build on what exists — don't reinvent

The **re-entry mechanism is the silent, automatic version of this**:

- [stop-reentry.ts](../../../packages/cli/templates/hooks/stop-reentry.ts) appends a session line every turn — `timestamp · session · ticket/phase · Next: <imperative>` — to `.safeword-project/re-entry.md`.
- [session-start-reentry.ts](../../../packages/cli/templates/hooks/session-start-reentry.ts) injects the last few entries on SessionStart for **silent agent context recovery**, and a statusline brief shows them.

Catch-me-up is the **on-demand, human-facing** surface of that same data, plus richer synthesis. Sources to stitch: active ticket (`getTicketInfo` → ticket.md goal / phase / work-log tail / `done_when` still unchecked), `re-entry.md` (recent "Next" imperatives), recent git commits (what landed), current gate/phase.

## Proposed shape

`/catch-me-up` → one scannable brief: _"You're on `<ticket>` at `<phase>`. Last active: `<recent work-log / Next>`. Landed: `<recent commits>`. Remaining: `<unchecked done_when>`. **Next:** `<the imperative>`."_ Same output discipline as the rest of safeword — lead with the answer, end with the call.

## Open questions (converge before spec)

- **Distinct from [explain-in-english](../NTT094-explain-in-english/ticket.md) (NTT094)?** Both emit a plain-English situational summary. Lean: sibling, not duplicate — explain = "translate _this_ artifact"; catch-up = "synthesize _where I am_ across artifacts + trajectory." Likely a shared rendering core, two entry points. Settle this first to avoid two overlapping skills.
- **On-demand only, or auto on return?** Re-entry already auto-injects silently at SessionStart. Should catch-up _also_ fire after a detected long gap, or stay strictly `/catch-me-up`? Lean: on-demand primary; auto-after-long-gap is a Phase 2.
- **"Long absence" signal** (only needed if auto): gap since last re-entry entry / last commit. Define a threshold, or sidestep it by staying on-demand.
- **Scope:** active ticket only, or whole project (multiple in-progress, the epic)? Lean: active ticket first + a one-line "other in-progress: …" pointer.

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md) (legibility cluster).
- [explain-in-english](../NTT094-explain-in-english/ticket.md) (NTT094) — sibling legibility skill; likely a shared core. **Reconcile scope with it before building either.**
- Re-entry mechanism (`stop-reentry.ts` / `session-start-reentry.ts` / `re-entry.md`) — the data foundation.

## Work Log

- 2026-06-09T20:16:05.452Z Started: Created ticket PHATHE.
- 2026-06-09T20:17:00Z Framed: anchored on the re-entry mechanism (the silent auto version already exists — stop-reentry appends a per-turn `Next:` line, session-start-reentry injects it). Catch-me-up = the on-demand human-facing surface + richer synthesis (work-log tail, commits, remaining done_when). Parented under VKNF1T (legibility cluster). Flagged the load-bearing open question: distinct from explain-in-english (NTT094) or the same skill — converge before building to avoid two overlapping legibility skills.
- 2026-06-12T00:40:00Z SUPERSEDED by NTT094. The NTT094 /figure-it-out (user-accepted) resolved the open question as "same skill": catch-me-up = `/explain` with no target. Two-sibling-skills rejected — re-draws a boundary that doesn't exist (catch-up IS "explain where I am") and adds a which-do-I-type burden. The data sources framed here (active ticket via in_progress scan, re-entry tail, `git log`, unchecked done_when) were carried verbatim into /explain's default-target gathering block. No separate skill ships. Kept open as reference, status: superseded.
