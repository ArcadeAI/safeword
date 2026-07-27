---
id: GS2FGC
slug: keep-retro-dedup-stable-during-issue-closure
type: task
phase: verify
status: in_progress
created: 2026-07-27T17:29:00.567Z
last_modified: 2026-07-27T18:11:37Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1481
scope: |
  Enumerate the stable all-state repository issue universe in creation order,
  then retain only open non-pull-request issues for exact retro marker matching.
out_of_scope: |
  GitHub cursor/Link-header plumbing, concurrent create idempotency, deleted
  issue handling, and changing the existing closed-issue recurrence policy.
done_when: |
  Closing an earlier issue during pagination cannot hide a later still-open
  marker match; closed issues and pull requests remain ineligible matches; the
  bounded enumeration still fails closed on a genuine unread tail.
---

# Keep retro dedup stable during issue closure

**Goal:** Prevent issue state changes during pagination from authorizing a duplicate retro issue.

**Why:** A closing issue can shift page-number pagination and hide a still-open marker match.

## Work Log

- 2026-07-27T18:11:37Z VERIFY: Final generated gate passed on the exact tree: 5,549/5,549 Vitest tests, 505/508 acceptance scenarios (3 skipped), 15,645/15,645 executed steps, build, lint, formatting, typecheck, and diff hygiene. Independent quality/engineering review: APPROVE with no critical findings; final delta re-check unchanged.
- 2026-07-27T17:58:00Z AUDIT: No change-scoped errors. Config, dependency boundaries, dead-code scan, learning/domain docs, changed-test quality, architecture, and configured docs were clean. Repository-wide warnings were limited to duplication growth, two patch-level dev-tool updates, and the pre-existing Python experiment coverage limitation.
- 2026-07-27T17:43:00Z REFACTOR: Removed the 55-line repeated-sweep state machine, made open-state eligibility explicit, and kept one cached all-state enumeration. Focused transport suite: 41/41; Prettier clean.
- 2026-07-27T17:40:00Z GREEN: Closed issues are retained in raw page membership but filtered from exact-marker candidates; the endpoint contract now pins `state=all&sort=created&direction=asc`.
- 2026-07-27T17:39:00Z RED: An all-state response containing only a closed exact marker incorrectly matched it, proving local state filtering is required to preserve the existing closed-recurrence policy.
- 2026-07-27T17:38:00Z GREEN: Switching the listing universe to `state=all` makes the repeated-close regression find #101 in the first real transport sweep.
- 2026-07-27T17:37:00Z RED: A real-transport/network-boundary test repeats the same close-at-page-boundary shift in every open-only sweep; the lookup returned `[]` instead of the still-open marker on #101.
- 2026-07-27T17:34:00Z Planned: Use `state=all` as the pagination universe and filter `state=open` locally. GitHub documents `open|closed|all`, creation-order sorting, item state, and issue/PR co-listing; the live repository currently needs 16 all-state pages versus 18 requests for the existing three-sweep miss path. Cursor pagination is more invasive and its mutation consistency is not documented; repeated open-state sweeps preserve the fragile proof that produced #1481.
- 2026-07-27T17:31:00Z Researched: GitHub's REST pagination uses server-provided Link URLs and the issue listing supports `state=all`; permanent issue deletion remains a separate rare membership mutation. Sources: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues, https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api, https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/deleting-an-issue
- 2026-07-27T17:29:00.567Z Started: Created ticket GS2FGC

## Figure-it-out decision

Recommend **all-state pagination with local open-state filtering** because it
removes close/reopen transitions from pagination membership while preserving
the existing open-only match policy. Repeated open-state sweeps were close on
API compatibility but lose on correctness complexity; cursor plumbing was
close on pagination mechanics but loses on scope and lacks a documented
snapshot-consistency guarantee.

**Premortem:** If this fails in six months, repository growth reaches the
3,000-item fail-closed bound sooner because closed issues and pull requests now
consume it; keep the explicit cap error and revisit the bound or cursor path
before the live count approaches it.

**Next:** Add the mutation regression in
`packages/cli/src/retro/github-rest.test.ts`, prove RED, then change
`fetchIssuePage` in `packages/cli/src/retro/github-rest.ts`.

## Tests

- [x] A close between page one and page two cannot hide a still-open exact marker.
- [x] A closed issue carrying the exact marker remains ineligible.
- [x] The request uses the documented all-state, creation-ascending listing.
- [x] Existing truncation, pull-request filtering, and cache behavior remain green.
