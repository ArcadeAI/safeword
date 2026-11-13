# Epic #4200 — next critical path, 2026-11-11

## Current handoff — November 13

November 13: user explicitly authorized administrative merge of #7190.
Supported checked Ready promotion succeeded; GitHub confirms verified head
`75d96de44` merged as `fd784a2fd4254c850bbd0c60608bac683f4893ad`.
No required human approval is fabricated; the explicit admin merge bypassed
that rule. User elected to leave converter dependencies unchanged until an
ESLint release accepts patched minimatch; do not apply the diagnostic override.
The converter audit remains failed and its journey incomplete. Missing RED,
failure history and all 33 deferred cases remain. The accepted dispute feature
below can proceed independently; no qualification or route change authorized.

Next: resume the accepted dispute feature, 26FK42. Keep the converter on hold
for upstream ESLint. This delivery preserves the planning/evidence records;
it does not approve or implement the unfinished 5GK1CN proposal.

## Historical observations — November 12

Main `8daeec44c` includes dependency repair #7201. Catalogue repair #7190
merged that main, passed complete local verification (each full CLI pass:
719 files / 11629 pass / 14 skip; 599 acceptance scenarios, 52 proof checks,
build/lint/typecheck/audits), and earned independent approval. Current-head
offline installer probe verifies all 50 asset bytes without package-manager
work. Task VRJ93G is closed in documentation-only commit `75d96de44`, pushed
to the existing Draft PR. No Ready promotion or merge is authorized.

Implementation head `f7081a0ea` has green CI `43260512508` on attempt two:
Node 24 passed first attempt; Node 22's first CLI suite passed but its separate
Claude release check timed out at 30s. One unchanged-job rerun passed all
81 release checks. Preserve both attempts, earlier full failures and missing
local RED. Final documentation head `75d96de44` independently passed CI
`43271285963` on its first attempt, including both Node jobs and release lanes.

Next: Ready/merge for #7190 needs explicit authority independently. Its
test-only change is not a production prerequisite for a
native trial. A fresh direct audit of the unchanged converter still exits 1
with the same two findings: #7201's repository overrides do not automatically
protect installed projects. Live upstream ESLint ranges still select affected
minimatch 10; the patched major is 11.

A diagnostic copy using the packed CLI (instead of a source-directory link)
removes the esbuild finding. A single root minimatch 11.0.8 override then passes
audit, real ESLint, TypeScript, 34 unchanged process tests and six BDD scenarios;
an intentionally undefined name still fails lint. The original project and its
pre-existing execution-plan edit remain untouched. Applying this tested
project-only proposal needs an explicit exception to the earlier no-major-
override restriction. It is not native completion or qualification evidence.
The proposed manifest, raw failures and results are in the permanent archive's
`main-update-2026-11-12/native-dependency-proposal/` directory.

The accepted dispute feature and proof gaps below remain, as do all 33 deferred
cases. Earlier dated state below is historical and superseded only by these
specific observations.

Observed main: `e49310a749b89cccc73faeeb843273bb05c95f08`.
This is a handoff, not a scope change, plan approval or completion receipt.

## Historical catalogue repair follow-through — superseded by November 13

