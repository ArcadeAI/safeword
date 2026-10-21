# #5086 surgical continuation verification

Source checkpoint: `8d8a43d5493dd8908a7e925df73256ce64d4895f` on `codex/5086-ranked-review-continuation`.
Base: `150eb7c619b2d5852174da99ba675ae326354153` (current main when work began and rechecked before final verification).
This verifies this delivery slice, not completion of #4200 or the parent ticket.

## Delivered scope

- Independent-first ranked reviewer routes, retaining actual attempt/failure evidence and refusing fallback when no independent route actually ran or stronger routes remain.
- Exact requested/confirmed provider and model provenance plus sealed corpus, rubric, schema and settings qualification. Production effort matches the qualification settings. Unknown capability cannot earn cross-agent assurance; proven-weaker verdicts are discarded. An unknown-capability rejection survives later same-agent approval.
- A single shared sealed packet and existing authenticated job owner for headless and host continuation. Lock-protected, single-use continuation rechecks origin/tier/dispatch identity and source currency; fresh-context then self-review is bounded.
- Honest `reduced` assurance under `prefer`, current-policy revalidation on admission, strict `require`, and a separate independent architecture gate. Reduced coverage is never relabeled cross-agent.
- Main's full author-copy contracts (#5957), semantic context/disposition behavior (#5980), and stronger refusal/restoration tests retained. The six native-copy fixtures now assert reduced assurance because their fake reviewers provide no exact model provenance; their copy checks are unchanged. Malformed approval config keeps its original error and no-mutation assertions, and discovery retains priority.

No old branch merge, no #5139 semantic scope enforcement, no parent phase/status closure, no merge or Ready promotion.

## TDD and review

The initial installed CLI RED on main failed 14/14 targeted cases. Independent Claude review rejected an initial misidentified failure, then approved the corrected RED (`deb6dde4-d309-4274-9b9d-a91bedf98fe6`). The failure was not silently relabeled.

Independent review found an unknown-capability rejection could be lost and production effort could differ from the qualification seal. Separate executable RED (`45dfb477-8486-4e0d-84d5-9bd2b1c1eaac`) approved the rejection proof; repairs retain rejection and bind effort. Current-policy flip RED (`6a99e06f-ac8c-4d85-a4d0-5ff01d910ee4`) proved reduced receipts still admitted after `prefer` changed to `require`; both planning and coding authorization now refuse.

Complete own-slice nonbundle source review `075fb458-1ff1-4db9-89f0-5ecda5500d6e` and test review `9cfd6aa3-6da9-4b9e-a513-2b2bfc80a9b8` approved checkpoint `9dcac79ac` with warnings. Admission follow-up `65c86501-60e2-4bb0-bdf1-222e266c3319` approved the later policy repair. Final bounded review `fbe89f41-6f36-4261-ba4a-ff9679582edb` approved the config-order, native-copy assurance and architecture-guidance delta, including the qualified-route and architecture-gate test context. These were real separate headless Claude processes, not author self-review. Compiled bundles were generated and exercised, not claimed raw-reviewed. AI review is evidence, not human approval.

Raw envelopes, patches and review contexts are retained under `evidence/5086-runs/` and neighboring `5086-*-review.patch` files. JSON envelopes use `.json.txt` to preserve exact bytes through formatters. Raw unified-diff snapshots retain blank context lines consisting of one space; a whole-tree `git diff --check` flags those archival lines. The source diff check excluding only these byte-preserved evidence patches is clean; the raw packets are not edited to hide that diagnostic. Earlier reviews apply to their declared checkpoints, not an invented exact-final-head signature; the final source delta is covered by the bounded follow-ups. Historical context bytes are archived before prose formatting.

## Qualification

Main's changed rubric/schema made the September evidence stale. That historical evidence is archived separately; it was not resealed as current. One fresh run per pinned model on 2026-10-20 produced Codex 18/18 and Claude 17/18. Both meet the unchanged 90% aggregate and two-of-three-per-fixture floors. Claude failed the first implementation-approve case; its actual output remains in the evidence.

The resulting direction is Claude-author to Codex-reviewer `not_weaker`, reverse `weaker`. No labels or floor were changed to improve the ranking. Subsequent offline verification confirms corpus/rubric/schema/settings unchanged; no unchanged paid qualification was repeated. This is a six-fixture, keyword-scored qualification with single-run sensitivity, not a general model ranking. Legacy Codex exec does not confirm a model; only the bound app-server path can. Claude uses confirmed stream/modelUsage identity.

