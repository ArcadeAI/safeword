---
id: CBTDK8
slug: portable-tracker-transport
type: feature
phase: define-behavior
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
