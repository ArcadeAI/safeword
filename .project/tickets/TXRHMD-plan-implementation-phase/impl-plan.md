# Impl Plan: plan-implementation phase before TDD

**Status:** implemented

## Approach

**Riskiest assumption:** inserting `plan-implementation` mid-array into `CANONICAL_PHASES` propagates correctly through the index-based one-step-advance rule, `phase_skips` justification, and phase-anchor machinery without breaking in-flight tickets or the pinned order-string tests — proven cheapest by the SM1.R1 transition scenarios (one-step in, skip denial naming the phase, justified skip accepted). Build slice 1 proves or kills this while it's cheap.

**Proof plan by cluster** (54 scenarios; highest practical scope per testing/SKILL.md):

- Gate machinery (TB1.R1 ×6, SM1.R1 transitions ×5, NTB1.R1 ×2, NTB1.R2): **integration** — direct hook-lib invocation in vitest, the established pattern of `tests/hooks/phase-provenance.test.ts` and `tests/integration/impl-plan-gate.test.ts`. Denial-content assertions pin the new gate apart from today's skip-denials. The canonical-order scenario is proven by the pinned order-string test updated in slice 1.
- Stop-gate memberships (SM1.R1 stop ×2): **integration** via stop-quality paths (pattern: `tests/integration/hooks.test.ts` scenarios 11–12).
- Boundary ledger (SM1.R1 boundary): **unit** on `src/boundary/engine.ts` (`ledgerRequiredPhase`).
- Plan validation incl. Doc impact (TB1.R5 ×3): **unit** on `templates/hooks/lib/impl-plan.ts` (validate-if-present, legacy five-section pass, empty-section fail).
- Doc-contract scenarios (TB1.R3/R6, TB2 all, TB3 all, NTB2 doc semantics, TB1.R4 ADR lifecycle, SM1.R4 interactive-only check, TB1.R2 resume-table routing): **unit content assertions** on the shipped docs (pattern: `tests/hooks/impl-plan.test.ts:164`, `adr-consultation-documentation.test.ts`).
- Prompt reminder (TB1.R2 reminder scenario): **unit** on `prompt-questions.ts` map.
- Parity/schema (SM1.R2): existing `schema.test.ts` + `runParity` machinery; new entries only.
- Config reference + website flow line (NTB2.R2 config scenario): content assertion on `configuration.mdx`.
- ADR record (SM1.R3): content assertion on `ARCHITECTURE.md`.
- **Wiring test:** one test drives the new transition-gate path from the real `pre-tool-quality.ts` entry with real hook-lib collaborators, mocking only fs (the process boundary).
- Cucumber lane: step definitions for the new feature file shell out to hooks per the root-lane convention; local Stop-hook dogfooding, not CI.

**Build order** (each slice commits green before the next):

