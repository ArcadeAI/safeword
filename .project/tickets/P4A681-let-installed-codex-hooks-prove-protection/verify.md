# Verification: Let installed Codex hooks prove protection

## Verify Checklist

**Test Suite:** ✓ 9032/9032 tests pass (14 skipped)
**Gherkin:** ✅ Acceptance lane passes
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete
**Refactor:** ✅ No change warranted — the installed-layout path belongs in the existing ordered manifest lookup; extraction or a second identity source would add indirection or duplication.
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal plugin-runtime plumbing
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof
**Evidence limits:** ⚠️ The generated repository-wide typecheck plan invokes `mypy .`, which reports duplicate module names in two unchanged Python experiment fixtures already present on origin/main; the shipping CLI, relay, and collector type/build/test lanes are green.

Audit passed with repository-baseline warnings outside this hotfix.

## Surface Evidence

| Affected surface | Proof command or check | Result |
| --- | --- | --- |
| Installed Codex plugin cache | `bun run test:release` physical-cache case invokes the public SessionStart hook from a real `codex plugin add` install, validates the identity-bound proof against source `hooks.json`, then invokes public `codex status --json` | ✅ Proof created and observed; 43/43 release-contract tests passed |

## Additional Evidence

- Full monorepo unit/integration suite: 538 CLI test files; 8,740 passed and 13 skipped, plus 292 relay/collector tests passed and one skipped.
- Full acceptance: 1,490 scenarios passed and 3 skipped; package acceptance: 592/592 scenarios passed.
- Generated Codex and Claude plugins are current at 0.82.6; Claude release alignment and the CLI contract are clean.
- Two independent quality-review passes found no error-level issues; the strengthened final regression addressed the first pass's proof-discrimination suggestion.
