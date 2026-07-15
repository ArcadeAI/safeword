---
id: X1Z5MG
slug: detect-author-model-for-cross-model-review
type: task
phase: intake
status: backlog
depends_on: [WAWQA6]
created: 2026-07-15T14:15:27.235Z
last_modified: 2026-07-15T14:15:27.235Z
---

# Detect the authoring model for cross-model PR review

**Goal:** Derive the model that authored a PR from repo evidence so the reviewer can guarantee a different, never-weaker model instead of relying on configuration.

**Why:** WAWQA6 v1 IMPLIES the author model via config ('our agents are Claude, review with something else'). That breaks when a fleet is heterogeneous — arcade's branch names (polecat/mutant/..., ericgustin/...) show both agent and human authorship in one repo, so a single configured assumption is wrong for some PRs. PRINCIPLES §1 requires the reviewer be never weaker and a different model than the author; you cannot honor that without knowing the author.

## Sketch (refine at intake)

Candidate evidence sources, cheapest first — none verified yet:

- **Commit trailers.** Safeword's own convention writes `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Free and already present where agents follow it; absent for hand-written commits and for other harnesses' conventions.
- **PR body markers.** `🤖 Generated with [Claude Code]` and equivalents. Same shape, same gap.
- **Branch-name convention.** Arcade's `polecat/mutant/mo-67yrqt@…` vs `ericgustin/…` distinguishes fleet-agent from human authorship, but is repo-specific and encodes no model.
- **Safeword-written provenance.** `session-author-model.ts` already captures the author model at SessionStart into `CLAUDE_ENV_FILE` (built for the architecture review gate's `crossModelReview`). Nothing carries it to CI — a committed provenance artifact would, at the cost of a new owned surface.
- **Mixed authorship is the hard case.** One PR can carry agent and human commits; "the author model" may not be a single value.

## Why v1 defers this

WAWQA6 ships with the model **implied by configuration** ("our agents are Claude → review with something else"). That is correct for a homogeneous fleet and wrong the moment it isn't — and it fails *silently*, which is the part that matters: a same-model review that believes it is cross-model is worse than a same-model review that knows it, because it launders correlated blind spots as independent verification. Reuse `modelsMatch` / `isCrossModelReviewRequired` in `hooks/lib/review-ledger.ts` rather than inventing a parallel notion of model identity.

## Out of scope

- The review procedure itself (WAWQA6).
- Changing the `crossModelReview` semantics or the PRINCIPLES §1 never-weaker rule — this ticket supplies the input those already expect.

## Done when

- The reviewer derives the authoring model from repo evidence rather than configuration, or declares it unknown.
- An unknown or mixed-authorship author model is surfaced, never silently assumed — a review that cannot prove it is cross-model must say so.
- The configured value remains the fallback, so a repo with no detectable provenance keeps working.

## Work Log

- 2026-07-15T14:15:27.235Z Started: Created ticket X1Z5MG
- 2026-07-15T14:16:00.000Z Filed (backlog) from the WAWQA6 intake conversation — user: "the model will be implied for now. later it will be detected. file that as a follow on ticket." Depends on WAWQA6 shipping the reviewer that would consume this.
