---
id: 4KP67A
slug: reconcile-ci-schedule
type: task
phase: implement
status: in_progress
created: 2026-07-08T05:12:02.649Z
last_modified: 2026-07-08T05:12:02.649Z
---

# Schedule the retro-reconcile sweep in CI

**Goal:** A standalone scheduled workflow (daily off-peak cron + workflow_dispatch, permissions issues:write/contents:read) runs safeword retro-reconcile against the upstream repo and fails loudly

**Why:** The sweep exists but nothing runs it, so #791's possibly-resolved flagging never fires; Actions' ghs_GITHUB_TOKEN already passes resolveGitHubToken, so this is workflow-only

## Decision (figure-it-out, 2026-07-08)

**Chosen:** a standalone scheduled workflow — daily cron on an off-peak minute (e.g.
`17 6 * * *`) + `workflow_dispatch`, `permissions: { issues: write, contents: read }`,
running `bun packages/cli/src/cli.ts retro-reconcile` from the repo checkout, failing
loudly (one red job, no swallowing). Zero CLI changes: Actions' `GITHUB_TOKEN` is
`ghs_…`-shaped, which `resolveGitHubToken` already accepts; the sweep is idempotent
and bounded (30 flags/run, actions/stale precedent), so daily is safe.

**Rejected:** release-published trigger — dogfood SHA provenance resolves on every main
push, so release-only starves half the ledger kinds; appending to `ci.yml` — couples an
egress write to every PR's CI at the wrong cadence.

**Risk noted:** the 60-day scheduled-workflow auto-disable only bites inactive public
repos (repo is active; `workflow_dispatch` is the manual fallback). Classic cron-rot
(ignored red runs) is the real failure mode — keep it one loud job.

## Work Log

- 2026-07-08T05:12:02.649Z Started: Created ticket 4KP67A
- 2026-07-08T05:14:00.000Z Decision recorded (daily scheduled workflow); parked to backlog. Depends on PR #958 merging (reconcile command ships there).
- 2026-07-08T13:30:00.000Z PR #958 merged; implemented `.github/workflows/retro-reconcile.yml` exactly per the decision (daily `17 6 * * *` + workflow_dispatch, issues:write/contents:read, non-cancelling concurrency group, CLI run from source with `GITHUB_TOKEN: ${{ github.token }}`). Failure posture verified in code: no token → exit 1; broken token → listIssues throws → non-zero; per-issue failures stay isolated (counted in the summary, run stays green) so one poisoned issue can't redden every daily run.
- Done when: the workflow lands on main and one workflow_dispatch run completes green with a `reconcile:` summary line — verify from the Actions tab after merge (scheduled/dispatch triggers only fire from the default branch).
- 2026-07-08T13:29:20.875Z Phase: intake → implement
