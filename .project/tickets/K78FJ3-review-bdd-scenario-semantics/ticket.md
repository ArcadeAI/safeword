---
id: K78FJ3
slug: review-bdd-scenario-semantics
type: task
subtype: bug-investigated
phase: intake
status: in_progress
created: 2026-08-11T15:57:40.154Z
last_modified: 2026-08-11T15:57:40.154Z
---

# Strengthen behavior proof for Safeword users

**Goal:** Review every shipped BDD scenario against the scenario-gate rubric and record actionable findings.

**Why:** The existing suite passes structurally, but every scenario needs an adversarial semantic review for vacuity, observability, determinism, and wiring.

## Root Cause

The observable-review feature claimed that long reviews remain visibly active,
but no scenario pinned heartbeat emission to its interval or required a second
heartbeat while work remained incomplete. The implementation already schedules
each heartbeat after 30 seconds and rearms it, but the scheduler unit test only
executed the first callback and the repeating integration test was absent from
the feature's proof map. That proof-wiring omission allowed an immediate,
one-shot heartbeat counter-implementation to satisfy the written scenarios.

Confirmed by tracing `createProgressReporter` through its injected scheduler and
comparing the feature proof map with the existing repeating-heartbeat integration
test. Ruled out: an immediate product emission, because the scheduler records a
30-second delay before the first callback; a non-repeating implementation,
because the callback schedules the next interval and the integration test sees
multiple heartbeats; and a cancellation defect, because completion removes both
pending handles before the controlled scheduler is flushed.

## Work Log

