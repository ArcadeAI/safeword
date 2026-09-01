# Impl Plan: Lean Product Plans

**Status:** planned
**Planned on:** 2026-09-01

## Approach

The riskiest assumption is that a child can remain useful while storing references instead of copied parent prose. Prove that first with CLI integration tests: an epic scaffold exposes stable job and milestone IDs; a child accepts only resolvable IDs and produces a delta-only `spec.md`. Then prove parent-contract fingerprints block only decision-bearing changes and that explicit reconciliation restores advancement. Finally add the small demand-research skill and agent guidance, then regenerate host artifacts.

Build order:

1. Add pure Product Plan parsing, validation, and parent-contract fingerprint tests. For a marked epic or standalone feature, Product Bet, Jobs To Be Done, Shape, and Killer Demo are the only required top-level planning sections; Killer Demo must carry audience, starting state, action, payoff, proof, and boundary. Product Inspiration is retired on this marked path: useful comparison evidence is cited compactly inside Product Bet, and neither `inspiration_contract` frontmatter nor its spec marker/table is written. For a marked child, `spec.md` contains Parent References, Contribution, and Rules and excludes inherited plan headings, inspiration markers, and `skip:` placeholders. Legacy inspiration/spec contracts remain readable and unchanged.
2. Replace the scaffold for newly created epics and standalone features with the four-section full-plan template and write `product_plan_contract: v1` to ticket frontmatter; add the delta-only child template. Assert new full and child tickets omit `inspiration_contract`, `inspiration_contract_scaffold`, the inspiration spec marker/table, comms/launch, and `skip:` while legacy fixtures remain accepted. Do not rewrite in-flight specs during install or upgrade.
3. Extend `ticket new` with milestone and parent-job references, validating before filesystem mutation. A child created through the command must persist `product_plan_contract: v1`, `parent`, `parent_job`, and `milestone` in `ticket.md`. Before the BDD workflow advances a child out of intake, the canonical BDD skill runs `ticket reconcile-parent` as an invisible workflow step to persist the initial digest; generated Claude, Codex, Cursor, and OpenCode artifacts must carry the same instruction. A content/parity contract asserts the command appears immediately before the child intake-exit transition on every host, so the integration test then starts with real `ticket new` output, follows that documented workflow path, verifies a second bootstrap is idempotent, advances successfully, and proves later selected-parent drift blocks. Preserve lineage without collisions by forming each child Rule ID as `<parent-job-id>.<child-ticket-id>.R<n>`: the parent-job prefix keeps intent traceable and the immutable child ID namespaces siblings. Prove doctor coverage with one epic and two children whose scenarios cover only their own Rules; duplicate local Rule numbers must remain distinct and neither sibling may satisfy the other's coverage.
4. Add the typed `ticket reconcile-parent` command used by that workflow: without `--accept` it may bootstrap only while the child remains in intake, is idempotent when current, and fails without mutation on unresolved references; after intake it refreshes only with explicit `--accept`. Marked children must pass delta validation; marked tickets without parent fields must pass full-plan validation; partial sets block. Unmarked tickets remain grandfathered, with anti-evasion for new-only fields/headings. Automated move-in/out conversion is deferred with preservation-first manual recovery. The digest contains exactly the referenced parent job, selected milestone outcome/non-goals, project non-goals, and success threshold. CLI and installed hooks deliberately carry separate pure implementations because deployed hooks cannot import the distribution; a shared JSON fixture corpus requires byte-identical canonical values, field labels, and digest. The read-only gate runs in `pre-tool-quality` and `stop-quality`: a marked child with complete references but no valid persisted digest always fails intake exit and done, with the bootstrap command as recovery; a missing digest never means "nothing to compare." Later drift requires `--accept`. Add a negative integration test that deliberately skips the BDD bootstrap and proves both intake exit and stop completion block, distinct from the happy path. Also prove idempotence, no mutation on unresolved refs, cross-implementation parity, legacy/anti-evasion behavior, and drift/reconciliation.
5. Bundle the focused demand-research skill and route intake guidance to it only for unresolved decision-critical demand or an explicit request. Add a skill content-contract test that requires the compact verdict/evidence/gap/validation steps and rejects the stripped general-research modes and fixed large-fetch budget. Add an intake-guidance contract test across the canonical BDD skill and generated host artifacts that requires the two positive triggers and the child, mandated, parity, and cheaper-experiment exclusions.
6. Amend the accepted Product-Framing Layer record in `ARCHITECTURE.md` with the full-plan/delta-child compatibility contract and reassessment trigger; update public guidance, regenerate all host artifacts, and run targeted then full verification.

