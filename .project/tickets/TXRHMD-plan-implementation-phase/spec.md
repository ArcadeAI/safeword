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

Unaffected:

- Claude Code on the Web — inherits repo-installed files; no cloud-specific behavior changes
- OpenAI Codex Cloud — same: reads the repo checkout's `.agents/skills`; no container-specific behavior

## Vocabulary

Consistent with the project glossary: Phase, Gate, Reconciliation, Phase Anchor. The glossary's `Phase` entry hard-codes the six-phase enum and is updated by this feature. No new project-wide terms; "transition gate" stays spec-local for the pre-tool denial of `phase: implement` without a valid plan.

## Jobs To Be Done

### plan-implementation-phase.TB1 — catch wrong-direction designs at a checkpoint, not in the diff

**Persona:** Technical Builder (TB)

> When my agent finishes validating scenarios, I want it to commit to a reviewed implementation plan as its own visible phase before any TDD RED, so I can catch a wrong-direction design at a cheap checkpoint instead of inside a large diff.

#### plan-implementation-phase.TB1.R1 — a new-flow feature cannot enter `implement` until a valid implementation plan exists

#### plan-implementation-phase.TB1.R2 — a ticket interrupted mid-planning resumes into planning work, not scenario re-validation

#### plan-implementation-phase.TB1.R3 — the scenario-gate exit judges only scenario quality; implementation-design judgment happens in the planning phase

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

## Rave Moment

skip: table-stakes — plan-before-code is now baseline across major harnesses (Cursor Plan Mode, Claude Code plan mode; verified in the 2026-07-08 /figure-it-out research). Safeword's differentiator here is *enforcement*, which users experience as absence-of-failure, not a shareable moment.

## Outcomes

- A feature ticket leaving scenario-gate lands in `plan-implementation`, and its ticket frontmatter can only reach `implement` once a valid impl-plan.md (status `planned`) exists.
- An agent resuming a ticket at `plan-implementation` is routed to planning work by the resume table and the per-phase prompt reminder.
- The scenario-gate exit checklist contains no implementation-design steps; PLAN_IMPLEMENTATION.md owns them.
- Existing M6D315/MR5M3A gate semantics still hold end-to-end: plan exists by `implement`, status flips to `implemented` before `verify`/`done`, architectureReviewGate unchanged.
- ARCHITECTURE.md records the superseding ADR.

## Open Questions

1. **Phase name:** `plan-implementation` per the issue (alternatives: `plan`, `implementation-plan`). Proposal: keep `plan-implementation`.
2. **Code-edit block (NTB1.R1):** extend the implement-phase application-code gate to also cover `plan-implementation`, or rely on the transition gate alone? Proposal: extend — "no RED until the plan exists" is the issue's stated outcome.
3. **Cumulative test-defs gate membership:** add `plan-implementation` to the stop-gate list `['scenario-gate','implement','done']`? Proposal: yes. (That list's pre-existing `verify` hole is a separate chip, not this ticket.)
4. **In-flight migration:** tickets sitting at `scenario-gate` on upgrade get a one-step denial if they jump to `implement`; they pass through the new phase doing work they already owed. Proposal: denial message + changelog note, ship as a 0.x minor — no migration tooling.
5. **#530 seam:** Proposal: this feature only establishes the phase-entry reminder surface; wiring the language-skill pointer stays in #530.
6. **Stop-gate membership for the impl-plan artifact list** (cold-start check gap): should stopping while AT `plan-implementation` with no impl-plan.md yet hard-block, or is the transition gate the sole boundary enforcement? Proposal: leave `phasesRequiringImplPlan = ['implement','verify','done']` unchanged — the stop gate stays cumulative (artifacts owed by *prior* exits), matching the test-defs precedent (required at scenario-gate because define-behavior's exit produced it); mid-phase work-in-progress stops stay legal, and SM1.R1's "every phase-keyed surface" reads as "an explicit membership decision per list", not "added to every list".
7. **SPLITTING.md remappings** (cold-start check gap): (a) the ">20 tasks OR 5+ major components" split checkpoint — task counts only materialize when the build order is drafted, so Proposal: move that checkpoint row from scenario-gate to plan-implementation. (b) split children currently restart at `implement` for splits at "scenario-gate+" — Proposal: children of splits at plan-implementation-or-later restart at `plan-implementation`, because each child needs its own impl-plan scoped to its slice (inheriting the parent's unsplit plan would be stale and would trip the transition gate anyway).
