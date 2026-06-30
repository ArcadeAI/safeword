# Work Log: DBF1FW feature-surfaces-bdd

**Anchored to:** `.project/tickets/DBF1FW-feature-surfaces-bdd/ticket.md`

## 2026-06-27

- 13:07Z Started in fresh worktree `/Users/alex/.codex/worktrees/509-feature-surfaces-bdd/safeword` on branch `codex/feature-surfaces-bdd`; old `523a` worktree left untouched.
- 13:07Z Found no committed issue-509 ticket; created `DBF1FW-feature-surfaces-bdd` with source CLI after bootstrapping dependencies.
- 13:07Z Decision: implement surfaces as a first-class configured path key and managed project-knowledge file, matching personas/glossary instead of hard-coding the default location.
- 13:30Z Implemented surfaces schema/path support, starter template, BDD/spec guidance, dogfood inventory, executable BDD scenarios, and customer-style tests. Validation passed: focused BDD feature, targeted Vitest/schema/parity set, lint/gherkin/typecheck.
- 15:03Z Reworked surfaces after user clarification: surfaces now mean supported runtime/context surfaces (Claude Code, OpenAI Codex, Cursor, CLI, product/protocol/deployment contexts), not screens/prompts/files. Added `spec.md ## Surfaces` `Affected:` parsing and zero-exit `safeword check` advisories for missing/stale `@surface.<slug>` feature tags.
- 15:03Z Validation passed: `bun run test -- tests/utils/namespace-root-defaults.test.ts tests/reconcile-namespace-root.test.ts tests/reconcile-configured-paths.test.ts tests/integration/discovery-surfaces-substep.test.ts tests/spec-surfaces.test.ts tests/schema.test.ts tests/parity.test.ts src/utils/scenario-coverage.test.ts tests/commands/check.test.ts`; `bun run test:bdd -- features/feature-surfaces-bdd.feature`; `bun run lint`; `git diff --check`. `bun packages/cli/src/cli.ts check --offline` still exits 1 because this worktree is missing the Python language pack, unrelated to this ticket.
- 17:00Z Retried after interruption. Refactored surface coverage reports to preserve missing surface slugs internally while keeping CLI advisory text unchanged. Validation passed: `bun run test -- src/utils/scenario-coverage.test.ts tests/commands/check.test.ts`; `bun run lint`; `bun run test:bdd -- features/feature-surfaces-bdd.feature`; `git diff --check`.
- 20:33Z Refactor pass: renamed private surface-coverage helper/local variables to say `surface tag slugs` instead of generic references/slugs. Validation passed: `bun run test -- src/utils/scenario-coverage.test.ts tests/commands/check.test.ts`; `bun run lint`; `bun run test:bdd -- features/feature-surfaces-bdd.feature`; `git diff --check`.
- 21:11Z Verify pass: fixed stale spec-template header test expectation, ran full Vitest green (`262` files, `3804` passing tests), feature BDD green (`7` scenarios, `126` steps), targeted surfaces suite green (`173` tests), lint/typecheck/format/diff checks green. Full `safeword test-plan --kind verify` still exits 5 because the existing Python lane under `experiments/gepa-review-spec/gepa` discovers zero tests.
