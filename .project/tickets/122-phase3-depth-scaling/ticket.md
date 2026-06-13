---
id: '122'
type: task
phase: intake
status: backlog
created: 2026-04-14T17:26:00Z
last_modified: 2026-04-14T17:26:00Z
scope:
  - Add depth-scaling to Phase 3 pipeline so small features collapse to single turn
  - Threshold heuristic (dimensions <= 2 AND partitions <= 6 → collapse)
  - Surprise heuristic for rationale visibility (show derivation only when non-obvious)
out_of_scope:
  - Changing the pipeline steps themselves (established in #121)
  - Changes outside Phase 3-4
done_when:
  - SCENARIOS.md includes depth-scaling rules with threshold heuristic
  - Small features (<=2 dimensions, <=6 scenarios) collapse to single-turn presentation
  - Large features show dimension table first, then scenarios
  - Rationale comments use surprise heuristic (shown per-rule only when non-obvious)
depends_on:
  - '121'
---

# Depth-Scale Phase 3 Visibility

**Goal:** Optimize the Phase 3 scenario pipeline (from #121) so small features don't feel heavy — collapse the visible decomposition to a single turn when the behavioral space is simple.

**Why:** The full pipeline is valuable for complex features but adds noise for simple ones. Users spend attention budget reading dimension analysis for a 4-scenario feature, leaving less patience for when the analysis actually matters.

## Design

Two scaling mechanisms:

### 1. Turn-count scaling

```
if dimensions <= 2 AND partitions <= 6:
    single turn — show organized scenarios under rule headers, skip dimension table
else:
    multi-turn — show dimension table first, converge, then draft scenarios
```

### 2. Rationale visibility (surprise heuristic)

Per-rule decision: "Would a developer familiar with this codebase independently identify these partitions?"

- Yes → show scenarios under rule header, no rationale comment
- No → add HTML comment explaining why this rule/partition exists

## Work Log

- 2026-04-14T17:26:00Z Created: Follow-up to #121. Optimization ticket — ship full pipeline first, then add depth-scaling.
