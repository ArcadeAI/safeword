---
id: Y4ZAAY
slug: prove-cross-provider-review-before-scaling-spend
type: feature
phase: implement
phase_anchors:
  - define-behavior: .project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/spec.md
  - scenario-gate: .project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/features/prove-cross-provider-review-before-scaling-spend.feature
  - plan-implementation: .project/tickets/Y4ZAAY-prove-cross-provider-review-before-scaling-spend/impl-plan.md
status: in_progress
scope:
  - Run ten development review attempts over the anchored void corpus, retaining its legacy author provenance without relabeling it and using OpenAI GPT-5.6 Terra as the only reviewer model.
  - Add a genuine OpenAI Responses API repository-reading tool loop and retain provider-native response envelopes, route identity, usage, and standard-tier cost.
  - Reload durable accounting before every attempt and stop before a later attempt once ten attempts have started, observed spend reaches $15, or cost evidence is incomplete.
  - Mark every output diagnostic-only so it cannot satisfy confirmatory scoring or spend authorization.
out_of_scope:
  - Generating the fresh Claude-authored confirmatory corpus.
  - Running more than the first ten development attempts.
  - Producing confirmatory estimates or authorizing confirmatory spend.
  - Changing published Safeword CLI behavior.
done_when:
  - No-cost tests prove actual OpenAI routing, attempt counting including retries, equality and resume boundaries, overshoot retention, missing-cost failure, usage/cost reconciliation, and diagnostic-only isolation.
  - The pinned adapter and ticket-local runner pass their targeted and full verification suites.
  - One ten-attempt Terra canary completes or stops earlier for the recorded $15 or incomplete-cost condition, with every raw attempt retained.
created: 2026-08-11T15:18:50.995Z
last_modified: 2026-08-11T15:18:50.995Z
---

# Prove cross-provider review before scaling spend

