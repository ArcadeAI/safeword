---
id: F9W3JP
slug: epic-child-linker
type: feature
phase: verify
status: in_progress
scope:
  - a `--parent <epicId>` flag on `ticket new` that writes `parent: <epicId>` on the new child
  - idempotent, atomic append of the child id to the epic's `children:` list
  - validation that `--parent` names an existing `type: epic` ticket, failing loud otherwise
  - INDEX grouping of children under their epic resolved from `parent:` (single source of truth)
out_of_scope:
  - a standalone `ticket link` command for re-linking pre-existing tickets (deferred; `--parent` is create-time only)
  - re-parenting or unlinking a child
  - a separate `epic:` frontmatter field (rejected — would duplicate the `parent:` relationship)
  - nested epics / multi-level hierarchies beyond one epic→child level
done_when:
  - "`ticket new <slug> --parent <epicId>` creates a child with `parent:` set and appends its id to the epic's `children:`"
  - "`findNextWork` navigates from the epic to the newly created child"
  - "`INDEX.md` lists the child under its epic's heading"
  - "`--parent` with a missing or non-epic id exits non-zero and mutates no files"
  - "re-running or interrupting the append leaves the epic's `children:` with the id exactly once and the file intact"
created: 2026-07-05T17:25:42.420Z
last_modified: 2026-07-05T17:25:42.420Z
---

# ticket new --parent links epic and child

**Goal:** One command wires a new child ticket to its epic across navigation and the index, with no dual-write drift

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-05T17:25:42.420Z Started: Created ticket F9W3JP
- 2026-07-05T17:27:00.000Z Complete: intake - one JTBD (TB1), four ACs, scope/out_of_scope/done_when set; design from /figure-it-out (single source of truth via parent:)
- 2026-07-05T17:30:00.000Z Complete: define-behavior - 7 scenarios across 4 rules (AC1 link+navigate, AC2 index, AC3 validation, AC4 idempotent-preserve)
- 2026-07-05T17:35:00.000Z Complete: scenario-gate - independent /review-spec PASS (fixed 1 vacuous scenario); impl-plan.md written (proof plan + build order, riskiest slice = INDEX grouping last)
- 2026-07-05T18:03:00.000Z Complete: implement - all 7 scenarios GREEN via outside-in TDD (helper → CLI wiring → navigation → index grouping); RGR ledger annotated with SHAs
