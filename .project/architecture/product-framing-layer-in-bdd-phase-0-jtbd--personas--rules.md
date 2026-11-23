# Product-Framing Layer in BDD Phase 0 (JTBD / Personas / Rules)

**Status:** Accepted
**Date:** 2026-05-31

**What.** BDD intake writes one marked Product Plan for an epic or standalone feature: Product Bet → persona-anchored Jobs To Be Done and Rules → milestone Shape → Killer Demo. Child features store only stable parent references, their Contribution, and collision-safe Rules (`<parent-job>.<child-ticket-id>.R<n>`). The digest ignores formatting and covers only the selected parent job, milestone outcome and non-goals, project non-goals, and success threshold. If any of those values change, the child plan requires explicit reconciliation before crossing a phase boundary. Legacy unmarked specs remain readable and untouched.

**Why.** Engineering scope (`scope` / `out_of_scope` / `done_when`) said what to build. Product framing identifies who needs it and why, ties scenarios to verifiable criteria, and lets `safeword doctor` flag uncovered rules and orphan scenarios.

**Trade-off.** Epic intake carries the durable product decision, while child intake stays small but cannot advance on stale or dangling parent references. Formatting-only edits do not create reconciliation work.

**Alternatives.** Keep engineering-only scope (rejected: no product framing); separate product skill with handoff (rejected: skill-to-skill handoffs unreliable — same reasoning as the BDD+TDD merge above).

**Implementation.** `spec-template.md`, `child-spec-template.md`, `ticket new --parent/--parent-job/--milestone`, `ticket reconcile-parent`, phase hooks, and `skills/bdd/DISCOVERY.md`. Demand research is a separate bounded skill used only for unresolved decision-critical Why now claims. Reassess when nested epics, partial child overrides, or tracker-native milestones become supported.
