---
id: T0FK4H
slug: qualify-additional-reviewer-pairs
type: feature
phase: verify
status: in_progress
phase_skips:
  - intake: completed before reclassification while T0FK4H was typed task; Codex review eedc8483 approved and intake was stamped
  - define-behavior: the code shipped on #6319 before any ticket existed; spec.md was written on 2026-11-03 after implementation and is labelled so, not backdated
  - scenario-gate: scenarios were written on 2026-11-03 after implementation and bound to existing tests; each GREEN row cites an executable-red replay against pre-change f211c4c30 instead of a pre-implementation RED
  - plan-implementation: no plan preceded the code; impl-plan.md records the shipped approach and says it was written afterwards
  - plan-execution: no execution plan preceded the code; none is written after the fact
  - implement: implementation commits 271d6aaa0, 638845b51, 36773f257, 0eb026c56 and e0834b7e3 predate the reclassification
scope:
  - pin several Claude/Codex pairs, each with its own capability revision
  - count a capability record only for the pinned pair it was qualified with
  - ship only pairs with complete, matching sealed evidence; refuse partial, cross-pair or shared-model evidence when building or rescoring
out_of_scope:
  - the paid qualification of claude-opus-5-5/gpt-6.1-sol
  - any review-route change
  - ticket 9239QM and its recovery-branch integration
  - merging #6319
done_when:
  - the shipped pair resolves exactly as before and its evidence and records are byte-identical
  - the latest pair is pinned but resolves unknown until sealed evidence exists
  - a second qualified pair is admitted through planning review
