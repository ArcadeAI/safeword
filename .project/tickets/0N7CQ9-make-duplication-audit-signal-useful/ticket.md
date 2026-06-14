---
id: 0N7CQ9
slug: make-duplication-audit-signal-useful
type: task
phase: intake
status: in_progress
created: 2026-06-14T11:51:36.330Z
last_modified: 2026-06-14T12:00:00.000Z
scope:
  - Reproduce the current jscpd report and identify why known mirrored agent surfaces still dominate the output.
  - Update `.jscpd.json` so intentional mirrors are ignored in the form jscpd actually honors: dogfood skill/rule/command copies and template skill/command copies.
  - Keep source-code and test duplication visible; this is signal cleanup, not a blanket duplication amnesty.
out_of_scope:
  - Refactoring the 423 reported clones directly.
  - Hiding `packages/cli/src/**` or `packages/cli/tests/**` from duplication scanning.
  - Solving agent-surface generation; that belongs to `agent-surface-refactor-epic (S3T6JA)`.
done_when:
  - jscpd output is no longer dominated by `.agents`, `.claude`, `.cursor`, or `packages/cli/templates/{skills,commands}` mirror pairs.
  - Real TypeScript source/test duplication remains visible in the report.
  - The chosen ignore patterns are verified with the same command used by audit.
---

# Make duplication audit signal useful

**Goal:** Tune duplication scanning so jscpd reports actionable code/test duplication instead of intentional safeword agent-surface mirrors.

**Why:** The current report found 423 clones and 18.74% duplicated lines, but the top noise is expected mirrored content across Claude, Cursor, Codex, and templates. That makes the tool expensive to read and easy to dismiss.

## Work Log

- 2026-06-14T11:51:36.330Z Started: Created ticket 0N7CQ9
- 2026-06-14T12:00:00.000Z Intake: Force-ranked as P4 because it improves audit usability but is not product behavior. It should tune scanning, not refactor intentional mirrors.
