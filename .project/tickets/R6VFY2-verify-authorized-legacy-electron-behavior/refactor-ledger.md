# Refactor and test-lifecycle ledger

Read-only scouts inspected all 11 runtime modules, 19 test files, four fixtures,
the delivery/rollback boundary, and the 25-scenario proof map. The runtime scout
found no warranted behavior-preserving code change. Test lifecycle corrections
are bug fixes and must remain separate from the one small structural refactor.
The full verification run's source inputs remain frozen until it finishes.

| Order | Finding | Disposition and proof |
| --- | --- | --- |
| 1 | Author-only configuration Given is missing in the author-receipt test | Fixed in f38e4f19e: commit the actual project setting before reviewed receipts; all nine authorization cases pass with refusal-before-replay assertions retained. |
| 2 | Authorization fixture construction can leak environment and owned directories when initial observation fails | Genuine RED 4aa2bbae0 failed PATH restoration after controlled frozen-install rejection; GREEN 8ced691a3 cleans the same owned resources. Regression plus authorization tests: ten passed. |
| 3 | Concurrent-journal test may tear down before its first owned replay settles after an assertion failure | Fixed in 176b52074: release and await the owned promise before teardown. Journal tests and all isolated broader failures: 160 passed. |
| 4 | Default review-worker write is overwritten by every review before dispatch | Refactored separately in bd409ac5a: delete only the unused initial write. Authorization, failed-construction and policy-receipt protection: 12 passed. No helper added. |
| 5 | Five closing-negative cases each prepare all 17 rows | Retain: exact inventory is a precondition, and each failed proof ID stays consumed. Sharing would require more complex identity, journal, and environment ownership. Assess actual deadline failures separately. |
| 6 | Repeated literal outcome tables and explicit identities | No change: static proof discovery needs literal cases; explicit identities reveal the tested boundary. |
| 7 | Embedded tool/reviewer programs and distinct Git shims | No change: they simulate different external boundaries. A shared abstraction would conceal the confidence limits. |
| 8 | Repeated policy hashing across runner, gate, journal and closing | No change: small expressions bind the same source-owned policy without extra coupling. |
| 9 | Similar legacy and Electron mutation validation | No change: their execution and receipt contracts differ; preserving legacy semantics is more valuable than a configurable helper. |
| 10 | Similar row and aggregate result builders | No change: identities and effects differ, and the common result envelope already exists. |
| 11 | Long Electron orchestration function | No change: leaf stages are extracted, and its ordered preparation/execution/revalidation/cleanup remains clear. |
| 12 | Repeated admission during closing | Defer optimization: before/after checks protect authority. No measured need justifies cross-invocation validation reuse. |
| 13 | Journal ownership and row publication order | No code change: pending ownership encloses publication, and passed state is published afterward. Reconcile the plan description. |
| 14 | Static proof-map inventory grows with the new feature | Independent quality review d84537b7 approved the disclosed 75-to-88 shared-declaration baseline change, noting it explicitly as information; maximum fan-in stays 14. No artificial wrapper tests added. |

Delivery evidence must distinguish portable fixtures from actual supported
installation and installed Electron execution. The retained installer/hash checks
and real observations supply that boundary. Ordinary-ticket protection should
cite both invented-ID closure rejection and authentic foreign-ticket rejection.
No candidate is silently omitted; pending rows remain unfinished.
