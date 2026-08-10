---
id: FY1NHB
slug: measure-bdd-skill-agent-quality
type: task
phase: intake
status: in_progress
parent: AK0QJR
depends_on: [BX1T7H, 7B1AMC, SH5GSP]
relates_to: [7ZLTWB, XZFSZ5, 21RAT9, QZAFT2]
external_issue: https://github.com/ArcadeAI/safeword/issues/2339
created: 2026-08-10T07:58:17.961Z
last_modified: 2026-08-10T08:00:27Z
---

# Measure BDD skill quality across coding agents

**Goal:** Quantify whether Safe Word reduces false-green BDDs across held-out tasks, hosts, model families, and releases.

**Why:** Skill prose is soft and model behavior changes; maintainers need artifact-based evidence that a candidate skill improves outcomes over no skill and the released version.

## Scope

- Maintain held-out BDD authoring tasks spanning agent skills, coding agents, host lifecycle, migration, concurrency, and release behavior.
- Reuse the eval discipline and copyable reference implementation from 7ZLTWB/XZFSZ5/21RAT9; extract shared seeded-gate code only if this work satisfies the recorded rule-of-three trigger.
- Compare no-skill, currently released skill, and candidate skill conditions.
- Score produced artifacts for scenario completeness, proof-plan quality, correct executable RED, actor-boundary fidelity, evidence honesty, false-green rate, ceremony, runtime, and token cost.
- Run a small deterministic smoke set on relevant changes and a broader repeated matrix nightly or before release.
- Cover Claude Code and Codex with representative Sonnet/Opus 5 and Luna/Sol 5.6 classes, pinning exact model identifiers and settings in each result.

## Out of Scope

- Treating prose self-reports as evidence.
- Requiring every model/host combination on every pull request.
- Optimizing to one benchmark task or accepting a candidate solely because it is more verbose.

## Done When

- A versioned held-out suite and artifact rubric exist.
- The harness records exact skill revision, host, model, settings, run count, runtime, tokens, and scored artifacts.
- Smoke and broad-matrix schedules are documented and reproducible.
- Each broad comparison uses at least three runs per condition and reports variance.
- A release decision can state whether the candidate improves false-green rate without unacceptable ceremony or cost regressions.

## Work Log

- 2026-08-10T07:58:17.961Z Started: Created ticket FY1NHB
- 2026-08-10T08:00:27Z Planned: Defined held-out, artifact-scored comparisons across skills, agents, models, and releases.
