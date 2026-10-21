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

Packets, prompts, rubrics, settings and floor are unchanged. Rescoring validates the original seals and identical observation inputs before changing labels. It refuses tampered or already-rescored inputs and changes to packets, rubric, settings or floor. New seals retain the original 2026-10-20 collection date and original results/corpus digests plus the rescoring timestamp. The originals and previous manifest are archived beside this record. No paid model qualification was repeated. Offline rescoring retains Codex 18/18, Claude 17/18 and the original failed Claude observation. These remain six-fixture observations with the original statistical limits. Offline regrading is not a fresh independent performance sample or a held-out validation of the revised oracle; the stronger labels and negative examples address known failure modes.

## Verification and review

Targeted verification passed all 140 tests in eight files. All four new BDD examples passed 24 steps. Typecheck and scoped lint passed. All five derived surfaces were regenerated and verified. Full serial verification is terminal and green; exact commands, exits, durations and raw logs are in verify-results.json.txt and archive-manifest.json.txt.

Independent Claude review 5e41c9d9-ed79-4b4d-897c-07137a9cc6d3 approved its declared checkpoint with warnings. The follow-up context mistakenly calls its dispatch ID 8cddf0dd-96bd-497b-be06-9e4dc8de29fe a review ID; the actual review ID is the former. Original sealed context bytes are preserved. The follow-up answers near-miss matching, positive rescoring and discriminating packet-count warnings. Catalogue lineage is available through the combined results digest and sealed raw evidence; it is not claimed to be a newly collected qualification.

## Failures retained

The initial BDD fixture omitted the required scenario context and failed four examples. A later fixture incorrectly represented a failed app-server turn as an unsupported protocol and failed two launch-order assertions. Corrected the fake to acknowledge a failed turn; all four then passed. These are fixture failures, not product RED.

The first targeted run passed 139/140: splitting the ordinary-review test omitted the original config restoration. Restored that setup and retained the exact absent-review_routes assertion. The complete targeted rerun passed 140/140.

An initial generated-surface fix reached its lifecycle test, then the shared lock rejected the test without starting it. The serial retry regenerated and verified all five surfaces. Optional CLI mutation probes initially dispatched the original worker and then failed to execute the bound mutant worker; those are inconclusive runner attempts, not killed mutants or product failures.

Native-host retrieval, private injection and isolation remain human-deferred. The new automated BDD cases prove the CLI boundary, not that every advertised host follows its instructions. Neither merge nor Ready promotion is authorized.

## Independent review dispositions

Follow-up review `c0361d0a-89e7-4d4e-a9b9-fe6a8afa8bde` approved the final bounded source/test changes with warnings. Both raw review envelopes and exact contexts are retained in evidence/5086-test-quality/.

- Labels remain maintainer-owned. Rescoring does not infer that arbitrary edited labels are stricter. This change preserves the floor and all previous required/forbidden terms and adds constraints. The recorded previous corpus digest covers the previous labels; the exact previous manifest and original seals are archived for audit. A valid rescore is not a claim that maintainers cannot loosen future labels.
- The collector confirms provider/model, while its callback is trusted to apply requested settings. The production recording script sets the pinned worker deadlines and passes medium effort; the settings seal records those configured inputs, not independent transport attestation of every setting. No new promise of settings attestation is made here.
- Concept matching remains a bounded lexical check, including word-start alternatives and generic terms. Near-miss negatives and accepted paraphrases improve discrimination without proving semantic equivalence for arbitrary findings.
- Rescore rejection tests use the single public failure message for different invalid inputs. They assert refusal, not internal branch selection; removing the relevant digest/input checks would make those invalid-input tests fail. A positive qualifying rescore is separately asserted.
- Added a release test that uses the actual packaged pairs and real reviewerCapabilityFailure API to classify the retained weaker direction, plus an exact-model mismatch refusal. It complements the deliberately mocked coordinator tests. The ranked BDD cases prove the real qualified route, not a real host-origin path for every weaker model.
- The reviewer questioned whether reviewOutputSchema returns an object. Direct invocation confirmed it returns a string; typecheck passes. No type suppression or schema weakening was added.
- The optional direct-coordinator ordering mutation was exercised successfully after the inconclusive CLI-worker probes: an unchanged real-CLI baseline launches codex:gpt-6-astra; removing ordering in an isolated coordinator build yields no launches and REVIEW_ROUTES_EXHAUSTED. The BDD launch/outcome assertions discriminate that result. This is a direct-coordinator mutation proof, not a successful mutated CLI-worker execution.

The release-only assertion was added after source checkpoint 3b6fd0809. The normal full suite excludes release files; the serial release stage separately verifies it. No production code changed after the reviewed checkpoint.

## Terminal verification

The serial pipeline completed with all nine exits zero:

- Full default suite: CLI 717 files / 11,585 passed / 14 skipped; relay 198 passed / one skipped; collector 153 passed. CLI duration 950.87 seconds.
- Release lane: 14 files / 83 tests passed, including unmocked packaged weaker classification. Offline capability verification retained both directions.
- Scoped BDD: 123 scenarios / 2,488 steps and two hooks passed using the archived cucumber.mjs.txt config and the repository's normal manual/live/proof exclusions.
- Repository lint, all three package typechecks, parity, five generated surfaces and the complete CLI contract passed. Generated assets were checked after regeneration and again at commit.

The final release review `1dcd84f9-3858-46bd-bbbd-419add451c91` approved its checkpoint with warnings. Added its requested same-unqualified-requested/confirmed identity refusal and real allowed-direction assertion, and a comment connecting the API test to independent raw-evidence reconstruction. This final release-only delta then passed scoped lint, CLI typecheck and a complete 83-test release rerun. That rerun waited for another checkout's shared test lock; no overlapping Vitest process was started. Both release runs and the wait are retained separately. The pinned toolchain emits an existing Vite future-native-config import-extension warning; no suppression or dependency change was made.

Production code is frozen at checkpoint `3b6fd0809`; the final changes above are release assertions and verification evidence. The default full suite excludes release files, and the final release rerun explicitly covers the later assertions. Final current-head CI after push is separate and pending until terminal. The inherited dependency audit fix remains in separate Draft #5998, whose current-head technical CI is all green; it has not landed or been incorporated into #5995.

No parent ticket closure, model qualification replay, merge or Ready promotion occurred. The original native-host and broader acceptance deferrals remain.
