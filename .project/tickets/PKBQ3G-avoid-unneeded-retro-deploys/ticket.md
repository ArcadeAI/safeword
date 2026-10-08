---
id: PKBQ3G
slug: avoid-unneeded-retro-deploys
type: patch
phase: verify
status: in_progress
scope:
  - skip retro deployments for CLI version-only changes and CI selector edits
  - preserve deploy requests for material retro service and shared input changes
out_of_scope:
  - change production deployment authorization or retry policy
  - change issue #2121 scenario evidence
done_when:
  - the selector returns no deployment for the merged Safeword 1.1.0 version-only diff
  - focused tests, the full suite, lint, typecheck, and exact-head CI pass
  - independent review finds no blocking issue
created: 2026-10-08T14:55:09.539Z
last_modified: 2026-10-08T17:34:16Z
---

# Avoid retro production deploys during CLI releases

**Goal:** Keep CLI-only releases from requesting retro production deployments while preserving deploys for material retro inputs.

**Why:** Version-only Safeword 1.1.0 changes left post-merge CI waiting on three unrelated protected deployments.

## Work Log

- 2026-10-08T14:55:09.539Z Started: Created ticket PKBQ3G
- 2026-10-08T14:56:03Z Scope: ignore version-only CLI manifest and lockfile changes plus CI selector edits; continue requesting deployment for material service and shared input changes. Production authorization and #2121 evidence are outside this patch.
- 2026-10-08T14:56:03Z Recorded prior evidence after creating this ticket: commit 5f10fba45, its independent review, the focused 11/11 workflow tests, the 612-file local full suite (10521 tests, 14 skips), lint, typecheck, and exact-head CI 37730162325 had already completed. The actual merged 1.1.0 diff produced deploy=false for all three retro services. PR #5636 remains Draft pending this ticket's supported close record and Ready advisory.
- 2026-10-08T15:02:00Z Review 41437087 independently approved this ticket and patch. The installed stamp verifier cannot witness the review until Safeword 1.1.0 is published, so the intake phase records a supported logged skip that names the actual review and bootstrap limitation. The authoritative 596-scenario Gherkin acceptance lane passed; its proof test waits on a shared Vitest lock held for over ten hours by another checkout. A broader root-level Gherkin command discovered 1625 scenarios and failed three unchanged scenarios outside this patch; CI's authoritative lane passed 596/596.
- 2026-10-08T15:08:00Z The other checkout's live Vitest run exited without intervention. The queued proof lane passed 47/47; the authoritative local BDD command is now green. Three broader root-level failures remain disclosed in verify.md; their source files are identical to origin/main, but the base commit was not executed separately.
- 2026-10-08T15:34:00Z Added final assertions for workflow push-range wiring, selector-only no-deploy behavior, shared-input deploy behavior, and the worker's CLI-manifest exception. Lint, Gherkin lint, and TypeScript typecheck pass. The focused retry is queued behind a live Vitest run in another checkout; final test and exact-head CI results remain pending, and PR #5636 remains Draft.
- 2026-10-08T17:34:16Z The lock holder exited without intervention. The focused workflow suite passed 12/12. The first final full suite had one failure in the unchanged OpenCode timeout test because the reviewer probe timed out earlier than expected; that exact test passed alone, and a clean full retry passed 612 files and 10522 tests with 14 skips. Independent review 8a64cbb2 found no blocking error in the final assertions. Exact-head CI remains pending until the final commit.
