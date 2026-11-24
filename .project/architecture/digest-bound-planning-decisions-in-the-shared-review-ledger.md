# Digest-Bound Planning Decisions in the Shared Review Ledger

[Context changes that stale a review](semantically-projected-planning-review-provenance.md).

**Status:** Accepted
**Date:** 2026-09-10

**What.** The project-local review ledger records each human approval or decline of an Implementation Plan as an append-only event bound to the plan digest. Each event identifies the ticket, planning phase, exact plan digest, decision, user-authority reference, timestamp, and idempotency key.

The same ledger may retain derived `delivery-proof:v1` events that bind an executed reviewed proof to its ticket, checklist item, Proof ID, producing revision, invocation, and outcome; those events are evidence only and grant neither human approval nor merge authority. Delivery proof requires a clean contribution subject outside the ticket's Execution Plan before and after execution. It remains current across the plan-only commit that persists its receipt only while the producing revision is an ancestor and Git reports no other committed or working-tree change; the separately authenticated normalized plan identity prevents that exclusion from hiding stable plan edits.

Each writer acquires an exclusive lease-bearing lock with a monotonically increasing fencing token. It rereads the ledger under the lock and atomically replaces it only while it still owns the current token. When appending a known event, it preserves unknown events byte for byte. Unknown events grant no authority, and known receipts remain readable. Events are retained for audit, while a changed plan digest makes an earlier decision non-current.

**Why.** Approval is authority over exact reviewed bytes, not mutable ticket state. Append-only history preserves the audit trail; digest binding prevents stale approval; serialization and fencing prevent concurrent writers or stale lock holders from losing an event; compatibility rules let independently released hosts share the ledger without an unfamiliar event invalidating unrelated review evidence.

**Trade-off.** Every supported writer must honor the same locking, compatibility, and clean-subject protocol, and retained events can increase read cost. Excluding the exact Execution Plan avoids an impossible self-referential commit but requires its normalized identity and stable definition to be checked independently. Unrelated repository changes conservatively stale proof. Local filesystems lacking exclusive creation and atomic same-directory rename fail closed. Contention, stale-lease recovery, and ledger growth must remain observable assessment triggers.

**Alternatives.** Mutable ticket frontmatter (rejected: conflates workflow state and authority); overwrite one current receipt (rejected: destroys history); host-local memory (rejected: breaks project handoff); reject a ledger containing an unknown event (rejected: one extension can erase otherwise valid authority); append without fencing (rejected: a stale writer can overwrite a newer append).

**Migration.** Existing ledgers remain valid. Tickets with approval enabled but no current digest-bound decision read as pending; no backfill invents authority. During rollback, new decision events remain readable but are non-authoritative under the old phase sequence. `YCFFNC` owns coordinated activation and rollback across installed hosts.

**Implementation.** Ticket `G1C9PP` owns the consumer model, local writer protocol, current-digest lookup, and fail-closed behavior. Ticket `5F5ZZA` owns authenticated host-user-event provenance and transport. Ticket `YCFFNC` owns cross-host deployment compatibility.

**A639WN extension:** The ledger also retains `delivery-compatibility:v1`
events. Each event binds an independent compatibility judgment to the exact
delivery receipt, reason, retained definition, revision pair, request digest,
and source review. The reviewer reads the deterministic request under
`.safeword/state/reviews/requests/` as transient input in an ignored path. Only the ledger event carries durable authority for the judgment. A dedicated `delivery-compatibility`
review kind reuses the shared coordinator, integrity, routing, and verdict
machinery but owns the narrow semantic question of whether the earlier receipt
still proves its retained boundary across the supplied complete diff.
Compatibility evidence grants neither human approval nor merge authority.
