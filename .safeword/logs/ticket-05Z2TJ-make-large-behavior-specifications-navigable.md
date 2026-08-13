# Work Log: Make large behavior specifications navigable for maintainers

**Anchored to:** `.project/tickets/05Z2TJ-make-large-behavior-specifications-navigable/ticket.md`

## Session: 2026-08-11

- [03:30] COMPLETE: User confirmed completion. Draft PR CI was fully green across Node 22/24, acceptance, release, lint, parity, contract, and physical-install gates; marked PR ready and transitioned the verified ticket to `phase: done`, `status: done` as required by the ready-PR closure gate.
- [02:21] VERIFY: caught up to `origin/main` (`03b7a49bb`) with no overlapping offload-spec changes. Post-merge checks pass: focused preservation/feature-source suite 8/8, retro-relay 167 passed/1 skipped, Gherkin lint, ESLint, typecheck, build, and `bun audit`.
- [02:19] Full-lane evidence: CLI Vitest passed 7,490 tests with 15 failures across 12 unrelated files; Cucumber passed 1,497 scenarios/66,487 steps with 17 failures. Failures were attributable to registry DNS, shared-machine timeouts, review-runner environment state, and concurrent `dist` rebuild races; see `verify.md`. No failure referenced an offload feature or the new guard.
- [00:26] QUALITY REVIEW: approved after two improvements—derive preservation facts from the immutable pre-split Git object and compare canonical Rule sources in addition to expanded semantics. Preferred Claude reviewer timed out; a separate headless Codex reviewer completed the independent review.
- [00:20] AUDIT: diff-scoped architecture/config review passed with no findings; dependency-cruiser reported no violations.
- [00:11] GREEN: shared-resolver and immutable-baseline improvements pass 8/8 focused Vitest checks, ESLint, Prettier, typecheck, and Gherkin lint. The first queued run waited 20 minutes without starting; the retry acquired the serialized slot and passed.
- [23:47] Quality-review fix: compare the split corpus directly with the immutable pre-refactor Git object at `1f8056ed8` plus an exact feature-header shape. Canonical Rule comparison normalizes line endings and outer whitespace while pinning wording, descriptions, tags, proof references, scenario/Examples source, and expanded executable semantics.
- [23:43] Audit hardening: reviewed high-water exceptions now fail if their path is stale or their rationale is empty; documented why 1,000 lines is deliberately above the current sub-500-line cohesive corpus.
- [23:40] Refactor review: replaced duplicate default-directory traversal in the new guard with `collectExecutableFeatureFiles`, so custom configured feature lanes receive the same high-water policy.
- [23:36] GREEN: Gherkin lint, 2/2 focused Vitest checks, focused ESLint, and `tsc --noEmit` pass.
- [23:35] Improved: focused ESLint rejected broad Gherkin regexes and implicit sorting in the new test; replaced them with exact line predicates and locale comparators.
- [23:34] Fixed: Gherkin lint found one extraction-only extra blank line at EOF in each split file; removed those 16 blank lines without changing the semantic inventory.
- [23:33] Refactored: moved each intact Rule into one capability-named feature file. Post-move inventory remains 16 Rules, 134 declarations, 79 Examples blocks, 624 expanded cases, digest `ae85ca52e26737f6ae5243bb15ba173f2c68801e3b1d8803c63f3909d1a220fe`; all files retain `@wip` and the largest is 230 lines.
- [23:30] RED refinement: a 12-Rule cap also rejected seven existing compact specs (193–460 lines), so Rule count is diagnostic only. The reviewed gate now uses a 1,000-line high-water mark plus explicit path-and-reason exceptions for genuinely cohesive outliers.
- [23:29] RED: the first maintainability test failed, including the intended 1,646-line offload feature.
- [23:27] Adopted GitHub #2583 through the local-only ticket bridge as task 05Z2TJ.
- [23:27] Refactor contract: scenario wording, Rule bodies, tags, Examples data, step definitions, runtime, and Cucumber configuration must remain behaviorally unchanged.
- [23:27] Required preservation proof: compare the semantic inventory before/after, retain `@wip` per resulting file, and add a deliberately high global monolith threshold.
- [23:27] Worktree boundary: `/Users/alex/.codex/worktrees/2583-navigable-bdd-specs/safeword` at `origin/main` 1f8056ed8; unrelated dirty worktrees are out of scope.
