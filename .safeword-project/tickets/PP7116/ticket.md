---
id: PP7116
slug: experiment-skill
title: '/experiment skill — frame work as a hypothesis with kill criteria, not a feature commit'
type: feature
phase: intake
status: in_progress
epic: product-systems-loop-closing
created: 2026-05-25T01:25:31.840Z
last_modified: 2026-05-25T01:26:00.000Z
---

# /experiment skill

**Goal:** Add an `/experiment` skill that frames a candidate feature as a hypothesis with explicit kill criteria — measurable thresholds below which the experiment is judged failed and the feature is sunset. Produces an experiment-spec artifact, gates the feature work behind the experiment framing, and feeds results into /sunset (negative) or /reprioritize (positive but unexpected).

**Why:** Teresa Torres' continuous discovery: every initiative should be framed as an experiment with measurable outcomes; default-shipped features are commits that accumulate without test. Today, safeword's bdd flow assumes "we're building this; ship and measure." `/experiment` adds an explicit branch: "we're testing this; ship to measure; if it fails, we sunset." The discipline matters because most "experiments" run today are commits without kill criteria — they ship, partially work, and never get killed.

**Parent epic:** GNSJ6P
**Depends on:** — (can ship independently of other loop-closing skills)

## Scope

### When to invoke

- Anytime a feature is at the intake phase and the user is uncertain whether the feature should permanently exist.
- Encouraged when the value hypothesis is novel (no prior evidence in the team's product) — the riskier the bet, the more it should be framed as experiment.
- Discouraged for clear "table-stakes" features (bug fixes, compliance, must-haves) — those aren't experiments; they're commitments.

### Workflow

1. **Frame the hypothesis** — "We believe [persona] will [behavior] because [reason]." Reuses the JTBD-style format from Phase 0.
2. **Define success criteria** — measurable; reuses the Outcomes section from spec (per 7VRXF6). The success threshold is "ship this permanently" criteria.
3. **Define kill criteria** — measurable; explicit threshold below which the experiment is judged failed. This is the experiment-specific addition.
4. **Define duration** — explicit measurement window before judgment. Default: align with one full measurement cycle of the slowest outcome metric.
5. **Define rollback plan** — how the feature is removed if killed. Triggers /sunset on negative result.
6. **Document** — write `<id>-experiment.md` with hypothesis, success criteria, kill criteria, duration, rollback plan.
7. **Tag the feature ticket** — `type: feature` gains a sub-marker (frontmatter field) `experiment: <id>-experiment.md` so the lifecycle is visibly experimental.
8. **At duration end** — fire a hook (or surface a reminder) prompting evaluation: hit success? hit kill? in between? Route to /reprioritize for "in between" cases.

### Artifact

`<id>-experiment.md` or `## Experiment` section. Fields:

- **Hypothesis** — "We believe X because Y."
- **Success criteria** — measurable threshold for "ship permanently."
- **Kill criteria** — measurable threshold for "sunset."
- **Duration** — measurement window.
- **Rollback plan** — how the feature is removed.
- **Status** — `running` → `succeeded` → `killed` (terminal) or `inconclusive` (route to /reprioritize).

### Integration

- Reads signals (from 1W107W) for kill/success measurement.
- Triggers /sunset (6F432S) on kill.
- Triggers /reprioritize (AQ14K2) on inconclusive results.
- Reads initiative context (from 92TBNN) if the experiment is part of a larger bet.

## Out of scope

- Statistical significance calculation — surface raw metric, let humans decide significance.
- A/B testing infrastructure — out of scope; safeword frames the experiment, project tooling runs it.
- Bayesian / sequential testing methodology — too heavy for v1; defer.
- Multi-variant experiments — single hypothesis per /experiment invocation; multi-variant is a future enhancement.

## Done when

- `/experiment` skill exists with the 8-step workflow documented.
- Skill produces `<id>-experiment.md` with the 6 fields.
- Feature ticket frontmatter supports `experiment:` field (coordinate with MBGQ89).
- Duration-end hook (or reminder) fires when an experiment's measurement window closes.
- Worked example: experiment framed → feature shipped → metrics collected at duration end → kill-criteria hit → /sunset invoked → feature removed; result documented as evidence for next experiment.

## Open questions

- **Duration enforcement** — soft (reminder at end) or hard (block reprioritization of related features during the window)? Driver leans soft (reminder); hard-blocking would interfere with normal product work.
- **Kill criteria vs negative outcome** — what's the distinction? Driver: kill criteria is the pre-committed threshold; negative outcome is anything below success. Some features get sunset because they were below kill criteria; others get reprioritized because they were below success but above kill. Worth surfacing in the principles cluster (4RD1NS).
- **Inconclusive routing** — when results are between kill and success criteria, the routing is /reprioritize. Default behavior at /reprioritize for inconclusive experiment: option (a) "extend the duration" — should this be a first-class default option?

## Work Log

- 2026-05-25T01:25:31.840Z Started: Created ticket PP7116
- 2026-05-25T01:26:00.000Z Drafted: Scope (when to invoke, 8-step workflow, artifact, integration); linked to epic GNSJ6P
