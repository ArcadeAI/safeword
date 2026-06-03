---
id: FSX1PP
slug: collapse-decomposition-phase
type: task
phase: done
status: done
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T04:58:17.754Z
last_modified: 2026-06-02T14:49:00.000Z
---

# Retire decomposition as a distinct bdd phase (ADR + behavior collapse)

**Goal:** Retire `decomposition` as a distinct bdd phase — fold its one genuinely-distinct job (test-layer assignment) into scenario-gate's exit and its overlapping jobs (component-ID, ADR triggers) into intake — recorded by an ADR, implemented as a reversible behavior-collapse first, with the enum/file/Cursor-rule removal staged behind it.

**Why:** P2. The chain audit found `decomposition` is ~75% redundant with intake (component identification and design-doc/ADR triggers duplicate intake's architecture work at [DISCOVERY.md:102](packages/cli/templates/skills/bdd/DISCOVERY.md); only per-scenario test-layer assignment is genuinely distinct, and it requires scenarios that don't exist at intake). It's also the **only phase with no gate and no artifact** — the lone hard-gate mention ([stop-quality.ts:188](packages/cli/templates/hooks/stop-quality.ts)) enforces the _prior_ phase's test-definitions.md. And it's **foreign to the canonical three-practice BDD model** (Discovery → Formulation → Automation has no breakdown phase). Epic 172's own principle — "no artifact → not a phase boundary" — and the [DKETNZ](.safeword-project/tickets/DKETNZ-phase-name-only) precedent (enum changes are ADR-worthy) both apply.

**Decision (from `/figure-it-out`):** Option C — collapse the behavior now (reversible doc/flow edits), stage the enum surgery. Chosen over deleting the enum outright (cross-cutting + a live ticket sits in the phase) and over keeping it (preserves dead weight).

**Scope:**

- Write the keystone **ADR** — _"safeword bdd as a solo-agent adaptation of the three-practice BDD model"_ — recording the deliberate divergences (agent simulates the Three Amigos via the scenario-gate adversarial pass + `/elicit` + `/figure-it-out`; safeword fuses BDD discovery with formal test-design via dimensions/AODI) and the decision to retire `decomposition`. Place per [architecture-guide.md](.safeword/guides/architecture-guide.md).
- Move test-layer assignment + task sequencing into the scenario-gate exit ([SCENARIOS.md](packages/cli/templates/skills/bdd/SCENARIOS.md)); confirm component-ID + ADR triggers are covered by intake ([DISCOVERY.md:102](packages/cli/templates/skills/bdd/DISCOVERY.md)).
- Flip scenario-gate exit to advance straight to `implement`; mark `decomposition` deprecated in [SKILL.md](packages/cli/templates/skills/bdd/SKILL.md) + [quality.ts:63](packages/cli/templates/hooks/lib/quality.ts) while keeping the enum value for back-compat.

**Out of scope (staged to a follow-up once nothing references the phase):** removing the enum value, deleting `DECOMPOSITION.md` + the paired Cursor rule `bdd-decomposition.mdc` (touches `schema.ts` managed-files + the `skill-cursor-pairs` parity fixture + the schema-drift test), and migrating ticket `153-boundary-resilience` (currently at `phase: decomposition`).

**Done when:** the ADR is committed; the bdd skill no longer routes through a separate decomposition beat (scenario-gate → implement); decomposition's distinct work has an explicit home; the enum value remains valid so existing tickets don't break.

**Blast radius (evidence):** phase enum [quality.ts:26](packages/cli/templates/hooks/lib/quality.ts), [stop-quality.ts:188](packages/cli/templates/hooks/stop-quality.ts), [prompt-questions.ts:68](packages/cli/templates/hooks/prompt-questions.ts), `bdd/SKILL.md` phase tables, `bdd/SCENARIOS.md` exit, `bdd/SPLITTING.md`, Cursor rule `bdd-decomposition.mdc`, `schema.ts`, ticket template, tests (`quality.test.ts`, `fixtures/skill-cursor-pairs.ts`), 1 live ticket (153).

## Work Log

- 2026-06-02T04:58:17.754Z Started: Created ticket FSX1PP
- 2026-06-02T14:25Z Reclassified feature→task: in-scope work is an ADR + reversible skill-doc edits (no executable behavior; enum/file removal deferred to a follow-up). Running as documentation/restructuring, phase→implement. Step 1: draft the ADR in ARCHITECTURE.md Key Decisions for review.
- 2026-06-02T14:32Z ADR committed (7fa641fc) after user review.
- 2026-06-02T14:39Z Reversible collapse done: scenario-gate exit now assigns test layers + build order and advances to `implement` (SCENARIOS.md); `decomposition` marked deprecated in SKILL.md phase tables, quality.ts + prompt-questions.ts messages, DISCOVERY.md planning note, and a deprecation header on DECOMPOSITION.md. Enum value + DECOMPOSITION.md + Cursor rule kept for back-compat (removal staged to a follow-up). Synced 6 dogfood copies (identical); 245/245 quality+hook tests pass; parity clean (116 pairs + 3 contracts). Done-when met for the reversible step.
- 2026-06-02T14:49Z Complete: /verify green (full suite 2364/2364, lint+build clean; /audit passed earlier this session covering the code). verify.md written. Closed by user — status/phase → done. Staged enum/file removal deferred to a follow-up ticket.
