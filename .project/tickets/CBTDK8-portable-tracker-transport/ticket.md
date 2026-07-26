---
id: CBTDK8
slug: portable-tracker-transport
type: feature
phase: verify
phase_anchors:
  - intake: e1c4733
  - define-behavior: 35b4b81
  - scenario-gate: f1a97fb
  - plan-implementation: b5983b6
  - implement: 65d3e61
  - verify: 65d3e61
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
- 2026-07-25T00:55:00.000Z implement: slices 1-2 GREEN — contract.ts (SyncPlan/Intent/SyncResults types), plan.ts computePlan (create 2e1d42c; update/close/reconcile fold 4b5fc89). NOTE process: slices 1-2 committed RED+GREEN in one commit each (ledger flags the SHA collision — reconcile before done, e.g. annotate as a logged deviation since work is green); slices 3-4 commit RED and GREEN separately (fixed).
- 2026-07-25T01:35:00.000Z implement: slices 3-4 GREEN. Slice 3 (load-bearing) — plan-side graph edges by corpus membership; extracted aliasMap+resolveTicketReference into ticket-references.ts (shared); gh path preserved (99 tracker-sync tests green). RED afb5108 / GREEN a3a92a9. Slice 4 — apply-results.ts + contract.parseResults: fold create results (recorded number+url), idempotent, update/close ack, malformed rejection incl. url-tail!=number internal-id guard; round-trip. RED 0cac69f / GREEN b73d7a4 / round-trip ff90189. 20 new unit tests pass; typecheck clean.
- REMAINING = slice 5 ONLY (task #5): wire --plan/--apply-results into commands/sync-tracker.ts + cli.ts. Needs: --plan writes SyncPlan JSON to stdout ONLY (no log/diagnostic lines) via computePlan(readCorpus, loadTrackerMap); --apply-results <file> reads file (ENOENT = "absent from disk" malformed case) → parseResults → applyResults(map, results, {provider, ticketIds=corpus ids}) → map.save(); mutually exclusive (both flags → error); no-flag routes to existing gh syncTracker unchanged; --plan/--apply skip the credential gate (offline); egress minimal by default. WIRING tests through syncTrackerCommand (real command, mock only fs/process boundary): --plan stdout purity + --apply read→apply→save-to-disk. ALSO add the "a create result missing the issue url" example to features/portable-tracker-transport.feature malformed outline (was blocked by phase lock during planning; now in implement it can be edited). Then mark cross-scenario ledger row + reconcile slices 1-2 SHA collisions.
- 2026-07-24T17:57:21.127Z Phase: define-behavior → scenario-gate
- 2026-07-24T23:03:54.908Z Phase: scenario-gate → plan-implementation
- 2026-07-25T00:11:37.715Z Phase: plan-implementation → implement
- 2026-07-25T14:32:35.247Z Phase: verify → done
- 2026-07-25T14:40:00.000Z Complete: implement — 5 slices GREEN (contract, computePlan fold, plan-side graph edges, apply-results, command wiring); 24 new tests; gh path preserved. Full suite 5378 passed (1 unrelated root-perms failure excluded).
- 2026-07-25T14:45:00.000Z Complete: verify + audit — verify.md written (all gates green); /audit passed (depcruise 0 errors, config in sync, knip cleaned). → done.
- 2026-07-25T14:49:40.686Z Phase: done → verify
- 2026-07-25T14:46:00.000Z Re-opened (done → verify): the earlier done was premature — verify/audit were run partially (shortcut the canonical test-plan block + full-repo lint; skipped jscpd/outdated/docs/domain/test-quality), and /quality-review on the implementation code + /refactor were not run. Running all four properly before re-closing.
- 2026-07-25T15:16:00.868Z Phase: verify → done
- 2026-07-25T15:20:00.000Z Complete: verify (2nd pass, all four gates genuinely run). /quality-review on the SHIPPED CODE by an independent fresh-context reviewer → APPROVE, no critical bugs (fold traced across all 6 state combinations; stdout purity confirmed); its 7 findings applied as the /refactor + hardening pass (8d57cb9): urlTail strips query/fragment, identity guard provider-gated to github + numeric `number`, rejectReason extracted, 6 test gaps closed. Full /verify: 5384 passed / 7 skipped, full-repo lint clean (eslint + gherkin + tsc, zero output), builds green. Full /audit: depcruise 0 errors, config in sync, knip clean, jscpd 0 clones, outdated = eslint dev/patch only, docs updated (ab2f576) + site builds. impl-plan reconciled → implemented (27699d5). Two behaviors that emerged during hardening were added as scenarios (terminal-never-synced create-closed; corrupt-sidecar refusal) → 21 scenarios, 0 unchecked. → done.
- 2026-07-26T00:26:00.000Z Complete: verify (3rd pass — PR review round). All four skills genuinely run on this round's code. /quality-review returned REQUEST CHANGES with 3 critical issues, each verified by executing probes: C3 computePlan used corpus order while the live path sorts topologically (a v1 one-way-door contract silently pushing a topological sort onto every executor) — fixed by sharing orderTicketsForProjection via ticket-references; C1 the parity suite compared Sets with no cardinality assertion, so extra/dropped intents passed green — now asserts length + order; C2 projectGraph recorded nothing and the fixture had no edges — now recorded and asserted, with the deliberate self-edge divergence named. /refactor: 9 applied, 11 rejected as churn. Also: reconcile arm covered, full-vs-minimal body content pinned (a silent egress downgrade previously passed every test). Every fix mutation-verified. Full suite 5469 passed / 7 skipped (1 known container-root failure in hooks/self-report, outside this diff); lint + gherkin + typecheck clean; depcruise 0 errors; knip clean. Caught up to main (703760e). → done.
