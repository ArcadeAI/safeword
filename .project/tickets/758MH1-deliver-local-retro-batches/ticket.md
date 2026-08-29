---
id: 758MH1
slug: deliver-local-retro-batches
type: feature
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/3477
phase_anchors:
  - define-behavior: .project/tickets/758MH1-deliver-local-retro-batches/spec.md
  - scenario-gate: features/deliver-local-retro-batches.feature
  - plan-implementation: .project/tickets/758MH1-deliver-local-retro-batches/impl-plan.md
  - verify: .project/tickets/758MH1-deliver-local-retro-batches/verify.md
  - done: .project/tickets/758MH1-deliver-local-retro-batches/verify.md
scope:
  - send every valid sanitized finding from one eligible local session as one ordered deterministic v2 public request
  - keep one shared request identity and receipt for the whole batch across Claude Code Codex and Cursor local carriers
  - accept exact v1 single-finding and v2 batch requests at the existing public collector boundary
  - reuse the current sanitizer source allowlist HTTPS transport deadline opt-out collector SQLite store and private recovery path
  - treat a new request id with byte-identical content in the same session scope as the existing durable submission
  - enforce the existing 65536-byte whole-request limit without partial public delivery
out_of_scope:
  - cloud carrier activation for Claude Code Codex or Cursor
  - new authentication registration credentials endpoints queues retries or telemetry platforms
  - retention deletion tombstone lifetime dashboards and rate-limit policy
  - semantic duplicate decisions or duplicate decisions based on sanitized MCP or operator reads
done_when:
  - local sessions with one or multiple valid findings make exactly one bounded public attempt containing every valid finding in original order
  - zero-valid and oversized batches make no public attempt while existing private recovery remains intact
  - the collector accepts exact v2 carrier bytes and released v1 bodies while rejecting invalid envelopes
  - byte-identical replay reuses the original receipt and unequal raw bytes retain conflict behavior
  - real-collaborator and fault-injection tests prove CLI through HTTP collector and durable store behavior silently
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-29T05:29:09.004Z
last_modified: 2026-08-29T05:29:09.004Z
---

# Deliver every eligible local retro finding in one bounded batch

**Goal:** Submit every eligible sanitized finding from one local session in a single bounded public request without changing recovery behavior.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-29T05:29:09.004Z Started: Created ticket 758MH1
- 2026-08-29T05:35:00Z Intake: Adopted GitHub issue #3477 as the
  canonical contract. Loaded project principles, personas, glossary, and
  surfaces. The user's explicit instruction to deliver through green CI and
  admin merge pre-approved the intake sub-phase gates; the issue already fixes
  the scope, exclusions, and acceptance outcomes, so no product choice remains
  to elicit.
- 2026-08-29T05:36:00Z Intake inspiration: retained one bounded export with a
  whole-request limit and deadline after checking the stable OpenTelemetry
  exporter contract. Rejected queues, scheduled batching, retries, and a new
  telemetry framework as unnecessary for this synchronous local correction.
- 2026-08-29T05:38:00Z Complete: intake — converged one complete-evidence job
  and one invisible-recovery job, three Rules, the issue-defined engineering
  scope, and no open questions. Advanced to define-behavior.
- 2026-08-29T05:42:00Z Complete: define-behavior — derived eight behavioral
  dimensions and saved twelve acceptance scenarios across three Rules. The
  user's pre-approved autonomous delivery instruction confirmed completeness;
  exhaustive malformed-envelope combinations remain lower-level table tests.
  Gherkin lint passed. Advanced to scenario-gate.
- 2026-08-29T06:06:00Z Complete: scenario-gate — independent Claude review
  approved the final scenario set with cross-agent independence after the
  request-identity, raw-byte, scope, byte-boundary, and non-blocking partitions
  were made explicit. Advanced to plan-implementation.
- 2026-08-29T06:10:00Z Plan: chose one strict v2 ordered batch serialized once
  across the local size check and collector boundary, with existing SQLite raw
  bytes remaining replay authority. No dependency, queue, schema migration, or
  ADR is needed; the load-bearing proof is the real CLI-to-collector lifecycle.
- 2026-08-29T06:18:00Z Complete: plan-implementation — independent Claude
  review approved the bounded v2 serializer, v1-compatible collector, raw-BLOB
  replay authority, real-collaborator proof, and Railway-before-release order.
  Advanced to implement.
- 2026-08-29T09:05:00Z Complete: implement — delivered one deterministic v2
  ordered batch across Claude Code, Codex, and Cursor local carriers; retained
  exact v1 intake, raw-byte durable replay authority, silent private recovery,
  the shared byte limit, and one transport-independent request identity.
- 2026-08-29T09:07:00Z Quality: three independent cross-agent reviews approved
  the work. Resolved delta-window scope, strict v2 identity, preparation and
  handoff deadline cleanup, surface-drop coverage, exact-retry coverage, and
  final proof-fidelity findings without adding runtime machinery.
- 2026-08-29T09:10:00Z Complete: verify — 9003 tests, 1483 executable BDD
  scenarios, 68144 steps, 37 proof checks, lint, typecheck, build, diff audit,
  and all five affected-surface proofs passed. No evidence limits remain.
