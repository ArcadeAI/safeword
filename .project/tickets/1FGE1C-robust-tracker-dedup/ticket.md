---
id: 1FGE1C
slug: robust-tracker-dedup
parent: RV9JT4-retro-transcript-mining
type: task
phase: intake
status: todo
created: 2026-06-28T01:00:02.710Z
last_modified: 2026-06-28T01:00:02.710Z
scope: |
  Replace retro's fragile fuzzy-title dedup with a robust scheme on the upstream
  GitHub adapter + triage:
    1. Stamp every retro-filed issue with a `retro` label and a hidden body
       marker `<!-- retro-sig: retro:<hash> -->`. The marker is appended in
       `buildDraft` AFTER sanitize (assembleBody takes a Finding with no
       signature; buildDraft has the signature) so the sanitizer never touches it.
    2. Dedup by the strongly-consistent issues-LIST API + exact marker match —
       NOT the eventually-consistent search API. List `state=all` (see closed
       policy below), paginated with a page cap, and scan returned bodies for the
       marker (the list endpoint returns `body`, so no per-issue GET).
    3. In-run signature map (`Map<signature, IssueReference>`), checked BEFORE the
       list lookup and populated on BOTH create and list-hit, so two findings
       sharing a signature in one run can't double-create or double-bump within
       the consistent-list window. This also covers the first-ever run (before the
       label propagates).
    4. Ensure the `retro` label exists before the first list (idempotent create,
       ignore 422-already-exists).
    5. Closed-issue policy: match CLOSED retro issues too. On a closed match, do
       NOT create a duplicate and do NOT auto-reopen; post a brief "recurred after
       close" comment so a regression is visible without resurrecting the issue.
    6. Retire `searchByTitle` — remove the title-search dedup path entirely (no
       dual path that could reintroduce the dup bug).
  The IssueTracker port gains `ensureLabel` + `listByLabel` (state-parameterized);
  the tested core (egress/pipeline/ledger) is unchanged.
out_of_scope: |
  - Semantic dedup vs HUMAN-filed tickets (no shared key) — that's a separate
    LLM-triage concern; this ticket is exact retro-vs-retro dedup only.
  - Multi-provider (Linear) adapters — routing stays upstream GitHub (RV9JT4).
  - The cross-session near-simultaneous race (two installs filing the same novel
    signature within the list→create window) — inherent limit; periodic merge is
    the backstop, not in scope.
  - Maintainer REMOVES the `retro` label from an issue → it drops out of the list
    and a recurrence may re-file. Accepted limitation (same class as the cross-
    session race); not defended here.
  - Auto-reopening maintainer-closed issues — deliberately not done (a comment is
    the signal; reopening is too aggressive).
done_when: |
  - A retro-filed issue carries the `retro` label and an exact, anchored
    `<!-- retro-sig: retro:<12-hex> -->` body marker; a test asserts the marker
    round-trips through body assembly + sanitize and is matchable by the scan.
  - The `retro` label is ensured to exist before the first list (idempotent).
  - Dedup uses the issues-list API + exact marker match; a known OPEN signature
    never creates a second issue even when GitHub search hasn't indexed it yet.
  - A known CLOSED signature creates no new issue and does not reopen; it leaves a
    "recurred after close" comment.
  - Two findings with the same signature in one run create exactly one issue
    (in-run map), and re-running on the same transcript does not double-file.
  - Title drift on a known signature does not fork a new issue.
  - List pagination is bounded by a page cap; behavior at the cap is logged
    (truncation = possible miss, backstopped by periodic merge).
  - Scenarios green; /verify passes.
---

# Robust dedup: signature marker + label-scoped list lookup (not fuzzy title search)

**Goal:** Make retro's "never a duplicate issue" guarantee actually hold, by
deduping on a stable embedded signature via the strongly-consistent issues-list
API instead of fuzzy, eventually-consistent title search.

**Why:** Title-search dedup (RV9JT4's first cut) is fragile — GitHub search
indexing-lag, relevance ranking past the first results page, and title drift can
all miss an existing issue and file a duplicate, breaking SM1.AC2.

**Parent:** RV9JT4-retro-transcript-mining. Flagged by two independent reviews
(S2) and deferred from RV9JT4 as a contained follow-up.

## Work Log

- 2026-06-28T01:00:02.710Z Started: Created ticket 1FGE1C (sub-ticket of RV9JT4)
