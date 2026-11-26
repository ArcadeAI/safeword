# Separate Implementation and Execution Planning Gates

**Status:** Accepted
**Date:** 2026-09-10

**What.** Feature work has two separately reviewed plans. Implementation Planning records the architecture, data, interface, operations, rollout, rollback, and proof-scope decisions that shape behavior in the project's `impl-plan.md`. Execution Planning turns the approved decisions into TDD slices an agent can start and PRs a reviewer can assess independently in `execution-plan.md`.

**Why.** People can review the approach in a focused meeting. The execution plan then gives an agent the sequence it needs to build it without making new design decisions.

**Trade-off.** The workflow gains one public phase and one artifact. Phase transitions, review receipts, migration, and every installed host must agree on the added state.

**Alternatives.** Keep one mixed plan (rejected: execution detail obscures design decisions); keep two files in one phase (rejected: the boundary is not observable or consistently enforceable); make Execution Planning an agent-private artifact (rejected: it cannot support durable handoff or review).

**Implementation.** The canonical phase model inserts `plan-execution` between `plan-implementation` and `implement`. Each phase has its own author/reviewer contract and requires a current review. Significant decisions are linked here before Implementation Plan approval. The planning edit freeze narrowly permits the configured, project-owned architecture record so this requirement is satisfiable; code and ordinary documentation remain frozen.

This decision supersedes the transition and six-section artifact portions of
the 2026-07-09 “plan-implementation: a gated planning phase as the Automation
on-ramp” decision. It preserves that decision's rationale, project-local
authority, and content-hash review history.