## Current checks

Final frozen-source verification is terminal and green. The six lanes ran serially and every exit code is zero (`evidence/5086-runs/finish-results.json.txt`):

- `scripts/dev bun run test`: retro relay 198 passed / one skipped; retro collector 153 passed; CLI 717 files passed, 11,573 tests passed / 14 skipped. CLI duration 853.63 seconds, excluding the documented wait for the shared lock.
- Package `test:release`: offline qualification verified plus 82 tests in 14 files passed. No paid qualification rerun.
- `scripts/dev bun run check:cli-contract`: all build/runtime/aliases/help/capabilities/fixtures/documentation/generated-reference/terminology/Claude/Codex/release-contract stages passed.
- Scoped package `test:bdd:acceptance` with the archived temporary config: 119 scenarios, 2,285 steps and two hooks passed; standard wip/proof/manual/live exclusions preserved.
- `scripts/dev bun run test:smoke:fast`: 106 files, 2,220 tests passed.
- `scripts/dev bun run typecheck`: all three package typechecks passed.

Separately, `scripts/dev bun run lint` passed ESLint, Gherkin lint and CLI typecheck. All package commands used the pinned Bun 1.3.14. Requested `bun ci` completed with no dependency changes and wrote the setup marker. The product tree outside `.project/` is identical to the source checkpoint; its SHA-256 and verification metadata head are retained in `finish-product-tree.json.txt`. Later evidence-only commits do not change tested source/tests/templates/dependencies.

Earlier terminal checkpoints: 119 touched BDD scenarios / 2,285 steps passed; 2,220 fast smoke tests passed; all three package typechecks passed. The final bounded repair passed 67 targeted integration tests, including the unchanged malformed-config test and all six native-copy distribution tests. These earlier counts remain declared-checkpoint evidence; the final results above supersede them for this frozen product tree.

All five derived surfaces were regenerated after the final template/code change, and the commit hook verified them current. Parity covers 277 pairs and 11 contracts. Offline capability verification retains the directional result. Diff-scoped architecture/dead-code/test audit ran against the main merge base; repository-wide Knip, duplicate scanning and whole-repository freshness were intentionally outside that audit mode.

End-user boundary: direct `review routes` confirmed the Cursor author route inventory; `review continue` against a terminal real coordinator source-review job returned exit 1 / `REVIEW_CONTINUATION_ALREADY_USED` without mutation. This is closed-job refusal, not a claim that the manual walkthrough itself exercised a prior host submission or successful continuation replay. Both direct commands were repeated on the frozen final source and their exit codes/effects retained. Installed CLI integration exercises `review run`, authenticated continuation, stamping, approve-plan, current-policy refusal and coding authorization using fake reviewer executables. Real qualification uses the actual two model CLIs. These are not proof of native host isolation or human-deferred retrieval behavior.

## Failures retained

- Initial route/fallback suite: 210 passed / seven failed / two skipped. Fixture key roots were inside the untrusted project and inherited a different bundled CLI; fixed by external trusted key roots and an explicit trusted CLI.
- Repair checkpoint: 15 passed / one failed because inherited preferred/alternate models changed an exact array. Tests now check route tiers and preserve a separate unknown-author assertion.
- Regression checkpoint: 384 passed / 21 failed from stale cross-agent stamps on unqualified fake reviews; fixtures now assert actual reduced assurance and keep their refusal checks. Thirty-six affected tests then passed.
- One repair RED combined a contract failure with a naming error and was rejected by Claude. The separated executable RED was independently approved; both results remain.
- First full run was stopped after qualification regeneration made dist stale (exit 143). Its BDD proof title and Claude-argument failures were repaired while preserving exact checks. A second full run was stopped after the CLI checker unexpectedly launched its own Vitest alongside it. Neither is green.
- The overlapping CLI check had 72 passes / one failure in repeated-status stdout consistency; cause was not established. A serialized retry passed unchanged. It is not erased as harmless.
- A broad Cucumber attempt was stopped because configured globs merged with explicit paths; an absolute temporary config path then failed startup. The scoped relative config preserves all standard exclusions and passed 119 scenarios.
- Policy repair interim: 55 passed / one failed because a test helper omitted emitted findings. It now exposes actual findings, retaining exact refusal assertions.
- Final preclosure full run completed: 715 files passed / two failed; 11,566 tests passed / seven failed / 14 skipped. Six were native fake-reviewer cross-agent expectations; one was main's malformed-config diagnostic masked by the new policy check. The original malformed test was not weakened. The final repair and all seven proofs passed in the 67-test targeted run; the frozen-source full rerun subsequently passed all 11,573 CLI tests and is separately recorded. No failed attempt was overwritten or reclassified.
- One audit invocation used Bun on a Bash script and failed; the corrected pinned Bash invocation passed. This is a runner error, not a passing audit attempt.
- The first frozen-source retry returned exit 75 because another checkout held the shared package-test lock; no CLI test started. Both smaller packages passed. A documented longer lock wait queues the serial retry without overlap.

