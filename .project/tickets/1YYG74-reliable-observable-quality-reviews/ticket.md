---
id: 1YYG74
slug: reliable-observable-quality-reviews
type: feature
phase: done
status: done
phase_anchors:
  - 'define-behavior: .project/tickets/1YYG74-reliable-observable-quality-reviews/spec.md'
  - 'scenario-gate: packages/cli/features/reliable-observable-quality-reviews.feature'
  - 'plan-implementation: .project/tickets/1YYG74-reliable-observable-quality-reviews/impl-plan.md'
  - 'implement: .project/tickets/1YYG74-reliable-observable-quality-reviews/test-definitions.md'
  - 'verify: .project/tickets/1YYG74-reliable-observable-quality-reviews/verify.md'
  - 'done: .project/tickets/1YYG74-reliable-observable-quality-reviews/verify.md'
scope:
  - revalidate the typed reviewer-failure baseline delivered by ticket 3FK4DC and PR #2591
  - let the managed review wrapper privately enable existing progress for JSON review runs without changing the public CLI contract
  - degrade safely to a silent review when the resolved CLI predates the private progress signal
  - update Safeword-owned required-review skill invocations on Claude Code and Codex surfaces
  - preserve route-funding and typed-failure behavior with focused regression tests while proving progress stream separation and quiet precedence through the public CLI
out_of_scope:
  - redesigning the existing 120-second default route attempt and 1,800-second detached-worker run bound
  - exposing raw reviewer-controlled output in progress or recovery guidance
  - adding a public progress option or a streaming result protocol
  - Cursor review wiring until Cursor has a required independent-review invocation
  - guaranteeing wall-clock cleanup when the operating system cannot reap a terminated reviewer child
done_when:
  - TBU1.R1 and TBU1.R2 pass through managed-wrapper and public-CLI scenarios that assert material stdout stderr and exit-status values
  - SWM1.R1 and SWM1.R2 pass through progress-failure reviewer-isolation compatibility and installed-surface parity scenarios
  - focused regression tests preserve ticket 3FK4DC's route funding failure taxonomy and bounded reviewer-output behavior
  - full verification audit quality-review and refactor gates report no blocking findings
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-11T18:27:36.373Z
last_modified: 2026-08-13T07:42:00.000Z
---

# Keep quality reviews observable and actionable

