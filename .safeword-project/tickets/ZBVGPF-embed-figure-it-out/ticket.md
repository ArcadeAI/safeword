---
id: ZBVGPF
slug: embed-figure-it-out
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-06T18:05:01.631Z
last_modified: 2026-06-06T18:05:01.631Z
---

# Embed figure-it-out into skills and BDD/TDD decision points

**Goal:** Wire the `figure-it-out` skill (option-debate with fresh docs/research before committing) into the other skills and the BDD/TDD phases, so a real design fork triggers evidence-based option analysis by default — instead of depending on the model remembering to reach for it in the moment.

**Why:** `figure-it-out` exists and SAFEWORD.md points to it ("Design choices → call /figure-it-out"), but invocation is discretionary and fires only when the model happens to remember. The decisions that most need it are buried _inside_ other workflows: bdd's structural choices, tdd's REFACTOR calls, debug's hypothesis ranking, the architecture and design-doc guides. Putting a figure-it-out checkpoint at those exact forks makes rigorous option analysis the default where it matters, not an opt-in that gets skipped under momentum.

> Status: **intake**. This records intent, a lead proposal, and the calibration risk. Scope / out_of_scope / done_when and the Phase-0 spec come after the open questions converge. Almost certainly an **epic** — fan out one child per embed site.

> **User direction (2026-06-06):** figure-it-out should **run every time** at each embed point — making it non-optional is the whole value; a skippable prompt collapses back into today's discretionary invocation, which is the problem this ticket exists to fix. The questions below stay **open for discussion in this ticket**, not resolved at intake.

## Where to embed (candidate sites)

- **ticket revalidation / replan-on-resume — priority (per user).** When a resumed ticket's `Resume check: N commit(s)…` heads-up is accepted the revalidation runs `/figure-it-out` over the changed context — **every time** (per user direction), not gated on the verdict. Shape to settle in-ticket: figure-it-out _is_ the revalidation method, and the still-good / change-scope / cancel / split / merge verdict falls **out of** that option analysis rather than deciding whether it runs. Confirmed absent today: the heads-up is emitted by [`replan-relevance.ts`](../../../.safeword/hooks/lib/replan-relevance.ts) (canonical template `packages/cli/templates/hooks/lib/replan.ts`); the judgment itself is the conversational sub-agent in SAFEWORD.md "Replan on resume" (line ~34) — neither references figure-it-out. This is the highest-value embed: revalidation exists _precisely because the world changed under the plan_, which is exactly when re-deciding from memory is most dangerous.
- **bdd** — at the point in DISCOVERY where a scenario implies a structural/design choice, and before `implement`.
- **tdd** — at REFACTOR (structural choices) and at GREEN when multiple plausible implementations exist, not just one obvious line.
- **architecture-guide / design-doc-guide** — already imply this; make the `figure-it-out` call an explicit step rather than a vibe.
- **debug** — ranking competing root-cause hypotheses.
- **refactor** — choosing _which_ restructuring among alternatives.
- **brainstorm** — explicit hand-off: brainstorm diverges, figure-it-out converges with evidence.
- **quality-review / audit** — when a finding implies a design change rather than a local fix.

## Open questions (converge before spec)

- **Trigger — open for discussion (user prior: every time).** Default is **always-on** — figure-it-out runs at each embed point rather than as a prompt the model can decline (a skippable prompt is just today's discretionary invocation in disguise). The live tension to settle in-ticket: keeping always-on from degrading into reinjection-fatigue noise on trivial edits — the failure [QSNKBB](../QSNKBB-prompt-brevity-cut/ticket.md) just cut from the Stop hook. Does "every time" mean literally every invocation, or every time there's a genuine decision at that point (which figure-it-out's own definition already scopes it to)? Open.
- **Replan flow — who runs figure-it-out.** Does the scope-judging sub-agent invoke `/figure-it-out` itself (inside its worktree, before returning a verdict), or does it just flag "scope must change" and hand back so the _main_ agent runs figure-it-out with the user? The sub-agent's contract is "report in chat only, never edit the ticket," which pulls toward hand-back; running it inside the sub-agent keeps it one hop. Left open for discussion.
- **v1 surface area.** Which sites ship first vs. later. Lean: replan-on-resume (per user) + bdd + tdd REFACTOR + the two architecture guides (highest-leverage forks); fan out to debug/refactor/brainstorm after.
- **Boundary hygiene.** figure-it-out, brainstorm, and elicit overlap. Embedding needs a crisp "use which when" so it doesn't create redundant ceremony: figure-it-out = converge-with-evidence, brainstorm = diverge, elicit = extract user-only knowledge.
- **Mechanism.** A single referenced line per site ("at a real design fork, run /figure-it-out"), a shared partial, or duplicated prose? Lean: one referenced line — duplicate content drifts silently (cf. the cursor-rule reference-pattern learning).

## Related

- Pairs with [NTT094-explain-in-english](../NTT094-explain-in-english/ticket.md) — figure-it-out makes the _decision_ rigorous; `/explain` makes the _result_ readable.
- SAFEWORD.md "Authority: docs and research, not memory" — the `/figure-it-out` trigger this ticket operationalizes across more surfaces.

## Work Log

- 2026-06-06T18:05:01.631Z Started: Created ticket ZBVGPF
- 2026-06-06T18:07:00Z Added: replan-on-resume / ticket-revalidation as a priority embed site (per user). Verified figure-it-out is referenced nowhere in that path — heads-up emitted by `.safeword/hooks/lib/replan-relevance.ts` (template `templates/hooks/lib/replan.ts`); scope judgment is the conversational sub-agent in SAFEWORD.md "Replan on resume" (~line 34), verdicts still-good/change-scope/cancel/split/merge. Embed fires only on the re-decide verdicts (change-scope/split/merge); skips still-good/cancel. New open question logged: does the replan sub-agent run figure-it-out itself or hand back to the main agent (lean: hand-back, preserves the "report-in-chat-only, never edit the ticket" contract).
- 2026-06-06T18:18:00Z User direction: figure-it-out should run **every time** at each embed point — non-optional is the value; a skippable prompt = today's discretionary invocation. Reframed the Trigger question and the replan embed from "fires only on re-decide verdicts / skip-when-trivial" to always-on (replan: figure-it-out as the revalidation method, verdict falls out of it). Per user, open questions left explicitly **open for discussion in-ticket**, not resolved at intake — softened my earlier leans. Live tension recorded for that discussion: always-on vs. trivial-edit reinjection noise (cf. QSNKBB).
