# Data Architecture Guide

Use this guide when work creates or changes a durable data contract. Record only
consequential decisions here; keep reversible, code-local choices in the implementation plan.

See `@"${CLAUDE_PLUGIN_ROOT}"/resources/guides/llm-writing-guide.md` for concise agent-facing documentation style.

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

### Mixed decision routing

**Trigger:** the case mixes durable contracts with reversible helper or control-flow choices.

Route durable identity and lifecycle contracts to architecture
`[decision.routing.identity-architecture]` `[decision.routing.lifecycle-architecture]` and route
reversible helpers and control flow to implementation planning
`[decision.routing.helper-implementation]` `[decision.routing.control-flow-implementation]`.
The separation itself is reviewable evidence `[proof.routing.durable-and-reversible-separated]`;
implementation-only durable contracts `decision.routing.identity-implementation-only`, architecture-owned
helpers `decision.routing.helper-architecture`, or collapsed evidence
`proof.routing.durable-and-reversible-collapsed` fail review.

### Artifact ownership

**Trigger:** the case assigns or compares responsibilities across architecture, plans, generated
representations, ADRs, or evidence.

Assign one authority to each artifact role: data architecture
`[decision.ownership.data-architecture]`, implementation plan
`[decision.ownership.implementation-plan]`, generated representation
`[decision.ownership.generated-representation]`, qualifying ADR `[decision.ownership.adr]`,
and linked evidence `[decision.ownership.linked-evidence]`. Prove one authority
`[proof.ownership.single-authority]`; duplicate authority
`decision.ownership.duplicate-authority` fails.

A cross-reference label is vocabulary, not guidance. Do not select
`[decision.core.independent-proof]` unless this guide also contains the Independent proof module
that defines its trigger and requirement.

<!-- data-architecture-ablation:independent-proof:start -->

## Independent proof

**Trigger:** the case explicitly makes a completeness or coverage claim. Do not apply this module
merely because ordinary verification would be useful.

Every completeness claim names an oracle maintained independently of the mechanism being checked.
Apply this requirement as `[decision.core.independent-proof]`.
Grade the intended and observed semantic IDs as exact sets: missing, forbidden, unknown, or duplicate
IDs fail. Evidence must state the environment, boundary, controls, threshold, and conditions that
require revalidation. A sibling generated output cannot prove another generated output complete.
For generated-artifact completeness, compare the output with a hand-maintained intended-facet
inventory `[proof.generated.independent-inventory]`.
<!-- data-architecture-ablation:independent-proof:end -->

## Triggered modules

Apply only modules whose trigger fires.

### Relational storage

**Trigger:** relational tables, constraints, joins, or query-performance claims.

- record physical schema, keys, constraints, indexes, tenant-parent binding, and query contract
  `[decision.relational.physical-schema]` `[decision.relational.query-contract]`
- forbid cross-tenant parent binding `decision.relational.cross-tenant-parent-binding`
- prove performance with engine/version `[proof.relational.engine-and-version]`, representative data
  shape `[proof.relational.representative-data-shape]`, query shape
  `[proof.relational.query-shape]`, threshold `[proof.relational.threshold]`, and revalidation trigger
  `[proof.relational.revalidation-trigger]`
- never infer coverage from a sibling-generated schema
  `proof.relational.self-generated-coverage`

### Encryption and key lifecycle

**Trigger:** application-managed encrypted fields, tokens, credentials, or scope-bound ciphertext.

- record representation/versioning, canonical AAD identity, scope binding, and key dependencies
  `[decision.encryption.representation]` `[decision.encryption.aad-binding]`
  `[decision.encryption.key-lifecycle]`
- prove canonical AAD identity `[proof.encryption.canonical-aad-identity]`, scope mutation failure
  `[proof.encryption.scope-mutation-failure]`, and dependency rotation coverage
  `[proof.encryption.key-dependency-rotation-coverage]`; generic encrypted-at-rest evidence
  `proof.encryption.encrypted-at-rest` is insufficient

### Live migration

**Trigger:** deployed data or mixed application versions must remain available during change.

- record deployed starting state, compatibility window, cutover, recovery, and restore behavior
  `[decision.migration.deployed-state]` `[decision.migration.compatibility]`
  `[decision.migration.cutover-and-recovery]`
- prove deployed starting state `[proof.migration.deployed-starting-state]`, mixed-version
  compatibility `[proof.migration.mixed-version-compatibility]`, cutover
  `[proof.migration.cutover]`, recovery `[proof.migration.recovery]`, and restore behavior
  `[proof.migration.restore-behavior]`; feature-branch-only evidence
  `proof.migration.feature-branch-starting-state` is insufficient

### Temporal behavior

**Trigger:** the case explicitly names validity, expiry, ordering, a time window, or a clock
boundary. Do not infer this module from a generic event or lifecycle.

- record authoritative clock and exact equality behavior `[decision.temporal.clock-boundary]`
- record delayed physical deletion and retry/restore semantics `[decision.temporal.deletion-lag]`
- exercise the authoritative clock `[proof.temporal.authoritative-clock]`, exact equality
  `[proof.temporal.exact-equality-behavior]`, retry `[proof.temporal.retry-behavior]`, and restore
  `[proof.temporal.restore-behavior]` boundaries; non-boundary evidence
  `proof.temporal.non-boundary` is insufficient

### Erasure and retention

**Trigger:** deletion, expiry, legal erasure, backups, indexes, caches, or derived copies apply.

- inventory every copy and record its deletion or retained disposition
  `[decision.erasure.copy-disposition]`
- record sibling-scope and different-owner isolation `[decision.erasure.isolation]`
- prove copy inventory `[proof.erasure.copy-inventory]`, positive deletion
  `[proof.erasure.positive-deletion]`, sibling-scope isolation
  `[proof.erasure.sibling-scope-isolation]`, and different-owner isolation
  `[proof.erasure.different-owner-isolation]`; primary-row-only evidence
  `proof.erasure.primary-row-only` is insufficient

### Generated artifacts

**Trigger:** code, schemas, manifests, docs, or catalogues are generated from another source.

- name the authoritative source and generation boundary `[decision.generated.source]`
- apply the independent-proof module whenever completeness or coverage is claimed
- do not use sibling generated output as the oracle `proof.generated.sibling-output`

## Evidence safety

Use synthetic placeholders such as `SYNTHETIC_TENANT_A` for mutable fixture values and use only
checked-in equivalents or deployed read-only snapshots for migration evidence. Never require or
store production credentials, tokens, keys, ciphertext, nonces, email addresses, plaintext customer
data, or other secret-bearing high-entropy values.

## Completion check

Before approval, verify the universal contract and each triggered module, confirm every durable
decision has one owner, re-grade proof against independent exact-set oracles, and make all referenced
evidence and revalidation conditions resolvable.
