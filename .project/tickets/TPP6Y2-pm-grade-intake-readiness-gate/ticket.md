---
id: TPP6Y2
slug: pm-grade-intake-readiness-gate
type: task
phase: intake
status: in_progress
epic: pm-grade-intake
parent: '169'
created: 2026-06-21T03:41:30.915Z
last_modified: 2026-06-21T03:41:30.915Z
---

# Sufficiency self-test as soft readiness gate at Clarify→Build

**Goal:** Make the agent run an explicit "do I know enough to run?" check at the Clarify→Build boundary, so it never starts irreversible work half-blind — without re-interrogating clear requests.

**Why:** Today the context-sufficiency check is implicit and skippable. `elicit` is dormant by default on the first turn (no hook fires it; only model discretion or late skill-call paths), and the specificity self-test lives in SAFEWORD.md prose with no per-turn surfacing. The user wants a stronger guarantee that all needed context is captured before the agent goes autonomous ("go run"). First child of epic 169 (pm-grade-intake).

## Decision (from /figure-it-out)

Recommend a **soft readiness gate framed by value-of-information triage**, not a hard mechanical gate.

- The target is a *sufficiency threshold* — knowing when you know enough — not maximal questioning. Both over-asking and under-asking are documented failure modes ([CaRT](https://arxiv.org/pdf/2510.08517); [Learning to Ask](https://aclanthology.org/2025.emnlp-main.1104.pdf)).
- Depth scales by blast radius: reversible/local clears in zero turns; irreversible/high-stakes must resolve open questions first ([Value of Information](https://arxiv.org/pdf/2601.06407)). This unifies epic 169 (intake) with epic 170 (propulsive-by-default) — the same go/no-go feeds both.
- Rejected the **hard intake gate**: blanket enforcement taxes the common (clear, reversible) case hardest, erodes trust, and contradicts safeword's own `propose-and-converge-research.md` anti-patterns (schema-filling, fixed rounds) and the prior soft-signal choice in V6N5PW.

## Scope

- A generative readiness self-test the model runs before advancing Clarify→Build: name what changes, what stays the same, the observable done-state, **and the single biggest remaining unknown plus its blast radius**.
- Surface it every Clarify turn via the existing `prompt-questions.ts` reminder (replaces dormant-by-default with an explicit nudge).
- Reuse the shipped `## Open Questions` section in `spec.md` (ticket V6N5PW) as the ledger of unresolved unknowns.
- Codify the VoI triage rule in SAFEWORD.md: reversible/local → run; irreversible/high-blast → resolve unknowns first.

## Out of scope

- A hard hook gate that blocks edits until an intake brief exists (rejected alternative — over-asks the common case).
- A heavier PM intake-brief artifact (who asked / problem / success metric / reversibility) — defer to a later child of epic 169.
- Changing the propose-and-converge flow or the existing phase/LOC/done gates.

## Done when

- The model emits an explicit go/no-go readiness check at the Clarify→Build boundary, scaled by blast radius.
- A per-turn reminder surfaces the readiness self-test during Clarify (no longer purely SAFEWORD.md prose).
- The self-test is generative (forces naming the biggest unknown + blast radius), not a yes/no tick — guarding the premortem failure where it degrades to a rubber-stamp.

## Open Questions

- **Soft or firm surfacing?** Pure SAFEWORD.md instruction (model-run, no hook) vs. a `prompt-questions.ts` reminder line. Leaning reminder — dormant-by-default is the problem being fixed. _(unresolved)_
- **Ledger shape?** Reuse the existing `## Open Questions` spec section vs. add a heavier intake brief. Leaning reuse; defer the brief to a later child. _(unresolved)_

## Work Log

- 2026-06-21T03:41:30.915Z Started: Created ticket TPP6Y2
- 2026-06-21T03:41Z Scoped from /figure-it-out: soft readiness gate + VoI triage (Option A framed by C); rejected hard gate (B). Linked as first child of epic 169 (pm-grade-intake). Scope/out_of_scope/done_when set; two open questions recorded for user to resolve before implement.
