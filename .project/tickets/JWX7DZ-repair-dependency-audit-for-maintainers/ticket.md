---
id: JWX7DZ
slug: repair-dependency-audit-for-maintainers
type: patch
phase: done
status: done
created: 2026-10-20T19:49:41.027Z
last_modified: 2026-10-21T04:38:43.000Z
scope:
  - Raise the markdown-it floor to ^14.3.2 and resolve 14.3.3 for GHSA-r7fv-28h4-cvq7.
  - Resolve Vite 8.2.4 and its required transitive patches for GHSA-587h-7wmj-h5pm before merge.
  - Preserve exact audit failure, successful checks, independent review and delivery evidence.
out_of_scope:
  - Scenario PR 5994 source changes, issue 5086 fallback work, audit-ignore changes and unrelated upgrades.
done_when:
  - Existing CI-policy audit passes with the original ignore list, freshly rerun at the merge head immediately before merging and retained as raw output.
  - After forced frozen reinstall the actual markdownlint consumer resolves 14.3.3 and accepts/rejects Markdown correctly.
  - Full tests, lint, build, freshness checks and independent review pass with limitations retained.
  - Current-head hosted CI is terminal and green before Ready or merge.
  - After a forced frozen reinstall Vitest and Astro resolve Vite 8.2.4 and full tests plus website build pass.
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/5996
---

# Repair the dependency audit for maintainers

**Goal:** Resolve patched markdown-it and Vite while preserving unrelated scenario work and CI policy.

**Why:** The markdown-it repair for clean main and PR #5994 passed CI, then a fresh pre-merge audit exposed GHSA-587h-7wmj-h5pm in Vite. Repair both dependency blockers before the authorized admin merge of PR #5996; the retrospective delivery record remains linked.

## Work Log

- 2026-10-20T19:49:41.027Z Started: Created ticket JWX7DZ
- 2026-10-20 Recorded the dependency patch already implemented at 4d419f51d88c977b6e3ead2347de37e88fdd5b55; this ticket does not claim planning preceded that patch.
- 2026-10-20 Evidence: .project/evidence/markdown-it-audit/verification.md retains audit RED/GREEN, 11853 passing tests, failed/interrupted attempts and seven inherited audit findings.
- 2026-10-20 Hosted CI run 39479547605 completed successfully at the exact source head, including both Node suites, acceptance lane and release gates. Metadata added here still needs its own current-head CI before Ready.
- 2026-10-20 Claude review 5451fd5d-f670-483f-b3b0-9eff605b3fc9 approved the intake revision and the normal phase stamp was recorded. Subsequent ticket edits made that receipt stale; intake-review.json retains its stale status, and it is not current approval. Applied version, reinstall, CI and fallback-boundary suggestions. Linked bounded lockfile-review limitation in verify.md. Existing research verifies the vendor patched floor at 14.3.2; actual resolved version is 14.3.3. A fresh review of the completed delivery record is required before advancing.
- 2026-10-20 User authorized normal merge of PR 5996 and updating PR 5994 afterward. GitHub requires one approving review; none is recorded, and no administrative bypass is authorized by this request.
- 2026-10-20 Independent delivery-record review a96f6f87 approved without errors. Phase-wide source coordinator attempt failed REVIEW_TARGET_INVALID_TEXT on preserved gzip evidence, after the narrow record review could not satisfy its full-branch inventory. Recorded the documented implementation-phase --skip exception with those exact limitations; no review policy or material source changed. Verify review and new-head CI remain required.
- 2026-10-20 21:31 PDT Resumed after the user explicitly authorized admin merge of PR 5996 after green CI. A fresh pre-merge audit failed on GHSA-587h-7wmj-h5pm, Vite locked at 8.2.1 (affected range through 8.2.3). No merge was attempted. The current closure is historical and this ticket must reopen for the related dependency repair; earlier green CI does not clear the new finding.
- 2026-10-20 Vite repair: added exact security override 8.2.4 and required Rolldown/native-binding/type updates only. Vendor source and registry integrity are in vite-repair.md. Fresh intake review 42f0f689 approved; its normal stamp succeeded. Backward reopening required an explicit documented exception because the done gate initially blocked the requested correction; no review policy changed.
- 2026-10-20 Forced frozen reinstall completed before tests. Actual Vitest/Astro consumers resolve 8.2.4; Markdown consumer remains 14.3.3. Exact unchanged-policy audit RED exit 1 then GREEN exit 0. Full default suites: 11855 passed, 13 skipped (CLI 11504/12; relay 198/1; collector 153/0). Astro builds nine pages; root lint/typecheck and generated freshness pass. No test file changed; raw proof is retained.
- 2026-10-20 Fresh material review 01623755 approved independently with no errors. Retain its PostCSS range mismatch, Rolldown update and exact-pin maintenance observations. Complete verification/closure and new-head hosted CI before Ready; rerun the audit immediately before the authorized admin merge. PR 5994 is only to be updated and tested afterward.
