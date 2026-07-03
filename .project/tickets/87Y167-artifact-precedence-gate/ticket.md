---
id: 87Y167
slug: artifact-precedence-gate
type: feature
phase: define-behavior
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
- 2026-07-03T21:45:00.000Z Complete: intake - Understanding converged, scope established. User gates: split decision answered explicitly (epic + 2 child features, recommended option); JTBD/AC/scope gates answered "/figure-it-out" — user delegated framing to the evidence-weighing process and directed full strict BDD; framing decisions recorded here and in epic YA68QF. Cold-start check not offered (recorded Reversibility: two-way door).
