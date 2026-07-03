# Spec: Artifact precedence + review demand: the behavior chain is earned, not ticked

## Intent

Close #644 G1: today the PreTool artifact gates check *existence only*, at a single write point (test-definitions.md creation), in reverse-cascading order. Two consequences the GH628F session demonstrated: (a) the gate's own check ordering dictated authoring **dimensions before spec** — the reverse of the intended spec → dimensions → scenarios flow; (b) an agent satisfied the whole chain with ~3 minutes of retroactive authoring, with no content review demanded at any point (`/self-review` and `/review-spec` never ran; the reviewGate flag that would have demanded them is default-off everywhere, including this repo). Make the chain enforce **precedence** (each artifact created only on complete prerequisites, denials walking forward) and **review** (the two highest-leverage review demands become always-on, content-bound, with auditable skips).

## Intake Brief

- **Requested by:** Safeword Maintainer (via the #644 session audit; wave-2 ordering agreed with the maintainer 2026-07-03 — G2 shipped first as ticket 0KYEBN because it was the root cause that unreached the other gates; G1+G4 are this epic).
- **Cost of inaction:** With G2 shipped, phases are earned — but the artifacts inside them are not. The chain remains satisfiable by burst-authoring skeletal artifacts in reverse order, and no gate ever demands a review before work builds on an unreviewed spec or unreviewed scenarios. The #644 failure recurs with slightly more typing.
- **Reversibility:** Two-way door. Hook gates plus a promotion of existing flag-gated checks to always-on; removing or re-flagging them breaks no data and no public API. The behavioral element — review stamps demanded of every feature ticket going forward — carries the house `skip:` escape.

## References

- #644 (G1 — the gap; G4 sibling is ticket B04ADS; G3/G5/G6 later)
- #385 (PreTool gates evaluate pre-edit state — the ordered-patch UX this chain must keep explaining; sibling friction, not fixed here)
- #478 / #481 (internal review before human-facing checkpoints — this ticket delivers the enforcement half at the two proven leverage points)
- NMSD94 (two-tier review machinery + reviewGate rollout flag — machinery reused, flag posture unchanged for the whole ladder)
- 0KYEBN / PR #693 (G2 phase provenance — the structural pattern this mirrors and composes with; in-repo precedent for a targeted always-on gate)
- 9EA27P (spec.md fail-closed gate; CLI scaffolds spec.md at feature birth, so precedence gates never block scaffolded tickets)
- Parent epic YA68QF (design record D1–D3, decided via /figure-it-out 2026-07-03)

## Personas

- Non-Technical Builder (NTB) — relies entirely on gates to keep the agent honest; cannot audit the diff.
- Technical Builder (TB) — recovers from gate denials by reading them; needs blocks that walk forward, not a chain to reverse-engineer.

## Surfaces

Affected:

- Claude Code
- Claude Code on the Web
- OpenAI Codex — via `codex/pre-tool-quality.ts` adapter spawning the Claude hook as source of truth
- Cursor — via `cursor/pre-tool-quality.ts` adapter spawning the Claude hook as source of truth

Unaffected:

- OpenAI Codex Cloud — no safeword hook runtime there today; parity tracked at the adapter layer, not per-feature.

skip: adapter architecture routes all three harnesses through the single Claude-shaped gate (`pre-tool-quality.ts`); scenarios exercise the shared gate directly plus the existing adapter contract tests, rather than per-surface `@surface.*` duplicates (same ruling as 0KYEBN).

## Vocabulary

- **Artifact precedence** (spec-local): the guarantee that each behavior artifact was created only after its prerequisites existed and were complete — spec.md on ticket.md; dimensions.md on a JTBD/AC-complete spec.md; test-definitions.md on all of the above.
- **Review stamp** (spec-local, from NMSD94): a `review:<ticket>:<artifact>@<content-hash>` line in the skill-invocations log, written by `write-review-stamp.ts` after a review passes (or with `skip:<reason>` for an auditable skip). Content-bound: a stamp matches only this ticket's artifact at exactly the reviewed content, so editing the artifact invalidates the stamp (the stale-approval-dismissal pattern).
- **Earliest-first denial** (spec-local): when several prerequisites are missing, the denial names the one that comes first in the authoring order — so the recovery path walks spec → dimensions → scenarios forward, never backwards.
- **Always-on** (spec-local): fires regardless of the `reviewGate` config flag, matching the G2 gate's posture. The flag continues to govern the whole-ladder Tier-2 phase-exit reviews.

## Jobs To Be Done

### artifact-precedence-gate.NTB1 — Trust the spec chain reflects real thinking

**Persona:** Non-Technical Builder (NTB)

> When my agent builds a feature, I want the behavior artifacts authored in dependency order and reviewed before anything builds on them, so I can trust the spec chain reflects real thinking rather than retroactive box-ticking I can't detect.

#### artifact-precedence-gate.NTB1.AC1 — An artifact cannot be created before its prerequisites are complete

Creating dimensions.md in a feature ticket folder is denied until spec.md exists and passes the JTBD and AC completeness checks (house `skip:` escapes honored exactly as the existing chain honors them); creating spec.md in a ticket folder is denied until ticket.md exists there. Creation-only: the gate polices new artifacts, never edits to existing ones.

#### artifact-precedence-gate.NTB1.AC2 — Scenarios build only on a reviewed spec

Creating test-definitions.md on a feature ticket is denied until a satisfying review stamp exists for spec.md at its current content — a real review (Tier-1 `/self-review`) or a logged skip with a non-empty reason. This demand fires with the reviewGate flag off (always-on); editing the spec afterwards invalidates the stamp for future scenario-file creations.

#### artifact-precedence-gate.NTB1.AC3 — Implementation starts only on independently reviewed scenarios

A ticket.md edit that advances a feature ticket into `implement` is denied until a satisfying review stamp exists for the ticket's scenarios at their current content — an independent review (`/review-spec` by a fresh-context reviewer) or a logged skip with a non-empty reason. Always-on; the stamp binds to the scenario source (`features/<slug>.feature` when the ledger names one, else test-definitions.md), so scenario edits after the review invalidate it.

### artifact-precedence-gate.TB1 — Recover forward from any denial

**Persona:** Technical Builder (TB)

> When a gate blocks my agent mid-chain, I want the block to name the earliest missing step and the action that satisfies it, so recovery walks the intended workflow forward instead of reverse-engineering the chain from its last link.

#### artifact-precedence-gate.TB1.AC1 — Every denial names the earliest missing prerequisite and the forward next action

When multiple prerequisites are missing at any gated write, the denial names the earliest one in authoring order (spec before dimensions before scenarios) and states what to author or run next — including the ordered-patch note where pre-edit-state evaluation applies (#385).

#### artifact-precedence-gate.TB1.AC2 — Rework and routine writes stay cheap

Edits to existing artifacts, work-log appends, non-feature tickets (tasks, patches, epics), tickets at rest, and backward phase moves never trip the new gates. A feature re-entering define-behavior to rework scenarios pays only the re-review on its way back into implement — nothing else.

## Rave Moment

skip: table-stakes — a guardrail's peak experience is the absence of a failure; nothing here beats an expectation in a shareable way (same ruling as 0KYEBN).

## Outcomes

- The #644 G1 reproduction is dead on all three harnesses: burst-authoring the chain in reverse order is denied at the first out-of-order write, and even a forward-ordered burst cannot reach scenario authoring or implement without the two review stamps (or visible, reasoned skips).
- The block chain teaches the workflow: an agent that only ever follows denials still authors spec → review → dimensions → scenarios → independent review → implement, in that order.
- Existing tickets, tasks, patches, and epics are untouched; no at-rest revalidation.

## Open Questions

(none — D1/D2 debates and premortems recorded in the parent epic YA68QF and this ticket's work log; scenario-stamp binding resolved: `.feature` source when the ledger names one, else test-definitions.md)
