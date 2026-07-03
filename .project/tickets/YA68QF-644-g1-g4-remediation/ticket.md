---
id: YA68QF
slug: 644-g1-g4-remediation
type: epic
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/644
children: ['87Y167', 'B04ADS']
created: 2026-07-03T21:21:24.625Z
last_modified: 2026-07-03T21:30:00.000Z
---

# #644 G1+G4: artifact precedence, review demand, and impl-plan timing

**Goal:** Close #644 G1 and G4 — make the PreTool artifact chain enforce precedence and review (not mere existence), and demand the impl-plan before the first line of application code (not at verify-stop).

**Why:** The #644 session audit showed the whole artifact chain satisfiable by 3 minutes of retroactive authoring — the gates' own check ordering *dictated* authoring backwards (dimensions before spec), no content review was ever demanded, and the impl-plan Stop gate fired only after implementation was complete, so it can only ever produce retroactive plans. G2 (phase provenance, ticket 0KYEBN, PR #693) made phases earned; this epic makes the artifacts within those phases earned.

## The two gaps → children

### 1. Artifact precedence + review demand — [87Y167](../87Y167-artifact-precedence-gate/ticket.md) (feature, first)

Forward creation gates (spec.md needs ticket.md; dimensions.md needs a JTBD/AC-complete spec.md), earliest-first denial ordering in the existing test-definitions.md chain, and two ALWAYS-ON content-bound review demands: a spec review stamp before scenario authoring, an independent scenario review stamp before entering implement.

### 2. impl-plan at first code write — [B04ADS](../B04ADS-impl-plan-at-code-write/ticket.md) (feature, second)

Extend the #128 implement-phase PreTool gate: a new-flow feature at implement requires a valid impl-plan.md before any application-code write. The verify-stop reconciliation gate (status must flip to `implemented`) stays.

## Design record (decided 2026-07-03, /figure-it-out; debates + premortems in child work logs)

- **D1 — precedence = forward creation gates**, not message reordering alone (fires only at scenario-write time; leaves dimensions-before-spec unpoliced) and not mtime/dwell detection (git-fragile, punishes legitimately fast work). Creation-only — edits and tickets at rest are never re-validated (G2's at-rest-tolerance posture). CLI-scaffolded tickets are safe: `safeword ticket new` scaffolds spec.md at feature birth (9EA27P).
- **D2 — review demand = two targeted always-on, content-bound demands**, not flipping the NMSD94 `reviewGate` default (violates its deliberate ship-inert ruling; wholesale per-phase Tier-2 stamps would over-block brownfield repos) and not dogfood-config-only (leaves the product gap open for the personas who can't audit diffs). Content binding follows the stale-approval-dismissal precedent (GitHub protected branches); reviewer independence mirrors "approved by someone other than the pusher". In-repo precedent for targeted always-on: the G2 phase-provenance gate.
- **D3 — impl-plan enforcement point = the #128 code-write gate**, not the phase-advance edit (redundant — first code write immediately follows the advance, and D2's scenario-review demand already gates that same edit; the code-write point also catches legacy tickets already sitting at implement).

## Sequencing

87Y167 first: it restructures the artifact-gate section of `pre-tool-quality.ts` that B04ADS's gate joins. Both children run the full BDD ladder independently (the #644 lesson: one-commit-ships-everything destroys auditability).

## Origin

Issue #644 session audit (GH628F shipped outside the intended workflow at 12+ steps). Wave 2 of the remediation; ordering agreed with the maintainer 2026-07-03 — G2 first (root cause), then G1+G4. Related: #385 (pre-edit-state gate UX, sibling of G1), #480/#481/#478 (plan-implementation phase + pre-human review gates, siblings of G4/G1 — this epic delivers the enforcement half without the new phase).

## Work Log

- 2026-07-03T21:21:24.625Z Started: Created ticket YA68QF
- 2026-07-03T21:30:00.000Z Scoped: Promoted to epic with children 87Y167 (G1) + B04ADS (G4) per user decision (epic + 2 child features, G1 first). Design record D1–D3 locked via /figure-it-out (options weighed with current evidence; GitHub stale-approval-dismissal cited for content-bound review stamps). User directed full strict BDD for both children; JTBD/AC/scope framing settled via /figure-it-out per user instruction at the intake gates.
