# Strengthen reviewer-route and continuation regression proof

This follow-up to Draft #5995 addresses the test-quality assessment. It does not close #4200/#5086 or native-host R7, add #5139, or incorporate dependency PR #5998. The original failures and deferrals remain in verify-5086.md.

## Behavior and proof

- Reject isolated keywords, disconnected findings, and a stale-job near miss when qualifying the seeded approval-authority defect. Concept groups must occur in one blocking finding, at word starts. Positive paraphrases remain accepted. This is a bounded lexical oracle, not a semantic judge or general model ranking.
- Run four ranked planning examples through the assembled CLI, real capability catalogue, confirmed app-server provenance, sealed job and fake external reviewer executables. Assert exact launch order, stop after success, unsupported-model eligibility, packet counts, full target bytes and shared dispatch. The alternate and later examples compare two and three actual packets. Single-route examples prove full target bytes rather than multi-route reuse.
- Race four independent processes against one authenticated continuation. Exactly one approval wins; the other three get the single-use refusal, and stored status equals the winning result. A different recognized host cannot consume a pending job or change its bytes; the rightful host can still complete it. Existing sequential replay, tamper, currency, tier and public-command checks remain.
- Split the bundled weaker-route coordinator test into focused tests without dropping assertions. It still deliberately mocks classification/runtime; the BDD fixture supplies the real classification/provenance wiring proof. Assert the current require-policy refusal reason, unchanged phase, and successful admission after restoring prefer.

## Root cause and TDD

The score bug was missing defect grounding, not case folding or missing verdict validation. An irrelevant error containing authenticated passed the existing label. Direct executable assertions demonstrated the original banana false positive and the later stale-job near miss before their respective fixes. Positive/negative scorer tests, lineage tests, existing-correct routing/continuation characterization tests and prior RED history are kept distinct.

The first Vitest RED attempt exited 75 without starting because another checkout owned the shared lock. Its longer queued retry was canceled before tests started; it is not RED. A direct assertion against the real scoring function failed with the expected assertion before the production fix. Subsequent tests are terminal only when the attached records say so.

## Qualification provenance

Packets, prompts, rubrics, settings and floor are unchanged. Rescoring validates the original seals and identical observation inputs before changing labels. It refuses tampered or already-rescored inputs and changes to packets, rubric, settings or floor. New seals retain the original 2026-10-20 collection date and original results/corpus digests plus the rescoring timestamp. The originals and previous manifest are archived beside this record. No paid model qualification was repeated. Offline rescoring retains Codex 18/18, Claude 17/18 and the original failed Claude observation. These remain six-fixture observations with the original statistical limits.

## Verification and review

Targeted verification passed all 140 tests in eight files. All four new BDD examples passed 24 steps. Typecheck and scoped lint passed. All five derived surfaces were regenerated and verified. Full serial verification is pending; final terminal commands/counts will be recorded below before delivery.

Independent Claude review 5e41c9d9-ed79-4b4d-897c-07137a9cc6d3 approved its declared checkpoint with warnings. The follow-up context mistakenly calls its dispatch ID 8cddf0dd-96bd-497b-be06-9e4dc8de29fe a review ID; the actual review ID is the former. Original sealed context bytes are preserved. The follow-up answers near-miss matching, positive rescoring and discriminating packet-count warnings. Catalogue lineage is available through the combined results digest and sealed raw evidence; it is not claimed to be a newly collected qualification.

## Failures retained

The initial BDD fixture omitted the required scenario context and failed four examples. A later fixture incorrectly represented a failed app-server turn as an unsupported protocol and failed two launch-order assertions. Corrected the fake to acknowledge a failed turn; all four then passed. These are fixture failures, not product RED.

The first targeted run passed 139/140: splitting the ordinary-review test omitted the original config restoration. Restored that setup and retained the exact absent-review_routes assertion. The complete targeted rerun passed 140/140.

An initial generated-surface fix reached its lifecycle test, then the shared lock rejected the test without starting it. The serial retry regenerated and verified all five surfaces. Optional CLI mutation probes initially dispatched the original worker and then failed to execute the bound mutant worker; those are inconclusive runner attempts, not killed mutants or product failures.

Native-host retrieval, private injection and isolation remain human-deferred. The new automated BDD cases prove the CLI boundary, not that every advertised host follows its instructions. Neither merge nor Ready promotion is authorized.