1. **Enum insertion** — `CANONICAL_PHASES`, `BddPhase` union, `PHASE_EVIDENCE` (compile-forced), `prompt-questions.ts`: add the new phase reminder AND reword the scenario-gate line at :80 (drops "record the proof plan + build order"), `review-trigger` default check; update pinned order-string tests + `phase_skips` fixtures. *Load-bearing slice.*
2. **Transition gate** — pre-tool deny of `phase: implement` for new-flow features without a parse-valid `planned` plan; denial names the missing artifact/section/status + scaffold template; task/legacy exemptions mirror M6D315 grandfathering. Wiring test here.
3. **List memberships + code freeze** — `phasesRequiringTestDefs` + `LEDGER_REQUIRED_PHASES` gain the phase; implement-phase app-code gate extends to plan-implementation; stop-message updates ("authored at scenario-gate exit" → planning phase).
4. **Doc impact section** — template sixth section + `parseImplPlan` validate-if-present + legacy/empty tests; adjust the "all five sections" error phrasing to "all five required sections".
5. **Phase doc + content moves** — author `templates/skills/bdd/PLAN_IMPLEMENTATION.md` (impl-plan authoring steps, ADR lifecycle incl. template/destination/supersede/mid-flight, editorial contract + deletion-test review, reuse routing to design-doc/data-architecture lanes, architecture awareness after ideal, relevance-scoped skill surfacing, current-docs rule, review-before-handoff + designApprovalGate incl. headless semantics — noting Cursor Cloud Agents run preToolUse but NOT stop/sessionStart hooks, so headless guidance must not assume stop-hook nudges there); slim SCENARIOS.md exit; reword DISCOVERY.md:227 (planning-note pointer to the new phase), TDD.md/SKILL.md tables/SPLITTING.md/VERIFY.md/impl-plan-template header/review-spec handoff/quality-review table/tdd-review loop-back/ticket-template/ticket-system/glossary/PRINCIPLES.md.
6. **ADR template + registrations** — `doc-templates/adr-template.md` (Nygard-core, date-prefixed dir-mode filenames); schema ownedFiles entries (phase doc + adr-template) + reword the schema.ts:1018 registration comment ("authored at scenario-gate exit"), CODEX row, CURSOR_RULE_WRAPPERS entry + generator run; parity sync (template → dogfood trio + `.mdc` pair + `.safeword/hooks`).
7. **Record + docs** — superseding ADR in ARCHITECTURE.md; `hooks-and-skills.mdx` flow line; `configuration.mdx` designApprovalGate entry; changelog note (0.x minor, in-flight migration note).
8. **Full verification** — full suite, `parity-check --mode=all`, `safeword check`.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Phase mechanism | New canonical enum value + pre-tool transition gate | D-only (harden exit, no phase); reject issue | Resume/reminder/review-stamp state stays wrong; ADR objections all answered (/figure-it-out 2026-07-08 #1) |
| Architecture guide consumption | Stays at intake; phase does alignment only | Issue-text relocation into phase | Recreates the intake duplication the decomposition ADR killed |
| Plan-review stamp scoping | Stage-scoped Tier-2 stamp at phase exit; architectureReviewGate unchanged (content-hash at verify/done) | Content-hash stamp pre-TDD | Mandatory reconciliation edit would invalidate it (Gerrit/RFC evidence) |
| Doc impact enforcement | Template-driven sixth section, parser validates-if-present, no staged tightening | Required sixth section + staged parser; Approach line-items | Staged release choreography for marginal gain; prose line-items decay (/figure-it-out #3) |
| ADR template + filenames | Nygard-core `adr-template.md`; dir-mode files date-prefixed `YYYYMMDD-slug.md` | MADR-full; sequential NNNN | NNNN collides across parallel sessions (same race ticket IDs solved); MADR-full over-templates (/figure-it-out ADR-lifecycle pass) |
| designApprovalGate | Conversational gate, prose contract, default off; headless → YOLO-precedent pending-approval record | Hook-enforced approval gate | Approval is a human judgment, not machine-checkable; hook code for a default-off conversational beat is bloat |
| Split checkpoint (this gate) | No child-ticket split; sequential slices in one ticket, split available mid-implement | Split into 5 children (machinery/doc/ADR/approval/parity) | Slices share files heavily (SCENARIOS.md, schema.ts, PLAN_IMPLEMENTATION.md, tests) — parallel children would conflict in worktrees; 5× ticket ceremony is the bloat TB2 bans; ledger + build order already anchor resume |

/figure-it-out evidence recorded in spec.md Decisions 1–23 (four passes: phase shape, editorial proportionality, ADR lifecycle, doc-impact placement).

## Arch alignment

Honors (ARCHITECTURE.md via `paths.architecture`):

- **Schema-as-manifest** — all new files register in SAFEWORD_SCHEMA; no parallel manifests.
- **Phase anchors / provenance (#809 lineage)** — new phase joins the anchor + one-step machinery unchanged.
- **PRINCIPLES.md "fire at boundaries"** — the one new gate sits on a phase boundary.
- **Generated-vs-narrative architecture docs** — ADR emission targets the record only; generated state docs untouched.
- **BDD as Solo-Agent Adaptation (retire decomposition)** — **superseded by this feature's ADR** (build slice 7): the new phase is the Automation practice's on-ramp carrying the gated impl-plan artifact, answering all three retirement objections (canon-shape, artifact-less skippability, intake duplication — the last by keeping design at intake).

## Known deviations

- The single deliberate reversal (standalone planning beat) is recorded via the superseding ADR (shipped, ARCHITECTURE.md 2026-07-09) rather than deviation-noted — the mechanism this feature itself prescribes.
- ~~Cucumber step definitions not delivered~~ RESOLVED 2026-07-09: CI's acceptance lane runs the root features (the 'local-only' premise was stale) and fails on undefined steps, so `steps/plan-implementation-phase.steps.ts` shipped in-ticket — 54/54 scenarios pass the lane.
- Reconciliation (2026-07-09): Decisions table held end-to-end — no choice changed during implementation; the slice-2 gate shape gained a shared `phaseTransitionContext` helper (readiness + plan gates), a smaller dedupe than planned-for, found by the cross-scenario review.

## Doc impact

- `packages/website/src/content/docs/reference/hooks-and-skills.mdx` — BDD flow enumeration gains the phase (build slice 7).
- `packages/website/src/content/docs/reference/configuration.mdx` — `designApprovalGate` entry (slice 7).
- README/website broader staleness (workflow diagram, impl-plan absence): **out of scope**, tracked via 91YDB6's neighborhood and the gap-critic backlog.
- CHANGELOG — 0.x minor entry with the in-flight-ticket migration note.

## Assessment triggers

- Skip-laundering on Doc impact or plan sections in dogfood/customer tickets → tighten `parseImplPlan` presence (the reserved staged path).
- #530 lands the language-skill pointer → confirm the phase-entry reminder is the wiring point it expects.
- A third phase-insertion proposal → generalize the enum/gate-list machinery instead of hand-editing lists again.
- designApprovalGate uptake signals (support questions, PR-review friction) → revisit conversational vs. hook-backed.
- Editorial deletion-test decays into tone-nagging → re-anchor rubric to decision coverage.
- The adjacency grep pin (plan-implementation-document.test.ts) fails on any reintroduced six-phase list — if it fires on legitimate text, scope the pattern, don't delete the pin.
