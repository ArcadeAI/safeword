---
id: 81P5QH
slug: deploy-retro-relay-spike
type: feature
phase: scenario-gate
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/81P5QH-deploy-retro-relay-spike/spec.md'
  - 'scenario-gate: features/deploy-retro-relay-spike.feature'
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
