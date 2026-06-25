# Spec: Cold-start executability test for high-blast intake

## Intent

For features that are hard to undo, give the builder proof that the context captured in the spec is enough to execute on its own — by having a context-free agent attempt to **plan** the work from only the spec and repo, with no conversation history, and reporting each point where missing context forces it to guess. It removes the "the agent already knows what I meant from the chat" crutch on exactly the work where being wrong is most expensive. (Planning, not a full build: insufficiency surfaces while planning — ambiguous intent, missing constraints — long before a full implementation would, at a fraction of the cost.)

## Intake Brief

- **Requested by:** alex (filed GitHub issue #329, spun off from TPP6Y2 where it was deliberately cut to keep the first child small).
- **Cost of inaction:** epic 169's sharpest sufficiency check stays unbuilt. On rare one-way-door features the agent can build from chat-only context that never makes it into the spec — confident-but-wrong execution on the work that is most expensive to reverse, and (for the Non-Technical Builder who can't read the diff) no safety net catching it.
- **Reversibility:** two-way door — advisory tooling (a skill + a DISCOVERY rung reusing the existing worktree harness), trivially removed or retuned; no data model or public API. (By its own trigger rule this feature would _not_ warrant the cold-start check — consistent: it's reversible.)

## References

- GitHub issue #329 (this ticket's source).
- Sibling epic-169 children: TPP6Y2 (readiness pointer — lightweight every-turn) and NWFT20 (intake brief — rung-0 reversibility read). This is the occasional deep check those two complement.
- `SAFEWORD.md` "Replan on resume" — the existing `isolation: worktree` sub-agent harness this reuses.
- doc-coauthoring skill, Reader-Testing pattern (fresh Claude, no context bleed) — the source pattern.

## Personas

- **Technical Builder (TB)** — drives the agent across irreversible work; can read the diff and act on surfaced gaps.
- **Non-Technical Builder (NTB)** — directs the agent in natural language, cannot audit the code; needs plain-language assurance and a concrete next action.

## Vocabulary

- **Cold-start check** — a one-shot spawn of a context-free sub-agent, given only the spec + repo (no conversation), that attempts to **plan** the work and reports where missing context forces a guess. Its verdict is _sufficient_ when the cold agent can plan the work end-to-end without guessing at intent or constraints, _insufficient_ otherwise (with the gaps named).
- **One-way door** — an irreversible (or cross-cutting: data model / public API / migration) change, read from the intake brief's recorded **Reversibility** field (not a fresh judgment). The trigger condition for offering the check.
- **Gap** — a specific thing the cold agent could not determine from the spec + repo and had to guess. Each gap becomes an Open Question.

## Jobs To Be Done

### cold-start-executability-test.NTB1 — Approve irreversible work I can't read myself

**Persona:** Non-Technical Builder (NTB)

> When I'm about to let the agent build something hard to undo, I want proof in plain language that what we captured is enough for the work to stand on its own, so I can approve irreversible work without being able to inspect the code.

#### cold-start-executability-test.NTB1.AC1 — The check is offered only on irreversible work

At the Intake Exit step (before advancing to define-behavior), the cold-start check is offered when (and only when) the brief's **recorded** Reversibility field reads one-way-door (or cross-cutting); routine two-way-door features are never interrupted by it. The offer keys off the recorded field, not a fresh re-judgment, so it can't drift liberal. Under YOLO mode (G2E72G), where gates auto-confirm, the offer auto-accepts: the check runs, gaps are recorded, and the auto-decision is logged in the work log — never blocking.

#### cold-start-executability-test.NTB1.AC2 — The verdict is rendered in plain language with a next action

When the check has run, its verdict is presented to the builder in plain language — what a context-free agent could not determine and what to do about it — without internal jargon, actionable by someone who cannot read the diff. (Presentation; AC TB1.AC2 covers persistence.)

#### cold-start-executability-test.NTB1.AC3 — The check is advisory, never a hard block

The builder decides whether to proceed; the check surfaces gaps but never fails closed or blocks an action on its own self-judged signal. This includes the check's own failure: if the cold sub-agent errors or times out, the agent notes it in one line and proceeds — no gap list, no block (mirroring the replan-on-resume failure rule).

### cold-start-executability-test.TB1 — Close context gaps before they get expensive

**Persona:** Technical Builder (TB)

> When I'm directing the agent on a one-way-door change, I want a context-free agent to attempt to plan it from only the spec and flag what it couldn't reconstruct, so I can close the real gaps in the spec before building rather than after.

#### cold-start-executability-test.TB1.AC1 — A context-free agent plans the work from spec + repo only

The check spawns a fresh `isolation: worktree` sub-agent given the ticket + spec and the repo, with zero conversation history. The cold agent attempts to plan the work end-to-end and returns a verdict — _sufficient_ if it could plan without guessing at intent or constraints, _insufficient_ with the named gaps otherwise. It plans, it does not run a full build.

#### cold-start-executability-test.TB1.AC2 — Gaps are persisted to the spec where intake will resolve them

Each gap the cold agent surfaced is appended to `spec.md`'s `## Open Questions` (added, not overwriting existing questions), so the existing Intake Exit discipline resolves or defers it before define-behavior. (Persistence; AC NTB1.AC2 covers presentation. Note: unlike the replan-on-resume pattern this reuses — which reports in chat only and never edits the ticket — this check deliberately writes to Open Questions, the designated mutable intake scratch, because that is the sink intake already drains at exit.)

#### cold-start-executability-test.TB1.AC3 — The builder can invoke the check on demand

The check is invokable explicitly at any point, independent of the reversibility read, for when the builder wants the sufficiency signal regardless of the auto-offer.

## Outcomes

- On a one-way-door feature, the Intake Exit step offers the check; on a two-way-door feature, it stays silent.
- Running the check yields a plain-language sufficiency verdict (could a cold agent plan this end-to-end?) plus the named gaps, appended to Open Questions.
- The check never blocks: the builder chooses whether to proceed, and a sub-agent error/timeout is noted and skipped, not gated.
- Under YOLO the check auto-runs and logs its auto-decision; the builder can also invoke it on demand regardless of the auto-offer.

## Open Questions

<!-- none open — design resolved across two figure-it-out passes (see ticket.md Decision). -->
