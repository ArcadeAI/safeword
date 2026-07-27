---
id: 81P5QH
slug: deploy-retro-relay-spike
type: feature
phase: verify
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/81P5QH-deploy-retro-relay-spike/spec.md'
  - 'scenario-gate: features/deploy-retro-relay-spike.feature'
  - 'implement: .project/tickets/81P5QH-deploy-retro-relay-spike/impl-plan.md'
  - 'verify: .project/tickets/81P5QH-deploy-retro-relay-spike/test-definitions.md'
scope:
  - production entrypoint with explicit host, port, health, shutdown, and fail-closed environment parsing
  - single Railway service with one persistent volume mounted at /data
  - disposable deployment using generated spike credentials and a non-functional GitHub App identity
  - black-box proof that SQLite request identity survives a Railway restart
out_of_scope:
  - production GitHub App creation or a successful live issue filing
  - routing Claude, Codex, or Cursor production traffic
  - multiple replicas, PostgreSQL, and zero-downtime availability
  - retry/dead-letter/compaction maintenance worker
  - production DNS, SLOs, alert routing, or long-term secret rotation
done_when:
  - missing or malformed required configuration prevents startup
  - the service listens on Railway's assigned port and health reports SQLite readiness
  - Railway runs exactly one service instance with /data persisted by a volume
  - a request accepted before restart remains authoritative after restart
  - the spike records costs, limitations, teardown steps, and the path to a real GitHub App
created: 2026-07-27T00:28:08.780Z
last_modified: 2026-07-27T00:28:08.780Z
---

# Prove the retro relay on Railway

**Goal:** Deploy one disposable, single-instance retro relay with persistent SQLite storage and prove health and restart durability.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-27T00:28:08.780Z Started: Created ticket 81P5QH
- 2026-07-27 Railway CLI v5.15.0 was installed but its saved session had expired; browser OAuth restored access as Alex Salazar.
- 2026-07-27 Scope: disposable health and restart-durability proof only. A successful GitHub issue create remains gated on a dedicated production GitHub App.
- 2026-07-27 Phase: intake → define-behavior after resolving the spike boundary, reversibility, persona, and deferred production GitHub App question.
- 2026-07-27 Phase: define-behavior → scenario-gate after the saved Gherkin and R/G/R ledger covered local runtime, live Railway topology/restart, disposable safety, and evidence reporting.
- 2026-07-27 Independent scenario review passed after tightening malformed-input partitions, live topology and restart wiring, hosted credential safety, exact-ID teardown previews, and report validation.
- 2026-07-27 Phase: scenario-gate → plan-implementation. The riskiest assumption is Railway replacement reopening the same SQLite request identity; the live 409 mismatch is the decisive oracle.
- 2026-07-27 Split checkpoint: kept one coupled feature because runtime, container, volume, live smoke, teardown preview, and report have no independent user value.
- 2026-07-27 Independent plan review passed after requiring changed Railway replica identity, atomic resource-ID capture, stdin-only secret injection, built-image wiring, explicit 0.0.0.0 binding, and stage-specific zero-create proof.
- 2026-07-27 Phase: plan-implementation → implement with six RED/GREEN/REFACTOR slices; the live Railway replacement proof remains the decisive slice.
- 2026-07-27 RED: `bun run --cwd packages/retro-relay test tests/runtime.test.ts` failed because `runtime-config` does not exist. The RED test could not be committed because the lint gate rejects unresolved imports; recorded the workflow's uncommittable-partial-state escape hatch before GREEN.
- 2026-07-27 Live: created only `safeword-relay-spike-0726`, deployed one service and one `/data` volume, and injected generated disposable values through Railway CLI stdin.
- 2026-07-27 Live: a deliberately uninstalled GitHub App failed at installation-token acquisition, with zero possible issue-create calls.
- 2026-07-27 Live: an exact Railway service restart changed the per-process boot ID while preserving the Railway replica ID; changed payload under the pre-restart request ID returned HTTP 409.
- 2026-07-27 Correction: `RAILWAY_REPLICA_ID` remains stable across an in-place restart and is hosting identity, not a restart oracle. Health now exposes an opaque process boot UUID for the spike proof.
- 2026-07-27 Quality review requested Node security, bounded draining, and wired safety fixes. Upgraded the image to Node 24.18.0, configured 30-second Railway draining with a 25-second application bound, and added stdin-only atomic state, topology, report-redaction, and exact teardown validation.
- 2026-07-27 Independent quality re-review approved with no critical issues.
- 2026-07-27 Phase: implement → verify after the live durability proof, hardened redeployment, executable Gherkin, and safety wiring passed.
