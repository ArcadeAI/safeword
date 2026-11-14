# Resume #5086 from main

Base: 150eb7c619b2d5852174da99ba675ae326354153 (#5957 and #5980 retained).

Scope: ranked reviewer routes, qualified exact capability/model provenance, authenticated single-use host continuation, honest reduced-independence admission. Excludes #5139 semantic scope enforcement. Reconcile only the own-slice delta from #5086, never merge its branch.

Primary proof: installed CLI integration in tests/integration/planning-review-fallback.test.ts exercises review run, sealed continuation submission, stamping and phase admission. Mock only reviewer executables. Route-order integrations additionally prove independent-first selection and provenance limits; job tests prove authenticated mutation/replay/staleness.

RED: scripts/dev bun run test tests/integration/planning-review-fallback.test.ts tests/integration/planning-review-route-order.test.ts tests/integration/planning-review-weaker-route.test.ts failed 14/14 on main. Actor-visible differences include degraded rather than reduced, blocked rather than continuation_required, and unqualified cross-agent admission. Weaker-route test mocks the new provenance API and is supplemental only until that API exists. Retro relay 198 passed/1 skipped; collector 153 passed. Initial lock wait was respected, no concurrent test process started.

GREEN plan: reconcile own-slice production changes against main, retaining installed-copy validation, semantic context/dispositions and all stronger tests. Restore only slice-specific qualification tooling/evidence; regenerate offline. Do not rerun unchanged paid qualification.

Historical failures and deferrals remain: broad acceptance 6 failed/585 unfinished; 33 accepted cases unverified; #5086 R7 host retrieval/private-injection human-deferred; wrong-kind receipt recovery R9 needs regression; historical Claude approval and check counts are not current-head evidence. No merge or Ready authority.

Completion: targeted regression tests, generated surfaces and parity, appropriate final checks, independent Claude review, surgical self-review, truthful Draft PR pushed. Preserve all limits.

Delivery record: [Draft PR #5995](https://github.com/ArcadeAI/safeword/pull/5995). The frozen-source local suites pass; the inherited dependency-audit failure remains a CI blocker. See `verify-5086.md` for terminal results, bounded Claude reviews, failed attempts and deferrals. Parent phase/status is unchanged. No merge or Ready promotion.
