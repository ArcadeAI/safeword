---
id: BX1T7H
slug: preserve-bdd-proof-regression-corpus
type: task
phase: intake
status: in_progress
parent: AK0QJR
depends_on: []
relates_to: [1698, Y9P3ZC, 21RAT9]
external_issue: https://github.com/ArcadeAI/safeword/issues/2335
created: 2026-08-10T07:58:17.621Z
last_modified: 2026-08-10T08:00:27Z
---

# Preserve trustworthy and hollow BDD examples for maintainers

**Goal:** Give every BDD quality mechanism a shared corpus that rejects historical false-green patterns without rejecting legitimate shared test designs.

**Why:** The exact hollow plugin BDD and its valid neighboring patterns must become durable regression evidence before Safe Word changes review or lint behavior.

## Scope

- Preserve the historical plugin false-green pattern: distinct scenarios whose steps all delegate to one umbrella suite or cached verdict.
- Add negative examples for no-op steps, feature-driven test registration, shared mutable state/order dependence, setup failures mistaken for product RED, and simulated-host checks presented as live-host evidence.
- Add paired positive examples for legitimate shared steps, Scenario Outlines/tables, scenario-local shared setup, contract tests, real CLI exit-code assertions, and reused actor adapters.
- Give review, heuristic, evaluation, and falsification work one versioned corpus and expected verdict format.

## Out of Scope

- Implementing the reviewer, detector, or mutation runner.
- Declaring every reused step or helper suspicious.
- Encoding project-specific framework style as a universal BDD rule.

## Done When

- Every corpus case names the behavior it should accept or reject and why.
- The exact historical false-green implementation fails the corpus oracle.
- Legitimate neighboring designs pass, including shared steps and table-driven scenarios.
- Corpus consumers can run the fixtures deterministically without external services.
- Adding a new regression requires a minimal failing and neighboring valid example.

## Work Log

- 2026-08-10T07:58:17.621Z Started: Created ticket BX1T7H
- 2026-08-10T08:00:27Z Planned: Defined paired historical negatives and legitimate controls as the common evidence base.
