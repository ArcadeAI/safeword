# Verification — EBCDJA

Release candidate source head: `73d0b0f59`. CI for that source: [run 37680551488](https://github.com/ArcadeAI/safeword/actions/runs/37680551488), successful on Node 22.23.2 and 24.18.1. Independent review `0e733d02-6cf6-46fb-9273-758af1545ede` approved the authored guard, tests, and version manifests with no blocking findings; `bun.lock` exceeded the reviewer's target limit. A closure-only commit will follow this source head and requires its own green CI before Ready. The Ready-only advisory review must pass before merge and publication.

## Verify Checklist

**Test Suite:** ✓ 610/610 CLI test files pass on both CI Node versions; relay and collector suites also pass. Local Vitest was deferred because another checkout held the shared package-test lock.
**Gherkin:** ✅ Acceptance lane passes in the Node 24 CI job; this lane runs only on Node 24 by workflow design.
**Build:** ✅ Success in both CI jobs and local pinned Bun install.
**Lint:** ✅ Clean in exact-head CI; local lint and typecheck passed.
**Typecheck:** ✅ Clean locally and in CI.
**Scenarios:** ⏭️ Skipped — this release task has no separate scenario ledger; #2121 remains incomplete on its own branch.
**Refactor:** ✅ No change warranted — the release reuses the reviewed guard and adds focused negative coverage.
**PR Scope:** ✅ Diff matches ticket scope: the retrospective row gate (including additional claims), proof runner, and close guard; their focused tests; `bun.lock`'s workspace version; 1.1.0 version and generated plugin artifacts; and this release ticket. These guards are a prerequisite for completing #2121 and can ship before its evidence ledger is complete. No #2121 ledger or proof packets are included.
**Dep Drift:** ✅ Clean — no new dependencies; lockfile and generated bundles match the pinned install.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — generated assets came from the repository generators.
**Experience:** ⏭️ N/A — internal release prerequisite, not persona-facing.
**Surface Evidence:** ⚠️ CLI, Claude plugin, and Codex plugin pass generated and contract checks; published-package installation awaits the release.
**Evidence limits:** ⚠️ Local Vitest could not run while another checkout's live Vitest owned the shared lock; exact-head CI ran the full suite and the 13-file release lane on both Node versions. The phase-wide independent reviewer refused `bun.lock` at its 262144-byte target limit; authored code and tests received separate independent approval.

Release lane: 13/13 files pass on both Node versions. Generated surfaces: 5/5 current. Version alignment: CLI package, marketplace, Codex manifest and package, Claude runtime package, and project marker all say 1.1.0. `bun install --frozen-lockfile` passed; `git diff origin/main...73d0b0f59 -- bun.lock` changes only the CLI workspace version from 1.0.0 to 1.1.0. `git diff 049897cf19f935fa320e0f995cddbe67aeede3e1 73d0b0f59 -- packages/cli/src/review/retrospective-close.ts packages/cli/src/review/retrospective-gate.ts packages/cli/src/review/retrospective-proof.ts` is empty, confirming guard-source parity with #2121's release candidate.
