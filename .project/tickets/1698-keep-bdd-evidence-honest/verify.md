# Verification: Keep BDD evidence honest

**Test Suite:** ✅ `bun run test:done` passed 1,244/1,244 tests across 81 files.

**Full Suite:** ✅ `bun run test` passed 5,645 tests with 5 skips across 377
files. Vitest completed in 379.17 seconds after the global package-test lock
became available.

**Focused Proof:** ✅ The scenario-fidelity and adjacent BDD documentation
tests passed 44/44.

**Lint:** ✅ ESLint and Gherkin validation passed.

**Typecheck:** ✅ `tsc --noEmit` passed.

**Template Parity:** ✅ Canonical BDD/TDD and TDD-review templates exactly match
their installed `.claude/skills/` dogfood copies.

**Codex Plugin Release Gate:** ✅ `bun run --cwd packages/cli test:release`
passed 26/26 tests across 8 files after `bun run --cwd packages/cli
generate:codex-plugin` regenerated the BDD and TDD-review skill assets.

**PR Scope:** ✅ Changes are limited to issue #1698's planning artifacts,
scenario-proof guidance, installed and generated agent-surface copies, and
regression tests.

**Lock Investigation:** ✅ The earlier apparent idle run was waiting for a
legitimate test owner in another worktree, not hanging inside Vitest. The
global wrapper allows up to 20 minutes of lock waiting.