## Limits and warning dispositions

The historical broad acceptance run is preserved as six failed / 585 unfinished on its old head, with 33 accepted ticket cases unverified and 418 undefined child bindings in the old audit. The current source-head package acceptance result below is separate evidence; it does not re-score that old head or verify the 33 deferred ticket cases. There is no fresh 142/142 aggregate claim. R7 host retrieval/private-injection remains human-deferred. R9's historical wrong-kind receipt recovery did not name the mismatch; that diagnostic limitation remains. #5139's RED/SHA-collision history is outside this slice.

Authentication binds a job, packet and one-use transition; fresh-context/origin claims are host-reported and do not prove isolation. Prompt copy tests prove wording, not that a host follows it. Exact host author-model metadata is required for a qualified cross-agent claim; unknown hosts honestly remain reduced or blocked. The separate architecture gate still needs independent design review or its existing reasoned skip.

Retained adapter warnings: isolated Codex auth.json-only credentials do not prove keyring-only authentication; failed-turn auth classification and candidate-probe/fallback timeout accounting have recovery/latency limits; missing unique final output waits for the deadline. Malformed/noncanonical continuation targets fail closed but can be confusing. Current-policy prerequisite findings and non-approved reduced receipt diagnostics can be generic; they fail closed. The policy-flip test restores config and admits the same receipt, but its planning refusal assertion does not isolate a policy-specific finding. These are explicit follow-ups, not claimed fixes.

## Source-head CI and dependency failure

At product-equivalent PR head `8420448f42ac00a4f345de2344b91b6ef510461c`, the [CI run](https://github.com/ArcadeAI/safeword/actions/runs/39477785863) is terminal: both Node 22.23.2 and Node 24.18.1 matrices passed. Node 24 executed the broader package acceptance lane: 597 scenarios / 11,140 steps passed. Its full CLI lane passed 11,577 tests / 10 skipped in 717 files, plus the non-git physical install proof, BDD proof-tag checks and 82 release tests. Node 22 deliberately skips Cucumber; it is not counted as a second acceptance run. The immutable job metadata, extracted summaries, and compressed complete Node 24 log (with uncompressed digest) are archived. These are package checks, not a fresh 142/142 epic claim or native-host R7 proof.

[Dependency audit](https://github.com/ArcadeAI/safeword/actions/runs/39477785863/job/118818132766) failed with `GHSA-r7fv-28h4-cvq7` (high, markdown-it below 14.3.2, reported via markdownlint-cli2). The lockfile is byte-identical to main: SHA-256 `9ab7cb7fb7c09bcf7d5facb84a600be57ca0abe4bdbd322331ee5b838dbecb9d`. This is an inherited dependency-set CI blocker, not a green check or a slice-specific dependency change. No dependency version or ignore suppression was changed. The raw job log and exact baseline comparison are retained. The final evidence-only push changes no product bytes; current-head CI after that push is pending until separately terminal and is not automatically called green.

## Draft readiness

[PR #5995](https://github.com/ArcadeAI/safeword/pull/5995) remains Draft by explicit instruction. Ticket linkage, source comprehension, bounded independent source/test reviews and fresh self-review are documented. Local verification is terminal and green; CI at the eventual PR head must be terminal and green before gate 4 passes. The inherited dependency audit currently prevents that. R7 and broader unfinished acceptance prevent an epic-completion claim. No merge-confidence or Ready claim is made; the parent ticket remains in its existing state.
