# Verification — EBCDJA

The release source was verified locally after the containment and portable-path corrections. Independent reviews `0b43f900-9a9b-4958-a3b9-e7517d870dec` and `c8d3e080-4545-47ab-8422-bd9eae1d43f1` of those guards, regression tests, and ticket found no blocking findings; earlier independent review `0e733d02-6cf6-46fb-9273-758af1545ede` approved the version manifests and other authored guard files. `bun.lock` exceeded the reviewer's target limit, so its workspace-version-only change is checked by a direct diff and the release contract. This record is committed with ticket closure, so it cannot name its own commit. Before merge, [PR #5612's required checks](https://github.com/ArcadeAI/safeword/pull/5612/checks) must be green on the PR's current head, and its Ready-only advisory receipt must review that same head; the PR readiness gate also requires the checklist to be updated before merge.

## Verify Checklist

**Test Suite:** ⚠️ Local full suite passed 610/610 files and 10,490 tests (14 skipped) on pinned Bun 1.3.14 after both corrections. Earlier CI passed full suites on Node 22 and 24; the closure commit requires fresh exact-head CI before merge.
**Gherkin:** ⚠️ Acceptance lane passed on the earlier CI head in the Node 24 job; exact-head CI is pending.
**Build:** ⚠️ Local pinned Bun `bun ci` and earlier CI builds passed; exact-head CI is pending.
**Lint:** ✅ Local lint passed after the portable-path correction.
**Typecheck:** ✅ Local typecheck passed after the portable-path correction.
**Scenarios:** ⏭️ Skipped — this release task has no separate scenario ledger; #2121 remains incomplete on its own branch.
**Refactor:** ✅ No change warranted — the release reuses the reviewed guard and adds focused negative coverage.
**PR Scope:** ✅ Diff matches ticket scope: the retrospective row gate (including additional claims), proof runner, and close guard; their focused tests; `bun.lock`'s workspace version; 1.1.0 version and generated plugin artifacts; and this release ticket. These guards are a prerequisite for completing #2121 and can ship before its evidence ledger is complete. No #2121 ledger or proof packets are included.
**Dep Drift:** ✅ Clean — no new dependencies; lockfile and generated bundles match the pinned install.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — generated assets came from the repository generators.
**Experience:** ⏭️ N/A — internal release prerequisite, not persona-facing.
**Surface Evidence:** ⚠️ CLI, Claude plugin runtime, Codex plugin, Claude historical catalogue/release contract, Cursor wrappers, and lifecycle fixtures pass local generated and contract checks; published-package installation awaits the release.
**Evidence limits:** ⚠️ The phase-wide independent reviewer refused `bun.lock` at its 262144-byte target limit; authored code and tests received separate independent approval. The portable-path assertion detects the old bug on Windows; local and CI Linux runs rely on explicit POSIX path construction and independent source review for that claim. The corrected closure commit still needs exact-head CI and Ready-only advisory review before merge.

Release lane: 13/13 files and 81/81 tests passed locally after both corrections; earlier CI passed the same lane on both Node versions. Generated surfaces: 5/5 current (Codex plugin, Claude plugin runtime, Claude historical catalogue/release contract, Cursor wrappers, and lifecycle origin-main fixtures). Version alignment: CLI package, marketplace, Codex manifest and package, Claude runtime package, and project marker all say 1.1.0. Pinned `bun ci` passed with no package changes; `git diff origin/main...HEAD -- bun.lock` showed exactly one hunk changing the CLI workspace version from 1.0.0 to 1.1.0. The corrected row gate must be brought to #2121's branch after this release; its original historical proof row remains unchanged.
