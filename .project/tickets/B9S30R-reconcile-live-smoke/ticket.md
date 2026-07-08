---
id: B9S30R
slug: reconcile-live-smoke
type: task
phase: intake
status: backlog
created: 2026-07-08T05:12:02.716Z
last_modified: 2026-07-08T05:12:02.716Z
---

# Live smoke of retro-reconcile version-provenance path

**Goal:** A token-gated live-lane test pins resolveTagDate('v0.68.0') to the real tag's commit date (%2F ref encoding + annotated-tag deref), plus one documented manual sweep run against a real version-provenance issue

**Why:** The version path has never touched the real API (dev/session containers cannot reach api.github.com) and it fails closed, so a production regression would be invisible - every version-provenance issue silently skipped

## Decision (figure-it-out, 2026-07-08)

**Chosen:** a token-gated test in the existing live lane (`vitest.live.config.ts`,
`test:smoke:live`) asserting `createReconcileTransport(token).resolveTagDate('v0.68.0')`
returns that tag's real commit date — this exercises the two unverified behaviors at
once: the `%2F`-encoded ref path (`git/ref/tags%2Fv0.68.0`) and the annotated-vs-
lightweight tag deref branch. Plus one documented manual `retro-reconcile` run from an
egress-capable environment against a real version-provenance issue before closing.

**Rejected:** one-off manual curl — answers once, no regression net; rewriting the path
to a literal slash "per docs" — Octokit itself percent-encodes `{ref}` (RFC 6570), so
`%2F` is the de-facto SDK form and the churn would still need a live confirmation.

**Environment constraint (verified this session):** dev/session containers cannot reach
`api.github.com` (the proxy 403s non-MCP calls), so this can only run where real egress
exists — a maintainer machine or CI with a token. Skip loudly without a token to avoid
rate-limit flakes.

## Work Log

- 2026-07-08T05:12:02.716Z Started: Created ticket B9S30R
- 2026-07-08T05:14:00.000Z Decision recorded (live-lane test + one manual sweep run); parked to backlog. Depends on PR #958 merging (resolveTagDate ships there).
