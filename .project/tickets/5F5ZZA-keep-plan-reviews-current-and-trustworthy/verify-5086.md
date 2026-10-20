# #5086 surgical continuation verification

Source checkpoint: `8d8a43d54` on `codex/5086-ranked-review-continuation`.
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

Raw envelopes, patches and review contexts are retained under `evidence/5086-runs/` and neighboring `5086-*-review.patch` files. JSON envelopes use `.json.txt` to preserve exact bytes through formatters. Earlier reviews apply to their declared checkpoints, not an invented exact-final-head signature; the final source delta is covered by the bounded follow-ups. Historical context bytes are archived before prose formatting.

## Qualification

Main's changed rubric/schema made the September evidence stale. That historical evidence is archived separately; it was not resealed as current. One fresh run per pinned model on 2026-10-20 produced Codex 18/18 and Claude 17/18. Both meet the unchanged 90% aggregate and two-of-three-per-fixture floors. Claude failed the first implementation-approve case; its actual output remains in the evidence.

The resulting direction is Claude-author to Codex-reviewer `not_weaker`, reverse `weaker`. No labels or floor were changed to improve the ranking. Subsequent offline verification confirms corpus/rubric/schema/settings unchanged; no unchanged paid qualification was repeated. This is a six-fixture, keyword-scored qualification with single-run sensitivity, not a general model ranking. Legacy Codex exec does not confirm a model; only the bound app-server path can. Claude uses confirmed stream/modelUsage identity.

## Current checks

Final serial verification is pending at this writing; replace this paragraph with terminal results before delivery. All package runs use `scripts/dev` and the pinned Bun 1.3.14. Requested `bun ci` completed with no dependency changes and wrote the setup marker.

Earlier terminal checkpoints: 119 touched BDD scenarios / 2,285 steps passed; 2,220 fast smoke tests passed; all three package typechecks passed. The final bounded repair passed 67 targeted integration tests, including the unchanged malformed-config test and all six native-copy distribution tests. These counts are declared-checkpoint evidence until the final frozen-source run completes.

All five derived surfaces were regenerated after the final template/code change, and the commit hook verified them current. Parity covers 277 pairs and 11 contracts. Offline capability verification retains the directional result. Diff-scoped architecture/dead-code/test audit ran against the main merge base; repository-wide Knip, duplicate scanning and whole-repository freshness were intentionally outside that audit mode.

End-user boundary: direct `review routes` confirmed the Cursor author route inventory; `review continue` against a consumed real coordinator job returned `REVIEW_CONTINUATION_ALREADY_USED` without mutation. Installed CLI integration exercises `review run`, authenticated continuation, stamping, approve-plan, current-policy refusal and coding authorization using fake reviewer executables. Real qualification uses the actual two model CLIs. These are not proof of native host isolation or human-deferred retrieval behavior.

## Failures retained

- Initial route/fallback suite: 210 passed / seven failed / two skipped. Fixture key roots were inside the untrusted project and inherited a different bundled CLI; fixed by external trusted key roots and an explicit trusted CLI.
- Repair checkpoint: 15 passed / one failed because inherited preferred/alternate models changed an exact array. Tests now check route tiers and preserve a separate unknown-author assertion.
- Regression checkpoint: 384 passed / 21 failed from stale cross-agent stamps on unqualified fake reviews; fixtures now assert actual reduced assurance and keep their refusal checks. Thirty-six affected tests then passed.
- One repair RED combined a contract failure with a naming error and was rejected by Claude. The separated executable RED was independently approved; both results remain.
- First full run was stopped after qualification regeneration made dist stale (exit 143). Its BDD proof title and Claude-argument failures were repaired while preserving exact checks. A second full run was stopped after the CLI checker unexpectedly launched its own Vitest alongside it. Neither is green.
- The overlapping CLI check had 72 passes / one failure in repeated-status stdout consistency; cause was not established. A serialized retry passed unchanged. It is not erased as harmless.
- A broad Cucumber attempt was stopped because configured globs merged with explicit paths; an absolute temporary config path then failed startup. The scoped relative config preserves all standard exclusions and passed 119 scenarios.
- Policy repair interim: 55 passed / one failed because a test helper omitted emitted findings. It now exposes actual findings, retaining exact refusal assertions.
- Final preclosure full run completed: 715 files passed / two failed; 11,566 tests passed / seven failed / 14 skipped. Six were native fake-reviewer cross-agent expectations; one was main's malformed-config diagnostic masked by the new policy check. The original malformed test was not weakened. The final repair and all seven proofs passed in the 67-test targeted run; the frozen-source full rerun remains separately recorded.
- One audit invocation used Bun on a Bash script and failed; the corrected pinned Bash invocation passed. This is a runner error, not a passing audit attempt.
- The first frozen-source retry returned exit 75 because another checkout held the shared package-test lock; no CLI test started. Both smaller packages passed. A documented longer lock wait queues the serial retry without overlap.

## Limits and warning dispositions

Historical broad acceptance remains six failed / 585 unfinished, with 33 accepted cases unverified and 418 undefined child bindings in the old audit. There is no fresh 142/142 aggregate claim. R7 host retrieval/private-injection remains human-deferred. R9's historical wrong-kind receipt recovery did not name the mismatch; that diagnostic limitation remains. #5139's RED/SHA-collision history is outside this slice.

Authentication binds a job, packet and one-use transition; fresh-context/origin claims are host-reported and do not prove isolation. Prompt copy tests prove wording, not that a host follows it. Exact host author-model metadata is required for a qualified cross-agent claim; unknown hosts honestly remain reduced or blocked. The separate architecture gate still needs independent design review or its existing reasoned skip.

Retained adapter warnings: isolated Codex auth.json-only credentials do not prove keyring-only authentication; failed-turn auth classification and candidate-probe/fallback timeout accounting have recovery/latency limits; missing unique final output waits for the deadline. Malformed/noncanonical continuation targets fail closed but can be confusing. Current-policy prerequisite findings and non-approved reduced receipt diagnostics can be generic; they fail closed. The policy-flip test restores config and admits the same receipt, but its planning refusal assertion does not isolate a policy-specific finding. These are explicit follow-ups, not claimed fixes.

## Draft readiness

The PR remains Draft by explicit instruction. Ticket linkage, source comprehension, bounded independent source/test reviews and fresh self-review are documented. CI at the eventual PR head must be terminal before gate 4 passes. R7 and broader unfinished acceptance prevent an epic-completion claim. No merge-confidence or Ready claim is made; the parent ticket remains in its existing state.
