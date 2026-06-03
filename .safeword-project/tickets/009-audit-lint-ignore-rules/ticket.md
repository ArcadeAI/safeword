---
id: 009
type: feature
phase: backlog
status: cancelled
parent: 001
created: 2026-01-07T16:39:00Z
last_modified: 2026-06-03T19:05:00.000Z
---

# Iteration 8: Audit/Lint Ignore Rules

**Goal:** Allow users to suppress specific warnings/errors that are intentional, so they don't see the same noise on every run.

**Parent Epic:** 001-stateful-bdd-flow

## Problem

Currently `/audit` and `/lint` report all findings every time. If a user has intentional deviations (e.g., large CLAUDE.md for a complex project, undocumented internal dep), they see the same warnings repeatedly.

## Potential Solutions

**Option A: Inline ignore comments**

```markdown
<!-- safeword-ignore: size-limit -->

# CLAUDE.md

...large file that's intentional...
```

**Option B: Config file**

```yaml
# .safeword/config.yaml
audit:
  ignore:
    - rule: size-limit
      path: CLAUDE.md
      reason: 'Complex project requires detailed instructions'
    - rule: staleness
      path: README.md
      reason: 'Stable project, README rarely changes'
```

**Option C: Both (inline + config)**

- Inline for one-off suppressions
- Config for project-wide policies

## Rules to Support

| Category | Rule           | Suppression Use Case                    |
| -------- | -------------- | --------------------------------------- |
| Audit    | size-limit     | Large config is intentional             |
| Audit    | staleness      | Stable docs don't change often          |
| Audit    | dead-refs      | Reference is to external/generated file |
| Audit    | structure      | Minimal style is intentional            |
| Audit    | drift          | Migration in progress                   |
| Audit    | gap            | Internal dep doesn't need docs          |
| Lint     | specific-rule  | Project style differs from default      |
| Quality  | specific-check | False positive for this codebase        |

## Considerations

- Should ignores expire? (e.g., "ignore for 30 days then re-check")
- Should ignores require a reason?
- How to handle ignore in monorepo (per-package vs root)?
- Integration with existing `.eslintignore`, `.prettierignore` patterns?

## Out of Scope

- Changing what rules exist
- Adding new audit/lint checks

## Work Log

- 2026-06-03T19:05:00.000Z Closed (cancelled) via ticket-triage: stale — three design options, never decided since Jan; abandoned.
