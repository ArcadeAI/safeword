---
id: 319VCW
slug: review-large-lockfiles
type: task
subtype: bug-investigated
phase: implement
status: in_progress
created: 2026-10-18T23:15:34.676Z
last_modified: 2026-10-18T23:15:34.676Z
scope:
  - Review bounded changes to large tracked bun.lock files as their original logical target.
  - Bind complete patches and full source identity to authenticated review freshness.
  - Preserve generated exclusions, credential checks and existing input budgets.
out_of_scope:
  - Reviewing new or unchanged oversized files without a usable Git baseline.
  - Deleted or renamed oversized lockfiles; projection requires a regular source at its existing baseline path.
  - Raising global budgets or marking lockfiles generated.
  - Changing models, review independence policy, publishing or profile selection.
done_when:
  - Version-only large lockfile changes satisfy real logical-file receipt coverage.
  - Committed, staged and unstaged dependency changes remain fully visible.
  - Source, snapshot or resolved baseline changes invalidate the review.
  - Bounds, credentials, generated priority and context limits fail safely.
  - Targeted tests, final-head CI, scoped audit and independent review pass.
---

# Keep large lockfile changes reviewable for developers

**Goal:** Complete independent review of bounded bun.lock changes without manual coverage exceptions.

**Why:** Whole-file caps currently conflict with required logical-file coverage during ordinary version bumps.

## Work Log

- 2026-10-19 Test-quality follow-up: added public-CLI acceptance through the real
  worker/signing and actual receipt reader/gate; added successful-baseline-truncation
  and exact serialized/source/baseline bounds; replaced the inspection-count test
  with deterministic courtesy-clock, process-budget and cancellation checks.
  Six deliberate mutations fail. Corrected completion-worker simulation claims.
  Earlier focused runs passed 175/175; a later managed-lifecycle failure also
  reproduces on unchanged main with the same exit-2 symptom. No deadlines or
  assertions were weakened. Final independent review and current-head CI remain.
- 2026-10-19 Verification-record review
  df3f17c4-1882-446b-9742-7b6417df4cfd approved the disclosed evidence and limits.
  Its remaining warnings are answered explicitly: final-head CI remains a hard
  delivery gate; baseline comparison establishes the same six failing test
  names, with different inspection symptoms and no asserted shared root cause.
  Baseline identity uses resolveBaseline()'s merge-base result in
  src/review/lockfile-diff.ts, not the remote tip; this is a code observation,
  not a separately executed remote-tip-only test. Historical CI run 39180050621's
  Node 24 acceptance log supplies the 596/11,118 counts; its metadata-only context
  did not include those log lines. The PR remains Draft pending current-head
  checks and explicit authority to promote or merge this new follow-up PR.
- 2026-10-19 Implemented complete bounded projection with production replay and
  source/baseline fingerprint identity. Packet RED produced 16 failures; signed
  job RED exposed two further stale-approval defects. Focused GREEN passed 156
  cases; the protected prefix refactor passed 81. Added hostile-configuration,
  path-escaping and near-8-MiB regression cases following independent review.
  Live review fd21fe4a-3049-4463-847b-664b34b1e227 approved the actual released
  343,758-byte lock under its original path with no exclusion; an edit staled it.
  Final original-path code/architecture review
  860afb41-e51a-4e90-bb78-77a4951e83d7 approved, and the authenticated implement
  stamp succeeded through the unmodified cached 1.1.0 distribution. Entered
  verification. Draft PR #5947 collects final-head CI. The first CI head passed;
  local broad verification reported failures, with five routing cases and a
  worker-inspection deadline case independently reproduced on the unchanged
  merge-base tree. See review-notes.md and test-quality-audit.md for limits.
- 2026-10-18T23:15:34.676Z Started: Created ticket 319VCW
- 2026-10-18 Intake approved by independent review
  ac193ff8-d56d-4817-a3ca-575bac1c73d6; authenticated intake stamp succeeded
  before entering implementation. Scope, excluded paths and bounds are explicit;
  no human choices remain. Implement the stronger suggestion: reconstruct from
  the exact displayed patch bytes, not a separately rewritten patch. Git uses
  the existing sanitized environment (system/global configuration disabled)
  plus an isolated empty-template directory. Existing local Git-scope policy
  already trusts host refs; this fix makes that assumption explicit rather than
  claiming protection against their owner. CI package jobs already fetch full
  history and regression fixtures supply their own complete Git history.

## Root Cause

