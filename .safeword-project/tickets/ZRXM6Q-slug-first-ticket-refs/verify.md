Verified: 2026-06-07T03:05:00Z

## Verify Checklist

**Test Suite:** ✓ 2493/2493 tests pass (1 skipped)
**Build:** ✅ Success (tsup)
**Lint:** ✅ Clean (eslint src tests + tsc --noEmit, exit 0)
**Scenarios:** ⏭️ Skipped — task (no test-definitions.md; behaviour covered by inline tests across the helper, CLI, and hook suites)
**Dep Drift:** ✅ Clean — no dependency changes (pure ES stdlib: template literals, `startsWith`/`slice`/`indexOf`)
**Parent Epic:** VKNF1T (siblings: 0/7 done — the rest are intake research/build tickets)
**Reconcile:** N/A — conformed to existing patterns; the lone `check.ts` dir-name split is a justified CLI-world site (cross-world sharing is the mirror-lib bloat figure-it-out rejected), recorded in the ticket

## Evidence

Slug-first ticket references ship at every surface that names a ticket:

- `ticket new` confirmation, `INDEX.md` rows, `check` coverage advisories — `formatTicketReference(id, label)` → `label (ID)`.
- Per-turn prompt hook and compaction-context hook — both read `getTicketInfo().slug` (derived once: frontmatter `slug:` ?? folder split).
- Stop-hook hierarchy-navigation "next up" message — slug-first via `getTicketInfo`.

Locked by: `ticket-reference.test.ts` (format + invariant), `ticket-sync.test.ts` (INDEX), `phase-derivation.test.ts` 1.3 + 5.1 (prompt + compact), `active-ticket-lookup.test.ts` (slug derivation), `check.test.ts` (slug-first advisory). SAFEWORD.md "Talking to the user" carries the naming rule for customers.

Reviewed three times via `/quality-review`: one missed surface found and fixed (Stop-hook bare ID), one test gap closed (advisory slug path). One acknowledged low-risk gap: the Stop-hook navigate message has no dedicated test (reuses tested `getTicketInfo.slug`).

Ready to mark done.
