---
id: 7B1AMC
slug: review-executable-red-before-implementation
type: feature
phase: scenario-gate
status: in_progress
phase_anchors: ['define-behavior: .project/tickets/7B1AMC-review-executable-red-before-implementation/spec.md', 'scenario-gate: packages/cli/features/review-executable-red-before-implementation.feature']
scope: 'Trusted execution plus independent review of each distinct new or changed primary executable RED proof, with a hard freshness gate before GREEN credit'
out_of_scope: 'Reviewing every reused step, requiring one test per Gherkin row, mandating a framework, replacing TDD review and final verification, adding a new recovery-command API, or duplicating existing host install/reconciliation/tamper contracts'
done_when: 'A trusted execution attestation and fresh independent review prove the intended missing behavior fails for the right reason at the actor boundary, and every supported agent host blocks GREEN credit when that evidence is missing, stale, fabricated, or for the wrong proof'
parent: AK0QJR
depends_on: [BX1T7H]
relates_to: [NMSD94, QZAFT2, 1698, BFCWDB, ZA0JQR, Y9P3ZC]
external_issue: https://github.com/ArcadeAI/safeword/issues/2336
created: 2026-08-10T07:58:17.735Z
last_modified: 2026-08-10T08:00:27Z
---

# Stop hollow acceptance proofs before implementation

**Goal:** Require an independent review of each new or changed primary executable RED proof before production implementation begins.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-10T07:58:17.735Z Started: Created ticket 7B1AMC
- 2026-08-10T08:00:27Z Planned: Scoped a lightweight independent RED receipt with explicit freshness and reuse rules.
- 2026-09-06T20:45:24Z Decided: User explicitly chose blocking enforcement; trusted execution and independent semantic review must gate GREEN credit across supported hosts.
- 2026-09-06T20:54:00Z Drafted: Derived 10 behavioral dimensions and 14 scenarios across seven Rules, including happy, rejection, freshness, tampering, recovery, reuse, and host-parity boundaries.
- 2026-09-07T04:32:36Z Confirmed: User accepted the 14-scenario blocking contract and directed publication of the issue and work-so-far pull request.
- 2026-09-07T05:00:00Z Scenario review: Independent Claude review requested changes for an uncovered unexpected-pass result, unproved review independence, and non-discriminating blocker messages; it also identified identity, interruption, host-admission, shared-state, fallback, and plain-language gaps.
- 2026-09-07T05:06:00Z Revised: Expanded the blocking contract to 19 scenarios, made both host directions symmetric, split every material freshness input, and fixed independent-review unavailability as fail-closed for GREEN credit.
- 2026-09-07T05:23:00Z Scenario re-review: Independent Claude review found the before-implementation ordering was still asserted but not falsifiable, plus host-wiring, deterministic-language, surface-tag, Rule-ownership, and forged-receipt gaps.
- 2026-09-07T05:28:00Z Revised: Expanded to 21 scenarios with an exact captured-state temporal rejection and forged-receipt rejection; bound both host outcomes to named entrypoints and evidence classes; made plain-language and Rule ownership assertions deterministic.
- 2026-09-07T05:38:00Z Scenario re-review: Independent Claude review found contradictory plain-language command placeholders, missing provenance Rule ownership, incomplete packet enumeration, and residual interruption, identity, observable, shared-state, progressive-disclosure, and installation-wiring partitions.
- 2026-09-07T05:39:00Z Revised: Expanded to 26 scenarios across nine Rules; gave provenance its own Rule, enumerated every packet input, standardized evidence classes, bound installation plus enforcement per host, and made plain-language recovery commands literal and technically inspectable.
- 2026-09-07T05:44:00Z Scenario re-review: Independent Claude review found ambiguous packet alternatives, one non-runnable recovery string, unproved public recovery commands, and install/reconcile, evidence-class, degraded-review, persona, distinct-proof, and missing-gate gaps.
- 2026-09-07T05:45:00Z Revised: Expanded to 32 scenarios across ten Rules; made all recovery commands runnable and behaviorally covered, split install from reconciliation and fail-open detection, made evidence class observable, and bound packet contents by scenario/Rule scope without alternatives.
- 2026-09-07T05:50:00Z Scenario re-review: Independent Claude review found declared evidence could echo without matching execution, reviewer recovery joined opposite outcomes, and absent/unrecognized gate defects were not independently forced; it also requested an incomplete-packet rejection and exact Rule lineage.
- 2026-09-07T05:52:00Z Revised: Expanded to 35 scenarios across ten Rules; split recovery success/failure, forced absent and unrecognized host defects separately, rejected declared/observed environment mismatch and incomplete packets, and aligned numbered Rule text with the spec.
- 2026-09-07T05:56:00Z Scope correction: User explicitly rejected bloat, over-hardening, and scope creep. Removed the speculative recovery-command API and duplicate host install/reconcile/tamper scenarios; retained the core trusted RED, independent right-reason review, freshness, provenance, packet, plain-language, reuse, and shared host-boundary contract.
- 2026-09-07T06:02:00Z Scenario review after scope correction: Independent Claude review found the eight host rows could still be satisfied by labels without real wiring. Chose the reviewer's surgical option: prove the shared block/permit boundary once, tag all surfaces, and explicitly delegate per-host invocation to existing parity/schema contracts.
- 2026-09-07T06:04:00Z Revised: 26 scenarios across eight Rules; added only the authentic-provenance positive, made incomplete packet classes discriminating, clarified structured TBU verdicts versus NTB copy, and aligned Rule lineage. Rejected re-expanding install/reconcile/recovery-command scope.
- 2026-09-07T06:09:00Z Final review: Independent Claude review found one remaining false-green path: the NTB message could say “run the displayed command” without displaying one. Bound command presentation directly in the existing outline, made packet-member names discriminating, corrected the reuse trigger, and added one authentic cross-proof replay rejection.
