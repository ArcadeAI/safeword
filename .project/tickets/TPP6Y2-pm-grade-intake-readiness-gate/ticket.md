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

**Honest delta (not greenfield):** `prompt-questions.ts` already emits an `intake` reminder with a three-part self-test ("what changes, what stays the same, observable done state"), mirroring the specificity self-test in `SAFEWORD.md`. This ticket is a *targeted expansion* of that existing line, plus one VoI sentence in SAFEWORD.md — not a new gate.

- Expand the existing intake self-test from three dimensions to **five**, derived from four independent intake disciplines (see Research). The reminder stays a **compressed pointer** to the dimensions (as today's line is), NOT five spelled-out prompts re-injected every turn — that would itself become the per-turn interrogation this ticket avoids. The five dimensions:
  1. **Intent** — why, and for whom?
  2. **Done** — what's the measurable end-state?
  3. **Constraints** — what must not break, who depends on this, is it reversible?
  4. **Riskiest assumption** — what am I most likely wrong about, and what's the cheapest way to test it before running? (active de-risking, not passive flagging — from `product-brainstorming` Assumption-Testing mode)
  5. **Request shape** — is this the problem, or someone's guess at the fix?
- Reuse the shipped `## Open Questions` section in `spec.md` (ticket V6N5PW) as the ledger of unresolved unknowns.
- Codify the VoI triage rule in SAFEWORD.md prose: reversible/local → run; irreversible/high-blast → resolve unknowns first. (The *behavioral go/no-go* — ready when remaining questions are edge-cases not basics, `doc-coauthoring/SKILL.md:97` — is the quality bar for this prose, not a separately testable criterion.)
- **Reuse `elicit`, don't duplicate it.** The gate is the go/no-go threshold + the five dimensions; it *inherits* elicit's rules — the Iron Law (`elicit/SKILL.md:11`, never surface a question the agent could answer itself), information-gain ordering (`:28`), the anchoring guard (`:50`), and the stopping rule (`:54`) — and *escalates to* `/elicit` only when user-only unknowns remain at meaningful blast radius. The default path is a silent "go." The gate never re-implements question-asking.
- **Stay silent during divergence.** The gate is a convergence device; it does not fire while the user is exploring/brainstorming (brainstorm's "user controls convergence", `brainstorm/SKILL.md:23`). It activates at the brainstorm→build handoff, not before.
- **Never announce the framework.** Render the five prompts as plain questions, not "running the readiness assessment" (brainstorm anti-pattern, `brainstorm/SKILL.md:49`) — already house law, reused not re-derived.
- **Behavioral go/no-go phrasing** (from `doc-coauthoring/SKILL.md:97`): phrase the SAFEWORD.md prose so "ready" means *remaining questions are edge-cases/trade-offs, not basics* — the checkable form of the signal and the anti-rubber-stamp guard. This shapes the prose copy; it is not a separate hook-testable criterion.

## Research (four genuine /figure-it-out passes)

The five-prompt core converges from four independent intake disciplines — cross-domain agreement is the strongest signal the shape is right:

- **Leadership / mission command** → clarify *intent + end-state*, take prudent risk within it; depth scales with readiness × blast radius. (`intake-readiness-leadership-analogy.md`)
- **Product management / Cagan** → bounded core (objective, success-signal, problem-not-solution, who) + *riskiest assumption*; lightweight, not a brief. (`intake-readiness-pm-analogy.md`)
- **Architecture** → *constraints / what-must-not-break* as the expensive-to-retrofit axis, made measurable. Bounded hard by **constraint decay** — agents degrade as constraints pile up, so surface only the load-bearing one. ([arXiv 2605.06445](https://arxiv.org/abs/2605.06445))
- **Consulting** → *problem-behind-the-problem* / request-shape normalization (under-specified non-technical ask vs. solution-in-disguise technical ask). (`intake-readiness-architect-consultant-analogy.md`)

## Out of scope

- A hard hook gate that blocks edits until an intake brief exists (rejected alternative — over-asks the common case).
- A heavier PM intake-brief artifact (who asked / problem / success metric / reversibility) — defer to a later child of epic 169.
- **Cold-start executability test** (spawn a fresh worktree sub-agent to verify it could run from the captured context, `doc-coauthoring/SKILL.md:255-331`) — **cut to a later child of epic 169.** It is a second, expensive mechanism for a rare case, and spawning an agent to re-derive sufficiency is the maximal form of the re-interrogation this ticket avoids. Does not belong in the smallest-thing-that-works core.
- Changing the propose-and-converge flow or the existing phase/LOC/done gates.
- Re-implementing question-asking mechanics (info-gain ordering, anchoring guard, stopping rule) — those live in `elicit`; the gate reuses them.
- Auto-invoking `/elicit` on normal turns — escalation is reserved for user-only unknowns above a blast-radius threshold (premortem guard against resurrecting first-turn interrogation).
- Folding the gate into the `elicit` skill — wrong cadence (the gate is a per-turn passive check; elicit is heavy active asking).

## Done when

Observable (these are what the TDD test asserts):

- The `intake` reminder in `prompt-questions.ts` surfaces a compressed pointer to all five dimensions (intent / done / constraints / riskiest-assumption / request-shape) during Clarify — verifiable in the hook's emitted output.
- The constraint dimension is worded "what must not break / reversibility" — not an NFR quality-attributes survey (constraint-decay guard) — verifiable in the reminder + SAFEWORD.md text.
- SAFEWORD.md carries the VoI triage sentence (reversible/local → run; irreversible/high-blast → resolve unknowns first) phrased with the behavioral "edge-cases-not-basics" readiness bar.

Quality bar (shapes the copy; not unit-testable at the hook layer, stated so honestly):

- The dimensions read as generative thinking prompts, not a yes/no checklist — the anti-rubber-stamp intent. Judged in review, not asserted by a test.

## Open Questions

- **Soft or firm surfacing?** Pure SAFEWORD.md instruction (model-run, no hook) vs. a `prompt-questions.ts` reminder line. Leaning reminder — dormant-by-default is the problem being fixed. _(unresolved)_
- **Does 3→5 dimensions on a per-turn reminder cross from nudge into interrogation?** The real propulsive-by-default tension. Current resolution: keep the reminder a *compressed pointer* (as line 64 is today), never five spelled-out prompts per turn — but confirm the expanded line still reads as a nudge, not a checklist, before shipping. _(unresolved — load-bearing)_
- ~~**Ledger shape?**~~ _Resolved: already settled by V6N5PW (reuse the `## Open Questions` spec section; heavier brief deferred). Not re-litigated here._

## Work Log

- 2026-06-21T03:41:30.915Z Started: Created ticket TPP6Y2
- 2026-06-21T03:41Z Scoped from /figure-it-out: soft readiness gate + VoI triage (Option A framed by C); rejected hard gate (B). Linked as first child of epic 169 (pm-grade-intake). Scope/out_of_scope/done_when set; two open questions recorded for user to resolve before implement.
- 2026-06-21T04:13Z Ran three more genuine /figure-it-out passes (leadership, PM, architect/consultant) — captured as learnings. Folded the convergent five-prompt self-test core (intent / done / constraints / riskiest-assumption / request-shape) into scope + done_when. Fresh evidence added: Cagan is 10 questions not 4 (lightweight by design); constraint decay (arXiv 2605.06445) bounds the constraint prompt to "what must not break", not an NFR sweep. Two scope open questions still unresolved.
- 2026-06-21T04:18Z Cross-checked against safeword's elicit + brainstorm skills and Claude's public skills (/figure-it-out). Product-self-knowledge skill irrelevant (docs-routing). Decision: gate REUSES elicit's rules (Iron Law, info-gain ordering, anchoring guard, stopping rule) and escalates to /elicit for high-blast user-only unknowns rather than duplicating them; gate stays silent during brainstorm/divergence; never announces the framework. Added to scope + out_of_scope. Two scope open questions held per user.
- 2026-06-21T04:21Z Checked Anthropic's prebuilt skills (/figure-it-out). No "product brainstorm" skill exists; the find is the `doc-coauthoring` example skill. Folded two new ideas (tiered): (A) behavioral go/no-go — "go" when remaining questions are edge-cases not basics (`doc-coauthoring/SKILL.md:97`), making the threshold observable + anti-rubber-stamp; (B) cold-start executability test (could a fresh agent run from captured context?) as high-blast escalation reusing the worktree sub-agent harness (`:255-331`). Rejected doc-coauthoring's dump-first ordering (inverts contribute-before-asking; agent can read code itself).
- 2026-06-21T04:26Z Reviewed Anthropic's `product-brainstorming` skill. Resisted most of it — it is divergent-ideation machinery (modes/frameworks: HMW, SCAMPER, OST, OODA) that belongs to brainstorm, not the convergent gate; folding it would be the "don't dump frameworks" anti-pattern + bloat. ONE fold: upgraded the riskiest-assumption prompt to also name the *cheapest way to test it before running* (active de-risking, Assumption-Testing mode). Noted OODA's "stuck in Orient" as reinforcement for the anti-over-gating premortem (no scope change).
- 2026-06-21T04:32Z /quality-review with independent fresh-context reviewer. REQUEST CHANGES applied: (1) CUT cold-start sub-agent escalation to a later child — second mechanism, rare+expensive, and the maximal form of re-interrogation; (2) rewrote done_when to observable-only (reminder/SAFEWORD.md text), demoted behavioral go/no-go + generative-quality to non-testable quality bar; (3) reframed scope as honest delta — expand existing intake reminder 3→5 dimensions as a compressed pointer (NOT 5 spelled-out prompts/turn), not greenfield; (4) closed the ledger-shape open question (settled by V6N5PW); (5) replaced it with the real load-bearing unknown — does 3→5 per-turn cross into interrogation. Scope now reduced to the smallest testable change.
