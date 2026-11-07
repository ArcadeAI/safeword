---
id: K8VPME
slug: judge-review-independence-by-reviewer-agent
type: task
phase: implement
status: in_progress
created: 2026-11-07T16:12:07.160Z
last_modified: 2026-11-07T16:34:00.000Z
---

# Stop downgrading planning reviews over unknown author models

**Goal:** Always attempt independent review, never block on it, and mark a review reduced only when a different agent could not review

**Why:** The author-model capture never reached reviews, so every planning review was marked reduced; ranking reviewers by general strength would exclude future specialist reviewers; and independence gates left Claude-authored Execution Plans with no way to be reviewed at all

**Type:** Improvement (removal)

**Scope:** Independent review never blocks. Safeword always tries a different agent first. When no different agent can review, for any reason, it falls back to the same agent and records the review `reduced`. "Independent" means a different agent (Claude vs Codex), because the exact author model is not reliably observable.

- Remove the author-model downgrade (`AUTHOR_CAPABILITY_UNKNOWN`) and the reviewer-strength ranking (`reviewer_capability_unknown` / `reviewer_capability_weaker`, including unqualified-feedback retention) from the coordinator.
- Remove the SessionStart author-model capture (`session-author-model.ts`): schema entry, settings hook, plugin event group (regenerated), and list it in `deprecatedFiles`.
- Remove the opt-in `crossModelReview` gate (stop-quality, pre-tool-quality, review-ledger, TDD.md).
- Planning fallback no longer needs a failed independent attempt. When no cross-agent route is configured, admitted or able to run, the same-agent route runs and the receipt says `reduced`. This includes Execution Plan reviews whose Codex route is not admitted.
- Remove `require` as a blocking policy. Config `require` and malformed config both read as `prefer`. Phase admission, delivery admission, review stamps and the opt-in architecture gate accept `reduced`.

**Out of Scope:**

- Policy `off` behavior.
- Resolving a "latest" Codex model at runtime (Codex has no supported alias; names are bumped per release).
- Rendering of historical results that recorded `review_policy: require` (presentation keeps reading them).

**Done When:**

- [ ] A Claude-authored planning review completed by Codex is recorded `cross-agent`, with no capability finding, whether or not `SAFEWORD_AUTHOR_MODEL` is set.
- [ ] A selector with no strength rating is launched like any other eligible route.
- [ ] A Claude-authored Execution Plan review with no admitted Codex route completes on the admitted Claude route, recorded `reduced`, instead of `REVIEW_ROUTES_EXHAUSTED`.
- [ ] A planning review with no cross-agent route configured falls back to the same-agent route, recorded `reduced`.
- [ ] `crossAgentReview: require` behaves like `prefer`; a `reduced` review passes phase admission.
- [ ] Install no longer writes the author-model hook; upgrade deletes an installed copy.
- [ ] `crossModelReview` no longer exists in hooks or docs.
- [ ] Generated surfaces regenerated; targeted tests and lint pass.

**Evidence:** `/Users/alex/Projects/safeword-trials/2026-11-06-main-27ebad272-csv/trial/blocker/AUTHOR-MODEL-DIAGNOSIS.md` (capture never reached `safeword review run`: missing `export`, and print mode sends no model). Trial blocker: `.../trial/blocker/INVESTIGATION.md`.

## Work Log

- 2026-11-07T16:12:07.160Z Started: Created ticket K8VPME
- 2026-11-07T16:20:00.000Z User decided to drop reviewer-strength ranking: future specialist models may review better than general ones. Classified as task (removal, no new state/flows).
- 2026-11-07T16:33:00.000Z User expanded scope: independent review is still attempted first but must never block; mark `reduced` when a different agent could not review. Removes the failed-attempt precondition for planning fallback and `require` blocking.
- 2026-11-07T22:30:00.000Z User dropped reviewer qualification: every review uses Claude `opus`→`sonnet` or Codex `gpt-6.1-sol`→`gpt-6.1-terra`. Execution Plan admission, capability corpus, eval harness and generated catalogue removed (fd6b4e4f2). User chose fixed Codex names over a runtime "latest" lookup.
