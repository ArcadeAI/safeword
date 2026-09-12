# Execution Plan: [Feature name]

**Status:** planned
**Prepared on:** YYYY-MM-DD

## Pull-request slicing

**Decision:** [one pull request | multiple pull requests]

**Rationale:** [Why these conceptual boundaries maximize independent review and
proof. Do not use line or file count alone.]

## PR 1 — [One coherent purpose]

- **Purpose:** [One independently valuable outcome]
- **Boundary:** [Included and excluded work]
- **Prerequisites:** [Earlier slice names, or none]
- **Proof:** [Behavioral tests and evidence]
- **Completion signal:** [Observable safe post-merge state]
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: [Failing behavioral test and command]
2. GREEN: [Minimum implementation]
3. REFACTOR: [Cleanup boundary or explicit skip]
4. Run: `[targeted command]`
5. Run: `[full verification command]`

## Obligation ownership

| Accepted obligation                                                          | Owning PRs |
| ---------------------------------------------------------------------------- | ---------- |
| [Behavior, migration, rollout, rollback, documentation, or affected surface] | PR 1       |

## Deferred scope ownership

- [Other ticket and the exact obligation it owns, or `skip: none`]

## Decision accounting

- [Recorded Decision]: unchanged

## Delivery checklist

- Tests: [proof and commands]
- Monitoring: [work or `skip: <reason>`]
- Migration: [work or `skip: <reason>`]
- Documentation: [work or `skip: <reason>`]
- Rollout: [work or `skip: <reason>`]
- Rollback: [work or `skip: <reason>`]
- Ownership: [maintainer or team]
