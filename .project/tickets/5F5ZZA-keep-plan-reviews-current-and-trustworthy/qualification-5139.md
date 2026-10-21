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

Execution conformance is separate and still running. Its prior descriptor
remains historical and cannot qualify the changed contract. No new Execution
descriptor or fresh aggregate acceptance claim has been produced.
