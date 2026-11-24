# Current test quality and refactor assessment

Two independent read-only scouts reviewed the authored diff after integrating
main 47464164c. The runtime pass covered all new policy/runner/admission/journal
and closing boundaries. The test pass covered all 25 BDD scenarios, their proof
map, changed tests, fixtures, historical RED logs and evaluation needs.

## Improvements applied

- The approved-row test now writes a separate VERIFIED claim with authenticated
  review IDs, commits that metadata before attestation, parses the actual claim,
  and proves that removing only the added line recovers the original ledger.
  Attestation and the real public gate leave ledger bytes unchanged. This is
  author-owned claim writing followed by trusted authorization, not an invented
  product ledger-writing operation.
- A real opt-in installation test packs the generated plugin, installs through
  a disposable Codex marketplace, verifies the real cache, removes its package
  and marketplace sources, and exercises the cached observation route. It passed
  without model calls, copied credentials, or real review-record mutation.
  The default portable BDD map remains supporting contract evidence, not a
  substitute for this host installation or retained actual Electron execution.
- The unsafe-input diagnostic now identifies missing/unsupported field names,
  never values. Genuine RED 1dec2fcdd had one failed assertion and 83 passed;
  GREEN 53479a324 passed 87 proof/public-route tests and regenerated delivery.
- The ordinary-ticket protection mapping additionally names authenticated
  cross-policy rejection rather than relying only on invented review IDs.
- Eight real headless Claude semantic cases passed: two valid controls and six
  false-credit hazards. The existing recorder binds guide/case/rubric/prompt
  bytes. Offline grading and always-approve/reject, missing-case, stale-rule
  and hidden-oracle controls run in normal tests. Model identity is an
  operator-selected alias, not provider-attested; summary-packet calibration is
  distinct from production coordinator reliability. Initial reason-label
  ambiguities were corrected in the shared scorer contract, not by weakening
  production reviewer rules. See the separate corpus README and records.

The test scope uses real Git, external processes and authenticated orchestration
where those boundaries matter. Reviewer workers, dependency tools and desktop
processes are synthetic in portable fixtures; those tests never establish a
native desktop walkthrough or real-model judgment by themselves.

## Refactor ledger

| Candidate | Disposition |
| --- | --- |
| Redundant dynamic import of an already statically imported policy | Removed in 7f5ae9ca2; public observation/catalog protection passed 12 tests and generated surfaces verified. |
| Three unused external helper exports | Made module-private in ca2cb66bf; proof contracts, primary authenticated admission, types and generated surfaces passed. No public package export exposed these helpers. |
| Long Electron orchestration | Retained: extracted leaf stages already leave preparation/execution/revalidation/cleanup ownership visible. |
| Repeated enrollment checks in closer and read-only driver | Retained: distinct authority and delivery boundaries need distinct diagnostics. |
| Repeated row admission during closing | Optimization deferred: before/after checks protect authority; no measured defect justifies a cache validity contract. |
| Journal nesting and publication order | Retained: pending ownership must enclose row publication before passed state. |
| Similar row/aggregate result builders | Retained: meaningful identities/effects differ; common CLI envelopes already exist. |
| Repeated policy hashes and membership checks | Retained: small source-owned bindings do not justify configurable enrollment. |
| Legacy/Electron validator similarities | Retained: distinct report and compatibility contracts. |
| Fixed preload program and event names | Retained: runner-owned instrumentation avoids another packaging dependency. |
| Matcher text heuristics | Retained with explicit limits: structured selection, monitoring and independent semantic review are also mandatory. |
| Separate history/proof Git wrappers | Retained: different failure and trusted-tool contracts. |
| Separate row/closing client deadlines | Retained: bounded combined budget fixes a measured cold-read failure. |
| Explicit enrolled-policy dispatch | Retained: two trusted migrations do not need a project-extensible registry. |
| Test-only delivery fixture constructor cleanup | Deferred: it owns only temporary files and does not mutate global environment; unrelated to the already fixed authorization constructor leak. |
| Literal case tables, distinct Git shims, independent expensive fixtures | Retained: static discovery and permanent failed-proof identity make implicit abstraction/shared resets riskier. |

## Historical TDD limit

The source ledger has 24 entirely unchecked RGR histories plus the primary
scenario's unchecked REFACTOR. Several retained logs show genuine assertion
failures, but they are not complete original failing commits for all outline
examples. Inventory, admission, matcher, publication, port and untracked-input
diagnostics provide specific supporting RED observations only. Some purported
RED logs contain import/setup failures or passing runs. Some first test commits
also contain implementation and are GREEN commits, not reproducibly failing RED.
No missing historical source scenario is marked complete from that evidence.

Current behavior, mutation tests and evaluator results cannot reconstruct those
original histories. No source policy was broadened, no skip was fabricated, and
no closure/readiness receipt was hand-written to hide this limitation. The
current verification report must distinguish functional results from formal
source-ticket completion.

Review methods follow the repository testing/eval guides and primary references:
[OpenAI evaluation practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices),
[Playwright Electron](https://playwright.dev/docs/api/class-electron), and
[Node 24.18.1 process contracts](https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html).
