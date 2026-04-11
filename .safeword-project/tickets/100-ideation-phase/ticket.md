---
id: '100'
title: Propose-and-converge interaction pattern
type: feature
phase: done
status: done
created: 2026-04-10
---

## Goal

Replace front-loaded questioning ("classify and ask 1-5 questions") with a propose-and-converge pattern: the agent restates what it heard, contributes a perspective or sketch, and surfaces open questions as part of that contribution. Depth scales naturally with ambiguity — no mode detection needed.

## Scope

- Agent always contributes before extracting (restate + perspective before questions)
- Proposals get more specific with each turn, incorporating user feedback
- User acceptance of a proposal triggers transition to execution
- Works identically for vague ideas, clear specs, and everything between
- Backstop at 3 turns to prevent infinite exploration

## Out of Scope

- Vague-vs-clear detection logic (eliminated by design)
- Fixed round limits or structured ideation phases
- Persisting ideation artifacts beyond the conversation

## Decomposition — Intake Substeps

What was previously lumped as "intake" is actually four distinct steps:

| Step              | What it is                                             | Currently                                            | Proposed                                                                                         |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Understanding** | "What are you trying to do?" — converge on the idea    | Features: Phase 0-2. Tasks: optional. Patches: none. | Propose-and-converge for all levels (0-3 turns). Defined by 6 scenarios in test-definitions.md.  |
| **Sizing**        | "How big is this?" — classify, decide artifacts needed | Detection tree, runs first (before understanding)    | Three concrete questions, agent-internal, after understanding. See Sizing section below.         |
| **Scoping**       | "What's in, what's out?" — boundaries, edge cases      | Feature spec goal/scope. Task spec "Out of Scope."   | Collapsed into understanding — scope derived from resolved questions. See Scoping section below. |
| **Planning**      | "How do I build it?" — scenarios, decomposition, tasks | Features: Phases 3-5. Tasks: inline tests.           | Stays as-is with two refinements. See Planning section below.                                    |

**Key insight:** The natural order is Understanding → Sizing → Planning. Scoping is not a separate step — it's how understanding ends. Every open question resolved during propose-and-converge produces one In-Scope item (the choice) and one or more Out-of-Scope items (the rejected alternatives). Today, sizing happens first (detection tree), then understanding (discovery) — backwards.

**Decision:** Understanding = propose-and-converge. The 6 scenarios in test-definitions.md define this step completely. No changes needed to scenarios after extensive review.

### Enforcement model (decided — soft, not mechanical)

Understanding and sizing are **conceptual phases defined in SAFEWORD.md**, not mechanically tracked in ticket frontmatter.

**Why not mechanical phase tracking:**

- Understanding and sizing happen in 0-3 turns (minutes). Phase tracking makes sense for Phase 3-7 (hours of work with distinct artifacts). The bookkeeping overhead exceeds the value for a brief conversation.
- The prompt hook's two lines already encode the behavior: "contribute before asking" (understanding) + "include what it touches and what rigor it warrants" (sizing). These fire every turn and survive compaction.
- Adding `phase: understanding` to ticket frontmatter would mean creating a ticket before the first contribution, then updating it mid-conversation — mechanical overhead for a conversational step.

**What we do instead:**

- SAFEWORD.md defines understanding and sizing as named steps with clear instructions and exit criteria
- The prompt hook re-injects the headline principles every turn (survives compaction)
- The ticket gets created after understanding+sizing complete (at what is currently `define-behavior` for features, or at spec creation for tasks)
- No new hook code, no frontmatter tracking, no pre-tool blocking for these steps

**What stays mechanically enforced:**

- Phase 3+ (define-behavior, scenario-gate, decomposition, done) — tracked in frontmatter, pre-tool blocks code edits in planning phases
- Done phase hard blocks (test/scenario/audit evidence)
- LOC gate, TDD step gates

