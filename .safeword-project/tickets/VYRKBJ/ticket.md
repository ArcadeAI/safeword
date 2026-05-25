---
id: VYRKBJ
slug: impl-plan-skip-annotations
title: "Extend skip annotation discipline to impl plan sections"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-two-merge
blocked_on: XDNSZA
created: 2026-05-24T21:37:59.922Z
last_modified: 2026-05-24T21:39:00.000Z
---

# Extend skip annotation discipline to impl plan sections

**Goal:** Extend safeword's existing `skip: <non-empty reason>` annotation convention (used today on R/G/R checkboxes in test-definitions.md) to impl plan sections. Each of the 5 sections (Approach, Decisions, Arch alignment, Known deviations, Assessment triggers) can be `skip: <reason>` for features where the section doesn't apply — uniformly enforced, audit-trail preserved.

**Why:** Without skip discipline, "Arch alignment" for a project with no ADRs is awkward (blank? "N/A"? prose explaining there are no ADRs?). The skip annotation pattern is already a safeword idiom on R/G/R checkboxes — extending it to impl plan sections keeps the convention uniform and machine-parseable, AND ensures the skip carries a reason rather than an empty section.

**Parent epic:** M6D315
**Depends on:** XDNSZA (sections must exist before they can be skip-annotated)

**No arcade pair:** safeword-internal hygiene — extends an existing safeword pattern rather than absorbing an arcade behavior.

## Scope

### Skip annotation convention

Each of the 5 impl plan sections can be empty with a `skip:` annotation in its place:

```markdown
## Approach

[content here]

## Decisions

skip: feature has no architectural choices — straightforward bug fix

## Arch alignment

skip: no ADRs in this project yet

## Known deviations

skip: no deviations — implementation matches plan

## Assessment triggers

[content here]
```

### Validation

- `safeword check` validates: every section is either non-empty (has prose/table content) OR marked `skip: <non-empty reason>`.
- Bare `skip:` without a reason → error.
- Empty section without `skip:` → error.
- Whitespace-only reason → error (same rule as R/G/R skips).

### Hook integration

When the Phase 6 entry hook (per XDNSZA) checks that the impl plan exists with all 5 sections, "has content OR is skip-annotated" satisfies the check.

### Documentation

Update the impl plan template (XDNSZA artifact) to call out the skip-annotation option explicitly: "If a section doesn't apply, mark it `skip: <reason>` rather than leaving it blank."

## Out of scope

- Skip annotations on test-definitions.md R/G/R checkboxes — already in place (this ticket is the impl-plan side of the same idiom).
- Skip annotations on scope/out_of_scope/done_when ticket frontmatter fields — separate work if useful.
- Restricting which sections can be skipped — all 5 sections are eligible (no allowlist).

## Done when

- Impl plan template documents the skip convention.
- `safeword check` validates the skip annotation rules (existence, non-empty reason, no whitespace-only).
- Hook validation at Phase 6 entry treats skip-annotated sections as satisfied.
- Worked example shows a skip-annotated impl plan section.

## Open questions

- **Skip reason length minimum** — single-character reasons technically valid? Driver leans yes (avoid forcing prose) but might want a 3+ char minimum to prevent trivial bypasses like `skip: .`.

## Work Log

- 2026-05-24T21:37:59.922Z Started: Created ticket VYRKBJ
- 2026-05-24T21:39:00.000Z Drafted: Scope (skip convention extended), validation, hook integration; linked to epic M6D315
