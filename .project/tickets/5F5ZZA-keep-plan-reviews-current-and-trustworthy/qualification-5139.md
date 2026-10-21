# Qualification of the changed planning review contract

Both fresh capability collections are complete: Claude Opus 5 and GPT-6 Astra
each scored 18/18 under main's unchanged lexical finding-group oracle. These
are six planning fixtures repeated three times, not the broader scenario suite
or general model-quality evidence. Both directional comparisons are now
`not_weaker` for this bounded corpus.

Executed through the pinned launcher:

```sh
scripts/dev bun packages/cli/scripts/reviewer-capability-eval.ts record claude
scripts/dev bun packages/cli/scripts/reviewer-capability-eval.ts record codex
scripts/dev bun packages/cli/scripts/reviewer-capability-eval.ts generate
scripts/dev bun packages/cli/scripts/reviewer-capability-eval.ts verify
```

The fresh records, complete collection logs, generation output and independent
digest reconstruction are retained under `evidence/5139-current-main/` with a
SHA-256 manifest. The collector uses `runHeadlessReviewerWithProvenance` and
checks the confirmed exact model. Digests come from `capabilityRevision` over
the current manifest, reviewer contracts and settings; generation verifies the
sealed results against those same inputs. It does not merely replace an old
digest on old observations.

The changed corpus supplies the accepted refusal/recovery outcomes and explicit
scope context required by the changed judgments. The Product schema selector
now names `product-plan`. Main's Astra selector, thresholds and stronger
finding-group oracle remain. Only these changed inputs were requalified.

Historical records remain separately archived as `historical-*.json`; their
collection dates, failures, prior rescoring lineage and seals are unchanged.
The fresh collection is not a rescore and therefore has no `rescored_from`
field. A frozen historical catalogue provides the formerly observed weaker
direction as a negative classifier control; it grants no current admission.

The first preflight collections were terminated before completion to correct
their schema/context inputs. They remain interrupted attempts, not passes.
The first test review did not have the completed logs and requested their
provenance; that review remains `changes_requested` until re-review.

Execution conformance is separate. The attempted live run was cancelled with
exit 130 after approximately twelve minutes without a completed result matrix;
the verified orphan worker was then stopped. No case from that run is claimed as passed.
The initial invocation also found no tests under the default configuration; the
later invocation used `vitest.live.config.ts`. Its prior descriptor
remains historical and cannot qualify the changed contract. No new Execution
descriptor or fresh aggregate acceptance claim has been produced.

A later bounded diagnostic selected only `one-coherent-change` with exact
selector `claude-opus-5`. It passed: one test passed, 63 unselected tests skipped,
95.45 seconds. The actual result and reviewer output are archived separately.
This is one passing conformance case, not a qualified route or a complete
63-case matrix. Reuse this result if the remaining unchanged cases are collected;
do not pay to repeat the completed case without changed inputs.

After the authorized local-plugin switch and restart, the remaining 62 cases
are being collected with the same exact selector and unchanged current rubric:

```sh
SAFEWORD_TEST_LOCK_MAX_WAIT_MS=600000 \
SAFEWORD_RUN_EXECUTION_PLAN_LIVE=1 \
SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER=claude \
SAFEWORD_EXECUTION_PLAN_LIVE_MODEL=claude-opus-5 \
SAFEWORD_EXECUTION_PLAN_RESULTS_PATH=/tmp/5139-execution-opus-remaining.json \
scripts/dev bun run --cwd packages/cli test --config vitest.live.config.ts \
tests/smoke/execution-plan.live.test.ts -t '^(?!.*one-coherent-change)'
```

The run is pending. No complete matrix, new admission descriptor, or additional
passing case is claimed before its actual result is retained. The existing
descriptor cannot admit the changed contract; this collection does not repeat
either completed capability collection or the completed first conformance case.

The user authorized a bounded LOC exception on 2026-10-21. A normal progress
checkpoint (`5477ef85f`) instead passed all precommit checks while retaining the
uncommitted packet change that needs a cognitive-complexity refactor. No hook,
threshold, receipt, historical ledger, or verification check was disabled.

## 2026-10-21 restart interruption and official-baseline planning

At 18:12 UTC, after the user's second full desktop restart, neither the Vitest
parent nor worker remained. The remaining-case log ended at `RUN`; neither its
result matrix nor output matrix existed. The run did not complete and provides
no additional passing cases. Reviewer invocations used
`--no-session-persistence`; no saved observations are available for replay.
The earlier expectation that this process would survive was incorrect. Retain
the completed first-case result and both complete capability collections.
Any further collection must retain observations incrementally so another
interruption cannot erase completed work.

The shared official-main runtime is healthy/protected after restart. A
project-only supported install (`--agents cursor,codex --no-modify`) reconciled
four generated guidance files in this worktree to that runtime's baseline.
Its actual effects contained no packages, configuration, network, or destructive
changes; source templates remain untouched. The candidate guidance was archived
before reconciliation. This permits planning against the installed official
contract without replacing the shared runtime with this branch's candidate.
Final regeneration must restore the candidate's derived surfaces before PR
verification. The initial `--offline` install was refused without effects by
the CLI's online-required policy; that refusal is not a successful install.
