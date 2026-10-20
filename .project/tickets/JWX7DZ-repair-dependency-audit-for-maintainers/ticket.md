---
id: JWX7DZ
slug: repair-dependency-audit-for-maintainers
type: patch
phase: done
status: done
created: 2026-10-20T19:49:41.027Z
last_modified: 2026-10-20T19:55:00.000Z
scope:
  - Raise the markdown-it floor to ^14.3.2 and resolve 14.3.3 for GHSA-r7fv-28h4-cvq7.
  - Preserve exact audit failure, successful checks, independent review and delivery evidence.
out_of_scope:
  - Scenario PR 5994 source changes, issue 5086 fallback work, audit-ignore changes and unrelated upgrades.
done_when:
  - Existing CI-policy audit passes with the original ignore list.
  - After forced frozen reinstall the actual markdownlint consumer resolves 14.3.3 and accepts/rejects Markdown correctly.
  - Full tests, lint, build, freshness checks and independent review pass with limitations retained.
  - Current-head hosted CI is terminal and green before Ready or merge.
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/5996
---

# Repair the dependency audit for maintainers

**Goal:** Resolve patched markdown-it while preserving unrelated scenario work and CI policy.

**Why:** Clean main and Draft PR #5994 fail GHSA-r7fv-28h4-cvq7; patch #5996 is verified but lacks the delivery ticket required for Ready.

## Work Log

- 2026-10-20T19:49:41.027Z Started: Created ticket JWX7DZ
- 2026-10-20 Recorded the dependency patch already implemented at 4d419f51d88c977b6e3ead2347de37e88fdd5b55; this ticket does not claim planning preceded that patch.
- 2026-10-20 Evidence: .project/evidence/markdown-it-audit/verification.md retains audit RED/GREEN, 11853 passing tests, failed/interrupted attempts and seven inherited audit findings.
- 2026-10-20 Hosted CI run 39479547605 completed successfully at the exact source head, including both Node suites, acceptance lane and release gates. Metadata added here still needs its own current-head CI before Ready.
- 2026-10-20 Claude review 5451fd5d-f670-483f-b3b0-9eff605b3fc9 approved the intake revision and the normal phase stamp was recorded. Subsequent ticket edits made that receipt stale; intake-review.json retains its stale status, and it is not current approval. Applied version, reinstall, CI and fallback-boundary suggestions. Linked bounded lockfile-review limitation in verify.md. Existing research verifies the vendor patched floor at 14.3.2; actual resolved version is 14.3.3. A fresh review of the completed delivery record is required before advancing.
- 2026-10-20 User authorized normal merge of PR 5996 and updating PR 5994 afterward. GitHub requires one approving review; none is recorded, and no administrative bypass is authorized by this request.
- 2026-10-20 Independent delivery-record review a96f6f87 approved without errors. Phase-wide source coordinator attempt failed REVIEW_TARGET_INVALID_TEXT on preserved gzip evidence, after the narrow record review could not satisfy its full-branch inventory. Recorded the documented implementation-phase --skip exception with those exact limitations; no review policy or material source changed. Verify review and new-head CI remain required.
