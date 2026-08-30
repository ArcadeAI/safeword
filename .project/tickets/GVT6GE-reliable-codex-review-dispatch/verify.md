# Verification

**PR Scope:** ✅ Diff matches ticket scope: bundled Codex runtime generation and cache-path invocation, hook/runtime release guards, behavioral and release coverage, generator refactors required by the review, generated architecture/format ownership, and this ticket's evidence. No unrelated product changes.

## Acceptance

- [x] Generated Codex review and project-knowledge commands invoke the bundled plugin CLI without `bunx`.
- [x] The Codex plugin ships the standalone CLI bundle and generated package identity.
- [x] `generate:codex-plugin --check`, version sync, and release contracts fail on runtime, marketplace identity, hook-event, or invocation drift.
- [x] A real isolated `codex plugin add` installs to the generated versioned cache path and executes the bundled runtime there.

## Full verification

- `bun run test`: 538 CLI test files passed; 8,727 tests passed and 13 skipped. Retro Relay: 186 passed, 1 skipped. Retro Collector: 106 passed.
- `bun run test:bdd:acceptance`: 1,485 scenarios passed, 3 skipped; 68,234 steps passed, 4 skipped.
- `bun run --cwd packages/cli test:release`: 10 files and 42 tests passed.
- `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run build`: passed.
- `bun run check:cli-contract`: build, runtime/protocol, generated references, terminology, Claude plugin, Codex plugin, and Claude release contract passed.
- `bun run test:bdd:proof`: 37 tests passed.
- Independent Safeword quality review: approved with no release-relevant finding after requested fixes.

## Audit

- Dependency Cruiser: 0 errors. Four pre-existing orphan warnings remain; the new generator helper introduces none.
- Repository-wide Knip, duplication, principle-trace, dependency freshness, and language-specific audit findings were reviewed separately from this diff. No new blocking finding is attributable to this ticket.
- Generated architecture state is current and `git diff --check` passes.