external_issue: https://github.com/ArcadeAI/safeword/issues/6316
external_issues: [https://github.com/ArcadeAI/safeword/issues/6316, https://github.com/ArcadeAI/safeword/issues/6312]
external_prs: [https://github.com/ArcadeAI/safeword/pull/6319]
created: 2026-11-03T18:58:56.549Z
last_modified: 2026-11-03T19:10:00.000Z
---

# Let maintainers qualify new reviewer pairs without retiring the existing qualified pair

**Goal:** The packaged reviewer capability catalogue holds more than one pinned Claude/Codex pair, each bound to its own models, so a new pair can be qualified later while the existing qualified pair resolves exactly as before.

**Why:** One global revision digest made qualifying claude-opus-5-5/gpt-6.1-sol retire the qualified claude-opus-5/gpt-6-astra pair (#6316).

## Ticket provenance

This ticket was created on 2026-11-03, after the code work, to give the already-reviewed change on #6319 its delivery record. Entries marked "Reconciled" restate existing commits, runs and reviews at the times they happened; the rest is work done under this ticket.

**Classification:** feature. The ticket was first typed task; on 2026-11-03 it was reassessed against the shipped behavior — new state (several pinned pairs with their own revisions), 3+ files, and two flows (review admission and the maintainer `record`/`generate`/`rescore`/`verify` commands) — and reclassified. The code was built test-first before any ticket existed, so spec.md, dimensions.md, impl-plan.md, the feature file and test-definitions.md were written on 2026-11-03 after implementation and say so. `phase_skips` records why each earlier phase did not happen in order. RED proof is replayed by running the new tests against pre-change `f211c4c30`, not backdated.

## Scope

- Pinned pair list in `packages/cli/tests/fixtures/reviewer-capability-corpus.ts` (existing `claude-opus-5`/`gpt-6-astra`, new `claude-opus-5-5`/`gpt-6.1-sol`).
- Per-pair revision and digest (`capability-eval.ts`); model-bound record lookup (`capability-catalogue.ts`); coordinator passes every pinned revision.
- Catalogue builder and `reviewer-capability-eval.ts` (`record --pair`, `rescore`, `verify`) emit only pairs with complete evidence and refuse partial, cross-pair or shared-model evidence.
- Regenerated catalogue and plugin bundles; tests for per-pair digests, mixed-pair refusal, partial-evidence refusal and the public review route.

**Out of scope:** the paid qualification for `claude-opus-5-5`/`gpt-6.1-sol`, any review-route change, ticket 9239QM and its recovery-branch integration, and merging #6319.

## Done when

- The existing pair resolves exactly as before; its evidence files and catalogue records are byte-identical.
- The new pair is pinned but resolves `unknown` until sealed evidence exists.
- Tests cover per-pair digests, mixed-pair refusal and partial-evidence refusal.

## Tests

`capability-catalogue.test.ts`, `capability-eval.test.ts`, `packaged-capability.release.test.ts` and `planning-review-route-order.test.ts` (pinned-but-unqualified row through the real coordinator).

## Work Log

- 2026-10-31T03:36Z Reconciled (log file time): full local verification of the feature tree (recorded on #6319 as `271d6aaa0`) exited 1 — CLI timeouts that differed between passes (all 9 files then passed 140/140 in isolation) plus the main-baseline JS and Python audit findings; Gherkin, build and typecheck passed.
- 2026-10-31T03:37:59Z Reconciled: `271d6aaa0` feat(review): qualify additional reviewer pairs without retiring existing ones.
- 2026-10-31T04:05Z Reconciled review: Codex cross-agent 5afb520b requested changes (fixed two-record count; evidence missing from packet).
- 2026-10-31T04:06:41Z Reconciled: `638845b51` lets the release check accept every qualified pinned pair.
- 2026-10-31T04:07Z Reconciled review: Codex cross-agent 18a5c6f8 requested a public-route proof.
- 2026-10-31T04:11:10Z Reconciled: `36773f257` proves pinned pairs through the public review route.
- 2026-10-31T04:11:24Z Reconciled review: Codex cross-agent 13de5286 approved with no findings.
- 2026-10-31T04:18Z Reconciled: #6319 opened as Draft; CI run 41168026298 failed (dependency audit and `rust-golden-path`/`setup-reconcile` 60 s timeouts); main run 41256979195 on `f211c4c30` reproduced the same failures.
- 2026-11-03T17:34Z Reconciled: main (`27ebad272`, #6433) merged into the branch as `1d4804230`; the tree equals a clean rebase of the three commits. CI run 41685547209 passed every job on the first attempt.
- 2026-11-03T18:58:56.549Z Started: Created ticket T0FK4H for delivery closure.
- 2026-11-03T18:59:58Z Intake review: Codex cross-agent 9e6ce3eb requested changes — (1) `rescore` skipped missing evidence per model, so a half-evidenced pair was rescored and exited 0; (2) the packet lacked the generated catalogue and sealed evidence.
- 2026-11-03T19:02:57Z RED → GREEN: added "rescores only complete pinned pairs and refuses partial or mismatched evidence" (failed: function missing); `0eb026c56` adds `rescorePinnedCapabilityEvidence`, sharing the builder's pair, exact-model and shared-model checks, and the script uses it. capability-eval + capability-catalogue tests 25/25, tsc and eslint clean, generated surfaces current.
- 2026-11-03T19:03:47Z Intake review (generated catalogue and sealed evidence now in the packet): Codex cross-agent a83fdb5a requested changes — no test proved the coordinator passes every pinned revision; passing the legacy single revision would still pass.
- 2026-11-03T19:05:54Z `e0834b7e3` adds `planning-review-pinned-pairs.test.ts`: qualifies the latest pair from resealed observations and requires cross-agent admission of `gpt-6.1-sol`. Mutation check: coordinator passing `PACKAGED_CAPABILITY_REVISION` fails it (restored, no diff). Route tests 24/24, tsc and eslint clean.
- 2026-11-03T19:06:36.688Z Phase: intake → verify
- 2026-11-03T19:06:50Z Full local verification started at `e0834b7e3`; finished 20:02:25Z, exit 1 on the dependency audit lane only (all test, Gherkin, build and typecheck lanes passed). Recorded in verify.md.
- 2026-11-03T20:03Z Reclassified task → feature against the shipped behavior; added spec.md, dimensions.md, impl-plan.md (Status implemented, written after the fact), `features/qualify-additional-reviewer-pairs.feature` with proof bindings (53/53), test-definitions.md and `phase_skips` for every earlier phase.
- 2026-11-03T20:04:12Z RED replay: bound tests run against pre-change `f211c4c30` (`evidence/red-replay.md`). The test first bound to "A record claiming another pair's revision is refused" passed at base, so that scenario was replaced by "Each pinned pair is admitted at its own settings revision", which fails there on behavior.
- 2026-11-03T20:06:42Z Executable-red review 61d5a933 for that scenario requested changes: the failure matched, but the ledger has no proof-plan row binding the scenario to its test and support files. The rubric also rejects import/missing-export failures, which is how the other six bound tests fail at base. Closure stopped here for a decision; see verify.md.
