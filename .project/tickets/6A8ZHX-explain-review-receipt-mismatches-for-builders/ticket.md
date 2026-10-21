---
id: 6A8ZHX
slug: explain-review-receipt-mismatches-for-builders
type: task
phase: implement
status: in_progress
created: 2026-10-21T15:45:34.972Z
last_modified: 2026-10-21T15:45:34.972Z
---

# Explain review receipt mismatches for builders

**Goal:** Identify wrong-kind planning review receipts and give the correct recovery action without admitting them or weakening current review gates.

**Why:** The #5086 delivery preserved an R9 diagnostic gap: a wrong-kind receipt fails closed without naming the mismatch.

**Category:** Bug

**Scope:** Diagnose authenticated Execution Plan receipt claims whose recorded review kind or ticket differs from the current gate. Keep one concrete re-review command for the current ticket, with no new approval authority.

**Out of Scope:** Admission-policy changes, reviewer routing, credential transport, R7 native retrieval/private-injection proof, #5139 scope enforcement, sibling-owned non-technical recovery copy, broad parent closure, paid qualification, merge and destructive cleanup.

**Done When:**

- [ ] The public execution-prerequisite command identifies the actual and required review kind for an otherwise-current wrong-kind receipt.
- [ ] An authenticated sibling-ticket receipt over identical plan bytes names the ticket mismatch and re-review for the current ticket.
- [ ] Genuine current matching receipts still satisfy the prerequisite, and unrelated invalid claims cannot displace an existing valid receipt.
- [ ] Missing, stale and unauthenticated receipts retain fail-closed behavior without invented authenticated provenance.
- [ ] Every mismatch recovery requests plan-execution for the current ticket. With no applicable receipt, diagnose the newest current authenticated mismatch; if one receipt mismatches both kind and ticket, name the kind first. A valid current matching receipt retains precedence over mismatched claims in either ledger order.
- [ ] Targeted regression checks, derived surfaces, scoped audit and independent review pass; verification records failures and limits.

**Tests (TDD):**

- [ ] RED: real CLI creates authentic receipts with a fake external reviewer; wrong-kind and sibling-ticket claims fail at the actor-visible mismatch assertions while refusal and the exact recovery command remain required.
- [ ] GREEN: preserve receipt validation and candidate selection, exposing mismatch diagnosis only when no applicable receipt is admitted.
- [ ] PROTECT: matching receipt, valid receipt with invalid claims in either order, multiple mismatches in both orders, a receipt mismatching both kind and ticket, missing and stale controls, and tampered wrong-kind/sibling receipts whose unauthenticated fields must never produce mismatch diagnostics.
- [ ] REFACTOR: inspect the bounded change and retain one owner for admission and its diagnostic result.

**Principle consequence:** Preserve the natural admission gate and expose one concrete next action. Tests prove emitted diagnostic mechanics; no claim of non-technical comprehension or native host isolation is made.

## Work Log

- 2026-10-21T15:45:34.972Z Started: Created ticket 6A8ZHX
- Intake reviews 88ead5d8 and 0e25d726 approved independently through Claude; the final authenticated intake stamp was recorded. Ordering means existing ledger append order, not timestamps. Stale receipts never supply mismatch diagnostics. These clarify the existing bounded task rather than broadening admission or sibling-owned copy.
- A multi-hunk ticket edit was safely refused without changes; three exact single-hunk edits applied the intake suggestions. This failure is retained rather than attributed to production behavior.
- RED: the real public CLI positive control passes with a genuine current review. Both identity regressions fail exactly at the missing mismatch diagnostics (2 failed /1 passed); they currently emit missing_admitted_delivery_checklist. No receipt was fabricated or re-signed; only reviewer executables are faked, and negative ledger claims are deliberately untrusted.
- GREEN: 3/3 primary tests pass. The expanded protection run initially passed 37 with one fixture-only duplicate target/context refusal; the fixture now selects kind-appropriate context without changing assertions. All 38 checks then passed, including 17 identity cases. A subsequent 38/38 run also asserts every terminal receipt JSON is byte-for-byte unchanged, alongside ticket and ledger bytes.
- All three package typechecks passed; all five derived surfaces were regenerated and verified. Diff-scoped audit at base 9f6ac6fce found no dependency violations (56 modules /86 dependencies); learnings, principle traces and domain checks had no findings. Repository-wide clone/dependency-freshness discovery was intentionally excluded.
- Independent Claude review 31c51fd9 approved the source and tests. Its duplicate receipt-load warning will be applied as one protected refactor. Same-level sibling diagnosis matches the existing ticket resolver's supported directory model; nested/archived targets retain generic fail-closed recovery. Active-job status cleanup is pre-existing in reviewData, not introduced by this slice; it remains outside this terminal-receipt diagnostic change. The command-module repair-code re-export is present, and no unrelated import cleanup is needed.
