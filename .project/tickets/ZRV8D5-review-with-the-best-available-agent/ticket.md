---
id: ZRV8D5
slug: review-with-the-best-available-agent
type: feature
phase: implement
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
  - changing the existing coordinator's packet, timeout, route, or process-cleanup contracts
done_when:
  - the first usable opposite local reviewer returns an independent result
  - a failed independent reviewer falls through to another available independent reviewer before degradation
  - exhausted independent routes use same-agent headless review before host-native delegation
  - Claude Code Cloud ships the documented read-only reviewer assets needed for fresh-context review without an external agent CLI
  - shipped host assets direct one bounded structured main-thread self-review after delegated-route failure
  - shipped host assets frame hostile packet text as data and never forward route diagnostics or credentials
  - only typed route exhaustion enters the host-owned degraded ladder
  - prefer may complete with degraded findings while require remains unsatisfied
  - an independent review satisfies require
  - host-acquired findings are never recorded as independent evidence
created: 2026-08-06T23:26:18.179Z
last_modified: 2026-08-06T23:26:18.179Z
---

# Keep review available with the best supported fallback

**Goal:** Attempt independent, headless, in-session, and self-review routes in order, while structurally refusing invalid results or overstated assurance

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-06T23:26:18.179Z Started: Created ticket ZRV8D5
- 2026-08-06T23:26:18.179Z Split: Moved the accepted seven-scenario fallback ladder out of reliable-reviews-for-real-packets (DR6M6N) so the completed coordinator contract remains stable.
- 2026-08-06T23:26:18.179Z Phase: intake → define-behavior; scope, boundaries, outcomes, personas, and affected surfaces are resolved.
- 2026-08-06T23:26:18.179Z Phase: define-behavior → scenario-gate; nine scenarios cover the independent, degraded, cloud, self-review, hostile-input, prefer, and both required-policy partitions after independent review closed two falsification gaps.
- 2026-08-06T23:39:00.000Z Phase: scenario-gate → plan-implementation; independent Claude review approved all nine scenarios with cross-agent provenance and no blocking findings.
- 2026-08-07T00:08:00.000Z Plan review: reopened the scenario gate after independent review found the typed-exhaustion boundary was planned but not behaviorally specified.
- 2026-08-07T00:26:00.000Z Phase: scenario-gate → plan-implementation; 15 scenarios passed independent AODI review after adding atomic non-exhaustion, ambient-context, assurance-distinction, and headless-to-host coverage.
- 2026-08-07T00:42:00.000Z Plan review: reopened the scenario gate to align terminal non-exhaustion examples with the coordinator's existing route-failure semantics.
- 2026-08-07T01:05:00.000Z Phase: scenario-gate → plan-implementation; 19 scenarios passed independent AODI review after making CLI-coordinator and host-fallback ownership explicit.
- 2026-08-07T01:22:00.000Z Plan review: reopened the scenario gate to make policy and assurance code-owned, add the host-fallback escape hatch, and define an empty self-review result.
- 2026-08-07T01:48:00.000Z Phase: scenario-gate → plan-implementation; 22 scenarios passed independent AODI review with code-owned policy/assurance, security contrasts, empty findings, and an off switch.
- 2026-08-07T02:01:00.000Z Plan review: reopened the scenario gate to align the user promise and fresh-context wording with what the host can actually prove.
- 2026-08-07T02:11:00.000Z Phase: scenario-gate → plan-implementation; 22 scenarios passed independent AODI review with host-reported fresh-context assurance and an enforceable typed finalization boundary.
- 2026-08-07T02:25:00.000Z Plan review: reopened the scenario gate to bind finalization to a coordinator-issued run record and preserve degraded changes-requested verdicts.
- 2026-08-07T02:38:00.000Z Phase: scenario-gate → plan-implementation; 23 scenarios passed independent AODI review with run-bound finalization and degraded verdict preservation.
- 2026-08-07T02:52:00.000Z Plan review: reopened the scenario gate to pin abandonment, per-route attempts, host-time source mutation, and degraded phase-stamp behavior.
- 2026-08-07T03:04:00.000Z Phase: scenario-gate → plan-implementation; 27 scenarios passed independent AODI review with abandonment safety, attempt bounds, source-hash finalization, and degraded phase-stamp semantics.
- 2026-08-07T03:18:00.000Z Plan review: rejected the transactional run-record design as bloat that still could not enforce foreground host invocation; returned to the accepted best-effort host fallback JTBD.
- 2026-08-07T03:31:00.000Z Phase: scenario-gate → plan-implementation; 22 scenarios passed independent AODI review after removing the unenforceable transactional protocol.
- 2026-08-07T03:47:00.000Z Plan review: reopened the scenario gate to define malformed terminal self-review, make the previously discussed off-switch decision explicit, and remove a duplicate ambient-context scenario.
- 2026-08-07T04:02:00.000Z Phase: scenario-gate → plan-implementation; 25 scenarios passed independent AODI review after closing both degraded-verdict polarities, terminal invalid output, cloud-without-delegation, and assurance-forgery gaps.
- 2026-08-07T04:08:00.000Z Plan review: reopened the scenario gate to pin invoked reviewer runtime failure and scope prompt-injection containment to the guarantees shipped host assets can honestly provide.
- 2026-08-07T04:16:00.000Z Phase: scenario-gate → plan-implementation; 26 scenarios passed independent AODI review with the runtime-failure and enforceable-containment boundaries explicit.
- 2026-08-07T04:23:00.000Z Phase: plan-implementation → implement; the parse-valid planned design passed independent review with the foreground-handoff smoke check named as its riskiest assumption.
- 2026-08-07T05:10:00.000Z Implementation: added the bounded `finish-review` workflow, shared fixed rubric, read-only Claude/Cursor reviewer, Codex generation, schema registration, and typed-exhaustion handoff parity for every class-1 coordinator caller.
- 2026-08-07T05:22:00.000Z Smoke: a fresh Codex in-session reviewer followed the shipped contract and approved with no findings; this is degraded same-agent evidence, not independent evidence. Live cloud execution remains unavailable locally.
- 2026-08-07T05:41:00.000Z Main catch-up: merged `origin/main`, retained the shared route-budget semantics, adopted the five-minute compatibility timeout API, and regenerated the newer Claude plugin distribution with the fallback assets.
- 2026-08-07T06:03:00.000Z Quality/refactor: degraded review requested changes because the host reads live paths and final result fields were prose-only. Restricted the named reviewer to `Read`, disclosed that source integrity is not revalidated, pinned coordinator/policy/state/verdict fields, and added generated sibling-contract parity. Rejected a CI claim that could force foreground delegation because no host exposes that programmatic boundary.
