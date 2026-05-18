---
id: 157
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:41:00Z
last_modified: 2026-05-18T05:41:00Z
scope: |
  Implement the documentation-impact heuristic that /audit's prose already
  describes but never executes. For each file changed in the last N commits
  (default: since last tag, fallback to last 20 commits), grep all docs/guides/
  skills/configs for references to changed file paths or exported symbol names.
  Flag any reference that points at code that has materially changed without a
  corresponding doc edit in the same commit range.
out_of_scope: |
  - LLM-based semantic comparison (separate, deferred)
  - Auto-fixing docs (read-only flagging)
  - References inside .safeword/ itself (skip — that's the shipped skill's
    domain, customer projects shouldn't audit their installed safeword config)
done_when: |
  - /audit reports a new section "Documentation Impact" with file:line refs
  - On a project with a recent code-change-but-docs-unchanged pattern, the check
    surfaces the gap
  - On a clean project, zero noise
  - Universal: works for any safeword user, not just safeword-the-project
---

# /audit: implement documentation-impact heuristic

**Goal:** Close the "I changed code that docs reference but didn't update the docs" gap that /audit's description promises but doesn't deliver.

**Why:** Ticket 152's whole reason for existing was that planning-guide.md had been describing the wrong test-definitions format for months — no audit caught it because none of the structural tools (depcruise/knip/jscpd) detect semantic drift. The docs-impact heuristic is the cheapest way to catch this class without LLM costs: grep changed files against doc references, flag mismatches.

## Work Log

- 2026-05-18T05:41:00Z Started: ticket created from 152 audit-skill improvement debate