- 2026-08-11T15:57:40.154Z Started: Created ticket K78FJ3
- 2026-08-12T00:03:03Z Semantic review started with the 32-scenario reliable-review packet. Direct scenario-gate review found `reliable-reviews-for-real-packets.TBU1.R2` was vacuous: a default-only timeout implementation satisfied its former `Then`. During the subsequent `main` sync, upstream's elapsed-window proof superseded the local rewrite and was retained. The active BDD lane passes. The prescribed independent coordinator route is still pending, so this packet is not yet marked complete.
- 2026-08-12T00:06:03Z This session could not capture a typed coordinator result or persisted review receipt from the prescribed independent route. It is not accepted as independent-review evidence; the packet remains in progress. Parser-backed Gherkin lint is healthy after the deadline-scenario correction.
- 2026-08-13T05:04:43Z Synced through Safeword 0.76. The old 134-scenario offload monolith is now sixteen explicit-`@wip` sources (136 scenarios), so its historical row was retired from the active review packet. Direct review of the two new active sources found no scenario-gate defect: every closeout scenario maps to a named Vitest proof, while the GitHub live-smoke feature remains an honest `@wip` implementation contract.
- 2026-08-13T05:04:43Z Completed the refreshed offload structural pass: one Rule per split source, explicit `@wip` delivery state for all 136 scenarios, rejection coverage for every Rule, and no non-claim `Then` matches. Semantic adversarial review remains pending per scenario.
- 2026-08-13T05:50:04Z Direct semantic review completed for the 23-scenario `offload-tests-workflow-security` Rule. No scenario-gate defect found: redirect, durability, entropy, hostile-path, workflow-identity, least-privilege, secret-channel, and immutable-dependency boundaries have explicit observable outcomes. Its two `@proof.pending-vitest` rows remain correctly non-delivered.
- 2026-08-13T05:50:39Z Direct semantic review completed for the nine-scenario `offload-tests-trusted-workflow-evidence` Rule. No scenario-gate defect found: it distinguishes preflight fallback from post-acceptance integrity failure, rejects byte normalization and configuration redefinition, freezes accepted authority, and guards credential channels across the dispatch race.
- 2026-08-13T14:57:28Z Synced through Safeword 0.77 and rebuilt the inventory: 110 feature sources, with nine added or materially changed sources (227 scenarios) placed in a fresh-review queue rather than inheriting historical ledger status. Direct semantic review completed for the five-scenario `durable-independent-review` source: its real detached-CLI proof covers inline completion, durable collection after caller exit, source/context staleness, cancellation precedence, worker-exit failure, and malformed-record rejection. No scenario-gate defect found; independent evidence remains pending.
- 2026-08-15T00:42:33Z Corrected the durable-review evidence after recovering its persisted coordinator result: independent Claude review returned changes requested, not an unavailable route. It found missing terminal failure, cancellation-finality, observable Claude/Codex surface, source-binding, timing-boundary, durable-store integrity, and handle-usability coverage. Synced through 0.78.1: the tracked corpus is now 111 sources; five new or changed sources (171 scenarios, overlapping the prior refresh where applicable) were added to the pending review queue.
- 2026-08-15T03:54:42Z Repaired the durable-review scenarios against the recovered findings: explicit terminal worker failure, usable pending handle, one-invocation collection, positive and unrelated-source binding, signed-record rejection, cancellation termination/finality, and unknown-ID rejection; dropped unsupported agent-surface tags. The earlier focused durable-job proof passed (33 tests) and Gherkin lint is healthy. A subsequent independent review `b4800890-eac8-4d7f-8575-cad75ce6797e` returned changes requested; this repair addresses those findings, with focused CI and a new independent review still required before approval.
- 2026-08-15T04:48:05Z The fresh independent review `4aff7d44-cf3e-4c8a-905d-7d183b1e7c31` also returned changes requested: status needed malformed/unknown-ID rejection, the absolute deadline needed a controlled and observable terminal boundary, failure behavior needed its own rule, cancellation needed a process-visible outcome, and source binding needed restore-identical-content/deletion partitions. Reopened 7GHXA5 for verification and repaired these contracts; the next focused run and independent review remain pending.
- 2026-08-22T22:43:00Z Completed the direct 11-scenario review of `reliable-observable-quality-reviews`. Independent review found a vacuous Claude/Codex catalogue precondition and a progress-write scenario that claimed terminal-result behavior absent from its mapped proof. Repaired those contracts, made reviewer identity, wrapper synchronization, older-CLI compatibility, and cancellation-after-completion observations explicit, and passed Gherkin lint plus all 130 mapped tests. Independent re-review `0c17e6eb-afde-4c78-8b2f-35f72d0e5964` is pending; this packet is not yet marked approved.
- 2026-08-22T22:47:00Z Independent re-review `a8216225-cf79-466b-b112-dbc966dfb34b` found one remaining must-fix vacuity: cancellation did not explicitly advance the controlled scheduler past both due points. It also correctly requested deterministic two-write outcomes and narrower Rule wording. Repaired all three without adding an unsupported integration matrix; Gherkin lint and the 27 focused policy tests pass. Final independent re-review remains pending.
- 2026-08-22T22:50:00Z Independent re-review `3f76c32d-fb80-4bd8-8f70-372c11fd9c25` found the allowlist scenario governed by an unrelated write-only Rule and a constant-Codex vacuity in reviewer identity. Reframed SWM1.R1 around isolation of Safeword-owned progress failures and signals, made write failure caller-observable, and parameterized the real managed-review proof across both Codex and Claude with opposite-reviewer rejection. Gherkin lint and all 131 mapped tests pass; another independent re-review is required.
- 2026-08-22T22:52:00Z The next review degraded after both Claude routes failed and Codex reviewed its own work, so it is not approval evidence. Its substantive finding was accepted: TBU1.R1 said “each terminal outcome” while proving only the supported approve/request-changes verdict outcomes. Narrowed the Rule and scenario wording to reviewer verdict results instead of bloating this feature with unrelated transport/schema failures. A cross-agent review is still required.
- 2026-08-22T22:53:00Z A second degraded self-review found the required-workflow precondition still linguistically allowed non-review workflows. Tightened it to non-empty catalogues specifically of workflows required to launch independent reviews, matching the explicit non-empty `requiredReviewFiles` proof. Both Claude routes failed before this fallback, so a cross-agent approval remains unavailable.
- 2026-08-22T22:54:00Z Final review attempt found no must-fix semantic defect and returned approved, but independence was degraded because both Claude models exited and Codex performed the fallback self-review. The packet is locally repaired and verified (Gherkin healthy; 131 mapped tests pass), but is recorded as awaiting cross-agent approval rather than independently approved.
- 2026-08-23T10:35:00Z Cross-agent review `cb6544c6-888b-4c77-97f0-0d676d4b5d21` found the central long-running heartbeat claim unpinned to time. Root cause is a specification/proof-map omission, not product scheduling: existing code delays and rearms heartbeats, but the feature did not require those boundaries. Added a deterministic interval-and-repeat scenario, extended the injected-scheduler proof through two due points, and mapped the existing repeated-heartbeat integration proof. Focused verification passed 95 tests. Independent re-review `ddaf6b43-167f-4073-b121-ac62271294bf` then found the scenario still expressed cadence relative to the implementation's own interval. Pinned silence and emissions to 30-, 60-, and 90-second controlled-scheduler boundaries and narrowed adjacent Rule wording to the guarantees actually proved; another cross-agent review is required.
- 2026-08-23T10:46:00Z Cross-agent re-review `4377cecc-8015-4020-b4b4-7cf59ed02550` approved the absolute heartbeat-boundary repair with no must-fix findings. The suggested all-writes-fail matrix is outside this focused timing defect and is deferred to avoid overhardening. Gherkin lint is healthy and the 95 focused policy/wiring tests pass.

**Next:** merge the focused heartbeat-proof follow-up, then resume the queued per-scenario review.
