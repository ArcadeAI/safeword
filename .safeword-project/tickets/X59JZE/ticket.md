---
id: X59JZE
slug: done-gate-two-state
title: "Split done into merge-ready (verify.md) and outcome-validated (signals live) states"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-three-merge
paired_with: 5FBD29
blocked_on: 1W107W
created: 2026-05-24T21:44:38.560Z
last_modified: 2026-05-24T21:45:00.000Z
---

# Split done into merge-ready + outcome-validated states

**Goal:** Replace safeword's single `done` state with two states: `merge-ready` (verify.md exists, current pre-merge gate) and `outcome-validated` (signals live and receiving data per 1W107W). The ticket has two close gates reflecting reality — implementation is "done" at merge, but value is "done" at validated-in-production.

**Why:** Today safeword's `done` fires at merge-ready. There's no distinction between "code is merged" and "feature is delivering value in production." Arcade's `/build-signals` runs _after_ `/implement-spec` completes — implicitly a two-state model. Safeword needs to make that explicit so the outcome-validated gate isn't optional / forgotten.

**Parent epic:** S4997T
**Paired with:** 5FBD29 in arcade
**Depends on:** 1W107W (the outcome-validated state requires the signals skill to produce live-status signals)

## Scope

### State machine extension

Today:

```
intake → define-behavior → scenario-gate → decomposition → implement → verify → done
```

After this ticket:

```
intake → define-behavior → scenario-gate → decomposition → implement → verify → merge-ready → outcome-validated
```

Or, alternatively, keep `done` as the terminal state and introduce `merge-ready` as an intermediate:

```
intake → ... → verify → merge-ready → done
```

Where `merge-ready` requires verify.md and `done` requires signals live. Driver leans the second shape (preserves `done` semantics; just adds a sub-gate).

### Hook integration

- Existing hook: blocks transition to `done` without `verify.md`. Update: blocks `merge-ready` → `done` unless all Outcomes from the spec have corresponding `live`-status signals (per 1W107W).
- Transition to `merge-ready` is the OLD `done` gate (verify.md required). Same enforcement; just a renamed state.

### Backward compat

- Existing tickets at `phase: done` remain valid — they predate signals. They don't retroactively block.
- New tickets created after this ships go through both gates.
- Tickets where Outcomes are `skip:`-annotated (per VYRKBJ — Phase 2 epic) can skip the `outcome-validated` gate; mark `done` directly with `outcome-validated: skip: <reason>` in frontmatter.

### Reporting

`safeword ticket status` (or equivalent) surfaces the two gates separately:

```text
Ticket DZ2NM5 (bdd-phase-zero-merge):
  - merge-ready: ✓ (verify.md exists)
  - outcome-validated: ✗ (2 of 3 outcomes pending live signals)
```

## Out of scope

- Auto-detecting that a signal has gone live (signals.md status update is manual per 1W107W).
- Time-based gating ("must be live for 7 days before outcome-validated") — out of scope for v1.
- Signals that go from live to dead (broken monitor, deleted alert) — the gate fires on first-live, not on staying-live.

## Done when

- State machine documented with the new merge-ready / outcome-validated split.
- Hook enforces both gates with clear messages.
- Existing tickets at `phase: done` remain valid (backward compat verified by test).
- Worked example shows a ticket walking through merge-ready then outcome-validated.

## Open questions

- **State shape — terminal `done` with intermediate merge-ready, or replace `done` with merge-ready + outcome-validated?** Driver leans intermediate (preserves `done` semantics). Affects every existing ticket — the cleaner-looking option (replace) breaks backward compat.
- **Frontmatter** — single `phase:` field that takes either state, or two boolean fields (`merge_ready: true`, `outcome_validated: false`)? Driver leans single phase field for consistency with today's model.
- **Outcome-validated skip** — explicit `skip:` annotation in frontmatter, or implicit from Outcomes-section `skip:` (per VYRKBJ)? Driver leans implicit — if Outcomes is skip-annotated, the outcome-validated gate is trivially satisfied.

## Work Log

- 2026-05-24T21:44:38.560Z Started: Created ticket X59JZE
- 2026-05-24T21:45:00.000Z Drafted: Scope (state machine, hook, backward compat, reporting); linked to epic S4997T
