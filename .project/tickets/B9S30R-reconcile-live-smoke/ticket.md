---
id: B9S30R
slug: reconcile-live-smoke
type: task
phase: done
status: done
created: 2026-07-08T05:12:02.716Z
last_modified: 2026-07-13T18:06:00.000Z
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
- 2026-07-13T17:31:01.466Z Phase: intake → verify
- 2026-07-13T18:06:00.000Z **Implemented + verified.** Added `packages/cli/tests/smoke/reconcile.live.test.ts` (token-gated via `resolveGitHubToken`; `describe.skipIf(!CAN_RUN)`; skips loudly; auto-joins the live lane via the `tests/**/*.live.test.ts` glob — no wiring change).
  - **Live-run evidence (egress-capable env, real GitHub token):** egress probe `GET .../git/ref/tags%2Fv0.68.0` → 200; targeted live lane `test:smoke:live` → Test Files 1 passed / Tests 1 passed on a fresh dist build; `resolveTagDate('v0.68.0')` → `2026-07-07T21:47:32Z`. Cross-check: v0.68.0 is an annotated tag (object `b64b93c`) → commit `d5905a7`, committer date `2026-07-07T14:47:32-07:00` = the API result exactly — confirms the annotated-deref branch and that the current `%2F` ref resolves.
  - **Three-stage close (FG6V57-style):** /verify — product suite 5172/5172 pass, Gherkin 407/410 (3 skipped), build ✅, lint ✅; 7 full-suite failures were local-overload/toolchain-env, all in files this diff doesn't touch (cursor-stop-review re-ran 6/6 green isolated; base SHA CI-green). /audit — passed with pre-existing baseline warnings only (arch clean, config in sync, new file adds no dead code/clones). /quality-review — independent fresh-context reviewer APPROVE, no critical issues; applied one accuracy fix (scoped the header to what a green proves: fail-closed path + annotated deref, not `%2F`-vs-raw-slash discrimination). /refactor — assessed, empty ledger (mirrors the `codex-parity.live.test.ts` house pattern), no smells. See `verify.md`.
  - **Manual-sweep half of the original Decision:** satisfied without a separate run — the daily reconcile sweep is already live (PR #990, 89 issues) but none carried version provenance (the gap this ticket closes), so the unit-level live assertion on `resolveTagDate` is the correct closure for the version path.
  - Commits: `ce7889f7` (test), `2a3bda65` (review-driven comment scope fix).
- 2026-07-13T18:07:21.338Z Phase: verify → done
