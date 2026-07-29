# Refactor ledger — 2026-07-29

Scope: the complete `origin/main...HEAD` diff for PR #1522. Three read-only
passes covered mechanical smells, semantic boundaries, and test structure.
Overlapping findings are merged below. The order is leaf-first; every item has
an explicit disposition so no scout finding is silently dropped.

## Accepted checklist

- [x] R1 Rename `listRelayDeadLetterCommand` to `listRelaySpoolCommand`.
- [x] R2 Name the shared 24-hour client retry window.
- [x] R3 Name the semantically distinct discard-claim and recovery-claim leases.
- [x] R4 Rename the per-run `deadLettered` result to `deadLetteredThisRun`.
- [x] R5 Unify durable-record-to-public-receipt projection in the relay store.
- [x] R6 Centralize request and source spool path construction.
- [x] R7 Name and reuse the discard fault-option type.
- [x] R8 Name CLI relay deadline and aggregate-headroom policy values.
- [ ] R9 Replace the `node:sqlite` `createRequire` compatibility workaround with
      the supported static import, retaining built-runtime qualification.
      Deferred after attempted refactor: tsup rewrites the built specifier to
      bare `sqlite`; runtime qualification failed and the edit was reverted.
- [x] R10 Name service request-boundary limits without changing validation order.
- [x] R11 Replace repeated manual deferred-promise setup with the existing test
      helper.
- [x] R12 Extract the repeated dead-letter fixture transition in CLI command
      tests while preserving byte-for-byte assertions.

## Explicitly deferred

These are legitimate opportunities, but they are larger than a safe final
pre-merge refactor pass or depend on abstractions that should settle after the
feature lands. Deferral means no behavior change is hidden inside this pass.

- [ ] D1 Extract single-request delivery from the 101-line delivery aggregator.
      Deferred: medium-risk control-flow rewrite around break/continue, timers,
      and terminal transitions.
- [ ] D2 Extract shared reconciliation/adoption mechanics from `reconcile` and
      `recover`. Deferred: raw-evidence and zero-match policy are safety-critical.
- [ ] D3 Consolidate reconciliation/recovery telemetry and route handlers.
      Deferred: changes the error/reporting boundary immediately before merge.
- [ ] D4 Generalize relay spool filename classification and then split the
      1,992-line delivery module. Deferred: multi-commit state-machine rewrite
      with precedence and import-cycle risk.
- [ ] D5 Extract shared source-tombstone writing. Deferred: acknowledgement wins,
      discard ownership, and fault seams intentionally differ.
- [ ] D6 Centralize relay HTTP request construction and receipt decoding.
      Deferred: recovery and bounded delivery deliberately own different timeout
      lifecycles.
- [ ] D7 Extract SQLite schema lifecycle to `store-schema.ts`. Deferred: module
      move is useful but carries migration/runtime qualification risk.
- [ ] D8 Generalize migration rebuilds. Deferred: historical projections and
      outbox presence differ; explicit SQL is currently a safety property.
- [ ] D9 Split `maintain` and name SQL retention/backoff modifiers. Deferred:
      transaction-local policy rewrite should land with dedicated policy tests.
- [ ] D10 Decompose readiness validation. Deferred: fail-closed prerequisite and
      evidence checks are clearer kept explicit for this release.
- [ ] D11 Extract GitHub App token response decoding and raw-marker page helpers.
      Deferred: outbound fail-closed behavior is security-sensitive.
- [ ] D12 Extract runtime cleanup/builders and the server handler factory.
      Deferred: lifecycle ownership and shutdown ordering are higher-risk than
      the structural benefit.
- [ ] D13 Centralize dead-letter suite setup/cleanup and expired-renewal fixture.
      Deferred: fake-time sequencing makes this more than a leaf cleanup.
- [ ] D14 Track/restart every relay integration store through a fixture registry.
      Deferred: double-close and restart ownership need a dedicated test-support
      change.
- [ ] D15 Decompose the fake GitHub HTTP collaborator.
      Deferred: pagination mutation and create-concurrency accounting are
      intentionally explicit collaborator behavior.
- [ ] D16 Extract shared BDD proof execution and step registration.
      Deferred: acceptance infrastructure has distinct caching and placeholder
      policies.
- [ ] D17 Share runtime environment/free-port fixtures.
      Deferred: production credential roles and BDD identities intentionally
      differ.
- [ ] D18 Decompose the six-surface real-collaborator wiring test.
      Deferred: keeping one shared end-to-end assertion protects cross-harness
      deduplication.
- [ ] D19 Introduce claim-option and restart helpers in tests.
      Deferred: broad fixture cleanup is lower value than retaining explicit
      concurrency parameters before merge.
- [ ] D20 Extract common legacy-database setup only.
      Deferred: the historical DDL itself must remain visibly exact.

## Guardrails

- Storage policy, durable deadlines, tombstone lifetime, authentication,
  marker authority, request identity, ambiguous-create behavior, key rotation,
  and #1495 credential-helper reuse are behavior/design work, not refactors.
- Raw REST bodies remain the only duplicate-marker authority.
- One accepted refactor is applied, focused-tested, regression-checked, and
  committed before the next begins.
