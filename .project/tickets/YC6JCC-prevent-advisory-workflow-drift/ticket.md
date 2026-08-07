---
id: YC6JCC
slug: prevent-advisory-workflow-drift
type: task
phase: done
status: done
parent: P0D6S2
epic: trustworthy-advisory-pr-review
depends_on: [HXT3GW]
created: 2026-08-05T19:52:07.090Z
last_modified: 2026-08-07T09:10:15Z
---

# Prevent advisory workflow drift before release

**Goal:** Continuously prove that Safeword's advisory GitHub workflows remain syntactically valid, opt-in, and runtime-compatible before release.

**Why:** The quality review found that object-shape tests and prose did not catch an unusable permission ceiling or default-on workflow installation; manual actionlint evidence also does not prevent future drift.

**Type:** Improvement

**Scope:** Turn the advisory workflow's manual syntax and runtime checks into
deterministic CI, a change-scoped release-blocking disposable smoke, and a
scheduled/manual canary for platform drift. Preserve the current opt-in
installation and split-privilege contracts as permanent regressions.

**Out of Scope:** Prerequisite reduction, model inspection, receipt rendering,
freshness, inline findings, or customer-code execution. HXT3GW, Z7M7Y3, and
436EQW retain those product behaviors.

**Done When:**

- [x] CI validates the installed router, worker, and trusted publisher paths with a current GitHub Actions schema validator, including environment-secret syntax, reusable-workflow inputs/concurrency, matrix calls, and caller permission ceilings.
- [x] Reconciliation proves all three workflows stay absent unless `prReview.enabled` is exactly `true`, then installs them together from their registered templates.
- [x] When the advisory workflow or compatibility harness changed since the last successful stable release, the release lane fails closed unless a disposable-repository smoke proves event and scheduled calls serialize, model credentials remain confined to inspection, and publication creates only a merge-neutral issue comment.
- [x] A scheduled/default-branch manual canary detects GitHub platform drift between releases without granting arbitrary branches access to the smoke environment.
- [x] Maintainer documentation names the required disposable fixture and explains how to refresh the compatibility evidence when GitHub Actions semantics change.

**Tests:**

- [x] Integration: generated installed workflow files pass the pinned schema validator; a deliberately invalid fixture fails.
- [x] Reconciliation: missing, malformed, false, and true `prReview.enabled` values produce the expected zero-or-three workflow plan.
- [x] Release smoke: a fork PR and scheduled re-evaluation use the same per-PR concurrency group without exposing the model secret to a write-capable job.
- [x] Release smoke: the advisory receipt leaves approvals, checks, statuses, and merge eligibility unchanged.

## Work Log

- 2026-08-07T09:10:15Z Strengthened the release proof after PR review. Stable is
  now the last-known-good comparison point: deterministic contracts run on every
  release, the destructive live smoke blocks only when advisory production or
  harness surfaces changed, and a daily/default-branch canary detects GitHub
  drift between releases. Both owner variables now require distinct dedicated
  sandboxes, and the token is documented without production-repository
  authority. Actionlint and the focused release contract pass.
- 2026-08-06T17:12:45Z Complete: User confirmed closure after reviewing the
  passing local contracts and live disposable-repository evidence. The final
  diff-scoped audit reported no findings; PR scope, scenario coverage, and
  cross-scenario refactoring were rechecked against `verify.md`.
- 2026-08-06T16:12:45Z Final local verification passed: workflow and smoke
  contracts 6/6, schema contracts 36/36, and release contracts 4/4. The
  release workflow now fails closed on the environment-protected live smoke;
  the ticket remains in verification pending closure confirmation.
- 2026-08-06T15:43:12Z Live GitHub evidence changed the architecture in two
  necessary ways. Same-repository reusable calls required `secrets: inherit`
  before the environment-scoped model secret reached inspection. Fork-triggered
  runs could not write a PR comment even when their declared token scope said
  `issues: write`; the ordinary PR-comment endpoint also required
  `pull-requests: write`. Added a trusted, no-checkout `workflow_run` publisher
  that discovers only the worker's JSON artifact, shares the per-PR lock, and
  calls only invalidation/publication commands. The final disposable run passed:
  event 31116176245, publisher 31116192147, and scheduled projection 31116229231
  all succeeded; one active plus one pending lease was observed; one marker
  comment remained; reviews, statuses, and mergeability were unchanged; both
  disposable repositories were permanently deleted.
- 2026-08-06T14:30:34Z Added the disposable fixture generator. It preserves the
  canonical router byte-for-byte, derives its manual sweep from the canonical
  scheduled caller, and confines worker drift to the three command probes that
  test secret scope, read-only inspection, JSON handoff, and issue-comment
  publication. Both fixture contract tests, actionlint, ESLint, and TypeScript
  pass.
- 2026-08-06T14:11:39Z Added a pinned actionlint v1.7.12 CI gate with
  checksum verification. The check renders the actual installed router and
  worker through the schema, validates them together, and proves the validator
  rejects a deliberately invalid permission fixture. Local actionlint, ESLint,
  and TypeScript checks pass.
- 2026-08-06T14:08:46Z Made opt-out reconciliation symmetric with opt-in:
  enabling advisory review installs exactly both registered workflows; disabling
  it removes only Safeword's exact scaffold bytes and preserves either customized
  workflow. Targeted lint, typecheck, and all 4 workflow contract tests pass.
- 2026-08-06T13:58:00Z Chose the smallest release proof after reviewing current
  GitHub contracts. Deterministic actionlint/reconciliation tests will bind the
  installed router and worker to their canonical templates. A purpose-built
  disposable public fixture derived from those templates will substitute only
  the unpublished CLI commands with bounded probes, then prove real fork-event,
  environment-secret, token-permission, concurrency, artifact, and ordinary
  issue-comment semantics. Exact post-publish execution was rejected because it
  cannot gate unpublished bytes; static-only validation was rejected because it
  cannot prove GitHub runtime behavior. Premortem: fixture drift creates a false
  green; mitigate by failing on every structural difference outside the explicit
  probe substitutions.
- 2026-08-05T19:52:07.090Z Started: Created ticket YC6JCC
- Quality-review follow-up: existing HXT3GW work already owns completeness, staleness, draft invalidation, and real CLI wiring. This ticket captures only the missing compatibility/release-proof layer.
