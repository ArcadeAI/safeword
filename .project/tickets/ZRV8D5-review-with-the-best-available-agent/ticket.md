---
id: ZRV8D5
slug: review-with-the-best-available-agent
type: feature
phase: plan-implementation
status: in_progress
related: [DR6M6N]
phase_anchors:
  - define-behavior: .project/tickets/ZRV8D5-review-with-the-best-available-agent/spec.md
  - scenario-gate: packages/cli/features/review-with-the-best-available-agent.feature
scope:
  - try every usable independent local reviewer before any degraded route
  - fall through to same-agent headless, host-native fresh-context, then bounded main-thread self-review
  - keep review findings available on local and cloud Claude, Codex, and Cursor surfaces
  - label the assurance of the route that completed and preserve required-review policy
  - treat packets and failed-route output as untrusted data across degraded handoffs
out_of_scope:
  - installing or authenticating reviewer CLIs
  - adding Cursor as a headless reviewer runtime to the existing coordinator
  - treating same-agent or self-review findings as model-independent
  - changing the existing coordinator's packet, schema, timeout, or process-cleanup contracts
done_when:
  - the first usable opposite local reviewer returns an independent result
  - a failed independent reviewer falls through to another available independent reviewer before degradation
  - exhausted independent routes use same-agent headless review before host-native delegation
  - Claude Code Cloud returns a fresh-context degraded review without an external agent CLI
  - every delegated-route failure ends in one bounded structured main-thread self-review
  - hostile packet text, route diagnostics, and credentials cannot alter the rubric or result contract
  - prefer may complete with degraded findings while require remains unsatisfied
  - an independent review satisfies require
created: 2026-08-06T23:26:18.179Z
last_modified: 2026-08-06T23:26:18.179Z
---

# Always return the best available review

**Goal:** Keep review available by falling through independent, headless, in-session, and self-review routes without overstating assurance

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-06T23:26:18.179Z Started: Created ticket ZRV8D5
- 2026-08-06T23:26:18.179Z Split: Moved the accepted seven-scenario fallback ladder out of reliable-reviews-for-real-packets (DR6M6N) so the completed coordinator contract remains stable.
- 2026-08-06T23:26:18.179Z Phase: intake → define-behavior; scope, boundaries, outcomes, personas, and affected surfaces are resolved.
- 2026-08-06T23:26:18.179Z Phase: define-behavior → scenario-gate; nine scenarios cover the independent, degraded, cloud, self-review, hostile-input, prefer, and both required-policy partitions after independent review closed two falsification gaps.
- 2026-08-06T23:39:00.000Z Phase: scenario-gate → plan-implementation; independent Claude review approved all nine scenarios with cross-agent provenance and no blocking findings.
