# Verify: K8VPME

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: 11607 passed, 3 failed (run after the qualification tear-out). `lint-go-context` (2) fails because the Go toolchain mixes compile go1.25.14 with go tool go1.27.1, identically on main. `bdd-proof-adapter` (1) used a step from a removed qualification scenario; repointed to a surviving step and now passes. A second pass also hit a load-only timeout in `review-candidate-share`, which passes alone and in the first pass.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios, 11786 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint on changed source and tests; prettier applied)
**Typecheck:** ✅ Clean (`tsc --noEmit` in packages/cli)
**Scenarios:** ⏭️ Skipped — task ticket with inline tests, no test-definitions.md
**Refactor:** ✅ Completed — 7dfab30c6 (inlined the funding check, renamed the all-routes-tried test); removal leftovers cleaned in place
**PR Scope:** ✅ Diff matches ticket scope. The coordinator, policy, admission, hooks, schema and skill docs implement non-blocking independence. Dogfood features T3E4NS R4 and DR6M6N NTB1.R3 were rewritten because they encoded the reversed rules. Generated surfaces and the dogfood install were regenerated.
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction. Walked a Claude author through plan-execution review with no admitted Codex reviewer; worst step before = `REVIEW_ROUTES_EXHAUSTED` dead end; now the admitted Claude route reviews and the receipt says `reduced`; new steps vs before = 0
**Surface Evidence:** ✅ Safeword CLI: `bun run test` (planning-review-*, review-wiring, coding-authorization, phase/architecture gates) plus cucumber acceptance lane
**Evidence limits:** ⚠️ Go toolchain version mismatch fails `lint-go-context` and `govulncheck` on unmodified main too; dependency audit reports pre-existing advisories (fast-uri; Python certifi, filelock, msgpack) unrelated to this change. The root dogfood acceptance lane (not run in CI) still has 9 test-count mismatches in `turn-decisions-into-startable-work` proofs whose expected counts and test files this change did not alter.

## Qualification removal (2026-11-07)

User decision: no reviewer qualification. Every review kind uses Claude `opus`→`sonnet` or Codex `gpt-6.1-sol`→`gpt-6.1-terra`. Removed the Execution Plan admission, capability corpus, evaluation harness, generated catalogue and their tests and scenarios. Package tests, both acceptance lanes for edited features, release tests, proof map, lint and typecheck pass.

Lifecycle origin-main fixtures: `cursor-install` and `cursor-uninstall` result hashes changed because the removed `session-author-model.ts` hook no longer appears in their created/removed file lists.

## Quality pass (2026-11-07)

- **TDD review:** one gap found and fixed. No test exercised the trial's headline case, so `review-wiring.test.ts` "gives a Claude-authored Execution Plan a reduced review from the admitted Claude route…" was added (b2f95c9c4). It fails when the old no-independent-route guard is restored. Each new fallback test was mutation-checked the same way.
- **Quality review (Codex, cross-agent), 6 passes:**
  1. Signed-out reviewer blocked the review. Fixed (68bc47a68).
  2. Run-budget exhaustion blocked the review. Fixed (4273a4754).
  3. Terminal failure blocked the review. This was the third error in the same class, so the class was closed (6293c6517).
  4. Ordinary-review fallback launched another reviewer after a terminal failure. Pre-existing on main; fixed (c54dc4d9d).
  5. Insufficient context; resent.
  6. Host continuation could let an unadmitted host approve an Execution Plan. Resolved by the user's later decision to remove reviewer qualification: there is no admission left to bypass.
- **Audit:** architecture clean (depcruise: no violations; sync-config current). Three documentation-drift errors fixed: README, website configuration page, and ARCHITECTURE.md (new superseding ADR). No surface or persona drift. No weak test patterns added.
- **Not done:** skill text for `REVIEW_AUTHENTICATION_REQUIRED` is now inert (the code no longer emits it) and is pinned by contract tests; its clean-up is a follow-up.

## Final quality pass after qualification removal (2026-11-07)

- **Refactor:** f9c0a11c2 and fad9207cb (one way to attach route models; return routes directly; corrected the model-default note).
- **TDD review:** changed tests assert exact model order and route lists; each new fix has a test confirmed to fail without it.
- **Quality review (Codex gpt-6.1-sol, cross-agent), 7 passes:**
  1. Legacy fallbacks launched with no model. Fixed (56458b19e).
  2. Planning routes dropped a reviewer whose CLI cannot select a model. Fixed (0a68ae61c).
  3. Insufficient context; resent with compile and admission evidence.
  4. Fallback reviewers never got the Sonnet/Terra alternate. Third error from one cause (each route path applied the model policy separately), so the class was closed with one per-agent model chain (404b807f9).
  5. Fallback results lost the failed attempt's request record, and ordinary configured routes could run the author first. Both fixed (4c9da3e2a).
  6. The chain stopped before checking provenance, so an answer for the wrong dispatch skipped the alternate. Fixed (9c7d4ff1d).
  7. **Approved** (review 0a3405b4). One non-blocking warning: when a fallback completes on its alternate model, the receipt does not name the model that reviewed.
- **Audit:** two documentation-drift errors fixed (09d939630); the doc test that pinned the old wording was updated (5eb246cd5). Depcruise clean; no references to deleted code remain.
- **Gap noted:** the local pre-commit surface check reported plugin bundles current after a `src/review` change; only CI caught that they were stale.

