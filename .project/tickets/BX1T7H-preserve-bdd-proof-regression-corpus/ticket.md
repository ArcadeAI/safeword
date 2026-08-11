---
id: BX1T7H
slug: preserve-bdd-proof-regression-corpus
type: task
phase: done
status: done
parent: AK0QJR
depends_on: []
relates_to: [1698, Y9P3ZC, 21RAT9]
external_issue: https://github.com/ArcadeAI/safeword/issues/2335
external_prs: [https://github.com/ArcadeAI/safeword/pull/2459]
created: 2026-08-10T07:58:17.621Z
last_modified: 2026-08-11T02:04:00Z
---

# Preserve trustworthy and hollow BDD examples for maintainers

**Goal:** Give every BDD quality mechanism a shared corpus that rejects historical false-green patterns without rejecting legitimate shared test designs.

**Why:** The exact hollow plugin BDD and its valid neighboring patterns must become durable regression evidence before Safe Word changes review or lint behavior.

## Scope

- Preserve the historical plugin false-green pattern: distinct scenarios whose steps all delegate to one umbrella suite or cached verdict.
- Add negative examples for no-op steps, feature-driven test registration, shared mutable state/order dependence, setup failures mistaken for product RED, and simulated-host checks presented as live-host evidence.
- Add paired positive examples for legitimate shared steps, Scenario Outlines/tables, scenario-local shared setup, contract tests, real CLI exit-code assertions, and reused actor adapters.
- Add paired examples from the #2328 / 0.74.7 delivery for exact ordered reviewer argv, reachable dynamic-chunk completeness and current source-map provenance, sanitized and agent-scoped host state, the full typed success tuple before content assertions, and direct process spawning versus approved fixture runners.
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
- The #2328 cases reject duplicated/reordered collaborator arguments, stale or incomplete build output, contaminated or cross-agent host state, success text inside a typed failure envelope, and unsanitized fixture-runner bypasses without rejecting their valid controls.

## Work Log

- 2026-08-10T07:58:17.621Z Started: Created ticket BX1T7H
- 2026-08-10T08:00:27Z Planned: Defined paired historical negatives and legitimate controls as the common evidence base.
- 2026-08-10T09:34:00Z Complete: Added a versioned 12-case corpus with six hollow regressions, six neighboring valid controls, a typed deterministic oracle, official Gherkin parsing, manifest/file parity, and contributor guidance. Targeted Vitest passed 6/6; ESLint, TypeScript, Prettier, and diff checks passed.
- 2026-08-10T11:46:37Z Reopened: New #2328 / 0.74.7 evidence adds five paired corpus dimensions not covered by the initial 12 cases: exact argv, complete build freshness, sanitized/scoped host state, typed outcome ordering, and fixture-runner boundaries.
- 2026-08-10T12:02:00Z Implemented: Expanded the corpus from 12 to 22 cases with paired reject/control evidence for all five #2328 dimensions; verification remains in progress under the repository's single-Vitest lock.
- 2026-08-10T12:07:00Z Verified: Targeted corpus contract passed 7/7 after honoring the cross-worktree Vitest lock; loader-level 22-case check, official Gherkin parsing, manifest/file parity, ESLint, TypeScript, Prettier, and diff checks all passed. Awaiting user confirmation before marking done.
- 2026-08-10T12:16:00Z Quality review requested changes: added explicit entrypoint existence/freshness to the complete-build control, seeded and excluded hostile host/agent state in the isolation control, removed a tautological self-verdict assertion, and documented that future consumer tickets own classifiers while production runtime stays independent of test fixtures. Reviewer independence was degraded because Claude was unavailable.
- 2026-08-10T12:31:00Z Re-review still requested changes: the corpus stores illustrative Gherkin/proof source and expected labels but does not execute the steps, classify proof fidelity, or drive real collaborators. Closing that gap would require runnable paired trials and a semantic oracle, which conflicts with this ticket's stated exclusion of reviewer/detector/mutation-runner implementation. Ticket remains in progress pending a scope decision. Review independence remained degraded after Claude timed out and Codex fallback reviewed the packet.
- 2026-08-10T12:55:00Z Attempted the authorized bounded semantic harness, then removed it after re-review showed it selected synthetic observations by case ID without executing the supplied proofs or real collaborators. Retained the valid review fixes (complete entrypoint freshness evidence, hostile host-state seeding, non-tautological oracle tests, and explicit consumer boundary). A trustworthy next implementation must make the case proofs themselves runnable and connect the #2328 controls to real boundaries.
- 2026-08-10T13:19:07Z Implemented the requested quality improvements: converted all 22 stored proofs into runnable Cucumber fixtures, added clean-baseline and injected-defect executions, derived reference verdicts from observed scenario outcomes, and connected the #2328 controls to the real reviewer argv, reviewer environment, typed CLI result, build filesystem, and CLI entrypoint boundaries. Focused verification passed 10/10 alongside ESLint, TypeScript, and Prettier. Awaiting final quality re-review and user confirmation before marking done.
- 2026-08-10T16:36:13Z Addressed the next quality-review findings: made empty or interrupted Cucumber reports fail closed; required a built CLI; changed the build control to inspect the real entrypoint, imported chunks, and current Git HEAD time; routed fixture execution through a dedicated sanitized/scoped runner; and changed the CLI, contract, and actor controls to invoke their real collaborators. The preferred Claude reviewer timed out, so the findings came from a degraded-independence Codex fallback. Focused corpus verification passed 8/8; final gates and re-review remain.
- 2026-08-10T17:41:44Z Tightened the remaining overclaims after re-review: build provenance now validates the emitted JavaScript graph and compares source-map contents to the current source tree; the real-CLI control now claims and observes unknown-command/help behavior; the shared actor example claims adapter-contract evidence rather than live installation; and the fixture runner proves its sanitized child environment and requested host scope through a subprocess probe before invoking the CLI. Corpus verification passed 8/8, formatting/lint/typecheck passed, and diff checks passed. The final coordinator result was interrupted before its buffered verdict could be recovered; ticket remains in progress and is not marked done.
- 2026-08-10T18:06:20Z Final review attempt: both coordinator routes timed out (`REVIEW_ROUTES_EXHAUSTED`, policy `prefer`, independence `none`). The required finish-review fallback returned `request_changes` because its fresh context reported that target contents and proof artifacts were unavailable for assessment; this is a review-environment limitation rather than a new implementation finding, but remains action-required supplemental feedback and no independent approval is claimed. Objective verification passed: build, TypeScript, ESLint, focused corpus and review-contract suites (10/10), and diff checks. Ticket remains in progress pending user confirmation and disposition of the unavailable-review limitation.
- 2026-08-10T20:02:24Z Full verification: ran the authoritative unit/integration, BDD, build, typecheck, lint, formatting, and dependency gates. Fixed a reproducible hermeticity defect where the native-plugin lifecycle fixture leaked the developer's real Codex executable/profile; it now uses the existing fake Codex runtime and the focused scenario passes 43/43 steps. The remaining two Vitest and four Vitest-backed BDD timeouts occurred under concurrent cross-worktree lock contention and are recorded as local evidence limits in verify.md.
- 2026-08-10T20:04:39Z Audit passed: diff-scoped architecture, dependency, learning, changed-test quality, configured documentation, principle-trace, domain-document, and whitespace checks reported no actionable findings.
- 2026-08-10T21:59:08Z Quality-review improvements: upgraded the corpus to schema v2; modeled setup failure as an actual failing Before hook; required Cucumber exit/report consistency; added five independent build defects; made source-map coverage fail closed with explicit virtual-source and zero-source-facade accounting; and recursively validated resolvable JavaScript artifacts reachable from the CLI entrypoint. Corpus tests pass 8/8 and the two previously timed-out CLI files pass 96/96. A four-proof relay rerun waited the full 20-minute shared-lock limit and exited before starting, so that evidence remains locally limited.
- 2026-08-10T23:49:23Z Completed the requested quality and refactor improvements: added exact argv mutation modes; AST-based emitted-module discovery; fail-closed unresolved edges, source-map and facade mutations; explicit wrong-stage RED rejection; manifest validation; per-run temp cleanup with crash leftovers isolated beneath the ignored dependency cache; proof syntax checks; fixture-runner self-validation; explicit timeouts; and reusable report-classification helpers. Final focused corpus verification passes 9/9. Prettier, ESLint, Gherkin lint, TypeScript, diff checks, and dependency audit pass with no vulnerabilities. The earlier full-lane cross-worktree timeout evidence limits remain recorded; ticket stays in progress pending explicit user confirmation.
- 2026-08-11T01:56:04Z Full red-team/refactor pass: made defect tags injective through safe IDs, derived the parent timeout from the per-proof budget, resolved paths from the package rather than cwd, isolated temp files under an ignored package test directory, removed accepted-fixture global environment mutation, allowlisted lifecycle-fixture environment inputs, rejected signaled child processes, and guarded malformed manifest shapes. Full units passed 7,196/7,196. Full BDD passed 1,483 scenarios, skipped 3, and had three load-sensitive failures; all three passed together in isolation (3/3 scenarios, 133/133 steps). Customer runtime exposure is none because corpus/tests are excluded from the published package; remaining risk is moderate release-confidence brittleness from the long, process-heavy BDD lane.
- 2026-08-11T02:00:00Z Done: User accepted the delivery and requested publication. Final independent review found no actionable correctness or customer-brittleness findings; proceeding to commit and pull request.
- 2026-08-11T02:04:00Z Published: Opened draft pull request https://github.com/ArcadeAI/safeword/pull/2459 from `codex/trustworthy-bdd-corpus`.
