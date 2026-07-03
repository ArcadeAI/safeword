---
id: 87Y167
slug: artifact-precedence-gate
type: feature
phase: scenario-gate
status: in_progress
parent: YA68QF
external_issue: https://github.com/ArcadeAI/safeword/issues/644
scope: |
  Forward artifact-precedence gates in pre-tool-quality.ts with pure logic in
  a new lib/artifact-precedence.ts (mirroring 0KYEBN's structure):
  (a) spec.md creation in a ticket folder requires ticket.md in that folder;
  (b) dimensions.md creation in a feature ticket folder requires a spec.md
  that passes the JTBD + AC completeness gates (skip: escapes honored as
  today);
  (c) the existing test-definitions.md creation chain reordered
  earliest-first, so every denial names the earliest missing artifact and the
  forward next action (spec before dimensions — today's order is reversed);
  (d) ALWAYS-ON content-bound review demand at scenario authoring:
  test-definitions.md creation on a feature ticket requires a satisfying
  review stamp for spec.md at its current content (Tier-1 /self-review, or an
  auditable logged skip) — promoted from behind the reviewGate flag;
  (e) ALWAYS-ON independent scenario review demand at implement entry: a
  ticket.md edit advancing a feature into implement requires a satisfying
  review stamp for the ticket's scenarios at their current content
  (/review-spec via fresh-context reviewer, or an auditable logged skip).
  Unit tests for the pure logic, gate-level tests, Gherkin acceptance at
  features/artifact-precedence-gate.feature + steps, template<->dogfood
  parity (bun scripts/parity-check.ts).
out_of_scope: |
  - #644 G4 (impl-plan timing) — sibling ticket B04ADS
  - #644 G3 (Bash-channel bypass of write-time gates), G5 (git-side
    commit/push ties), G6 (skill-invocation reconciliation before done)
  - Flipping the NMSD94 reviewGate flag default — whole-ladder Tier-2
    phase-exit review stays flag-gated; only the two #644-proven leverage
    points go always-on
  - mtime/dwell-based retroactivity detection (git-fragile, punishes
    legitimately fast work — rejected in D1)
  - Gating features/<slug>.feature file creation — not ticket-scoped on
    disk; test-definitions.md creation is the chain's anchor point
  - Cross-model review requirements (7A0B2K crossModelReview flag unchanged)
done_when: |
  - dimensions.md creation on a feature ticket without a JTBD/AC-complete
    spec.md is denied, naming spec.md as the artifact to author first;
    spec.md creation without ticket.md is denied
  - test-definitions.md creation on a feature ticket without a spec review
    stamp at the spec's current content is denied with reviewGate off, and
    allowed once a real stamp or logged skip exists
  - a ticket.md edit advancing a feature into implement without a scenario
    review stamp at the scenarios' current content is denied, and allowed
    once a real stamp or logged skip exists
  - every denial from this chain names the earliest missing prerequisite and
    the forward next action
  - edits to existing artifacts, non-feature tickets, tasks/patches, and
    tickets at rest never trip the new gates
  - full test suite green; parity check passes
created: 2026-07-03T21:21:31.938Z
last_modified: 2026-07-03T21:35:00.000Z
---

# Artifact precedence + review demand in the PreTool chain (#644 G1)

**Goal:** Make the behavior-artifact chain enforce authoring order and content review — a feature's spec, dimensions, and scenarios must each be built on reviewed prerequisites, so retroactive box-ticking stops satisfying the workflow (#644 G1).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes. Parent epic: [YA68QF](../YA68QF-644-g1-g4-remediation/ticket.md) (shared design record D1–D3).

## Work Log

- 2026-07-03T21:21:31.938Z Started: Created ticket 87Y167
- 2026-07-03T21:25:00.000Z Found: G1 gap confirmed in code — the only artifact-creation gate anchors at test-definitions.md creation (pre-tool-quality.ts) and checks dimensions.md (line ~321) BEFORE spec.md (line ~348), which is what dictated the reversed authoring order in the #644 transcript. No gate fires on dimensions.md or spec.md creation. Both review demands exist (NMSD94 Tier-1 spec stamp at test-definitions creation; Tier-2 phase-exit stamps) but sit behind reviewGate, which is off in this repo and every customer repo by default — the #644 session hit zero review demands.
- 2026-07-03T21:30:00.000Z Decision (/figure-it-out, recorded in epic YA68QF): D1 forward creation gates (creation-only, at-rest tolerance) over message-reordering-alone and mtime detection; D2 two targeted always-on content-bound review demands (spec stamp before scenarios; independent scenario stamp before implement) over flipping the reviewGate default or dogfood-config-only. Premortems: D1 over-blocking legacy-artifact edits → mitigated by gating creation only; D2 rubber-stamping → Tier-1 is the gameable floor by design (G7 owns forgery); content-binding kills stale/cross-ticket passes.
- 2026-07-03T21:55:00.000Z Found: re-review round 3 returned BLOCK — 2 fresh must-fixes of the unpinned-qualification class: (M1) all dimensions-creation scenarios shared an incidental "at phase define-behavior" Given while the canonical flow (via the #404 readiness gate) creates dimensions.md at INTAKE — a phase-keyed gate would pass all 41 and leave the real creation point ungated; (M2) the phase_skips hatch was satisfiable by ANY reasoned entry (a residual birth skip would silently waive the scenario review). Applied both + strengtheners (AC2 demand pinned at a second phase via a scenario-gate-phase deny; the feature-source-binding allow now says "recorded for this ticket"). Now 44 scenarios, ledger 44/44 in order. Round 3 also confirmed all six round-2 fixes landed clean.
- 2026-07-03T21:50:00.000Z Found: re-review round 2 returned BLOCK — 2 must-fix: (M1) ledger-repointing dodge — nothing pinned the scenario stamp's ticket qualification, so an agent could repoint its ledger's "Feature source:" line at an already-reviewed feature file and inherit that ticket's stamp (false-allow masquerading as a real review); (M2) the "any other file (ungated)" partition had no scenario while dimensions.md claimed full coverage — an implementation gating EVERY in-ticket file creation would pass all 38 while violating "routine writes stay cheap" (would even brick sibling B04ADS's impl-plan.md creation). Applied both + all 3 strengtheners (reviewGate-off pin on the AC3 deny; explicit no-test-definitions Given on the phase_skips hatch; blank-reason jobs-skip deny at dimensions creation) + nit (ledger name mirrors feature source exactly). Now 41 scenarios; ledger 41/41 same order.
- 2026-07-03T21:40:00.000Z Found: scenario-gate independent review round 1 (fresh-context subagent, /review-spec procedure) returned BLOCK — 1 must-fix (empty-skip-reason deny scenarios absent on both review demands: an implementation accepting bare `skip:` would pass all 31 scenarios and make the always-on demand waivable at zero cost — the cheapest #644 recurrence) + 4 strengtheners (ledger-stamp impersonation of a named feature source; cross-ticket stamp reuse at identical content; 4 uncovered dimensions partitions; MultiEdit channel pinning for the AC3 gate). Applied all: 7 scenarios added (now 38 across 5 rules), dimensions.md records the two partitions deliberately routed to unit tests (pass-through payloads, reviewGate-on no-double-demand). Reviewer also confirmed AODI 31/31, ledger 1:1, lineage exact, and the surface skip valid; stamp forgery via Bash correctly out of scope (G3/G7).
- 2026-07-03T21:55:00.000Z Complete: define-behavior - 31 scenarios defined across 5 rules (one rule per AC; saved to features/artifact-precedence-gate.feature + R/G/R ledger). Count exceeds the intake estimate (~12-15) and the >15 split advisory; proceeding unsplit per the user's explicit structure decision at intake (epic + 2 children with G1 scoped whole) and the 0KYEBN precedent (31 scenarios unsplit) — the independent scenario-gate review will re-weigh. Behavioral decisions pinned while drafting: scenario-review stamp binds to the .feature source when the ledger's "Feature source:" line names one, else to test-definitions.md; a phase_skips justification covering scenario-gate satisfies the scenario-review demand (no double bookkeeping with the G2 hatch); all new gates are creation-only/transition-only. Dogfood friction for retro: the #404 readiness gate demands dimensions.md to ENTER define-behavior, though SCENARIOS.md authors it DURING define-behavior — order inversion adjacent to this very ticket's subject.
- 2026-07-03T21:45:00.000Z Complete: intake - Understanding converged, scope established. User gates: split decision answered explicitly (epic + 2 child features, recommended option); JTBD/AC/scope gates answered "/figure-it-out" — user delegated framing to the evidence-weighing process and directed full strict BDD; framing decisions recorded here and in epic YA68QF. Cold-start check not offered (recorded Reversibility: two-way door).