Primary proof is CLI integration because the value crosses command parsing, filesystem scaffolding, and phase hooks. Pure parser/fingerprint edge cases use unit tests. Skill content uses a focused contract test; host delivery uses schema/catalogue parity tests.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| Linear project and initiative documentation | 2026-09-01 | Current web docs | Safeword current main | Project descriptions and milestones keep durable intent close to execution | Keep product intent on the owning ticket and let child work reference it | Linear's data model is inspiration only; no tracker synchronization or copied text |

**Decision impact:** retained: the external model supports one durable owner plus milestone-linked delivery, matching the reviewed anti-duplication design.
**Decision informed:** Product Plan storage and ownership

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Product Plan storage and ownership | Full plan in epic or standalone `spec.md`; delta-only child `spec.md` | Separate `product-plan.md`; copied plan per child | A second artifact and copied prose create drift and busy work |
| Parent reference integrity | Stable references plus a formatting-normalized `parent_contract_digest`; bootstrap is automatic but later refresh requires explicit `--accept` after changed fields are shown | Creation-time capture; raw or whole-file hash; transient hook state; automatic drift acceptance; no reconciliation | These alternatives respectively create intake churn, editorial churn, cross-session failure, hidden decisions, or permanent blocks |
| Reconciliation recovery | Explicit CLI reconciliation after the builder reviews the changed parent contract | Permanent block; automatic acceptance | Permanent blocks have no recovery; automatic acceptance hides decision changes |
| Demand research delivery | One trimmed demand-signal skill installed through existing skill parity machinery | Bundle the full personal research suite; inline the workflow in BDD | The full suite is unrelated bloat; inline copies drift across hosts |
| Child scenario lineage | Child Rules use `<parent-job-id>.<child-ticket-id>.R<n>` while remaining locally authored | Share the parent Rule namespace; synthesize a child JTBD; omit child Rules from doctor | Shared numbering collides across siblings; a synthetic JTBD duplicates intent; omitting Rules breaks coverage and orphan checks |
| Existing spec compatibility | Grandfather legacy specs; mark and validate only newly scaffolded Product Plans | Rewrite on upgrade; reject legacy specs | Rewrites violate reconciliation safety; rejection breaks in-flight tickets |
| Product Inspiration migration | Retire it for new marked Product Plans and fold decision-bearing evidence into Product Bet; grandfather legacy contracts | Keep a fifth section; copy it to children | A fifth section duplicates Why now and violates the reviewed four-section/zero-placeholder contract |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize NTB experience without constraining TBU control | Defaults create the right plan shape while explicit references and reconciliation remain scriptable | `packages/cli/tests/commands/ticket-new.test.ts` and `packages/cli/tests/cli-protocol/cli-contract.test.ts` | |
| Structure enforces, agents guide | CLI validates identity and phase invariants; skills guide judgment-heavy drafting | `packages/cli/tests/hooks/pre-tool-quality.test.ts` and stop-quality tests reject stale/dangling contracts and permit persisted reconciliation | |
| Fire at boundaries, not continuously | Parent drift is checked only when a child advances or the stop hook completes it | pre-tool tests prove ordinary edits remain allowed; stop-quality tests prove stale children cannot reach done or cascade | |
| Add, never replace | Demand research uses the existing managed skill/schema path; legacy specs remain readable | `packages/cli/tests/schema.test.ts`, host-parity tests, and a legacy doctor fixture | |
| Correct, safe, clear, then simple | Validation happens before ticket creation; one plan and one compact fingerprint are the smallest safe model | `packages/cli/tests/commands/ticket-new.test.ts` proves invalid references leave no folder | |
| Product-framing scenario lineage | Delta-only child Rules combine the parent-job prefix with immutable child ID so doctor resolves coverage without copied JTBD prose or sibling collisions | `packages/cli/tests/commands/doctor.test.ts` epic/two-child fixture proves each sibling's scenario covers only its own same-numbered Rule | |

The design preserves schema-as-source-of-truth, reconciliation-over-copy, and agent parity from `ARCHITECTURE.md` and `AGENTS.md`.

## Known deviations

- Automatic conversion from delta child to standalone Product Plan is deferred. The first version blocks a partial move and gives a manual preservation-first recovery because rewriting a live spec would risk destroying the child's authored Contribution and Rules.
- Automatic conversion from standalone Product Plan to delta child is deferred for the same reason; manual re-parenting must preserve feature-specific Rules and Contribution while removing inherited parent prose.

## Doc impact

- Update the ticket-system and BDD skill guidance for the new Product Plan and child-reference flow.
- Regenerate the command reference for `ticket new` options and `ticket reconcile-parent`; update README only if it duplicates that generated reference.
- Amend `ARCHITECTURE.md`'s Product-Framing Layer decision in place to describe marked Product Plans, delta-only child lineage, legacy compatibility, and the parent-contract phase boundary.

## Assessment triggers

- Nested epics become a supported ticket shape.
- Parent intent needs partial child overrides.
- Tracker-native milestones become authoritative instead of local Product Plans.
- Demand validation grows beyond a bounded build/no-build decision.
