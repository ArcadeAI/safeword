# Quality Review: Keep retro dedup stable during issue closure

Evidence reviewed 2026-07-27 against PR #1541, current GitHub primary
documentation, repository history, CI, and a live API census.

## Feedback review

**Currency:** ✓ Current as of 2026-07-27
**Sources:** ✓ Load-bearing claims verified against primary GitHub sources and
live repository data
**Correct:** ⚠️ The cap and CI blockers were valid; several advisory claims
needed narrower wording
**Elegant:** ✓ The required fixes were narrow
**No-bloat:** ⚠️ Link traversal and cross-run caching require separate design
**Wiring:** ✓ The real `createRestTransport` tests mock only the network boundary

**Verdict:** REQUEST CHANGES

Validated blockers:

1. `MAX_DEDUP_PAGES = 30` was introduced for an open-only universe. The
   all-state universe contained 1,550 items across 16 pages, leaving roughly
   4.7–6.1 weeks before a deterministic, transport-latched filing outage at
   measured trailing growth.
2. CI correctly rejected completion evidence while the ticket remained
   `verify` / `in_progress`.

Corrections to the feedback:

- A 150-page guard was reasonable but not “comfortably over a year”: it bought
  about 303 days at the measured trailing-seven-day rate.
- The test normalizer masked omitted issue state, but it did not affect
  reconcile transport tests in this file.
- ETags do not make request count O(new items), and an issue-number high-water
  mark alone misses reopens.
- Equal-creation-time ordering remains undocumented and therefore
  nonblocking.

## Figure-it-out decision

Recommend **a 200-page fail-closed guard plus explicit issue states in fixtures**
because it buys a measured one-year safety horizon without changing
normal-path request count or widening the transport response contract.
Following GitHub `Link` URLs is the documented pagination best practice, but it
does not provide a documented snapshot guarantee and belongs with the caching,
mutation, and ordering design tracked in
[issue #1552](https://github.com/ArcadeAI/safeword/issues/1552).

**Premortem:** If this fails within six months, tracker growth accelerated
beyond the measured seven-day rate and no threshold-based follow-up landed
before 20,000 items.

## Post-fix review

**Currency:** ✓ GitHub API contract current as of 2026-07-27
**Sources:** ✓ Primary GitHub docs and live census verified
**Correct:** ✓ Cap, filtering, and exact boundary behavior are correct
**Elegant:** ✓ Stale cap wording corrected
**No-bloat:** ✓ Minimal constant, test, and fixture changes
**Wiring:** ✓ Real transport with only `fetch` mocked

**Verdict:** APPROVE

**Critical issues:** None.

The 200-page calculation is exact for the dated measurement:
`(20,000 − 1,550) ÷ (311 ÷ 7) = 415.27 days`. Tests pin completion at exactly
20,000 items and fail-closed behavior at 20,001. All 41 focused transport tests,
ESLint, Prettier, TypeScript, and diff hygiene passed.

## Provenance

- [List repository issues](https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues)
- [Using pagination in the REST API](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)
- [REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
- Live `ArcadeAI/safeword` all-state issue enumeration fetched 2026-07-27

**Next:** Commit and push the reviewed fixes, close the ticket through the done
gate, then reply to and resolve the PR threads.

## Follow-up review

The 2026-07-27 follow-up review approved the fixes and raised three
nonblocking improvements. A fresh quality pass reproduced the 415-day
flat-rate arithmetic and exact recent 30-day buckets of 18, 110, 365, and
1,014 items.

**Verdict:** APPROVE

**Critical issues:** None.

Corrections and decisions:

- Describe 415 days as a flat-rate capacity horizon, not a forecast. The recent
  buckets increased sharply, but four observations do not establish a durable
  growth model.
- Make the observable threshold #1552's first independent deliverable. It still
  requires a signal-destination decision, but not the other four investigations.
- Keep the production bound private. Test-local specification constants remove
  ambiguous cap-derived literals while deliberately retaining an independent
  value that makes accidental production drift fail the behavioral tests.

**Premortem:** If this resolution fails, the test-local policy value drifts
without detection; retain the full-bound and first-tail transport tests as the
cross-check.

**Next:** Refactor the cap tests around named specification constants, clarify
the source comment, and reorder #1552.

### Follow-up post-fix review

**Verdict:** APPROVE

**Critical issues:** None.
**Suggested improvements:** None.

The independent reviewer confirmed that the test constants remain deliberately
independent from `MAX_DEDUP_PAGES`, the unrelated fixture is expressed as two
pages plus one, the source calls 415 days a flat-rate capacity horizon, and
Issue #1552 makes the observable threshold its first independent deliverable. All 41
focused transport tests and Prettier passed.

**Next:** Run final Safeword verification, commit, push, and answer the
top-level review comment.
