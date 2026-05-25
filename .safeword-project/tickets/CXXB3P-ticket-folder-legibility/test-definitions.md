# Test Definitions — ticket-folder-legibility (CXXB3P)

**Note on provenance.** This file is backfilled. Implementation landed in commit `cc8658dd` (PR #160) before the ticket existed. RED steps are marked `skip: backfilled` with reference to the actual commit rather than fabricated SHAs — this preserves the audit trail that TDD was not run for this change.

## Scenario 1 — Slug-aware ID collision (the new behavior)

Given a tickets directory containing `AAAAAA-legacy-slug/`,
When `createTicket` is called with a minter whose first output is `AAAAAA`,
Then the mint must be rejected (ID already in use under a different slug) and the minter retried,
And the resulting folder must be named with the next minted ID + new slug (e.g. `BBBBBB-new-slug/`),
And no folder named `AAAAAA-new-slug/` exists on disk.

- [x] RED skip: backfilled — convention change implemented as single edit cycle in cc8658dd, test added post-hoc in this follow-up commit
- [x] GREEN cc8658dd
- [x] REFACTOR skip: no refactor pass — code landed in its final shape

## Scenario 2 — Folder shape includes slug suffix

Given a fresh install (no `.safeword-project/tickets/` directory yet),
When `createTicket` is called with `slug: 'kickoff'` and a minter returning `FIRSTT`,
Then the resulting folder must be `FIRSTT-kickoff/`, not `FIRSTT/`.

- [x] RED skip: backfilled — existing test at ticket-writer.test.ts:110-120 was updated in lockstep with the source change in cc8658dd
- [x] GREEN cc8658dd
- [x] REFACTOR skip: no refactor pass

## Scenario 3 — Hook resolver still resolves bare IDs

Given a renamed ticket folder `G2E72G-yolo-mode/`,
When the active-ticket hook looks up by bare ID `G2E72G`,
Then `findTicketFolderMatches` must return the renamed folder via prefix match,
And no hook source-code change must be required.

- [x] RED skip: backfilled — verified by manual code inspection of .safeword/hooks/lib/active-ticket.ts:75-79 (existing prefix-match branch already handles the new shape)
- [x] GREEN cc8658dd
- [x] REFACTOR skip: docstring updated in cc8658dd to reflect that `{id}-{slug}` is now canonical, not legacy

## Scenario 4 — Cross-branch duplicate-ID safety shifts from merge-conflict to detector

**Trade-off documented.** The previous `{ID}/` layout used identical filesystem paths as a merge-time conflict layer — two branches force-minting the same ID would conflict on `tickets/{ID}/ticket.md`. The slug suffix breaks that property (different paths → clean merge). Detection now relies entirely on the post-merge `check-ticket-ids.ts` detector wired into pre-commit + CI.

Given two branches force-minting the same ID `COLLID` with different slugs (`foo`, `bar`),
When both are merged to main,
Then the second merge must succeed (different paths),
And both folders (`COLLID-foo/` and `COLLID-bar/`) must coexist on disk,
And `check-ticket-ids.ts` must exit with status 1 and name `COLLID` in stderr.

- [x] RED skip: backfilled — caught by self-audit during /verify; existing test asserted the now-removed merge-conflict property
- [x] GREEN {follow-up commit} — cross-branch-tickets.test.ts rewritten to assert detector-based catch
- [x] REFACTOR skip: docstring at ticket-writer.ts head updated to document the safety-layer shift explicitly
