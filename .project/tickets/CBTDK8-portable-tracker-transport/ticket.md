---
id: CBTDK8
slug: portable-tracker-transport
type: feature
phase: implement
phase_anchors:
  - intake: e1c4733
  - define-behavior: 35b4b81
  - scenario-gate: f1a97fb
  - plan-implementation: b5983b6
status: in_progress
epic: offboard-local-ticketing
parent: KKNFZA
scope:
  - "sync-tracker --plan: compute the deterministic create/update/close intents (local tickets diffed vs the tracker-map) and emit them as JSON; no network I/O"
  - "sync-tracker --apply-results <file>: fold an executor's results into the tracker-map idempotently, recording the bare issue number + url; reject a malformed results file with an actionable error, never corrupting the map"
  - a declared, versioned intent/result JSON contract (the plan↔executor boundary), documented so an executor can be written against it alone
  - the agent (via its own GitHub access, e.g. MCP) is executor #1 — proven manually end-to-end; no packaged automation
  - the plan and executor reproduce the graph edges the gh path projects today (parent + blocked-by), so an agent-applied mirror matches gh's output, not a lesser subset
  - the existing gh executor path preserved unchanged and still the default when gh is present (additive seam)
out_of_scope:
  - token+REST CI executor — the "bot" co-executor (immediate follow-on child)
  - packaged/automated agent-executor orchestration (this ticket exposes the seam; driving the loop is separate)
  - Linear executor; label-rejection hardening (not-yet-existing label rejected on create)
  - status/phase home, churn removal, INDEX retire (other KKNFZA children)
done_when:
  - "sync-tracker --plan emits the same create/update/close set the gh path would act on, computed with zero network calls (proven offline in tests)"
  - "sync-tracker --apply-results <file> records bare number + url into the map; re-applying the same file is a no-op; a malformed file errors without corrupting the map"
  - the plan carries parent + blocked-by edges by ticket id; an executor creates-then-links (resolving ticket id → issue number after creates land) and reproduces the same links the gh path sets
  - the gh executor path is byte-for-byte unchanged; full suite green with no live tracker
created: 2026-06-29T02:29:45.594Z
last_modified: 2026-06-29T02:29:45.594Z
---

# Environment-portable tracker transport (plan + pluggable executor)

**Goal:** Make `sync-tracker` work in any environment by computing a network-free sync **plan** and letting a pluggable **executor** (agent via MCP, CI via token+REST, dev via `gh`) apply it — instead of hard-wiring the `gh` binary.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-29T02:29:45.594Z Started: Created ticket CBTDK8
- 2026-06-30T00:50:00.000Z Complete: intake — scope converged; cold-start check run (INSUFFICIENT → contract pinned); graph-edge fork decided B (link them); dimensions.md authored. → define-behavior
- 2026-07-24T17:50:00.000Z Re-homed onto current main (old branch claude/ticketing-migration-safeword-m73r9p / PR #548 superseded by #1086; this ticket + design already on main). define-behavior: 16 scenarios across 7 rules saved to features/portable-tracker-transport.feature (@wip; proof via vitest units) + test-definitions.md ledger. Dangling edge → omit silently; no-token-in-plan guard kept. Paused before scenario-gate review.
- 2026-07-25T00:09:00.000Z Complete: scenario-gate — inline + independent review → 19 scenarios (3 must-fix caught: vacuous dangling-edge, missing --plan-stdout wiring, unfalsifiable no-flag-unchanged); review stamped. → plan-implementation.
- 2026-07-25T00:09:30.000Z Complete: plan-implementation — impl-plan.md (status planned); TWO independent plan reviews. Round 1 (REQUEST CHANGES) fixed MF1 buildGraphProjection-is-executor-side (compute edges plan-side by corpus membership), MF2 planTicketSync is create/update/RECONCILE not close (documented the fold), MF3 number-as-string + require url. Round 2 caught N1: close intent must carry full payload+graph (gh path has no field-less close, index.ts:220,232) — fixed; N2 ref.number string pinned. Review stamped. → implement.
- 2026-07-25T00:55:00.000Z implement: slices 1-2 GREEN — contract.ts (SyncPlan/Intent/SyncResults types), plan.ts computePlan (create 2e1d42c; update/close/reconcile fold 4b5fc89). 5 unit tests pass. NOTE process: slices 1-2 committed RED+GREEN in one commit each (ledger flags the SHA collision) — future slices MUST commit RED and GREEN separately. REMAINING: slice 3 graph edges by corpus membership (load-bearing; extract aliasMap/resolveTicketReference/orderTicketsForProjection to a shared module, leave buildGraphProjection on the gh path, keep gh byte-for-byte); slice 4 apply-results.ts (fold + malformed incl. missing-url which still needs adding to the .feature outline); slice 5 wire --plan/--apply-results into commands/sync-tracker.ts + cli.ts (stdout contract, mode routing, mutual-exclusion, offline, egress, wiring tests). Banked at context limit — resume fresh.
- 2026-07-24T17:57:21.127Z Phase: define-behavior → scenario-gate
- 2026-07-24T23:03:54.908Z Phase: scenario-gate → plan-implementation
- 2026-07-25T00:11:37.715Z Phase: plan-implementation → implement
