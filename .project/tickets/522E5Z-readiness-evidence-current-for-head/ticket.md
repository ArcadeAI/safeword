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
- 2026-09-05T23:20:00Z Baselines re-pinned with the user's explicit approval.
  The applied diff was exactly the predicted blast radius: six `tree_sha256`
  values plus their manifest entries, no `result_sha256` moved, no Claude
  fixture touched, no file added or removed.
- 2026-09-05T23:20:00Z Caught a miss in my own sequencing: the dash/case fix
  changed bundled source, so the Codex and Claude plugin runtimes still shipped
  the previous evaluator until `check:cli-contract` flagged it. Regenerating a
  plugin has to follow every bundled-source edit, not just template edits.
- 2026-09-05T23:20:00Z Verified green: full suite 555 files / 9101 passed /
  0 failed; lint, typecheck, parity (260 pairs), actionlint, and
  `check:cli-contract` all clean; focused re-run after the plugin rebuild
  45 files / 499 passed.
- 2026-09-05T22:20:00Z Known limitation, accepted deliberately: the readiness
  job lives in the workflow that `install` only generates when `prReview.enabled`
  is true, so a repository that wants readiness discipline without an LLM
  reviewer cannot get it yet. Decoupling means a second workflow template, a
  second schema entry, and a second config key — new surface for a feature with
  no demand evidence. Ship coupled, dogfood it, and split only if a customer
  actually asks.
- 2026-09-06T05:40:00Z Accepted scope inclusion: the pr-readiness coverage-wording
  fix (9fa59c222) ships in this branch. It predates the ticket and is strictly a
  different concern, but the user asked for it in the same turn and it edits the
  same shipped skill file. Recorded here rather than silently carried.
- 2026-09-06T05:40:00Z /audit finding, unresolved and reported not fixed: the
  readiness commit status adds a merge-affecting publication surface to the
  workflow whose ADR (ARCHITECTURE.md, "Automatic pull request review",
  2026-08-04) states the pipeline publishes "without ... acquiring an
  approval/check/merge capability", records "no merge-affecting publication
  surface" among its consequences, and rejected draft PR #1917 partly because it
  "used a check-run receipt". Deterministic, model-free publication is arguably
  outside that rationale, but the recorded consequence is now false and no
  superseding record exists. This needs a human architecture decision.
- 2026-09-08T00:25:00Z Resolved with the user's go-ahead after /figure-it-out,
  which overturned my own prior recommendation. I had proposed moving the job to
  its own workflow; GitHub matches required checks by context-name string, not by
  workflow file, so relocation leaves the merge capability identical and would
  have been compliance in appearance only. Amended the ADR instead, following the
  repo's existing partial-narrowing idiom (Status line names the narrowing, the
  original record stays intact).
- 2026-09-08T00:25:00Z Two findings the research settled: the
  `pull_request_target` hazard is checking out fork code, which this job does not
  do, so `statuses: write` is not a security regression; and *requiring* the
  status is worse than publishing it — an unreported required check jams every
  PR, and requiring a self-attestation converts it to a formality. Both are now
  recorded in the ADR and the reference docs, not just in this log.
- 2026-09-08T00:25:00Z Coupling limitation split out as MNS9J2 rather than fixed
  here.
