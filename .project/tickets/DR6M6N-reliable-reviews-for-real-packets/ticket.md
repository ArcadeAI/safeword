---
id: DR6M6N
slug: reliable-reviews-for-real-packets
type: feature
phase: implement
phase_anchors:
  - define-behavior: .project/tickets/DR6M6N-reliable-reviews-for-real-packets/spec.md
  - scenario-gate: packages/cli/features/reliable-reviews-for-real-packets.feature
  - plan-implementation: packages/cli/features/reliable-reviews-for-real-packets.feature
  - implement: .project/tickets/DR6M6N-reliable-reviews-for-real-packets/impl-plan.md
phase_skips:
  - scenario-gate: Re-entered define-behavior twice mid-implementation to correct scenarios that field evidence and an independent review proved wrong (the size-derived deadline, the candidate-share floor, the pre-launch capability claim). Each correction returned straight to implement rather than replaying the full gate, which had already run ten adversarial rounds over the same scenarios.
  - plan-implementation: The plan was reviewed independently four times before implementation began and reconciled at implement exit; the mid-flight returns to define-behavior did not change the design it records.
status: in_progress
scope:
  - a size-aware review budget with a documented bounded maximum, honoring the existing explicit override
  - per-candidate time allocation so an earlier reviewer executable cannot starve later ones
  - Codex typed-output wiring that hands it the exact review result contract
  - capability-gated candidate selection that skips reviewers unable to honor that contract
  - an alternate-model retry of the reviewer agent before degrading to the author's own runtime
  - plain-language exhausted-route explanations naming each route's own cause in human and JSON output
out_of_scope:
  - shipping any model name inside safeword (the alternate model is user-configured)
  - adding a third reviewer agent runtime such as Cursor
  - weakening reviewer provenance checks or strict result parsing
  - removing packet-size or reviewer-output bounds
  - letting a degraded review satisfy a required cross-agent check
  - changing review rubrics
  - reviewer installation or authentication
done_when:
  - a representative five-file ~58 KB review whose reviewer answers near 111 seconds returns a verdict instead of a timeout
  - a reviewer that never completes is stopped inside the documented maximum and classified as timed out
  - a slow first candidate still leaves a later compatible candidate a real opportunity to run
  - an exhausted reviewer agent retries on a configured alternate model, still reports a full cross-agent check, and names the reviewing model
  - with no alternate model configured, route selection matches today and safeword passes no model name
  - each attempted route carries its own bounded budget rather than sharing one exhausted deadline
  - Codex receives the exact review result contract, and candidates lacking typed-output support are skipped
  - schema-conforming Codex output passes with allowed fields and severities unchanged
  - exhausted-route human and JSON output name the preferred and fallback causes without raw output, diagnostic noise, or secrets
  - prefer and require keep their current independence and fail-closed guarantees
created: 2026-08-04T14:54:55.395Z
last_modified: 2026-08-04T14:54:55.395Z
---

# Keep independent reviews reliable for real ticket packets

**Goal:** Let realistic bounded review packets complete on the preferred route, and let the Codex fallback return contract-valid results

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-04T14:54:55.395Z Started: Created ticket DR6M6N
- 2026-08-04T16:30:02.281Z Phase: intake → define-behavior
- 2026-08-04T16:33:40.692Z Phase: define-behavior → scenario-gate
