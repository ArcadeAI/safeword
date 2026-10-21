# BDD and TDD assessment follow-up

This continuation follows the user's request to improve the tests assessed at
`7fa307972`. It adds free regression coverage, not a new qualification collection
or a claim that the historical scenario ledger is complete.

## Intended proof and limits

| Concern | Improved proof | Limit |
| --- | --- | --- |
| Retained passing flags | Import the actual live harness, capture and invoke its setup, and compare a saved response with the current oracle before checkpoint replacement; include passing and failing controls | Test registration is intercepted and paid dispatch throws; this does not exercise a real provider |
| Provenance | Start with valid evidence, then independently corrupt model confirmation, provider, output pairing, or per-output dispatch mode | Exact headless conformance only; no acceptance/CLI recovery |
| Source preservation | Refuse overlapping retained-checkpoint source/destination carriers, including resolved aliases, and refuse combined replay/retention input | Replay-only source/destination overlap remains outside this guard; current probes use distinct destinations |
| Interrupted checkpoint writes | Force real filesystem failures after output replacement and before metadata/results completion; require the old results marker to remain and mixed observations to be refused | This is write-failure coverage, not comprehensive crash recovery or fsync durability |
| Ranked BDD routes | Put the capability-refused selector and typed failure in every outline row and assert them through the real CLI | External reviewer executables remain fakes; no semantic qualification |
| One-change rationale | Reject examples where unrelated negation or the word “would” previously passed the inseparability check | A bounded lexical filter cannot establish semantic reasoning quality |
| Scope/persona judgment | Preserve the instruction-delivery checks as structural evidence | No automated semantic acceptance proof is claimed for omissions, overreach or persona judgments |

## Retained semantic disagreements

The original exact Codex collection remains 38/63 passing with all 25 failures
retained. The corpus, expectations and saved provider outputs are unchanged.
No paid replay or model recollection is performed in this follow-up's test work.

The direct `packetFor` probe sends the Execution Plan, Implementation Plan,
scenario and reviewer identity. It does not use the production owned-plan context
resolver. The common Implementation Plan supplies obligation names and two
architectural decisions; the current shared contract requires binding context
and rejects unresolved accepted choices. These are concrete contextual confounds
for treating all expected approvals as known-good plans.

| Disagreement | Evidence-based disposition |
| --- | --- |
| 15 expected approvals routed to Implementation Planning | The saved findings identify missing accepted contracts/context; inspect and resolve fixture completeness before attributing these to reviewer defects |
| 3 expected approvals rejected in Execution Planning | `accepted-data-ownership`, `complete-measurement-execution`, and `test-command-discovery-stays-in-execution-planning`: retain the refusal and inspect startability/completion details against the accepted requirement |
| 4 expected rejections routed to Implementation Planning instead of Execution Planning | Missing upstream authority can dominate the seeded execution defect; a destination expectation is confounded until that context is established |
| 3 expected rejections matched verdict and destination but failed further assertions | `two-independent-purposes`, `migration-missing-dependency-order`, and `later-step-is-not-startable`: their saved findings identify the intended defects; inspect the failing lexical/record assertion before judging these as missed defects |

This is an adjudication of what the observations support, not relabeling of the
oracle. A future corpus revision needs explicit accepted upstream contracts,
paired defect/control fixtures, and independent review before any newly changed
qualification run. Claude's passing collection does not settle the disagreement.

The three matching-verdict/destination cases expose literal wording limits:
`two-independent-purposes` requires “two” although the finding describes the
combined contract and public activation; `migration-missing-dependency-order`
requires “dependency order” although the finding requires Migration as a
prerequisite to activation; `later-step-is-not-startable` requires “before
implementation” although the finding requires resolving the user-visible choice
before renewed execution review. These are candidate lexical false negatives,
not newly passing cases. Their expected terms and saved failures remain intact.

## Evidence integrity

Historical missing RED, the GREEN/REFACTOR SHA collision, six historical failures,
585 unfinished checks and 33 deferred/unverified cases remain unchanged. New
characterization tests are not historical RED. A deliberate mutation is evidence
that a regression test detects that mutation, not proof of a production defect.

Editing the live harness changes its oracle digest. Prior qualification metadata
remains attached to its original source revision; it must not be restamped as
current. The existing Execution admission artifact remains stale and the PR
remains Draft. This continuation does not implement #5857 recovery or #5486
runtime isolation.

## Executed evidence