**Goal:** Run a bounded development-only canary over the legacy-provenance corpus using only OpenAI GPT-5.6 Terra for review, with durable attempt and cost stops.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- Completed the read-side append-chain reconciliation TDD slice. Reload now strictly validates and byte-matches sequenced upstream/local attempt starts and cost completions, preserves independent attempt and cost completeness, conditionally cross-binds valid start/completion identities, checks cumulative picodollar arithmetic and raw-response/native-usage digests, rejects cross-kind receipt reuse, and enforces both the ten-attempt cap and authorization receipt budget. Adversarial coverage includes unfinished attempts, rollback/missing records, duplicate/out-of-order identities and sequences, foreign/swapped bindings, inconsistent heads, arithmetic drift, and independently falsifying cap/budget cases. The controller suite passes 88 tests and both ticket suites pass 120. A degraded-independence Codex fallback review approved after three passes drove and verified the independence, uniqueness, cross-binding, and authorization-bound fixes. The repository full suite reached 7,172 passing tests and 9 skipped but failed 9 timeout-sensitive tests plus one 60-second integration hook while several other worktrees were running test suites; none touch these ticket-local files. No paid API calls were made, and the protected legacy corpus remained untracked and untouched.
- Completed the crash-safe initialization/reload TDD slice over real temporary directories. Initialization consumes the trusted upstream authorization before local creation, validates the exact zero receipt, exclusively creates and fsyncs an authorization-bound marker plus zero attempt/cost journals, and never repairs missing or edited state. Reload and reinitialization fixtures cover unavailable/unreadable upstream state with arbitrary bytes, deleted ledgers, absent/forged markers, planted ledgers, both one-ledger-missing directions, valid progressed append-only ledgers, altered/extended receipts, strict one-line/exact-schema mutations, a file planted between preflight and `wx`, forged non-zero genesis, and asymmetric non-zero upstream heads. The controller deliberately fails all non-zero heads closed until the next append-chain parser slice exists. Targeted ticket tests now pass 89 cases. Multiple fallback TDD reviews found and drove correlation, strictness, preservation-matrix, and all-or-nothing head fixes; the final fresh-context Codex re-review approved with degraded independence. No paid API calls were made.
- Added the pure pre-dispatch decision core with 31 offline tests covering attempt ten eligibility, attempt/cost stops, exact adjacent-picodollar behavior around $15, incomplete-accounting suppression, exhaustive combined reason sets, missing authorization, post-completion threshold crossing, malformed runtime primitives, and unsafe integers. The first fallback TDD review found coarse dollar boundaries and asymmetric reason/type gaps; all were fixed and the fresh-context Codex re-review approved with degraded independence. Durable/resume and physical no-request feature scenarios remain unchecked until the controller I/O proves them. No paid API calls were made.
- Completed the ticket-local Terra evidence/pricing TDD slice with 32 offline fixture tests: strict attempt/request/response parsing, unique turn correlation and journal sequences, equal-count swap rejection, intent/request/response ordering, native Terra/default route validation, known foreign-provider usage rejection, exact integer-picodollar pricing across mixed cached/cache-write input at 271,999/272,000/272,001 tokens, absent optional-detail normalization, multi-turn summation, recomputed corpus digests, and exact registered provenance copying into JSON-serializable diagnostic manifests. The first fallback TDD review found four falsification gaps; all were fixed and the fresh-context Codex re-review approved with degraded independence. Claude was not retried after two earlier long review timeouts. No paid API calls were made.
- Completed the first TDD slice: provider-keyed production runner dispatch now routes both repository reading and finding verification through recorded OpenAI Responses calls, rejects route/status drift, preserves encrypted stateless reasoning replay, answers every tool call, bounds time and verifier concurrency, and surfaces refusals and verifier failures. The full review-tool suite passes 277 tests; Biome and diff checks pass. Typecheck remains limited to the same two pre-existing benchmark-fixture errors (missing `terminalState`, and missing schema-failure `raw`/`source`). Claude found and drove fixes in two earlier passes, then timed out twice on the expanded packet; a fresh-context Codex fallback requested three protocol fixes and approved after they landed. Independence is therefore degraded, not cross-model. No paid API calls were made.
- The degraded-independence implementation-plan review approved the corrected design after retries were restricted to downstream failures with complete priceable accounting; unpriceable OpenAI transport failures now block the output identity without any retry.
- Degraded-independence plan review found that static upstream authorization could not detect local ledger rollback, hidden HTTP retries could bypass attempt inventory, and only the adapter was pinned. The revised plan uses bounded immutable upstream start/completion receipts, zero automatic retries, and clean tagged pins for both adapter and harness code before paid dispatch.
- Plan and independent reviews exposed scenario-level falsification gaps; the set now has 45 scenarios, including stubbed observation of the real outbound OpenAI route, physical no-retry observation, full local/upstream receipt reconciliation, negative intent-ordering cases, exact later-turn cost retention, default/CI paid exclusion, authorization author/repository/replay binding, and non-refundable provenance-invalid usage.
- Claude's earlier review covered the 39-scenario version. After later hardening, two Claude review attempts reached their configured time limit; a fresh-context Codex fallback approved the current 45-scenario set with degraded independence after requiring physical no-retry and full receipt-content reconciliation coverage. This result is not represented as Claude approval.
- Revised the scenario set after independent adversarial hardening: thirty-nine focused scenarios now use a consumed one-time upstream authorization as the initialization trust root, fail closed on unavailable or unreadable upstream state, reject every local reset/plant/forge path, and retain the verified provider, spend, provenance, and confirmation boundaries.
- Intake converged from the user's explicit session decisions: this remains a feature because genuine cross-provider routing, durable spend state, and evidence-role isolation are independently valuable behaviors; scope stops after the first ten-attempt development checkpoint.
- The user confirmed the target experimental roles and first checkpoint across the existing #1910 session: Claude authors the future fresh corpus/code, OpenAI GPT-5.6 Terra reviews, the old corpus is development-only, and the first checkpoint is ten attempts with a $15 observed stop. The old corpus has no durable Claude-author proof, so this diagnostic run preserves its legacy provenance instead of relabeling it.
- Isolated this slice from CWGYH0 after independent scenario review showed that reopening its monolithic recovery feature would mix the canary with unrelated legacy scenario debt.
- 2026-08-11T15:18:50.995Z Started: Created ticket Y4ZAAY
