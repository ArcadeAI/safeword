# Refactor ledger — 2026-08-01

Scope: the relay client slice changed in PR #1522. Scout inputs: CLI lint and
typecheck, dependency-cruiser, Knip, and a semantic pass over relay delivery
and command outcomes. Entries are leaf-first; every finding has a disposition.

## Completed

- [x] R1 Extract `relayDeliveryFailureOutcome` from `runRelayRetro`.
  The named helper contains the single structured outcome for a post-persistence
  delivery error, leaving the orchestration function focused on the successful
  delivery state machine. Behavior is characterized by the invalid-route and
  combined persistence/delivery-failure tests. Commit: `edd2ced14`.
- [x] R2 Extract retained-alias deprecation selection from `executeDefinition`.
  The helper keeps command execution focused on invocation and reporting while
  preserving the legacy `retro` compatibility metadata. The real CLI alias
  regression test proves the externally visible JSON envelope. Commit:
  `1f5df8ef9`.

## Deferred

- [ ] D1 Consolidate `rearmClaim`, `deadLetterClaim`, and
  `releaseRecoveryClaim`. They look similar but have different terminal
  ownership: rearm must suppress acknowledged work, while dead-letter and
  recovery preserve visible terminal work. Generalizing them would be a
  state-machine redesign, not a leaf refactor.
- [ ] D2 Replace the separate snapshot state rank and recovery sibling lists.
  The rank selects an authoritative live state; sibling lists select matching
  files for cleanup. They are intentionally not two implementations of the same
  precedence rule.
- [ ] D3 Remove the exported `RELAY_CLEANUP_RESERVE_MS` reported by Knip. It is
  a feature-branch pre-existing public export; removing it needs an API-scope
  decision rather than this local cleanup.
- [ ] D4 Split `deliverRelayRequests`. Its timeout, claim, acknowledgement, and
  dead-letter transitions are coupled by explicit cleanup ordering. Extract
  only with dedicated transition/race characterization tests.

## Audit result

- CLI lint and typecheck passed.
- Dependency-cruiser: 0 errors, 1 pre-existing `no-orphans` warning.
- Knip: the pre-existing exported `RELAY_CLEANUP_RESERVE_MS` finding above.
