# Work Log: Keep override regressions fast

**Anchored to:** `.project/tickets/5KHSQB-keep-override-regressions-fast/ticket.md`

---

## Session: 2026-07-26

- [07:48] Full suite GREEN: 370 files; 5,473 passed, 5 skipped, 0 failed;
  397.95s runner wall. The target file measured 22.52s in-suite versus the
  earlier 68.27s profile.
- [07:48] Static validation GREEN: ESLint, Gherkin lint, and typecheck.
- [07:41] REFACTOR: boundary now pins all four fixture links, the exact
  install-disabled upgrade call, and hook spawn/status/output guards.
- [07:40] GREEN: boundary 1/1 and override integration 10/10 passed. Isolated
  runtime fell from 91.03s to 43.94s (47.09s / 51.7%).
- [07:40] Reassessment: four TypeScript upgrades consume ~8.2s and four real
  hook runs consume ~17.9s. Further reduction would consolidate required
  examples or change production-hook subprocesses, both outside this ticket.
- [07:37] RED: the new boundary test failed on missing `linkRepoToolchain`.
- [07:28] Baseline: 10/10 passed in 91.03s. First scenario in each of four
  fixtures took 12–20s; later examples took 2–6s.
- [07:29] Full skip-install probe: 24.41s, 9/10 passed. The no-console positive
  proof failed because `bunx eslint` lacked a fixture-local toolchain; negative
  assertions could otherwise pass on launcher failure.
- [07:31] Skip-skills-only probe: 10/10 passed in 63.92s, proving unrelated
  skill installation accounts for about 27s.
- [07:34] PATH/NODE_PATH probe with installs skipped still failed the no-console
  proof. Bun's package executable/config resolution needs fixture-local
  `node_modules`; environment-only reuse is insufficient.
- [07:36] Decision: link the repository toolchain into fixtures, skip installs,
  keep all ten examples, and add an explicit hook-launch failure guard.
