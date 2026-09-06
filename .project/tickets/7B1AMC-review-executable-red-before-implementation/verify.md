# Verify: Stop hollow acceptance proofs before implementation (7B1AMC)

Verified: 2026-09-06T17:24:57Z

## Verify Checklist

**Test Suite:** ✓ 9,205/9,205 tests pass (561 files; 16 skips)
**Gherkin:** ✅ Acceptance lane passes (592 scenarios; 11,046 steps)
**Build:** ✅ Root TypeScript packages build successfully; website production build has the evidence limit below
**Lint:** ✅ Clean (ESLint, Gherkin lint, TypeScript, Markdown, and Astro diagnostics)
**Scenarios:** ✅ All 15 scenarios have executable proof registrations; 46/46 ledger cells are complete, including the cross-scenario row
**PR Scope:** ✅ The 56-file branch diff matches issue #2336: trusted execution, durable receipt binding, failure attribution, CLI/workflow surfaces, generated assets, docs, and ticket evidence
**Dep Drift:** ✅ Clean (no dependency changes; dependency-cruiser reports 0 violations across 407 modules and 692 dependencies)
**Parent Epic:** ⚠️ AK0QJR remains in progress; 1/6 children is currently done, and 7B1AMC is the next completed delivery pending user confirmation
**Reconcile:** ✅ The implemented design matches the recorded decisions; one declared-input/sandbox limitation remains documented in `impl-plan.md`
**Experience:** ✅ Walked the TBU/NTB through the advisory flow; worst step = composing JSON argv and declaring support files; new steps vs before = 1
**Evidence limits:** ⚠️ Independent external judgment was not executed because the host approval reviewer rejected transmitting the bounded source/ticket packet. Generated cloud-host parity is verified, but no live Claude/Codex/Cursor cloud session ran. The POSIX descendant-kill path ran locally; the Windows `taskkill /t` branch did not. The website Astro check is clean, but its production build is locally blocked by the missing optional `@bruits/satteri-darwin-arm64` binding.

## Evidence

- Full CLI Vitest: 561 files passed; 9,205 tests passed; 16 skipped; zero failures.
- Full Cucumber: 592 scenarios and 11,046 steps passed, plus one passing hook.
- Focused executable-RED and contract regressions: 179/179 passed. The prior full-load candidate-share failure passed in the final full suite and in the focused seven-file run.
- Root lint and typecheck are clean. Root package build succeeds for retro-relay, retro-collector, and the CLI. Website `astro check` reports 0 errors, warnings, or hints.
- Generated Claude historical catalogue, Claude plugin release contract, workflow negative control, CLI reference, and generated Claude/Codex tree comparisons pass. The combined CLI checker's machine-contract lane timed out under a deliberately restricted pinned-Bun PATH; the same file passed 3/3 in isolation and in the 9,205-test full suite.
- Diff-scoped audit passed with 0 ticket-local errors: Safeword config is in sync; dependency-cruiser found no violations; Knip, duplication, and dependency freshness are intentionally repository-audit-only checks. The principle checker found pre-existing broken references in CKWE2D and 3F5Z6P; 7B1AMC's one dead proof reference was repaired and its rerun is clean.
- Test-quality review covered seven changed test files. Assertions are outcome-specific, state is isolated, timeout cases exercise the timeout contract rather than sleeping the test, and repeated cases use static tables. No test-quality finding remains.
- Configured documentation coverage is `README.md` plus `packages/website/src/content/docs`. The directly affected review guide and `ARCHITECTURE.md` describe the trusted execution, freshness, advisory, and recovery contracts; the generated package map agrees with the architecture narrative.

## Surface Evidence

| Surface | Evidence | Limit |
| --- | --- | --- |
| Safeword CLI | Real built-CLI wiring test plus full protocol and integration suites | None |
| Claude Code local | Canonical source install, dogfood copy, generated plugin, historical catalogue, and parity tests | No manual interactive reviewer run |
| Claude Code cloud | Generated plugin and host-neutral packet parity | No live cloud session |
| OpenAI Codex local | Generated plugin/runtime and parity tests; work performed from Codex | Installed-profile activation was not manually exercised |
| OpenAI Codex cloud | Generated plugin and host-neutral packet parity | No live cloud session |
| Cursor local | Project install reports ready; canonical workflow and packet contract tests pass | No manual interactive run |
| Cursor cloud agents | Host-neutral workflow/packet parity | No live cloud session |

## Audit Verdict

Audit passed with warnings — 0 change-scoped errors. The warnings and coverage limits above do not
change the executable-RED trust contract, but the unavailable independent external review prevents
claiming independently confirmed quality-review coverage.
