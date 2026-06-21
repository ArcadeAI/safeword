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

- A generative readiness self-test the model runs before advancing Clarify→Build — five plain-English, blast-radius-gated prompts (no jargon, ≤5, generative not checkbox), derived from four independent intake disciplines (see Research below):
  1. **Intent** — why, and for whom?
  2. **Done** — what's the measurable end-state?
  3. **Constraints** — what must not break, who depends on this, is it reversible?
  4. **Riskiest assumption** — what am I most likely wrong about?
  5. **Request shape** — is this the problem, or someone's guess at the fix?
- Surface it every Clarify turn via the existing `prompt-questions.ts` reminder (replaces dormant-by-default with an explicit nudge).
- Reuse the shipped `## Open Questions` section in `spec.md` (ticket V6N5PW) as the ledger of unresolved unknowns.
- Codify the VoI triage rule in SAFEWORD.md: reversible/local → run; irreversible/high-blast → resolve unknowns first.

## Research (four genuine /figure-it-out passes)

The five-prompt core converges from four independent intake disciplines — cross-domain agreement is the strongest signal the shape is right:

- **Leadership / mission command** → clarify *intent + end-state*, take prudent risk within it; depth scales with readiness × blast radius. (`intake-readiness-leadership-analogy.md`)
- **Product management / Cagan** → bounded core (objective, success-signal, problem-not-solution, who) + *riskiest assumption*; lightweight, not a brief. (`intake-readiness-pm-analogy.md`)
- **Architecture** → *constraints / what-must-not-break* as the expensive-to-retrofit axis, made measurable. Bounded hard by **constraint decay** — agents degrade as constraints pile up, so surface only the load-bearing one. ([arXiv 2605.06445](https://arxiv.org/abs/2605.06445))
- **Consulting** → *problem-behind-the-problem* / request-shape normalization (under-specified non-technical ask vs. solution-in-disguise technical ask). (`intake-readiness-architect-consultant-analogy.md`)

## Out of scope

- A hard hook gate that blocks edits until an intake brief exists (rejected alternative — over-asks the common case).
- A heavier PM intake-brief artifact (who asked / problem / success metric / reversibility) — defer to a later child of epic 169.
- Changing the propose-and-converge flow or the existing phase/LOC/done gates.

## Done when

- The model emits an explicit go/no-go readiness check at the Clarify→Build boundary, scaled by blast radius.
- A per-turn reminder surfaces the five-prompt readiness self-test during Clarify (no longer purely SAFEWORD.md prose).
- The self-test is generative (forces naming the riskiest assumption + constraints/blast-radius), not a yes/no tick — guarding the premortem failure where it degrades to a rubber-stamp.
- The constraint prompt stays scoped to "what must not break / reversibility" — not an NFR quality-attributes survey (constraint-decay guard).

## Open Questions

- **Soft or firm surfacing?** Pure SAFEWORD.md instruction (model-run, no hook) vs. a `prompt-questions.ts` reminder line. Leaning reminder — dormant-by-default is the problem being fixed. _(unresolved)_
- **Ledger shape?** Reuse the existing `## Open Questions` spec section vs. add a heavier intake brief. Leaning reuse; defer the brief to a later child. _(unresolved)_

## Work Log

- 2026-06-21T03:41:30.915Z Started: Created ticket TPP6Y2
- 2026-06-21T03:41Z Scoped from /figure-it-out: soft readiness gate + VoI triage (Option A framed by C); rejected hard gate (B). Linked as first child of epic 169 (pm-grade-intake). Scope/out_of_scope/done_when set; two open questions recorded for user to resolve before implement.
- 2026-06-21T04:13Z Ran three more genuine /figure-it-out passes (leadership, PM, architect/consultant) — captured as learnings. Folded the convergent five-prompt self-test core (intent / done / constraints / riskiest-assumption / request-shape) into scope + done_when. Fresh evidence added: Cagan is 10 questions not 4 (lightweight by design); constraint decay (arXiv 2605.06445) bounds the constraint prompt to "what must not break", not an NFR sweep. Two scope open questions still unresolved.
