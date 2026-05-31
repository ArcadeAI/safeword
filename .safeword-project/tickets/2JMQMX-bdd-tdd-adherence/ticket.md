---
id: 2JMQMX
slug: bdd-tdd-adherence
type: feature
phase: intake
status: backlog
epic: workflow-gate-hygiene
created: 2026-05-31T18:31:15.885Z
last_modified: 2026-05-31T18:31:15.885Z
---

# Explore & fix bdd/tdd workflow adherence

**Goal:** Diagnose where and why agents drift from safeword's intended bdd/tdd phase machine, then fix it — so the workflow is actually followed, not loosely approximated.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes (run intake when picked up).

## Why

This long dogfooding session repeatedly drifted from the exact workflow, and the drift went unenforced:

- **Closes by `status`, not `phase: done`.** Two epics (DZ2NM5, P8RJ4M) were closed by setting `status: done` with `phase` left at `intake`, so the done-gate never fired. **Verified against current code (2026-05-31):** the entire done-gate branch is keyed on `currentPhase === 'done'` (`stop-quality.ts:351`); a done-_status_ ticket with a non-done phase is explicitly treated as no-phase-context and only draws a soft review (`:509`, `:515`). Nothing enforces that `status: done` ever passed through `phase: done`. verify.md was hand-written until a retro-run was explicitly requested. So the sidestep is real and partly _by design_ — the open question is whether status-close should require the phase gate to have fired.
- **Work outside the phase machine.** Most of the session (ticket filing, revalidation, audits, doc edits) happened with no active phase at all — the machine only engages for a ticket that's deliberately walked intake→done.
- **Skill steps skipped silently.** `/verify` + `/audit` weren't run on the epic closes until asked; nothing flagged their absence because the gate keyed on a phase that was never set.

So the question isn't "is the workflow good" — it's "why doesn't the harness make agents follow it, and what would?"

## Scope (sketch — refine at intake)

- **Diagnose** the drift modes (the three above + any others): where the phase machine is bypassable, where guidance exists but isn't enforced, where the agent has no phase context at all.
- **Decide guidance vs enforcement** per drift mode — some belong as hook gates (physics, per the `natural-vs-self-report-gates` learning), some as clearer skill steps, some are acceptable (not all work is ticketed).
- Likely touches: the phase machine + `pre-tool-quality.ts`/`stop-quality.ts` gates, the done-gate's phase-keying (the `status`-vs-`phase` sidestep), the bdd skill, and re-entry.
- **Open question for intake:** is the fix tighter enforcement (close the `status`/`phase` sidestep, gate more transitions) or better steering (the workflow is fine, agents just need stronger nudges)? The `procedural-gates-generalize-beyond-tdd` and `long-session-style-drift` learnings warn that heavy procedural enforcement can backfire — weigh that.

## Out of scope

- Rewriting the bdd/tdd workflow's _content_ (the phases themselves). This is about _adherence_, not redesigning the phases.

## Related

- **M7AZY3** — parent cleanup epic.
- Learnings: `natural-vs-self-report-gates`, `procedural-gates-generalize-beyond-tdd`, `long-session-style-drift`, `instruction-attention-hierarchy` — directly bear on the enforcement-vs-steering call.
- **DZ2NM5 / P8RJ4M** verify.md — the concrete `status`-vs-`phase: done` sidestep, documented in their close notes.
- **172-phase-step-enforcement** (referenced across the bdd Phase-0 work) — adjacent enforcement epic; coordinate.

## Work Log

- 2026-05-31T18:31:15.885Z Started: Created ticket 2JMQMX
- 2026-05-31T18:31:15.885Z Filed (backlog): carved from this session's dogfooding — the bdd/tdd phase machine was repeatedly sidestepped (closes by status, work outside any phase, skipped /verify+/audit) with no enforcement. Explore the drift modes; decide enforcement vs steering per mode. Sized feature (likely hook + skill changes); intake should resolve the enforcement-vs-steering question first.
- 2026-05-31T18:37:30.834Z Revalidated against current code: confirmed the done-gate is phase-keyed (`stop-quality.ts:351`) and that a done-_status_ ticket is explicitly handled as no-phase-context (`:509`/`:515`) — the `status`-vs-`phase: done` sidestep is real and partly by-design, with no rule linking the two. Diagnosis sharpened with line refs. Other referenced learnings (`natural-vs-self-report-gates`, `procedural-gates-generalize-beyond-tdd`, `long-session-style-drift`, `instruction-attention-hierarchy`) confirmed present in `.safeword-project/learnings/`.
