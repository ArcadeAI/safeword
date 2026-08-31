# Work Log: Let installed Codex hooks prove protection

**Anchored to:** `.project/tickets/P4A681-let-installed-codex-hooks-prove-protection/ticket.md`

## Session: 2026-08-31

- [14:52] `codex exec` saw Safeword 0.82.5 but produced no lifecycle proof.
- [14:53] Interactive Codex visibly completed the packaged SessionStart hook and UserPromptSubmit hooks, ruling out plugin discovery and trust.
- [14:58] Confirmed the bundled runtime searches source/build manifest paths only; neither exists in the installed cache layout where `hooks.json` is adjacent to `runtime/`.
- [14:59] Decision: add an installed-layout candidate and a generated-runtime physical-cache regression. Avoid embedding a second manifest digest because that would introduce another generated identity source.
- [15:03] RED: the physical-install release contract failed because the installed hook did not create `hook-proof-v2/session-start.json`.
- [15:04] GREEN: added the installed layout's `../hooks.json` candidate, regenerated Codex and Claude runtimes, and passed the physical-install release contract (8/8).
- [15:05] Focused verification: profile-proof and hook-command suites passed 79/79; deterministic headless activation passed 5/5.
- [15:07] Full lint: repository ESLint, Gherkin lint, TypeScript typecheck, and Prettier check passed.
- [15:08] Full audit: no hotfix-caused architecture, dead-code, documentation, or test-quality finding. Repository mode surfaced pre-existing baseline debt outside this ticket; kept out of scope.
- [15:09] Refactor review: no change warranted. The missing installed-layout candidate belongs in the existing ordered manifest lookup; extraction or a second identity source would add indirection or duplication.
- [15:10] Quality-review plan: verify runtime-relative path semantics against Bun's primary documentation; challenge correctness against the physical install contract; inspect edge cases, generated parity, scope, and bloat; obtain an independent review verdict.
- [15:22] First independent quality review approved the fix with no blocking findings. Adopted its test-strengthening suggestion: compare installed manifest bytes to source and exercise the public status observer; declined speculative future-layout hardening outside the accepted scope.
- [15:35] Full verification pass: relay 186 passed/1 skipped; collector 106 passed; CLI 8,731 passed/13 skipped with 9 stale origin-main fixture digests; full acceptance 1,490 passed/3 skipped and package acceptance 592/592; builds, JS/TS/Astro typechecks, lint, formatting, proof tags, and supply-chain checks passed.
- [15:40] Baseline reconciliation: refreshed the nine origin-main tree digests against released main 0.82.5; the contract passed 12/12 and operation-result digests remained unchanged.
- [15:41] Evidence limit: the generated repository-wide typecheck plan also invokes `mypy .`, which reports duplicate modules in two unchanged Python experiment fixtures already present on origin/main. This is pre-existing test-plan debt outside the hotfix and is not part of the shipping CLI/relay/collector suites.
- [15:47] Strengthened GREEN passed 8/8 after validating the proof digest, installed version, source/build/installed manifest identity, and public status observation.
- [16:00] Final independent quality review approved the strengthened snapshot with no error-level findings. Its remaining warnings concern pre-existing fail-closed durability edges in the broader proof state machine, not this hotfix.
- [16:00] Final verification: full monorepo suite passed 9,032 tests with 14 skipped; release contract passed 43/43; generated Codex and Claude plugins are current at 0.82.6; CLI and Claude release contracts, lint, typecheck, and formatting are clean.