[Main CI 43090952840](https://github.com/ArcadeAI/safeword/actions/runs/43090952840)
failed both Node jobs on the same catalogue installation test:
`packages/cli/tests/opencode/catalogue.test.ts:86`, 60-second timeout.
Both jobs otherwise pass 717 files / 11,631 tests, with 10 skipped tests.
Earlier exact-head PR CI succeeded, and the merged tree equals the tested tree.
That contrast does not establish a flaky-test or product-regression diagnosis.

Follow-through: user approved offline setup for this catalogue-only test,
preserving the real installer and every assertion. Direct probes isolate
unrelated package downloads; the offline path verifies all 50 catalogue assets
in 667ms. Unchanged baseline passes 5/5 locally; the candidate passes 28/28
catalogue/profile checks and independent review. Draft
[#7190](https://github.com/ArcadeAI/safeword/pull/7190) at `1c54c4a78` has green
CI run `43130744212`, first attempt, including both Node versions. It is not
merged. Next delivery step: complete VRJ93G's verification/closure record;
Ready promotion and merge need explicit authorization. No original failure
or missing historical RED is replaced by this passing candidate.

Latest closure attempt remains blocked: the full local invocation exited 1
with intermittent timing failures and inherited audit findings (9 Bun, 16 uv).
All three failed cases pass unchanged in isolation, and acceptance/build/type
checks pass, but neither fact erases the failed full run. Dependency PR #7201
already addresses the affected locks and Bun toolchain separately; it remains
Draft/unmerged. Keep VRJ93G at verify and #7190 Draft. After #7201 lands on
main, update this branch using accepted pins/locks and rerun closing checks.
Do not broaden the catalogue patch or invent a verification waiver.

Only if another failure requires it, inspect the saved logs and reproduce the
single case with the pinned launcher, from `packages/cli`:

```bash
../../scripts/dev bun run test tests/opencode/catalogue.test.ts
```

The test uses the real lifecycle installer with `offline:false`; establish
which operation stalls rather than assuming all future failures have the same
cause. Both original failures remain preserved. Do not simply raise the timeout,
suppress the check or rerun the whole suite. The exact historical CI subprocess
timing remains unknown; the approved repair removes the unnecessary registry
dependency from the catalogue proof without changing production installation.

## 2. Resume the accepted disputed-findings feature

Ticket: `26FK42-resolve-disputed-plan-findings`, original obligation 13.
It has 15 accepted scenarios, no implementation plan and no completed R/G/R.
Read its spec, dimensions, feature source and ledger before writing plans.
Read-only `ticket reconcile-parent 26FK42 --no-input --json` on the main-based
delivery worktree still returns `PARENT_RECONCILIATION_FAILED`, changed:false.
Review the accepted parent contract changes; do not blindly run `--accept` or
rewrite the child's scope. Obtain whatever current approval that comparison
actually requires, then plan the existing feature.

Reuse main's `commands/review-disposition.ts` for its actual purpose:
confirmed decline of info/warning advice from an approved authenticated review.
Its pending confirmation is not durable pending-dispute recovery, and declining
optional advice is not adjudicating a disputed correctness error.

The missing behavior is the accepted authority routing and honest outcomes:
user-owned scope decisions, provenance-based currency, a fresh resolver for
correctness/relevance, no originating-reviewer-only adjudication, durable
pending recovery and no unresolved-correctness approval. Plan all accepted
scenarios without adding a general arbitration framework, pass counters or
fixed review limits. The first vertical implementation slice should prove
fresh correctness resolution and refusal of false approval at the real CLI
boundary; the rest of the accepted feature remains required, not newly deferred.

## 3. Reconcile proof before buying more testing

Use the updated proof map to inspect existing migration, routing, phase-contract,
enabled-human-selectivity, message-comprehension and delivery-slicing evidence.
Run only a missing partition at its real boundary. Synthetic parity and CLI
controls do not impersonate native Cursor or hosted acceptance. The assisted
Codex converter remains blocked at its recorded dependency audit; do not reuse
its working application or local PR description as verified delivery.

## Boundaries and preserved evidence

Keep all missing historical RED, failures, stale/rejected/exhausted reviews and
33 deferred cases: MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1.
Do not stretch fixed-ticket recovery, merge the old completion branch wholesale,
change model routes, run qualification or silently waive the native audit.
Do not tick original scenario boxes from this map. The two source fixes are
already merged; they need no new PR or implementation campaign.

Raw source checks, failed main logs and this handoff are backed up under the
permanent trial archive's `epic-followthrough-2026-11-11/`. The original working
tree's pre-existing 5GK1CN/parent changes were separate and uncommitted at
that capture. They are now saved by preservation delivery AAV0Q5, without
approving their implementation or completion claims.
