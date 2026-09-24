# Verification: Make agent handoffs decision-complete

## Verify Checklist

**Test Suite:** ✅ Exact-head GitHub CI run `36006176966` ran the root `bun run test` command successfully on Node 22 and Node 24 after the final code, fixture, generated-copy, and documentation changes; that command covers retro-relay, retro-collector, and CLI packages. The combined focused evaluator and Stop-hook regression set passes 246/246; retro-relay passes 198 with its optional Docker qualification skipped; retro-collector passes 153. Older host-saturation results are superseded by this clean exact-head run and are not used as completion evidence.
**Gherkin:** ✅ Exact-head CI run `36006176966` ran the repository's full `bun run test:bdd` acceptance lane successfully on Node 22 and Node 24. The recorded full-lane result is 1,617 scenarios with 3 skipped and 75,790 steps with 4 skipped; the final feature-only run passes all 121 expanded Cucumber scenarios and 5,566 steps in `features/make-agent-handoffs-decision-complete.feature`.
**Build:** ✅ Success
**Lint:** ✅ Clean
**Typecheck:** ✅ Clean
**Scenarios:** ✅ All 154 RED/GREEN/REFACTOR lifecycle entries in `.project/tickets/ASG60P-make-agent-handoffs-decision-complete/test-definitions.md` are complete with a commit or an explicit reviewed reuse/skip reason. The ledger records up to three lifecycle entries per authored scenario, while the 121 Cucumber count is the feature's executable scenarios after Scenario Outline expansion; the counts measure different things and are not expected to match.
**Refactor:** ✅ Cross-scenario refactor completed in `959ecc66c`; subsequent test-only commits moved parity proof to the real CLI boundary. Negative-control scenarios `Version drift fails parity for every delivered copy`, `A missing delivered contract copy fails parity`, and `Decision-role drift fails parity at the canonical version` prove the failures remain discriminating.
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ The intended automatic one-shot rewrite adds no user step and makes an incomplete handoff actionable. Exact-head CI scenario `Each installed native terminal boundary corrects every incomplete long-form corpus case once` proves the installed host correction names the missing requirements; the manual Claude Code walkthrough additionally observed all five roles in one correction.
**Surface Evidence:** ✅ 4/4 affected surfaces have recorded proof
**Evidence limits:** ✅ The final exact-head hosted matrix supersedes the earlier saturated local run: both Node lanes, the full `test:bdd` acceptance lane, build, lint, typecheck, dependency audit, release contracts, and the dedicated Dogfood parity job are terminal and green in run `36006176966`.

The retro-relay skip is its Docker-only production-image qualification; the hosted runners did not expose a usable Docker daemon, so the optional qualification skipped while all 198 portable relay tests passed. Repository-level acceptance skips are tagged conditional/manual coverage outside this ticket; every one of this feature's 121 expanded scenarios passed.

Audit passed — diff-scoped dependency boundaries, parity, principle-trace integrity, changed tests, generated-copy alignment, and impacted documentation were checked. README/reference corrections were included before exact-head CI run `36006176966`, which reran lint, build, tests, and acceptance successfully.

## Surface Evidence

| Affected surface | Proof command or manual check | Result |
| --- | --- | --- |
| Claude Code, OpenAI Codex, and Cursor native boundaries | Exact-head CI run `36006176966`: `bun run test:bdd:acceptance` executes all host example rows in `Each installed native terminal boundary...`, `A prior session's correction...`, and `An intervening compliant stop...`; the combined run covers Claude correction state, Codex current-turn tool attribution, and Cursor edit-marker/loop-count behavior | Passed on Node 22 and Node 24 |
| Safeword CLI delivery | Exact-head CI run `36006176966`, Dogfood parity and release-gate steps (`bun scripts/parity-check.ts --mode=all`) | All 264 pairs and 11 contracts synchronized |
