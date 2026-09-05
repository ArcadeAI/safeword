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
- 2026-09-05T22:20:00Z Verified the two load-bearing assumptions rather than
  assuming them. `pull_request_target` grants a read/write token even on public
  fork pull requests, so `statuses: write` reaches the fork head; and GitHub's
  protected-branch docs state plainly that required status checks "can be checks
  or commit statuses", so the cheap Statuses API is enough — no GitHub App and
  no `checks: write`.
- 2026-09-05T22:55:00Z Full suite: 9095 passed, 6 failed, all six in
  `tests/lifecycle/origin-main-contract.test.ts` — the pinned origin/main
  install-tree baselines for codex-{install,check,upgrade} and
  cursor-{install,check,upgrade}. Only `tree_sha256` moved; every
  `result_sha256` still matches, so the install *outcome* is unchanged and
  only the byte content of a managed file differs.
- 2026-09-05T22:55:00Z Confirmed the cause rather than assuming it: restoring
  both edited templates to their pre-session content makes all 13 pass, and
  restoring the current content reproduces exactly the same six failures. The
  drift starts at the coverage-wording commit (9fa59c222), not at the
  readiness feature.
- 2026-09-05T22:55:00Z Explained the claude/codex-cursor asymmetry instead of
  waving it off: `projectLifecycleSchema` gives Claude native plugin delivery,
  so `.claude/skills/**` is not a managed project path and the edited skill
  never enters Claude's tree. Cursor and Codex both carry the shared
  `.safeword` runtime copy, which does contain it. Consistent, and it confirms
  the edit landed on the surfaces that need it.
- 2026-09-05T22:55:00Z BLOCKED on refreshing those baselines
  (`SAFEWORD_UPDATE_ORIGIN_MAIN_FIXTURES=1`). Standing instruction is never to
  update a baseline without explicit human approval.
- 2026-09-05T22:20:00Z Known limitation, accepted deliberately: the readiness
  job lives in the workflow that `install` only generates when `prReview.enabled`
  is true, so a repository that wants readiness discipline without an LLM
  reviewer cannot get it yet. Decoupling means a second workflow template, a
  second schema entry, and a second config key — new surface for a feature with
  no demand evidence. Ship coupled, dogfood it, and split only if a customer
  actually asks.
