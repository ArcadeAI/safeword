# Spec: plan-implementation phase before TDD

## Intent

Give implementation planning its own gated BDD phase between `scenario-gate` and `implement` (GitHub issue #480), so scenario-gate becomes a pure behavior-quality gate and no TDD RED starts before a valid, reviewed implementation plan exists. Design direction fixed by /figure-it-out (2026-07-08): the phase owns impl-plan.md authoring and architecture *alignment*; architecture *design* stays at intake; a pre-tool transition gate makes the plan a hard precondition for entering `implement`; the phase-exit review stamp is stage-scoped (Tier-2) while `architectureReviewGate` stays content-hash-scoped at verify/done on the reconciled plan; the decomposition-retirement ADR (2026-06-02) gets superseded by a new ADR, not silently contradicted.

## Intake Brief

- **Requested by:** Alex (TheMostlyGreat) — GitHub issue #480 (2026-06-26); issue #530 explicitly waits on this phase as the durable anchor for the #482 language-skill planning pointer.
- **Cost of inaction:** scenario-gate keeps doing two unrelated jobs (behavior quality + implementation design), so planning sits late in a 5-step prose exit checklist where instruction-following measurably decays; a ticket interrupted mid-planning resumes as "continue validating scenarios" and re-runs /review-spec instead of continuing the plan; the Tier-2 exit stamp conflates spec review with design review (the mixing #478 objects to); #530's pointer stays on an interim PostToolUse trigger with no durable home.
- **Reversibility:** one-way door — once released, customer tickets in flight carry `phase: plan-implementation` and matching `phase_anchors`; rolling the enum back orphans those values (the decomposition retirement itself needed a staged, cross-cutting removal). Cross-cutting: phase enum (2 hook libs + boundary-engine lists), stop/pre-tool gates, skill-doc trio, Cursor rule pair, schema manifest, tests, ADR.

## References

- GitHub issues: #480 (this), #478 (checkpoint ordering — related, out of scope), #482/#530 (language-skill pointer seam — out of scope)
- ADR "BDD as a Solo-Agent Adaptation of the Three-Practice Model (retire `decomposition` phase)", ARCHITECTURE.md, Accepted 2026-06-02 — superseded by this feature's ADR
- Epic M6D315 (impl-plan discipline, PR #204) and MR5M3A (architectureReviewGate, PR #208) — the gate semantics this feature relocates but must not break
- /figure-it-out evidence (2026-07-08): gated-artifact ablation arxiv 2604.05278; BDD separation doctrine (cucumber.io BRIEF); Cooper 2008 JPIM deliverables-based gates; stage-scoped approval per Rust-RFC pattern

## Personas

- Technical Builder (TB)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SM)

## Surfaces

Affected:

- Claude Code — full enforcement: phase enum, transition gate (PreToolUse), stop-gate lists, prompt reminders
- OpenAI Codex — skill-doc parity (`.agents/skills/bdd/` trio member) + phase-keyed stop-hook behavior
- Cursor — thin rule pair for the new phase doc + phase-keyed stop-hook behavior
- Claude Code on the Web — headless/ephemeral sessions: approval-gate auto-decision semantics, no interactive-only dependencies
- OpenAI Codex Cloud — same headless semantics; reads `.agents/skills` from the checkout; no bash auto-expansion available
- Cursor Cloud Agents — same headless semantics via the Cursor rule pair

## Vocabulary

Consistent with the project glossary: Phase, Gate, Reconciliation, Phase Anchor. The glossary's `Phase` entry hard-codes the six-phase enum and is updated by this feature. Spec-local terms: "transition gate" (the pre-tool denial of `phase: implement` without a valid plan) and `designApprovalGate` (the opt-in human-approval config toggle, decision 17).

## Jobs To Be Done

### plan-implementation-phase.TB1 — catch wrong-direction designs at a checkpoint, not in the diff

**Persona:** Technical Builder (TB)

> When my agent finishes validating scenarios, I want it to commit to a reviewed implementation plan as its own visible phase before any TDD RED, so I can catch a wrong-direction design at a cheap checkpoint instead of inside a large diff.

#### plan-implementation-phase.TB1.R1 — a new-flow feature cannot enter `implement` until a valid implementation plan exists

#### plan-implementation-phase.TB1.R2 — a ticket interrupted mid-planning resumes into planning work, not scenario re-validation

#### plan-implementation-phase.TB1.R3 — the scenario-gate exit judges only scenario quality; implementation-design judgment happens in the planning phase

#### plan-implementation-phase.TB1.R4 — the architecture record stays honest through planning: prior decisions are reviewed, significant new decisions are offered as ADRs, and deviations supersede the record instead of silently contradicting it

#### plan-implementation-phase.TB1.R5 — customer-visible changes carry a doc-impact plan: the configured documentation sources they touch are enumerated as build-order tasks, or skipped with a reason, and legacy five-section plans keep passing their gates

#### plan-implementation-phase.TB1.R6 — the plan's proof coverage spans every spec-affected surface, or records a per-surface skip

### plan-implementation-phase.TB2 — right-sized planning artifacts

**Persona:** Technical Builder (TB)

> When my agent completes planning, I want the stored artifacts sized to the feature's risk — with padding flagged editorially — so the planning record stays readable and trustworthy instead of becoming volume nobody reads.

#### plan-implementation-phase.TB2.R1 — plan depth tracks feature size and risk in both directions: brief plans are correct for small features, hard-to-reverse work compels depth, and the phase stores only the plan, qualifying ADRs, and existing-lane design docs when their own guides trigger them

#### plan-implementation-phase.TB2.R2 — ADRs stay lean: a page or two per record, never mega-records or design guides in disguise

#### plan-implementation-phase.TB2.R3 — the editorial check governs size, never whether: padding is flagged via the deletion test, and skip lines govern applicability, not effort

### plan-implementation-phase.TB3 — architecture-fluent planning that reuses what exists

**Persona:** Technical Builder (TB)

> When my agent plans, I want it fluent in the current architecture and the design machinery we already ship — reusing better components and existing design lanes, changing architecture deliberately when warranted — so plans neither duplicate what exists nor anchor to it.

#### plan-implementation-phase.TB3.R1 — the phase directs current-architecture awareness (generated state doc + decision record) after the ideal design is sketched, framed as reuse-or-deliberate-change, never sunk-cost conformance

#### plan-implementation-phase.TB3.R2 — deep technical and data design routes through the existing design-doc and data-architecture lanes; impl-plan.md stays the lean record

#### plan-implementation-phase.TB3.R3 — each load-bearing design choice gets a /figure-it-out pass

#### plan-implementation-phase.TB3.R4 — installed language and component skills relevant to the feature's touched code are surfaced during planning, scoped to relevance, never the full inventory

#### plan-implementation-phase.TB3.R5 — each component the plan selects is planned against its installed version's current documentation

### plan-implementation-phase.NTB2 — reviewed before it reaches me, autonomous by default

**Persona:** Non-Technical Builder (NTB)

> When my agent finishes planning, I want the output independently reviewed before anything is put in front of me — and human design approval to be an opt-in toggle defaulting to autonomous — so I'm never asked to judge raw output or approve architecture I can't evaluate.

#### plan-implementation-phase.NTB2.R1 — human handoff on planning output happens only after the phase's independent review has passed; user-only information gaps route to the user at any time

#### plan-implementation-phase.NTB2.R2 — human design approval is a config toggle defaulting to autonomous; enabling it inserts the approval after the review passes, before implement

#### plan-implementation-phase.NTB2.R3 — an enabled approval gate in a headless session records the pending approval and surfaces the plan in the session's reviewable output instead of blocking indefinitely

### plan-implementation-phase.NTB1 — a plan I can read is my only audit surface

**Persona:** Non-Technical Builder (NTB)

> When I can't audit code, I want the agent blocked from writing application code until a readable plan artifact exists in the ticket, so a wrong design surfaces as a plan I can judge instead of code I can't.

#### plan-implementation-phase.NTB1.R1 — application code stays untouched while a feature ticket is in the planning phase

#### plan-implementation-phase.NTB1.R2 — a planning-gate denial names the missing artifact and the concrete next action in plain language

### plan-implementation-phase.SM1 — one declarative home for planning-phase machinery

**Persona:** Safeword Maintainer (SM)

> When I wire planning-related enforcement or guidance (language-skill pointers per #530, entry reminders, gates), I want a first-class phase that every phase-keyed mechanism recognizes, so new machinery lands in one declarative place instead of scattered interim triggers.

#### plan-implementation-phase.SM1.R1 — every phase-keyed surface (enum, evidence messages, prompt reminders, gate phase-lists, splitting/resume/phase-file tables) carries a `plan-implementation` entry

#### plan-implementation-phase.SM1.R2 — the phase doc ships with full cross-harness parity (template ↔ Claude ↔ Codex trio, Cursor rule pair) like every other bdd phase doc

#### plan-implementation-phase.SM1.R3 — the decomposition-retirement ADR is superseded by a recorded ADR, not silently contradicted

#### plan-implementation-phase.SM1.R4 — the phase contract executes on the current versions of Claude Code, Codex, and Cursor including their cloud surfaces, with no interactive-only or bash-auto-expansion dependencies

## Rave Moment

Grounded in the 2026-07-08 /figure-it-out research: every major harness ships a plan *mode* (Cursor Plan Mode, Claude Code plan mode, Devin's plan file) — optional, freeform, forgettable. The rave is enforcement plus honesty, not planning per se.

### plan-implementation-phase — a readable plan before it's allowed to build (NTB)

- **Moment:** before any code exists, a plain-English plan sits in the ticket — riskiest assumption, build order, how each behavior gets proven — and the agent must later reconcile it: "here's where reality differed."
- **Beats:** the dread of "it confidently built the wrong thing for three hours and I couldn't tell until the demo" — today's tooling gives a non-coder no checkpoint between describing a feature and receiving finished code.
- **They'd say:** "I can't read code, but I don't have to — it has to show me a readable plan before it's allowed to build, and confess afterward where it changed course."

### plan-implementation-phase — plan mode with teeth (TB)

- **Moment:** the agent tries to jump into TDD and the harness refuses: no `implement` until the plan names the riskiest assumption and which scenario proves it. Screenshot-able denial.
- **Beats:** plan modes you must remember to toggle, and plans agents silently drift from (ungated plan artifacts measured as near-noise; the gate is the active ingredient — Spec-Kit ablation, arxiv 2604.05278).
- **They'd say:** "It's plan mode, except the agent physically can't skip it — and it has to reconcile the plan against what actually shipped."

## Outcomes

- A feature ticket leaving scenario-gate lands in `plan-implementation`, and its ticket frontmatter can only reach `implement` once a valid impl-plan.md (status `planned`) exists.
- An agent resuming a ticket at `plan-implementation` is routed to planning work by the resume table and the per-phase prompt reminder.
- The scenario-gate exit checklist contains no implementation-design steps; PLAN_IMPLEMENTATION.md owns them.
- Existing M6D315/MR5M3A gate semantics still hold end-to-end: plan exists by `implement`, status flips to `implemented` before `verify`/`done`, architectureReviewGate unchanged.
- ARCHITECTURE.md records the superseding ADR.

## Decisions (intake signoff, 2026-07-08)

All seven intake questions resolved — user accepted each proposal:

1. **Phase name:** `plan-implementation` (matches issue text and kebab-case enum convention).
2. **Code-edit block (NTB1.R1):** the implement-phase application-code gate extends to cover `plan-implementation` — no app-code writes while planning.
3. **Cumulative test-defs gate:** `plan-implementation` joins `phasesRequiringTestDefs`. (The list's pre-existing `verify` hole is a separate chip, not this ticket.)
4. **In-flight migration:** no tooling — the one-step provenance denial + changelog note carry it; ships as a 0.x minor.
5. **#530 seam:** this feature only establishes the phase-entry reminder surface; wiring the language-skill pointer stays in #530.
6. **Impl-plan stop-list:** `phasesRequiringImplPlan = ['implement','verify','done']` unchanged — the stop gate stays cumulative (artifacts owed by *prior* exits, matching the test-defs precedent); the pre-tool transition gate is the sole boundary enforcement; mid-phase work-in-progress stops stay legal. SM1.R1 reads as "an explicit membership decision per phase-keyed list", not "added to every list".
7. **SPLITTING.md:** the ">20 tasks OR 5+ major components" checkpoint moves to `plan-implementation` (task counts materialize with the build order); split children at plan-implementation-or-later restart at `plan-implementation` — each child authors its own plan scoped to its slice.

Added at the ADR-lifecycle /figure-it-out (2026-07-08, second signoff round):

8. **ADR template:** safeword ships `.safeword/templates/adr-template.md` (ownedFiles doc-template, like impl-plan-template) — Nygard-core fields (Context / Decision / Consequences + Status, Date, bidirectional supersede links), lean per MADR minimalism. Validation stays advisory; structure is never hard-gated (log4brains precedent: enforcement isn't prevailing practice; gating = ceremony).
9. **ADR destination:** reuse `paths.architecture` (no new config key) — a file receives appended entries, a directory receives one file per ADR with a merge-safe date-prefixed filename (`YYYYMMDD-slug.md`); sequential NNNN rejected because parallel sessions collide (same race ticket IDs were redesigned to avoid; MADR issue #28 + log4brains agree).
10. **Elevation:** the significance test decides what touches the architecture record; routine decisions live in the plan's Decisions table; generated architecture state docs (architecture.generated.md — machine-owned *what-is*) are never an ADR destination — the record (*why*) is the only target.
11. **Mid-flight drift:** the plan is a living record until implement-exit reconciliation — a decision proven wrong during implement updates the plan section then, notes the change in Decisions, and supersedes any affected ADR immediately; exit reconciliation is the backstop. Stage-scoped review stamps make mid-flight edits safe.
12. **Legacy ADR drift:** supersede, never edit, never delete — a new record marks the old one "superseded by", linked in both directions (unanimous: Nygard, Microsoft WAF, AWS, MADR).

Added at the third signoff round (2026-07-08 — reuse, AI leverage, review-before-handoff, approval toggle):

13. **Reuse over reinvention:** deep technical/data design routes through the lanes that already ship — design-doc-template/guide (Components, Data Model), data-architecture-guide (data-model elevation rules), architecture-guide (Survey & Reconcile, escalation table). impl-plan.md stays the lean record with pointers; no new section inventions. TB2's closed artifact set amended to include the existing design-doc lane when its own guide's triggers fire.
14. **/figure-it-out is the phase's design engine:** each load-bearing choice (slicing, data model, storage, interfaces, test layers) gets a /figure-it-out pass — leveraging AI research abilities to out-plan an unaided human is the point of the phase, not an optional extra.
15. **Architecture awareness without anchoring:** the phase directs reading the generated architecture state doc and the decision record for current-structure fluency (reuse better components, avoid duplicate work) — but only after the ideal design is sketched (SAFEWORD.md's load-bearing order), and changing the architecture is a planned-for outcome with a recorded decision, never sunk-cost conformance.
16. **Review-before-handoff:** any human-facing checkpoint in this phase fires only after the phase's independent quality review has passed — raw output is never handed to the user. User-only information gaps (/elicit) are the exception and route to the user at any time. (#478's principle applied to this phase; reordering other phases stays out of scope.)
17. **Human design approval is an opt-in toggle:** config key `designApprovalGate`, default off/absent = autonomous (the NTB default — no rooting around for toggles). Enabled (the TB opt-in): after the independent review passes, the plan is presented for user approval before `implement`. Conversational-gate mechanism like intake's sub-phase gates — prose contract, no hook code; documented in the config reference. Independent review prefers a different model when crossModelReview is available (secondary, per existing semantics).

Added at the fourth signoff round (2026-07-08 — model/harness currency, remote sessions):

18. **Harness and model currency, remote-first-class:** the phase contract executes on current Claude Code, OpenAI Codex, and Cursor *including their cloud surfaces* (Claude Code on the Web, Codex Cloud, Cursor Cloud Agents) — no interactive-only dependencies, no reliance on bash auto-expansion (Codex has none; skill bash runs only if the model chooses). Guidance is authored for frontier models (Fable 5, Opus 4.8, GPT-5.5), and crossModelReview pairing may span vendors. Doc/API currency against the latest harness documentation is verified at implement via /quality-review's version-currency angle.
19. **Headless approval semantics:** with `designApprovalGate` enabled in a session with no interactive user (cloud/headless runs), the gate follows the YOLO precedent (G2E72G): record the auto-decision as pending approval in the work log and surface the reviewed plan in the session's reviewable output (PR description / session summary) rather than blocking indefinitely — the human approves at PR-review time.

Added at the fifth signoff round (2026-07-08 — environment skills, docs currency, context economy):

20. **Language/environment skill surfacing is relevance-scoped:** the phase directs mapping installed language skills (`.claude/skills/<lang>-*` — Go via #482, TypeScript, Rust, and future packs like redis/Astro) to the plan's scenarios — but scoped to what the feature actually touches, never the repository's full inventory. A polyglot monorepo must not context-flood the phase; the pointer-not-list principle from the #480/#530 design holds (skill descriptions are already always-loaded in the picker). Mechanism boundary unchanged: #530 wires the entry-reminder trigger; this ticket pins what the phase doc directs.
21. **Current-docs planning:** for each component or library the plan selects, the phase directs reading the installed version's documentation before recording the decision — extending intake's library-docs rule to planning time, so designs aren't stale for Go/TypeScript/anything. /quality-review's version-currency angle at implement stays the verification backstop.

Added at the sixth signoff round (2026-07-08 — doc impact, customer surfaces):

22. **Doc impact is a sixth impl-plan section (template-driven, parser validates-if-present):** impl-plan-template.md gains a content-or-skip "Doc impact" section directing enumeration of which configured `docs.sources` surfaces the feature's customer-visible changes touch (updates become build-order tasks); `parseImplPlan` validates the section when present but never requires it, so in-flight five-section plans pass their gates untouched — no staged tightening (/figure-it-out verdict: the scaffold slot solves the decay failure; parser tightening stays in reserve if skip-laundering emerges). Audit-side consumption of this section is ticket 3BTGMW's scope, not this ticket's.
23. **Customer surfaces.md is a planning input:** the plan's proof planning covers each spec-affected surface (from the project's surfaces.md) — naming the proof that covers it or a per-surface skip — and the affected-surface list is the relevance selector for skill/doc surfacing (generalizing decision 20's "what the feature touches").

## Open Questions

None outstanding — all resolved at intake signoff (see Decisions above).
