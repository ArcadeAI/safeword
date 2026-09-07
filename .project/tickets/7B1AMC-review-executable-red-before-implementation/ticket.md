---
id: 7B1AMC
slug: review-executable-red-before-implementation
type: feature
phase: scenario-gate
status: in_progress
phase_anchors: ['define-behavior: .project/tickets/7B1AMC-review-executable-red-before-implementation/spec.md', 'scenario-gate: packages/cli/features/review-executable-red-before-implementation.feature']
scope: 'Trusted execution plus independent review of each distinct new or changed primary executable RED proof, with a hard freshness gate before GREEN credit'
out_of_scope: 'Reviewing every reused step, requiring one test per Gherkin row, mandating a framework, or replacing TDD review and final verification'
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
