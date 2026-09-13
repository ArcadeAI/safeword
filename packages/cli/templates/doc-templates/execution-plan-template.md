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

## Proof specifications

Use one row per executable command or admitted review receipt. `Invocation` is
tagged JSON. Commands use a project-contained `cwd` and nonempty `argv`; review
receipts use a review `kind` and project-contained `targets`.

| Proof ID   | Method  | Scope       | Boundary exercised               | Qualifies as  | Currency         | Invocation                                         |
| ---------- | ------- | ----------- | -------------------------------- | ------------- | ---------------- | -------------------------------------------------- |
| [proof-id] | command | integration | [Real system boundary exercised] | real_boundary | current_required | {"type":"command","cwd":".","argv":["replace-me"]} |

## Delivery checklist

Replace every bracketed value. Keep all eleven categories. Contributor items
reference a real-boundary Proof ID. Human items leave `Required proof` empty and
use `pending_human` with a named dependency or reviewed `not_applicable` with a
reason.

<!-- safeword:delivery-checklist:v1 -->

| ID                     | Category                                  | Obligation                          | Owner       | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| ---------------------- | ----------------------------------------- | ----------------------------------- | ----------- | -------------- | ----------- | -------------- | -------- | ------------------------------- |
| outcome-scope          | outcome and scope                         | [Outcome and scope obligation]      | contributor | [proof-id]     | open        | missing        |          |                                 |
| resolved-decisions     | resolved decisions                        | [Resolved decisions obligation]     | contributor | [proof-id]     | open        | missing        |          |                                 |
| pr-decomposition       | dependency and pull-request decomposition | [Dependency and slicing obligation] | contributor | [proof-id]     | open        | missing        |          |                                 |
| testing                | testing                                   | [Testing obligation]                | contributor | [proof-id]     | open        | missing        |          |                                 |
| data-compatibility     | data and compatibility                    | [Data and compatibility obligation] | contributor | [proof-id]     | open        | missing        |          |                                 |
| monitoring             | monitoring and failure signals            | [Monitoring obligation]             | contributor | [proof-id]     | open        | missing        |          |                                 |
| security-privacy       | security and privacy                      | [Security and privacy obligation]   | contributor | [proof-id]     | open        | missing        |          |                                 |
| rollout-rollback       | rollout and rollback                      | [Rollout and rollback obligation]   | contributor | [proof-id]     | open        | missing        |          |                                 |
| documentation          | documentation                             | [Documentation obligation]          | contributor | [proof-id]     | open        | missing        |          |                                 |
| ownership-dependencies | ownership and human dependencies          | [Ownership obligation]              | contributor | [proof-id]     | open        | missing        |          |                                 |
| completion-evidence    | completion evidence                       | [Completion evidence obligation]    | contributor | [proof-id]     | open        | missing        |          |                                 |
