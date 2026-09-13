# Verification: Show review-stamp help without artifact lookup

## Verify Checklist

**Test Suite:** ✅ 9,595/9,652 CLI tests pass across 578/578 files; 57 are
skipped. The affected helper integration tests pass 32/32, and the lifecycle
contract passes 13/13 after regenerating the intentional Cursor tree hashes.

**Gherkin:** ✅ Acceptance lane passes 1,496 scenarios and 68,731 steps; 3
scenarios and 4 steps are skipped. The proof lane passes 45/45 tests.

**Build:** ✅ Success — CLI, retro-relay, retro-collector, website, and Go
builds pass. The website required materializing its exact lockfile-pinned
optional Darwin binding in `node_modules`; no manifest or lockfile changed.

**Lint:** ✅ Clean — pre-commit ESLint, Prettier, markdownlint, schema parity,
and TypeScript checks pass; all configured TypeScript and Python typechecks
pass.

**Scenarios:** All 2 inline task scenarios marked complete.

**Refactor:** ✅ No change warranted — the parser-aware branch is the smallest
complete fix and preserves the existing parser.

**PR Scope:** ✅ Diff matches ticket scope.

**Dep Drift:** ✅ Clean — no dependencies changed; Bun audits across all five
workspaces, pip-audit, and govulncheck report no known vulnerabilities.

**Parent Epic:** N/A

**Reconcile:** ✅ No pattern deviation.

**Experience:** ⏭️ N/A — internal helper behavior, not persona-facing.

**Surface Evidence:** ✅ 4/4 affected surfaces have recorded proof.

| Affected surface | Proof | Result |
| --- | --- | --- |
| Canonical helper | `bun run test tests/integration/review-stamp.test.ts` | 32/32 pass |
| Installed `.safeword` mirror | Pre-commit parity contract | Current |
| Generated Claude plugin | `bun run check:cli-contract` | Pass |
| Generated Codex plugin | `bun run check:cli-contract` | Pass |

**Evidence limits:** ✅ None.

Audit passed for the `origin/main…HEAD` diff: no dependency violations, config
drift, broken references, documentation drift, or test-quality findings. The
principle checker reported only pre-existing findings in unchanged tickets,
outside the printed audit scope.
