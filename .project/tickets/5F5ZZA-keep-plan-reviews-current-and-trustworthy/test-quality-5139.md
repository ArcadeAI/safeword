# BDD and TDD assessment follow-up

This continuation follows the user's request to improve the tests assessed at
`7fa307972`. It adds free regression coverage, not a new qualification collection
or a claim that the historical scenario ledger is complete.

## Intended proof and limits

| Concern | Improved proof | Limit |
| --- | --- | --- |
| Retained passing flags | Import the actual live harness, capture and invoke its setup, and compare a saved response with the current oracle before checkpoint replacement; include passing and failing controls | Test registration is intercepted and paid dispatch throws; this does not exercise a real provider |
| Provenance | Start with valid evidence, then independently corrupt model confirmation, provider, output pairing, or per-output dispatch mode | Exact headless conformance only; no acceptance/CLI recovery |
| Source preservation | Refuse overlapping source/destination checkpoint carriers, including resolved aliases, and refuse combined replay/retention input | A preflight refusal only; no recovery or historical evidence rewriting |
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
