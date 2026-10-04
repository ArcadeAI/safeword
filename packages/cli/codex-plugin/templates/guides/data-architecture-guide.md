# Data Architecture Guide

Use during Implementation Planning when work changes a store, schema, data relationship,
source of truth, ownership, access, lifecycle, migration, backfill, or cross-system flow.
One consequential entity is enough; file and entity counts are not skip rules. The
feature's `impl-plan.md` is its design plan of record. This guide helps decide
what belongs there and when a significant choice also needs the configured
durable architecture record.

## Universal contract

Every applicable plan names these decisions:

Decide each applicable subject at review depth: Purpose; Store and model;
Schema and relationships; Source of truth; Ownership and access; Identity and
integrity; Cross-system flow; Lifecycle and retention; Migration and backfill;
Compliance; and Rollback. Compliance states the applicable privacy, retention,
residency, and audit obligations or why none applies. State why any subject
does not apply; a guide citation or generic "data covered" statement is not a
decision.

- source of truth and authoritative writer (Source of truth; Ownership and access)
  `[decision.core.source-of-truth]`
- identity, ownership, tenant/scope binding, and relationship invariants
  (Ownership and access; Identity and integrity; Schema and relationships)
  `[decision.core.identity-and-scope]`
- accepted values, validation, compatibility, and conflict semantics
  (Schema and relationships; Identity and integrity; Cross-system flow)
  `[decision.core.value-contract]`
- creation, mutation, retention, deletion, restore, and retry boundaries
  (Lifecycle and retention; Migration and backfill; Rollback)
  `[decision.core.lifecycle]`

Record the chosen data contract, alternatives, reasons, and consequences in the
Implementation Plan. Apply the architecture guide's significance test separately:
shared structure or contracts, a key quality attribute, data ownership or lifecycle,
migration or compatibility behavior, or another difficult-to-reverse constraint
also requires a resolvable link to the configured durable architecture record.
A routine, reversible field addition does not require one merely because it
persists data. The durable record preserves the cross-feature rule; the feature
plan explains its adoption without creating competing authority. Generated
schemas or manifests represent a contract but never become another authority.
The Execution Plan owns exact migration commands, file edits, test paths,
backfill batches, and evidence collection.

Use the interface contract guide for caller-visible requests, errors, and
entry-point authorization; this guide covers the data beneath that interface.
Use the release/recovery guide for live cutover policy and the testing guide
for proof scope. These guides contribute to one plan rather than creating
separate design authorities.

### Mixed decision routing

**Trigger:** the case mixes an architecturally significant data contract with
reversible helper or control-flow choices.

Record the identity and lifecycle decisions in the Implementation Plan and
link their lasting shared constraints in the configured architecture record
`[decision.routing.identity-architecture]` `[decision.routing.lifecycle-architecture]` and route
reversible helpers and control flow to implementation planning
`[decision.routing.helper-implementation]` `[decision.routing.control-flow-implementation]`.
The separation itself is reviewable evidence `[proof.routing.durable-and-reversible-separated]`;
significant contracts without that resolvable link `decision.routing.identity-implementation-only`, architecture-owned
helpers `decision.routing.helper-architecture`, or collapsed evidence
`proof.routing.durable-and-reversible-collapsed` fail review.

### Artifact ownership

**Trigger:** the case assigns or compares responsibilities across architecture, plans, generated
representations, ADRs, or evidence.

Assign one authority to each artifact role: durable data architecture
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
merely because ordinary verification would be useful; a performance threshold
or correctness proof alone is not a completeness or coverage claim.

Every completeness claim names an oracle maintained independently of the mechanism being checked.
Apply this requirement as `[decision.core.independent-proof]`.
Grade the intended and observed semantic IDs as exact sets: missing, forbidden, unknown, or duplicate
IDs fail. Evidence must state the environment, boundary, controls, threshold, and conditions that
require revalidation. A sibling generated output cannot prove another generated output complete.
For generated-artifact completeness, compare the output with a hand-maintained intended-facet
inventory `[proof.generated.independent-inventory]`.
For generated artifacts, do not use sibling generated output as the oracle
`proof.generated.sibling-output`. Before approving an explicit completeness or
coverage claim, re-grade proof against the independent exact-set oracle.
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

## Evidence safety

Use synthetic placeholders such as `SYNTHETIC_TENANT_A` for mutable fixture values and use only
checked-in equivalents or deployed read-only snapshots for migration evidence. Never require or
store production credentials, tokens, keys, ciphertext, nonces, email addresses, plaintext customer
data, or other secret-bearing high-entropy values.

## Completion check

Before approval, verify the universal contract and each triggered module;
confirm that each applicable decision appears in the Implementation Plan and
that every significant decision has a resolvable durable-record link. Make
referenced evidence and revalidation conditions resolvable.
