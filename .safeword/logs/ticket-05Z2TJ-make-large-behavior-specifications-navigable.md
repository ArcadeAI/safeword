# Work Log: Make large behavior specifications navigable for maintainers

**Anchored to:** `.project/tickets/05Z2TJ-make-large-behavior-specifications-navigable/ticket.md`

## Session: 2026-08-11

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