**Goal:** Let Safeword complete long independent reviews with visible bounded progress and precise recovery without corrupting machine output.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-11T18:27:36.373Z Started: Created ticket 1YYG74
- 2026-08-11T18:41:00.000Z REVIEW: Draft intake contract revised after two independent cross-agent quality-review passes; ticket remains in intake pending user confirmation of Rules and engineering scope.
- 2026-08-11T18:48:00.000Z REVIEW: Third pass tightened combined-stream consumption, zero-process discovery outcomes, exact cadence reset/cancellation, same-version skill/CLI delivery, and bounded schema-validated reviewer output.
- 2026-08-11T18:54:00.000Z REVIEW: Fourth pass made the final result single-line and ordered after progress cancellation, added wrapper capability degradation for older CLIs, and specified read-time per-stream limits and exit statuses.
- 2026-08-11T19:01:00.000Z REVIEW: Fifth pass scoped the machine envelope to accepted invocations, pinned request-changes to exit 2, specified clamped route budgets, last-valid-result extraction, overflow draining and termination, probe allowlists/timeouts, and the existing human-progress baseline.
- 2026-08-11T19:07:00.000Z REVIEW: Sixth pass made every typed terminal outcome a single-line schema-1 action-required result with exit 2, removed the contradictory unconditional transition announcement, prohibited reviewer bytes on host-facing streams, and distinguished the reviewer-work budget from total wall time.
- 2026-08-11T19:15:00.000Z REVIEW: The repeated quality challenge showed the public option was creating more protocol than value. Simplified to a private managed-wrapper signal that older CLIs safely ignore; direct public CLI behavior remains unchanged.
- 2026-08-11T19:22:00.000Z REVIEW: Eighth pass pinned reviewer stdio isolation and dispatch/schema authentication, separate wrapper streams, private-signal scrubbing, route-exhausted behavior, and admissible old-CLI proof.
- 2026-08-11T19:28:00.000Z REVIEW: Ninth pass distinguished the Safeword CLI child from reviewer agent processes and restored the single-line envelope after progress cancellation for merged host displays.
- 2026-08-11T19:34:00.000Z REVIEW: Final quality pass returned no error-severity findings. Carried its worthwhile warnings into proof for escaped output, candidate trust order, signal scrubbing, and non-fatal progress writes; stopped further contract expansion.
- 2026-08-11T19:40:00.000Z REVIEW: Follow-up distinguished wrapper CLI-unavailability from typed review outcomes, pinned existing exit statuses, and specified multi-route failure aggregation without changing candidate resolution.
- 2026-08-11T19:46:00.000Z REVIEW: Clarified that only validated reviewer summary/findings enter the escaped bounded envelope, fixed progress/recovery prose remains Safeword-owned, scoped progress to asynchronous reviewer work, and required consume-and-delete handling for the internal signal.
- 2026-08-11T19:52:00.000Z REVIEW: Assigned wrapper no-CLI failure exit 127 on stderr, dropped merged-host ordering from the machine contract, and required a true real-wrapper to real-CLI to real-coordinator wiring scenario.
- 2026-08-11T19:58:00.000Z REVIEW: Made CLI consume-and-delete normative with reviewer allowlisting as defense in depth, reserved/remapped wrapper exit 78, enumerated the integrated failure taxonomy, pinned exact signal/funding-floor semantics, and named the acceptance feature.
- 2026-08-11T20:03:00.000Z REVIEW: Moved wrapper 78/no-CLI behavior into SWM1.R3 acceptance and narrowed unchanged direct-JSON behavior to callers without the unsupported internal signal.
- 2026-08-11T20:08:00.000Z REVIEW: Closed the reviewer-field allowlist with verdict/severity, restored independent per-stream limits, split real-time wiring from in-process clock proof, and removed duplicate multi-route envelope design from this ticket.
- 2026-08-11T20:12:00.000Z REVIEW: Aligned engineering scope with SWM1.R4: route funding is deterministic in-process proof; public CLI proof owns progress streams and quiet precedence.
- 2026-08-11T20:17:00.000Z REVIEW: Final pass qualified silent direct callers by signal absence, pinned overflow to child termination plus invalid-output, and assigned cadence to deterministic reporter tests.
- 2026-08-11T20:22:00.000Z REVIEW: Distinguished reviewer failure reasons in data.preferred_failure from REVIEW_ROUTES_EXHAUSTED finding codes and pinned the wrapper's existing 10-second review-run help capability probe.
- 2026-08-12T03:00:00.000Z REBASE: Caught up exactly to origin/main at 66e0f82a4. Ticket 3FK4DC landed through PR #2591, so it is now a verified baseline rather than an external dependency; the remaining product gap is managed JSON-review progress. PR #2595 also strengthens BDD proof expectations but does not change this feature's intended behavior.
- 2026-08-12T10:30:00.000Z BDD: Derived nine behavioral partitions and authored four actor-visible Rules with ten executable scenarios. Moved exact timing budgets, byte caps, and the full #2591 taxonomy to focused regression coverage; retained end-to-end assertions for typed results, streams, exit statuses, surface wiring, and old-CLI compatibility.
- 2026-08-12T10:48:00.000Z REVIEW: Independent scenario gate requested changes. Added deterministic progress-rate boundaries, exact exhausted-route fields and exit behavior, complete rejected-output non-disclosure, reviewer-environment signal isolation, both terminal classes under progress-write failure, and stronger Claude/Codex wrapper wiring assertions.
- 2026-08-12T11:03:00.000Z REVIEW: Second scenario-gate pass found three remaining ambiguities. Tightened every machine-output path to exactly one schema envelope and no other stdout bytes, sequenced the 60-second heartbeat before completion, and changed surface parity proof from generated-text inspection to real installed entry-point execution with argument, stream, and status preservation.
- 2026-08-12T11:15:00.000Z REVIEW: Third pass removed vacuous negative paths by requiring an observed rejected progress write, concrete lifecycle output in security and human-mode cases, unambiguous 60-second heartbeat ordering, and a broader exact-sentinel rejection table.
- 2026-08-12T11:28:00.000Z REVIEW: Fourth pass added fast and simultaneous completion cancellation boundaries, rejected delayed-plus-heartbeat writes for both result classes, fresh timer ownership across fallback transitions, and exact allowed lifecycle messages and counts.
- 2026-08-12T11:40:00.000Z REVIEW: Fifth pass covered timer-first ordering at simultaneous boundaries, required silent handling of rejected progress writes on both streams, pinned invalid-output handling to a canonical fixed envelope, and added the positive exact-value progress signal case.
- 2026-08-12T11:53:00.000Z REVIEW: Sixth pass replaced self-referential expectations with fixed verdicts and findings, pinned route-exhaustion recovery fields, made human stdout/stderr separation complete, fully sequenced fallback clocks, and bounded reviewer-payload encoding checks.
- 2026-08-12T12:07:00.000Z REVIEW: Seventh pass corrected the fallback heartbeat timeline, crossed synchronous and asynchronous progress failures with both terminal result classes, localized the exhaustion target, and pinned rejected-output diagnostics to a wholly coordinator-owned canonical fixture.
- 2026-08-12T12:18:00.000Z REVIEW: Eighth pass unified heartbeat timing on route start and added one bounded outline covering all seven landed reviewer-failure classifications with exact action-required output and exit behavior.
- 2026-08-12T12:36:00.000Z REVIEW: First successful cross-agent review found two blockers and ten strengthening points. Made suppression paths slow and deterministic; separated installed passthrough from real-wrapper environment scoping; moved taxonomy to focused regressions; specified clock-jump cadence, literal exit/recovery/secret checks, timeout leakage, and exhaustive generated-workflow wiring; aligned ledger rule titles.
- 2026-08-12T12:52:00.000Z REVIEW: Second cross-agent pass clarified total boundary line counts, deterministic invalid-output timing and route funding, exact fallback ordering, injected progress-sink semantics, ordinary human progress, success and failure passthrough, catalogue non-emptiness, rejection tags, and focused-test ownership of the full failure taxonomy; removed a duplicate inferential signal-isolation scenario.
- 2026-08-12T13:08:00.000Z REVIEW: Third cross-agent pass bound timer rows to ordered line identities, made timeout and old-CLI compatibility non-vacuous, proved the reviewer actually launches without the private signal, distinguished the real wrapper, and added alternate-model timers, packet-preparation silence, human quiet mode, exact multi-route messages, and persona cleanup.
- 2026-08-12T13:25:00.000Z REVIEW: Fourth cross-agent pass made two- and three-route timing self-contained and exact, replaced timer prose with literal bytes, made clock-jump ordering exact, added success-with-progress workflow passthrough, pointed delegated taxonomy coverage to concrete regression files, moved the positive signal control to the progress rule, and closed successful and exhausted reviewer-output leakage paths.
- 2026-08-12T13:41:00.000Z REVIEW: A timed-out independent route's degraded follow-up added terminal envelopes, statuses, and timer cancellation to route-reset scenarios; exact timeout lifecycle stderr; distinct preferred/fallback leakage sentinels; and deterministic asynchronous progress-error ordering with process-survival proof.
- 2026-08-12T14:02:00.000Z REVIEW: Scenario gate approved with no material findings after the assigned Claude reviewer timed out and the separate Codex fallback completed a degraded review. Recorded author=codex, reviewer=codex, independence=degraded provenance; ticket remains at scenario-gate pending user completeness confirmation.
- 2026-08-12T14:12:00.000Z BDD: User confirmed the reviewed scenarios fully cover the intended behavior and important boundaries. No documentation-unknown build risk warrants a spike; advanced to plan-implementation after rebasing cleanly onto origin/main at 077e50b4d and revalidating the feature lane.
- 2026-08-12T14:32:00.000Z PLAN: Selected a consumed private environment signal over a hidden argv option or wrapper-owned progress. Planned four coupled slices with real wrapper/CLI/coordinator wiring first, no ADR, and durable background review explicitly separated.
- 2026-08-12T15:08:00.000Z REVIEW: Independent implementation-plan review requested changes. Replaced the impossible deterministic-grandchild proof with a real-time wrapper walking skeleton plus in-process deterministic CLI tests; moved reporter arming to reviewer-route activation; assigned human-mode, failing-sink, environment-builder, installed-surface, and documentation ownership explicitly.
- 2026-08-12T15:27:00.000Z REVIEW: Second plan pass caught an unintended human-mode timing change and missing pipe/failing-stderr proof. Restricted packet-preparation suppression to managed JSON, documented the reporter's unconditional non-TTY behavior, added production-adapter failure coverage, moved wrapper regeneration into the walking skeleton, and required exact generated-workflow argv/stream/status passthrough.
- 2026-08-12T15:41:00.000Z REVIEW: Third plan pass tightened proof seams: the exported registration helper now owns signal parsing/deletion; the stderr error listener spans the reporter lifetime; landed 3FK4DC fixture/deadline/config seams are named; slice-boundary green scenarios are explicit; managed-human preparation and existing quiet behavior are regression guarded.
- 2026-08-12T16:03:00.000Z REVIEW: Fourth plan pass folded managed preparation filtering into the walking skeleton, made signal deletion unconditional on every registration path, cited the reporter's stage-scoped implementation, assigned action-required/quiet/isolation scenarios once, and recorded old-CLI environment-versus-argv compatibility as the decisive signal rationale.
- 2026-08-12T16:19:00.000Z REVIEW: Fifth plan pass named the current JSON reporter-construction gate, verified literal messages in coordinator route functions, documented route-start heartbeat anchoring, moved registration dependency injection into slice 1, and clarified that old-CLI proof is the no-new-argv invariant.
- 2026-08-12T16:38:00.000Z REVIEW: Sixth pass (degraded after Claude timeout) caught a late stderr-error lifecycle hole. The production adapter now owns scoped error handling through settlement of every pending progress write, including after reporter stop/result production, then removes the listener to avoid swallowing unrelated stderr failures.
- 2026-08-12T17:22:00.000Z BDD: Reopened the scenario gate after plan review exposed an implementation-shaped async-stderr requirement and missing live-forwarding proof. Replaced it with observable synchronous/closed/isolated-sink failure partitions, split delayed-line and heartbeat boundaries, and added wrapper progress-before-exit behavior. Revised scenarios passed with zero findings under degraded Codex fallback after Claude timeout.
- 2026-08-12T17:29:00.000Z PLAN: Applied all review suggestions by replacing process-wide stderr listener management with an isolated synchronous descriptor sink, splitting sink/lifecycle/wrapper work into independently green slices, requiring the shipped generated wrapper in the walking skeleton, and retaining a live dogfood observation.
- 2026-08-12T18:31:00.000Z BDD: Final cross-agent red team drove route-provenance fixtures, public-command environment isolation, quiet anti-vacuity, TTY parity, coalesced heartbeat semantics, hostile-data encoding, literal transition text, and raw wrapper-status passthrough. Removed the unreachable async-stream row because production now uses synchronous descriptor writes. Final scenario gate approved with zero findings under degraded fallback after Claude timeout.
- 2026-08-12T18:47:00.000Z PLAN: Implementation plan approved with zero findings under degraded Codex fallback after Claude timeout. Entered implement with a four-slice vertical-first plan and synchronous descriptor ownership for progress writes.
- 2026-08-13T07:42:00.000Z DONE: Full verification, repository audit, quality review, refactor review, BDD proof review, and customer-brittleness assessment passed. Rebased onto current main, reconciled durable background-review progress wording, and verified the exact PR SHA in CI.
