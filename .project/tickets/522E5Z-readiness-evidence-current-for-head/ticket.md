---
id: 522E5Z
slug: readiness-evidence-current-for-head
type: task
phase: intake
status: in_progress
created: 2026-09-05T22:02:16.936Z
last_modified: 2026-09-05T22:02:16.936Z
scope: |
  Publish one commit status per pull request head reporting whether the
  readiness evidence block in the PR body is current for that head. Five
  verdicts, all derived without interpreting prose:
    - draft      → success (evidence not required on a Draft)
    - current    → success (`Head:` SHA equals the pull request head)
    - stale      → failure (`Head:` SHA is some earlier revision)
    - missing    → failure (no evidence block in the body)
    - blocked    → failure (the author's own block records a BLOCKED gate)
  Ship as `review-pr readiness`, a deterministic offline-capable sibling of
  `review-pr inspect`, wired into the existing pr-review workflow on the
  events that already fire there.
out_of_scope: |
  - Verifying the four self-attested gates (comprehension, end-user execution,
    self-review, merge confidence). They are assertions; a checker that
    "passes" them manufactures false compliance.
  - Re-checking gates another system already owns: CI green is the repo's own
    required checks; AI review is the existing receipt comment.
  - Requiring the status. Branch protection stays the repository owner's call
    (3579 out-of-scope). Safeword publishes; the owner opts in.
  - Any local hook blocking `gh pr ready`. It covers only the CLI path, misses
    the GitHub UI button, and would block on text it cannot validate.
  - Tracker-link verification — needs per-repo tracker config for little gain.
done_when: |
  - A pure evaluator maps (body, head SHA, draft) to one of the five verdicts
    with no network and no prose interpretation.
  - The published status description comes from a closed set of constants, so
    no attacker-controlled body text reaches a privileged step.
  - `review-pr readiness` is registered in the CLI protocol catalog with a
    fixture, and the CLI reference regenerates clean.
  - The repo workflow and the shipped customer template both publish the
    status on every head change, independent of the advisory review path.
  - Focused tests cover all five verdicts and the constant-description rule.
---

# Catch pull requests whose readiness evidence no longer matches the code

**Goal:** A commit status reports whether the PR body's readiness evidence is current for the head SHA

**Why:** The seven gates are advice today; nothing notices when the evidence goes stale on the next push

## Work Log

- 2026-09-05T22:02:16.936Z Started: Created ticket 522E5Z
