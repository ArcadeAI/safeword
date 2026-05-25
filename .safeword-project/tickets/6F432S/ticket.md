---
id: 6F432S
slug: sunset-skill
title: "/sunset skill — discipline the deprecation when a feature signals fall below threshold (or above hypothesis)"
type: feature
phase: intake
status: in_progress
epic: product-systems-loop-closing
created: 2026-05-25T01:25:31.788Z
last_modified: 2026-05-25T01:26:00.000Z
---

# /sunset skill

**Goal:** Add a `/sunset` skill that disciplines the deprecation of a feature when its outcome signals fall persistently below threshold — or when a kill-criteria experiment (per /experiment) returns negative. Produces a sunset plan, executes the deprecation in safeword tickets, and tracks the lifecycle.

**Why:** Most teams accumulate features that don't meet their outcomes but stay shipped because removing them is "work." Cagan POM principle: outcomes drive decisions, including the decision to undo. Without explicit sunset discipline, the product accretes complexity, support cost, and cognitive load. A discipline arc makes sunset a normal mid-cycle action, not a failure narrative.

**Parent epic:** GNSJ6P
**Depends on:** — (can ship independently)

## Scope

### Invocation

- Triggered (suggested) when a feature's signals are below threshold for N consecutive measurement windows (configurable; default 3).
- Triggered when an /experiment (per PP7116) returns negative against its kill criteria.
- Also manually invocable when a practitioner notices a feature that isn't earning its keep.

### Workflow

1. **Confirm sunset criteria met** — load signals.md and confirm thresholds breached, or load experiment.md and confirm kill criteria triggered.
2. **Map the blast radius** — what depends on this feature? Other features, API contracts, customer integrations, documentation, support runbooks. Read from impl plan's "Arch alignment" and "Known deviations" sections.
3. **Draft sunset plan** — three phases:
   - **Phase A: Soft sunset** — feature flag off for new users; in-app message to existing users.
   - **Phase B: Migration** — provide path for existing users to alternatives.
   - **Phase C: Hard remove** — code deletion, infrastructure teardown, documentation removal.
4. **Stakeholder check** — explicit prompt: "Have you confirmed with [list of detected stakeholders] that sunset is the right call?" Wait for confirmation before proceeding.
5. **Execute** — generate the sunset-execution tickets (one per phase) with the right dependencies; link to the original feature ticket; update feature ticket status to `sunsetting`.
6. **Document** — write `<id>-sunset.md` with rationale (signals data, decision context), plan, blast radius, stakeholder confirmation, ticket links.

### Artifact

`<id>-sunset.md` or `## Sunset` section. Fields:

- **Rationale** — signals or experiment data triggering sunset.
- **Blast radius** — dependencies discovered, impact assessment.
- **Plan** — 3-phase execution (soft sunset → migration → hard remove) with target dates.
- **Stakeholders confirmed** — who, when.
- **Execution tickets** — links.

### Lifecycle states

The original feature ticket gains a `sunsetting` state alongside its existing `done`. When Phase C completes, the feature ticket goes to `sunset` (terminal, distinct from `done` and `cancelled`).

## Out of scope

- Automated feature-flag manipulation — the skill surfaces what to do; humans toggle.
- Automated code deletion — generates the ticket; engineers execute.
- Customer notification systems — surfaces the message intent; existing comms tools deliver.
- "Soft" sunset (just hide from UI but keep code) as a permanent state — sunset means removal; "hide" is a different workflow.

## Done when

- `/sunset` skill exists with the 6-step workflow documented.
- Skill produces `<id>-sunset.md` with the 5 fields.
- Original feature ticket lifecycle supports `sunsetting` → `sunset` states (extends safeword's status enum; coordinate with MBGQ89 schema work).
- Worked example shows: feature signals below threshold for 3 windows → /sunset invoked → plan generated → 3 execution tickets opened → eventually feature ticket reaches `sunset` state.

## Open questions

- **Sunset state vs sunset status** — extend ticket `status:` enum with `sunsetting` and `sunset`, OR use the existing `cancelled` / `wontfix` with a sub-marker? Driver leans new states (sunset is semantically distinct: shipped, then explicitly removed for outcome reasons).
- **Reversibility** — what if signals improve mid-sunset (e.g., during Phase A soft-sunset, the metric recovers)? Driver leans "pause the sunset, re-evaluate via /reprioritize" — don't auto-abort.
- **Blast radius detection** — how aggressively does the skill scan for dependencies? Read impl plan / arch alignment is straightforward; scanning the codebase for actual references is heavier. Driver leans impl-plan + grep-for-feature-flag as the v1 detection.

## Work Log

- 2026-05-25T01:25:31.788Z Started: Created ticket 6F432S
- 2026-05-25T01:26:00.000Z Drafted: Scope (3-phase sunset, artifact, lifecycle states); linked to epic GNSJ6P
