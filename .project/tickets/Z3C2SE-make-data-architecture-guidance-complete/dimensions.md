# Dimensions: Conditional, independently verifiable data guidance

## Scope edge

- In scope: durable data-contract decisions, conditional applicability, independent proof, artifact ownership, shipped-guide parity, the seven issue fixtures, and two routing fixtures.
- Outside scope: vendor prescriptions, production credentials or sensitive fixtures, full DDL/query-plan dumps, staffing and milestones, and the broader work in issues #4200 and #4210.

## Dimension table

| Dimension | Partitions and boundaries | Rule coverage |
| --- | --- | --- |
| Decision durability | stored-data/identity/security/lifecycle decision; reversible code-local helper/control-flow choice | TBU1.R1 |
| Universal applicability | simple key-value preference; data-heavy system with one or more conditional triggers | TBU1.R2 |
| Conditional module | relational schema; encryption/key lifecycle; live migration; time-dependent data; erasure/retention; generated schema/manifest; trigger absent | TBU1.R2 |
| Artifact owner | data architecture; implementation plan; generated representation; ADR; linked test/evidence | TBU1.R3 |
| Completeness oracle | independent inventory/fixture; generated output compared with sibling generated output | TBU2.R1 |
| Discriminating proof | complete query-plan context; incomplete context; AAD identity/scope mutation fails decryption plus key-dependency rotation coverage; generic encrypted-at-rest assertion; erasure positive plus isolation negatives; primary-only deletion; deployed-state migration; new-schema-only migration; exact time equality; non-boundary-only time proof | TBU2.R2 |
| Evidence safety | synthetic placeholder; checked-in migration-equivalent input; production credential/secret/customer value absent | TBU2.R3 |
| Delivery surface | canonical template; CLI-owned `.safeword` installation read by Cursor/Codex; path-adapted Claude plugin resource; Codex planning route with zero additional guide copies; OpenCode catalogue with no guide copy or planning reference | SWM1.R1 |

## Representative scenario set

Seven required issue evaluation cases are durable acceptance inputs:

| Case | Must select or prove | Must reject or omit |
| --- | --- | --- |
| Simple key-value preference | source of truth, identity/scope, value contract, lifecycle | SQL query plan, migration ladder, encryption, and erasure when absent |
| Multi-tenant relational event store | composite scope binding, physical schema constraints, query proof, time semantics, copy inventory, erasure, live migration, independent schema coverage | cross-tenant parent binding and self-generated coverage proof |
| Encrypted credential record | ciphertext/nonce/key reference, canonical AAD binding, key-dependency inventory, rotation/retirement failure behavior, restore implications, synthetic fixtures | real keys, ciphertexts, nonces, tokens, plaintext customer data, and generic encrypted-at-rest assertions |
| Live additive migration | already-exported read-only schema snapshot from the deployed version or a migration-equivalent CI fixture bound to the deployed release tag and snapshot digest; mixed reader/writer compatibility, idempotent backfill, cutover gate, rollback/roll-forward, restoration implications | feature-branch-only starting state and required production credentials |
| Generated manifest missing one facet | independent intended-facet inventory and exact set equality | agreement between generated manifest and generated documentation as completeness proof |
| Erasure across secondary copies | disposition for primary, cache, queue, index, analytics/log, replica, backup, and PITR copies; matching positive plus sibling-scope and different-owner negatives | primary-row-only deletion and zero-row assertion without an independent copy inventory |
| Time equality boundary | authoritative clock, `now == expires_at` behavior, logical-expiry versus physical-deletion lag, retry/restore behavior | non-boundary-only proof and an unspecified inclusive/exclusive boundary |

Two additional cold-start cases complete Rule coverage:

| Case | Must select or prove | Must reject or omit |
| --- | --- | --- |
| Mixed decision routing | durable identity and lifecycle choices in data architecture; reversible helper and code-local control flow only in implementation planning | removal of consequential data choices; copied helper/control-flow detail in data architecture |
| Artifact ownership | durable contract in data architecture; code locations/build slices/rollout in implementation plan; executable form in generated representation; qualifying structural decision in ADR; falsifiable proof linked from its owner | generated artifact as sole completeness authority; duplicated contract/evidence across owners; staffing or milestones in data architecture |

Deterministic host-delivery proof is separate from the nine cold-start cases. A hand-maintained inventory names the exact repository-relative paths for the canonical template, CLI-owned `.safeword` copy read by Cursor/Codex, and path-adapted Claude resource. The supported CLI install and Claude/Codex generation workflows must produce exactly that inventory. Tests compare template and `.safeword` byte-for-byte; compare Claude against a separately maintained literal canonical-to-plugin path substitution rather than generator-derived expected output; assert Codex contributes no additional guide copy; resolve generated planning references to the correct host-owned targets for Claude, Codex, and Cursor; assert the OpenCode catalogue contains no guide copy or planning reference and records why it remains unaffected; and reject seeded missing-copy, extra-copy, cross-surface-reference, Claude body-drift, and non-path-substitution fixtures.

## Evaluation mechanism

Each fixture contains synthetic case prose plus expected and forbidden guide decision IDs and proof-fact IDs. A documented command starts a fresh text-only agent with tools disabled, one checked-in decoding configuration, and only the canonical guide, one case, and a neutral JSON response format. The agent returns selected decision IDs, selected proof-fact IDs, and short decision notes. The runner stores one current content-bound result per case with model/version, decoding configuration, exact prompt, response, canonical guide hash, and case/rubric digest. Verification re-grades every response against the current rubric and rejects missing results, stale guide or fixture/rubric digests, recorded model/version or decoding configuration that differs from the checked-in evaluation contract, and responses that fail their rubric. A result passes only when both selected sets equal their expected sets; forbidden and unknown IDs produce specific failure diagnostics. The command covers all nine cases but makes no probabilistic or first-try reliability claim. A bounded ablation deterministically removes the independent-proof requirement and proof text while preserving its decision-ID labels, then evaluates the generated-manifest case with the identical model/version, checked-in decoding configuration, case text, response format, and rubric loader as its paired full-guide result. Verification rejects mismatched pair configuration, re-derives the ablated guide from the canonical guide and named transform, validates the canonical and derived hashes, and re-grades both responses through the same rubric-loading path. An ablation pass or paired-control failure fails the evaluation. The same rubric grades agent records and seeded negative fixtures, rejecting incomplete query-plan context (engine/version, representative data shape, query shape, threshold, or revalidation trigger missing), cross-tenant parent binding, primary-only erasure, missing erasure isolation controls, generic encryption assertions, feature-branch-only migration evidence, self-generated manifest coverage, and non-boundary temporal proof. Fixtures use a fixed synthetic-placeholder convention and checked-in migration-equivalent inputs. A deterministic scan rejects credential/token/key prefixes, email-shaped strings, and non-placeholder high-entropy values, with a seeded fixture for each rejection class; no production credentials or sensitive values are needed or stored.

Exhaustive wording checks belong in table-driven Vitest coverage rather than duplicating every clause in Gherkin.

## Dropped partitions

- Specific database engines, schema languages, cloud providers, migration frameworks, and encryption services are excluded vendor choices.
- Full malformed-field and clause-by-clause matrices are lower-level documentation contract tests, not separate persona-visible scenarios.
- Issue #4200 plan completeness and issue #4210 durable artifact placement remain external coordination boundaries; this feature adds only the data-guide link and ownership language.

## Open questions

None. Issue #4560 fixes the decision structure, exact module requirements, safety boundaries, and evaluation cases.
