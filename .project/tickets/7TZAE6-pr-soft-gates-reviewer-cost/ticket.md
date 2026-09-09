---
id: 7TZAE6
slug: pr-soft-gates-reviewer-cost
type: task
phase: intake
status: backlog
created: 2026-09-05T21:54:35.291Z
last_modified: 2026-09-05T21:54:35.291Z
scope: |
  Carry the soft gates from Arcade's "What a Good PR Looks Like" announcement
  (ArcadeAI/monorepo docs/docs/announcements/2026-04-24-what-a-good-pr-looks-like.md)
  into pr-readiness. The seven hard gates already match 1:1; these are the
  reviewer-cost characteristics the skill dropped:
    1. Small and focused — one coherent concern. "and also..." in the
       description means it is two PRs.
    2. Title states what the change is, with the tracker ID in it.
    3. Author-annotated line comments where two files connect non-obviously
       or a line looks wrong but is intentional. Reviewer context, not code
       documentation.
    4. Commits ordered for review when the PR is not tiny, with the order
       named in the description.
  Ship through templates/skills/pr-readiness/SKILL.md, then regenerate the
  Codex and Claude plugin copies and sync .safeword/ and .claude/.
out_of_scope: |
  - The seven hard gates — already ported and verified matching.
  - Monorepo-specific numbers (Codecov 70/85 thresholds, stale-bot 5/7/14 day
    timers). Safeword is host-agnostic; reference "the repository's target".
  - Hook-level enforcement of any gate. pr-readiness is deliberately soft;
    making it blockable is a separate decision.
done_when: |
  - templates/skills/pr-readiness/SKILL.md states all four soft gates without
    growing past its current one-screen density.
  - Codex and Claude plugin copies regenerated; .safeword/ and .claude/ synced.
  - A test asserts the skill names scope, title, and self-annotation.
  - Templates and cursor/codex parity hold.
---

# Make PRs cheaper to read by adding scope, title, and self-annotation guidance

**Goal:** pr-readiness carries the soft gates that make a PR cheap to read, not just the seven hard gates

**Why:** Reviewers spend the most effort on oversized, unlabeled, unannotated PRs; the hard gates don't catch those

## Work Log

- 2026-09-05T21:54:35.291Z Started: Created ticket 7TZAE6
