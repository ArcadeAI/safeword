# Data Architecture Guide

Use this guide when work creates or changes a durable data contract. Record only
consequential decisions here; keep reversible, code-local choices in the implementation plan.

## Universal contract

Every applicable plan names these decisions:

- source of truth and authoritative writer `[decision.core.source-of-truth]`
- identity, ownership, tenant/scope binding, and relationship invariants
  `[decision.core.identity-and-scope]`
- accepted values, validation, compatibility, and conflict semantics
  `[decision.core.value-contract]`
- creation, mutation, retention, deletion, restore, and retry boundaries
  `[decision.core.lifecycle]`

Architecture owns durable contracts. Implementation plans own reversible sequencing and helper
choices. Generated schemas or manifests represent a contract but never become a second authority.
Use an ADR only for a qualifying cross-cutting decision, and link evidence rather than copying it.

<!-- data-architecture-ablation:independent-proof:start -->

## Independent proof `[decision.core.independent-proof]`

Every completeness claim names an oracle maintained independently of the mechanism being checked.
Grade the intended and observed semantic IDs as exact sets: missing, forbidden, unknown, or duplicate
IDs fail. Evidence must state the environment, boundary, controls, threshold, and conditions that
require revalidation. A sibling generated output cannot prove another generated output complete
`[proof.core.contract-complete]`.
<!-- data-architecture-ablation:independent-proof:end -->

## Triggered modules

Apply only modules whose trigger fires.

### Relational storage

**Trigger:** relational tables, constraints, joins, or query-performance claims.

- record physical schema, keys, constraints, indexes, tenant-parent binding, and query contract
  `[decision.relational.physical-schema]` `[decision.relational.query-contract]`
- forbid cross-tenant parent binding `[decision.relational.cross-tenant-parent-binding]`
- prove performance with engine/version, representative data shape, query shape, threshold, and
  revalidation trigger `[proof.relational.query-context]`
- never infer coverage from a sibling-generated schema
  `[proof.relational.self-generated-coverage]`

### Encryption and key lifecycle

**Trigger:** application-managed encrypted fields, tokens, credentials, or scope-bound ciphertext.

- record representation/versioning, canonical AAD identity, scope binding, and key dependencies
  `[decision.encryption.representation]` `[decision.encryption.aad-binding]`
  `[decision.encryption.key-lifecycle]`
- prove scope mutation fails and dependency rotation remains covered
  `[proof.encryption.scope-and-rotation]`

### Live migration

**Trigger:** deployed data or mixed application versions must remain available during change.

- record deployed starting state, compatibility window, cutover, recovery, and restore behavior
  `[decision.migration.deployed-state]` `[decision.migration.compatibility]`
  `[decision.migration.cutover-and-recovery]`
- use checked-in migration-equivalent inputs or deployed read-only evidence, not a feature branch
  `[proof.migration.deployed-mixed-version]`

### Temporal behavior

**Trigger:** validity, expiry, ordering, windows, or lifecycle depends on time.

- record authoritative clock, exact equality behavior, retries, and restore semantics
  `[decision.temporal.boundary]`
- exercise the boundary itself, including equality `[proof.temporal.exact-boundary]`

### Erasure and retention

**Trigger:** deletion, expiry, legal erasure, backups, indexes, caches, or derived copies apply.

- inventory every copy and record its deletion or retained disposition
  `[decision.erasure.copy-disposition]`
- prove positive deletion plus sibling-scope and different-owner isolation
  `[proof.erasure.complete-and-isolated]`

### Generated artifacts

**Trigger:** code, schemas, manifests, docs, or catalogues are generated from another source.

- name the authoritative source and generation boundary `[decision.generated.source]`
- compare output with a hand-maintained intended-facet inventory
  `[proof.generated.independent-inventory]`
- do not use sibling generated output as the oracle `[proof.generated.sibling-output]`

## Evidence safety

Use synthetic placeholders such as `SYNTHETIC_TENANT_A` for mutable fixture values and use only
checked-in equivalents or deployed read-only snapshots for migration evidence. Never require or
store production credentials, tokens, keys, ciphertext, nonces, email addresses, plaintext customer
data, or other secret-bearing high-entropy values.

## Completion check

Before approval, verify the universal contract and each triggered module, confirm every durable
decision has one owner, re-grade proof against independent exact-set oracles, and make all referenced
evidence and revalidation conditions resolvable.