**Rationale:** Gate the irreversible, nudge the qualitative. Understanding/sizing are qualitative judgment — the agent should have agency to skip for trivial requests (0-turn patches). Hard enforcement would create "learned helplessness" where the agent seeks permission before obvious actions.

### Sizing (decided)

After understanding, the agent answers three concrete questions internally before proceeding:

1. How many files will this touch?
2. Does this introduce new persistent state?
3. Are there multiple user flows?

**Routing:**

- All no / 1 file → fix directly (patch)
- 1-2 files, one testable behavior → TDD (task)
- 3+ files OR new state OR multiple flows → write scenarios first (feature)

**Mechanism:** Prompt hook re-injects the three questions every turn (survives compaction). Agent answers internally — user never sees the checklist. Answers drive artifact creation, which drives enforcement.

**What changes from today:**

- Same criteria as current detection tree
- Runs AFTER understanding instead of before (better input = more accurate)
- Runs on agent's converged proposal, not raw keyword matching
- No visible announcement ("Feature detected") — sizing is embedded in the agent's contribute-first proposal

**What doesn't change:**

- Pre-tool enforcement (blocks edits in planning phases)
- Stop hook enforcement (artifact checks at done)
- Artifact requirements per level
- User can override with `/bdd` or `/tdd`

**Future optimization:** Could the sizing step use a smaller model (e.g., Haiku) via a `prompt`-type hook instead of the main agent? The three questions are factual, not creative — a cheap model might handle them reliably. Explore later.

### Scoping (decided — collapsed into understanding)

Scoping is not a separate step. It's how understanding ends.

**Mechanism:** Every open question resolved during propose-and-converge produces scope:

- The choice → In Scope
- The rejected alternatives → Out of Scope

Example from a 3-turn understanding:

| Resolved question                          | In Scope                   | Out of Scope             |
| ------------------------------------------ | -------------------------- | ------------------------ |
| "Noise reducer vs spotter" → noise reducer | Filter what doesn't matter | Discovery/surfacing tool |
| "Daily digest vs real-time" → daily        | Morning digest             | Real-time alerts         |
| "Just you vs team-wide" → just me          | Single-user                | Team/org deployment      |

**The final turn of understanding includes structured scope:**

> Scope: Morning digest — Gmail threads + Slack mentions, ranked by sender importance and deadline keywords. Single user.
> Out of Scope: Real-time alerts, Google Docs, team-wide usage, device sync.
> Done When: Daily digest with top items ranked.

**Per level:**

- Patches (0 turns): One-line scope, implicit Out of Scope ("not modifying surrounding code")
- Tasks (0-1 turns): Scope + rejected alternative as Out of Scope + Done When
- Features (1-3 turns): Full structured scope from all resolved questions + domain-knowledge exclusions

**Non-obvious exclusions:** Resolved questions capture things that were discussed. For exclusions nobody mentioned (e.g., "not building a migration system"), the agent adds domain-knowledge boundaries beyond the resolved alternatives.

**What changes from today:**

- Out of Scope is derived from understanding, not invented in a separate step
- Scope artifact is still written to ticket (same format, same enforcement)
- No separate scoping conversation — scope is embedded in the final proposal

**Exit criterion for understanding:** After the user accepts a proposal, write structured scope to the ticket (Scope, Out of Scope, Done When) before proceeding to sizing. This is the forcing function — the loop produces its key output before ending.

**What doesn't change:**

- Spec still written to ticket with Scope / Out of Scope / Done When
- Quality review can still check implementation against spec

### Planning (decided — stays as-is with two refinements)

Planning runs after sizing. The process per level:

- **Patches:** No planning. Fix directly.
- **Tasks:** Inline test scenarios in spec → TDD (RED→GREEN→REFACTOR). Unchanged.
- **Features:** Phase 3 (draft scenarios) → Phase 4 (validate) → Phase 5 (decompose) → Phase 6 (TDD). Two refinements below.