- Test-first `3c3e7f9a9`: 4 intended failures and 16 passes; `b7f2e9ff1` passes all 20 after the headless-mode and rationale guards.
- Review follow-up test-first `f3e723c7e`: 10 failures and 20 passes (five missing preflight refusals, three pairing diagnostics, two valid phrasings rejected); `f3f5f2974` passes all 30. On-disk marker cases characterize existing refusals rather than inventing new RED.
- Final focused run: nine files and 147 tests pass, 50.08 seconds. This is not a new full-suite result.
- Real CLI BDD outline: four scenarios and 200 steps pass. Deliberately changing the refusal reason produces one failed scenario and three passing scenarios; restoring the expectation restores the passing outline. The full 601-scenario aggregate was not repeated.
- Deleting the retained-output revalidation loop makes its mismatching-output control fail while its matching-output control passes (ten other cases filtered). Source was restored byte-for-byte before final verification. This is mutation sensitivity, not a historical production RED.
- Final zero-inference Codex replay: all 63 per-case results exactly match the saved collection, 38 pass and 25 fail. Vitest reports 39 passes including metadata and 25 failures, exit 1. Its current oracle digest is `982ed387e7b0ee82465fd1022b37a3047755800d1e6d55f132d0e028c986766b`; metadata explicitly says `mode: replay`. No paid qualification was repeated and no admission artifact was regenerated.
- Changed-file ESLint, CLI typecheck, Gherkin lint and formatting pass; all five generated surfaces remain current. The first test-lock attempt exited 75 without starting tests; queued waits are not RED. An unsupported Prettier `.feature` invocation was observed as a tooling error, followed by passing Gherkin lint and supported formatting checks.

## Independent review dispositions

Cross-agent Claude review `84986cd6-6185-4053-b9cd-222369d6f2c0` approved the initial delta with warnings. Its source-overwrite concern is addressed by preflight refusal of carrier collisions, including canonical aliases and sidecar overlap; combined replay/retention input is refused. Pairing failures now have their own diagnostic. Saved responses explicitly skip original packet-dispatch binding because the original packet is unavailable; the live headless path retains real dispatch binding. The replay control selects a named fixture instead of relying on corpus order. On-disk metadata guards and two valid rationale phrasings have direct tests.

The follow-up review packet supplies both passing and deliberate-failure BDD logs, plus the 10-failure RED and 30-pass GREEN logs. It reviews the actual committed delta from `b7f2e9ff1` to `f3f5f2974`, verified byte-identical to the patch below; it is not a review of an unapplied proposal.

File-level retained-source attribution, the test writer accepting corrupt input, and bounded lexical rather than semantic rationale judgment remain disclosed limits. No per-case recovery mechanism or historical packet/serving-model confirmation is invented.

Reviewed follow-up patch SHA-256: `8905ab3e4937820ab2e09f0a4d5708ecc21d7c921ff31b4aca3ff34667537106`.

Follow-up cross-agent Claude review `23a7b820-4096-4856-b72a-5354553b34ee` approves the committed functional delta. Its remaining findings are answered as follows:

- Replay-only source/destination overlap is pre-existing and outside the retained-checkpoint guard. The test title now names retained-source collisions and combined modes precisely. Broader replay/recovery hardening remains deferred under the user's #5857 exclusion; every current replay invocation uses a distinct destination and preserves its original input artifacts.
- The reader already rejects duplicate raw case IDs before the pairing count check. Unique raw IDs plus filtering to passing IDs and equal cardinality establishes the claimed pairing; `[A,A]` cannot reach that count check.
- The rationale example says the whole contract is independently reviewable, not that its component changes are independently deliverable. The lexical gate still cannot prove semantics or rule out contradictory prose; that disclosed limit remains, and no acceptance or qualification claim is gained from it.
- Selecting the named `generic-checklist` fixture is an explicit stable fixture dependency. Its current expected verdict is rejection; changing that fixture would fail both controls rather than silently passing. A more specific precondition diagnostic is deferred.
- Metadata-marker cases are characterization coverage, already identified above. File-level source attribution and the corruptible test writer remain bounded fixture choices.
- Hard-linked destination names are replaced by atomic rename rather than writing through the source inode. An unset results path does not write any checkpoint; the existing live identity test rejects the missing destination. Neither observation demonstrates loss of the retained source.

After review, only the test title and evidence prose changed; the reviewed functional source is unchanged. No additional RED, semantic qualification, full-suite pass, historical repair or feature closure is inferred from either approval.

Final supported project reconciliation touched exactly the four previewed dogfood files, with empty package/configuration/network/destructive effects. All 277 parity pairs and 11 contracts match; all five generated surfaces are current. The shared official runtime SHA remains `c535706afa985ac3e76fa83b0d033baf9d42ed17eb08a245de1085d9cdc5e6a1`. The mandated profile-install retry failed on the reported 1.1.0/installed 1.2.0 version mismatch and left project hooks unchanged; no candidate profile was activated. All 212 archived artifacts verify against their uncompressed byte counts and SHA-256 entries, including the 32 new follow-up artifacts. The new-artifact credential-pattern scan found no matches.