Packet capture limits each whole file to 256 KiB while implementation receipts
require every changed logical file. The real 343,758-byte release lockfile
therefore failed before review despite a single workspace-version edit. Its
normalized byte equality rules out dependency churn; the public packet API's
REVIEW_TARGET_TOO_LARGE rules out a model/reviewer failure. A fresh real-Git
reproduction fails at that same boundary.

Both preceding PRs are now admin-merged after green CI: source #5924 at
96d2a4de98431b554a677551b51a3e72dd147a37 and release #5925 at
2dcc27e57214a2a63379ee9deddbe0f9dfbea3b8. The one-time version-only exception
does not extend to this fix or change standing review policy.

## Decision

Keep the original bun.lock target and supply a complete bounded Git patch with
typed source/baseline identity. Existing file/packet budgets remain 256 KiB/1 MiB;
the complete serialized logical-file record, including patch and metadata, must
fit 256 KiB and the complete serialized packet must fit 1 MiB. Never truncate.
Scan the full source, full baseline and displayed patch with the existing UTF-8
and credential guards, including credentials outside displayed hunks. Raw source
and baseline reads are separately bounded to 8 MiB. The first existing
origin/HEAD, origin/main, origin/master, local main or local master ref supplies
the merge-base with HEAD. An unusable selected ref fails; a newer local main
cannot hide committed changes while a remote default exists. Git refs and the
host Git binary are trusted checkout inputs before capture, not protected
against an author rewriting them. Changed resolved baselines invalidate proof.

Use isolated Git configuration, fixed 20-line context and private file-backed
blob/patch capture. Only an existing file whose basename is exactly bun.lock,
submitted as a quality-review logical target, may use projection; all other
filenames, context files and review kinds retain the existing full-text caps.
Generate the diff from exact captured working-tree bytes and raw baseline blob
bytes in private files under an isolated Git directory, with --text,
--no-textconv, --no-ext-diff and --no-color. Project attributes and filters must
not normalize or hide changes. Runtime Git apply must reconstruct the exact
captured source bytes and executable mode from the baseline; reject any mismatch
before dispatch. This check is required in production, not only in tests.
Deleted or renamed paths fail closed rather than being silently skipped.
A release CI failure's digest matched exactly the first
16 KiB of a 33,526-byte immutable Git blob; its same-head retry and complete
local acceptance-to-release sequence passed. Validate declared blob byte counts
and never approve truncated patches. Reviewers request changes when the supplied
context is insufficient. Architecture owns the typed representation/identity
contract; this ticket owns implementation sequencing. No new durable store.

Raising the full-file limit wastes review input on unchanged graph content;
generated annotations suppress real resolution changes. Both were rejected.
Premortem: a convenient baseline or incomplete patch could hide a resolution
edit while leaving a signed receipt fresh; explicit baseline and complete-patch
tests guard those failures. Remote precedence deliberately differs from the
nearest-base helper used by implementation-file discovery, whose one caller
need not change for this bounded projection. The new projection reviews a
conservative superset rather than hiding committed changes.

## Test Definitions

Use actual temporary Git repositories and real packet/job/receipt APIs. Original
receipt tests simulate the completion worker, including approval signing; a new
active public-CLI Cucumber regression runs the actual worker and simulates only
the external reviewer executable. Inspect its original lockfile representation,
signed status coverage and stale-on-edit result. Test exact serialized 256 KiB
and source/baseline 8 MiB boundaries, successful truncated baseline output, and
deterministic courtesy-clock/process budgets with observable cancellation. One explicit Git
transport fault injector delegates real Git, then removes a later patch hunk;
the production reconstruction guard must reject that otherwise applicable patch.
Prove version-only
logical coverage; committed/staged/unstaged changes; local main ahead of the
remote; nested project roots; baseline advances with identical patch bytes;
source/snapshot/mode drift; complete patches above 16 KiB; and safe rejection of
oversized source/patch, missing baseline, invalid text and credentials. Preserve
generated-marker precedence and full-text context/other-kind limits. Reconstruct
the expected authored file by applying the displayed patch as an independent
completeness oracle. Bind baseline identity even when patch bytes match; reject
substituting patch text as a small full-text source, and preserve legacy full-text
fingerprints. No untested behavior is claimed.

## Plan

1. Add failing public-packet and signed-receipt regressions before production edits.
2. Implement typed bounded projection, source freshness and metadata fingerprinting.
3. Regenerate native bundles and run targeted tests, lint/types and scoped audit.
4. Run a real independent-review lockfile probe, apply code-review findings and
   collect final-head CI before reporting completion.