**Refinement 1 — Phase 5 (decomposition) is now optional:**
Agent can skip decomposition if the architecture is clear from the converged proposal. Decomposition adds value when architecture decisions are ambiguous (schema choices, shared module conflicts). It adds overhead when the architecture is obvious from the proposal (data → logic → API → UI). Agent's judgment, with user override.

Research basis: Google Research found decomposition improves parallel tasks (+81%) but degrades sequential ones (39-70%). Most feature implementation is sequential.

**Refinement 2 — Phase 3 draws from resolved questions:**
Resolved questions from understanding inform which behavioral space to cover in scenarios — not the exact scenarios themselves. "User chose noise-reducer over spotter" → scenarios should test noise-reduction behaviors, not the choosing. The agent uses resolved questions to determine coverage area, then drafts testable Given/When/Then scenarios within that area. Add failure-mode scenarios from domain knowledge.

**What doesn't change:**

- Phase 3 (scenarios) and Phase 4 (validation gate) are Safeword's core value — kept intact
- Phase 6 (TDD) unchanged
- Test-first discipline unchanged
- All planning runs on better input (converged, scoped, sized proposal)

### Design exploration

See [design-exploration.md](design-exploration.md) for the full log of approaches explored, debated, and evaluated — including emergent classification, multi-layer heuristics, and why the simple answer won.

### Implementation approach

Three text changes + manual evaluation:

1. **prompt-questions.ts** — Replace current injection with:

   ```
   SAFEWORD:
   - Contribute before asking. Embed open questions in your contribution.
   - When proposing, include what it touches and what rigor it warrants.
   ```

   Both lines universally relevant (every turn, not just turn 1). Sizing details (3 questions) and scope derivation live in SAFEWORD.md. Hook carries the headline principles that survive compaction.

2. **SAFEWORD.md** — Reorder: understanding (propose-and-converge) before sizing (detection tree). Embed scoping in final proposal (derive Out of Scope from resolved questions). Change announcements to contribute-first style. Make Phase 5 decomposition optional. Note that Phase 3 scenarios draw from resolved questions as behavioral coverage areas.
3. **DISCOVERY.md** — Reframe discovery rounds as contribution techniques within propose-and-converge, not a separate phase.
4. **Manual evaluation** — Test conversations at each work level (patch, task, feature). Include: verify Safeword hooks execute normally under Claude Code Auto Mode (no conflict — they operate at different layers, but verify empirically).

## Open Questions (future work)

### 1. Quality prompts should reference latest research, not static knowledge

The quality review hooks and stop hook prompts say "Does it follow latest docs/best practices?" but the agent can only use its training data. These prompts should be updated to explicitly trigger web research — fetching current documentation, checking versions, verifying against latest patterns. This applies across all quality gates, not just intake.

### 2. Explore-debate-steelman as a general Safeword pattern

Split into two tickets:

- **#105** — Agent reasoning discipline: encode explore-debate as agent-internal behavior (safe, due diligence). Steelmanning is risky solo (fox-henhouse) but the explore-debate portion is straightforward.
- **#106** — User collaboration guide: document the techniques users can use to drive better outcomes (explore, steelman, show examples, capture). User-facing, not agent-internal.

## Origin

Customer feedback from Guru (2026-04-10): "It is asking me a lot of follow-up questions about the technical scope. But it is assuming that I am set on the idea. Instead I would love to start the conversation with a vague idea. Then it helps me go through some kind of an ideation to finalize the specific details about the idea itself before getting into the tech."

## Work Log

- 2026-04-10T23:50Z Complete: Phase 0-2 - Context established from customer feedback
- 2026-04-11T03:27Z Complete: Phase 3 - 6 scenarios defined (propose-and-converge model)
- 2026-04-11T04:17Z Complete: Phase 4 - All 6 scenarios validated (atomic, observable, deterministic-for-domain)
- 2026-04-11T14:38Z Complete: Phase 5 - Decomposed into 3 implementation tasks (three text changes). Sizing, scoping, and planning designs finalized.
