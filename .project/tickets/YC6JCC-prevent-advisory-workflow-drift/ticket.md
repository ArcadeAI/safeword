---
id: YC6JCC
slug: prevent-advisory-workflow-drift
type: task
phase: implement
status: in_progress
parent: P0D6S2
epic: trustworthy-advisory-pr-review
depends_on: [HXT3GW]
created: 2026-08-05T19:52:07.090Z
last_modified: 2026-08-06T13:58:00Z
---

# Prevent advisory workflow drift before release

**Goal:** Continuously prove that Safeword's advisory GitHub workflows remain syntactically valid, opt-in, and runtime-compatible before release.

**Why:** The quality review found that object-shape tests and prose did not catch an unusable permission ceiling or default-on workflow installation; manual actionlint evidence also does not prevent future drift.

**Type:** Improvement

**Scope:** Turn the advisory workflow's manual syntax and runtime checks into
deterministic CI and a release-gated disposable-repository smoke. Preserve the
current opt-in installation and split-privilege contracts as permanent
regressions.

**Out of Scope:** Prerequisite reduction, model inspection, receipt rendering,
freshness, inline findings, or customer-code execution. HXT3GW, Z7M7Y3, and
436EQW retain those product behaviors.

**Done When:**

- [ ] CI validates the installed router and worker paths with a current GitHub Actions schema validator, including environment-secret syntax, reusable-workflow inputs/concurrency, matrix calls, and caller permission ceilings.
- [ ] Reconciliation proves both workflows stay absent unless `prReview.enabled` is exactly `true`, then installs both together from their registered templates.
- [ ] The release lane fails closed unless a disposable-repository smoke proves event and scheduled calls serialize, model credentials remain confined to inspection, and publication creates only a merge-neutral issue comment.
- [ ] Maintainer documentation names the required disposable fixture and explains how to refresh the compatibility evidence when GitHub Actions semantics change.

**Tests:**

- [ ] Integration: generated installed workflow files pass the pinned schema validator; a deliberately invalid fixture fails.
- [ ] Reconciliation: missing, malformed, false, and true `prReview.enabled` values produce the expected zero-or-two workflow plan.
- [ ] Release smoke: a fork PR and scheduled re-evaluation use the same per-PR concurrency group without exposing the model secret to a write-capable job.
- [ ] Release smoke: the advisory receipt leaves approvals, checks, statuses, and merge eligibility unchanged.

## Work Log

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
