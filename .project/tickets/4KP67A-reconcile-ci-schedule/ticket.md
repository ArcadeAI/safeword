---
id: 4KP67A
slug: reconcile-ci-schedule
type: task
phase: intake
status: backlog
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
