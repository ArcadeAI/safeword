---
id: K8VPME
slug: judge-review-independence-by-reviewer-agent
type: task
phase: implement
status: in_progress
created: 2026-11-07T16:12:07.160Z
last_modified: 2026-11-07T16:12:07.160Z
---

# Stop downgrading planning reviews over unknown author models

**Goal:** Judge planning-review independence by whether a different agent reviewed, and drop the reviewer-strength ranking and author-model capture

**Why:** The author-model capture never reached reviews, so every planning review was marked reduced, and ranking reviewers by general strength would exclude future specialist reviewers

**Type:** Improvement (removal)

**Scope:**

- Planning reviews judge independence by which agent reviewed, as the routes already record. Missing author model no longer downgrades a review (`AUTHOR_CAPABILITY_UNKNOWN` removed) and reviewer routes are no longer refused or ranked by author/reviewer strength ratings (`reviewer_capability_unknown` / `reviewer_capability_weaker` removed from the coordinator).
- Remove the SessionStart author-model capture (`session-author-model.ts`): schema entry, settings hook, plugin event group (regenerated), and list it in `deprecatedFiles` so upgrades delete it.
- Remove the opt-in `crossModelReview` gate (stop-quality, pre-tool-quality, review-ledger helpers, TDD.md docs). It depended on the same capture and could never be satisfied from hooks.

**Out of Scope:**

- Execution Plan admission (63-case job test) and its route filtering: unchanged.
- Routing Execution Plan reviews to another Codex model.
- Retiring the capability measurement harness (`reviewer-capability-eval.ts`, `capability-eval.ts`, corpus, generated catalogue, release check). `PACKAGED_CAPABILITY_SETTINGS` stays in use for reviewer launch settings. Follow-up decision.
- Recording or re-capturing the author model any other way.

**Done When:**

- [ ] A Claude-authored planning review completed by Codex is recorded `cross-agent`, with no `AUTHOR_CAPABILITY_UNKNOWN` finding and no `capability_failure`, whether or not `SAFEWORD_AUTHOR_MODEL` is set.
- [ ] A selector with no strength rating (for example `codex:gpt-6-sol`) is launched like any other eligible route instead of being refused.
- [ ] Install no longer writes the author-model hook, and upgrade deletes an installed copy.
- [ ] `crossModelReview` no longer exists in hooks or docs.
- [ ] Generated surfaces regenerated; targeted tests and lint pass.

**Tests:**

- [ ] Integration: planning review without `SAFEWORD_AUTHOR_MODEL` completes cross-agent (host-gates).
- [ ] BDD ranked routes: the "later" case launches the unrated selector.
- [ ] Schema: author-model hook absent from settings and listed as deprecated.
- [ ] Removed tests: models-match, session-author-model, weaker-route, cross-model gate cases.

**Evidence:** `/Users/alex/Projects/safeword-trials/2026-11-06-main-27ebad272-csv/trial/blocker/AUTHOR-MODEL-DIAGNOSIS.md` (capture never reached `safeword review run`: missing `export`, and print mode sends no model).

## Work Log

- 2026-11-07T16:12:07.160Z Started: Created ticket K8VPME
- 2026-11-07T16:20:00.000Z User decided to drop reviewer-strength ranking: future specialist models may review better than general ones. Classified as task (removal, no new state/flows).
