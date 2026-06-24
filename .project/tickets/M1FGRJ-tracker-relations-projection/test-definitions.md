# Test Definitions: sync-tracker v2 graph projection

## tracker-relations.TB1.AC1 — Parents exist before children are linked

- [x] RED: added an orchestrator test where a child sorts before its parent by ID
      but the writer creates the parent first; it failed with child-before-parent.
- [x] GREEN: sorted the corpus by resolvable `parent:` / `epic:` before
      projecting.
- [x] REFACTOR: kept ordering pure and provider-neutral.

## tracker-relations.TB1.AC2 — Native hierarchy is attempted only for known parents

- [x] RED: added payload/corpus tests for native type and ticket graph metadata;
      they failed before the new fields existed.
- [x] GREEN: carried raw parent/dependency metadata through the corpus and
      resolved it only against known corpus aliases during projection.
- [x] REFACTOR: kept v1 `epic:` labels untouched as fallback.

## tracker-relations.TB1.AC3 — Dependencies become native issue relations

- [x] RED: added an orchestrator test that records a synced dependency target and
      expects the writer to receive a blocked-by relation.
- [x] GREEN: translated `depends_on:` / `blocked_on:` refs through the sidecar map
      and skipped dangling refs.
- [x] REFACTOR: shared graph-ref resolution across create/update/reconcile.

## tracker-relations.TB1.AC4 — Type promotion keeps the label fallback

- [x] RED: added payload/writer tests showing `issueType` is supplied while the
      `type:<type>` label remains.
- [x] GREEN: extended `IssuePayload` and writer graph requests with the native
      type candidate.
- [x] REFACTOR: kept unsupported native type fallback in the GitHub adapter, not
      the orchestrator.

## tracker-relations.TB1.AC5 — Graph projection is idempotent

- [x] RED: added an orchestrator test that re-runs against recorded refs and still
      calls the graph writer without creating a duplicate.
- [x] GREEN: invoked graph projection after every successful create/update or
      reconcile using recorded sidecar refs.
- [x] REFACTOR: kept sidecar format stable.
