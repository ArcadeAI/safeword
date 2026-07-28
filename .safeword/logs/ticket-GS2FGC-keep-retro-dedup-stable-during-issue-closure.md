# Work Log: Keep retro dedup stable during issue closure

**Anchored to:** `.project/tickets/GS2FGC-keep-retro-dedup-stable-during-issue-closure/ticket.md`

---

## Session: 2026-07-27

- [12:20] Started review-feedback resolution for PR #1541.
- [12:21] Review claims to validate: all-state cap headroom, ticket done gate,
  independent-review provenance, fixture realism, Link pagination, lifetime
  enumeration cost, and creation-time tie ordering.
- [12:22] Investigation domains: live repository growth, GitHub pagination
  guarantees, failure/rate-limit economics, and minimal behavioral test design.
- [12:38] Live census: 1,550 items / 16 pages; 1,020 created in 30 days and
  311 in 7 days. Existing 3,000 cap reaches a deterministic latched outage in
  roughly 4.7–6.1 weeks.
- [12:41] Quality verdict on comments: REQUEST CHANGES is justified. Corrected
  two overclaims: 150 pages is not comfortably over one year at recent growth,
  and the fixture normalizer does not reach reconcile transport tests.
- [12:45] Figure-it-out: chose 200 pages plus explicit fixture states now.
  Rejected Link plumbing for this slice because it adds a response-header seam
  without documented snapshot consistency; rejected ETag/high-water persistence
  because its cross-run state and invalidation contract is underdesigned.
- [12:46] RED: the 20,000-item exact-bound test failed at the old 3,000-item
  guard.
- [12:47] GREEN: the same test passed after raising the guard to 200 pages.
- [12:48] REFACTOR: removed implicit state normalization, made every issue
  fixture explicit, and kept all 41 transport tests green.
- [12:50] Filed GitHub follow-up #1552 for Link traversal, safe cross-run
  caching, state mutation handling, ordering, and guard observability.

## Session: 2026-07-27 follow-up

- [16:17] Fetched the new top-level review: APPROVE, no unresolved inline
  threads; three nonblocking suggestions concern forecast wording, #1552
  sequencing, and cap-derived test literals.
- [16:22] Re-measured 1,554 total items. Exact rolling 30-day buckets are
  18 → 110 → 365 → 1,014; exact trailing seven days contain 303 items.
- [16:24] Quality review: APPROVE with no critical issues. Correct “plainly
  super-linear” to “sharply increasing recent buckets” and “land and close
  independently” to “land independently.”
- [16:26] Figure-it-out: keep `MAX_DEDUP_PAGES` private and introduce
  test-local specification constants. Importing the production value was close
  on convenience but would make the boundary expectations self-referential.
- [16:29] Updated #1552: observable threshold is now the first independent
  deliverable; signal destination remains the explicit first decision.
- [16:32] RED: set the test policy to 201 pages. The exact-bound test rejected
  at production's 200-page cap, proving independent drift detection.
- [16:33] GREEN: restored the test policy to 200 pages; exact-bound behavior
  passed.
- [16:33] REFACTOR: derived all nine cap literals from named test policy
  constants and expressed the unrelated fixture as two pages plus one. All 41
  focused tests, ESLint, Prettier, TypeScript, and diff hygiene passed.
- [16:48] VERIFY: fresh-build full gate passed — 5,549 Vitest tests, 505/508
  acceptance scenarios, 15,645 executed steps, build, and TypeScript.
  Independent post-fix review approved with no findings.
