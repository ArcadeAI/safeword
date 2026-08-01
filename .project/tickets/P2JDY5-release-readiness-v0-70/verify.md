# Verification: Ship a clean release for safeword users

## Verify Checklist

**Test Suite:** ✓ 6068/6073 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes (671 scenarios passed, 3 skipped; 21984 steps passed, 4 skipped)
**Build:** ✅ Success (CLI package build, publint, and website production build)
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing
**Evidence limits:** ✅ None

Audit passed: dependency-cruiser reported 0 errors (one known dynamic-entry
orphan warning for `codex-plugin/hooks.ts`), Knip found no dead code, all 200
template pairs and 8 contracts are in sync, publint passed, and the production
dependency audit found no vulnerabilities.

The refreshed verification reran the complete 402-file Vitest suite, the
674-scenario acceptance lane, 27 release tests, CLI package build, website
typecheck/build, formatting, and diff hygiene after the final review fixes.

## Review Closeout

- Independent refreshed-diff review: APPROVE; no critical issues remain.
- The sole unresolved PR thread was narrowed against Microsoft's filename
  rules: a bare device-looking ID and an ID-ending period become portable after
  the mandatory slug suffix, while a reserved device basename followed by a
  period remains reserved.
- `createIssueFirstTicket` now rejects that unsafe family before `onMinted` or
  filesystem mutation. Three negative and three positive boundary cases pass.
- Keychain-only authentication now has a real-command wiring proof through
  `gh issue create`, graph projection, and the recorded sidecar reference; the
  test also requires a clean command exit and no stderr output.
- The copyable workflow pins checkout v7.0.1 and setup-node v7.0.0 to their
  verified immutable commit SHAs.
- The copyable workflow now uses Node 24.18.0 LTS, above the Node 24.17.0
  security floor that fixed two High and several Medium vulnerabilities; a
  release test prevents regression below that floor.
- The generated ticket index now exactly represents all 472 canonical tickets,
  including the four review tickets added here and six reconciled status changes.
- Authentication documentation now distinguishes Safeword's preflight order
  from GitHub CLI's live `GH_TOKEN` → `GITHUB_TOKEN` → stored-auth precedence.
- Final post-fix independent review ended with APPROVE, no critical issues, and
  no remaining suggested improvements.
- The branch includes the latest remote reviewer commits and current `main`,
  including the typed public CLI protocol and continuous Codex migration work.
- The main catch-up initially bypassed GitHub CLI credential discovery in the
  new public `tracker sync` handler. A Commander-boundary regression test failed
  without `GITHUB_TOKEN`, then passed after the handler reused `resolveGhCliToken`.
- The latest main catch-up adds actionable Linear portable-sync guidance while
  retaining the GitHub keychain path, immutable workflow actions, and patched
  Node version. The new shared-lock runner also reports honest wait provenance.
- Architecture-fingerprint enforcement from the newest main has no substantive
  overlap with this PR. Its 218 focused tests and the complete suite are green;
  one initial lock-test child exit did not reproduce in isolation or a full rerun.
