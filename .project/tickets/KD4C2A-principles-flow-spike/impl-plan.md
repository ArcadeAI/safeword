# Impl Plan: Make project knowledge shape and challenge feature delivery

**Status:** implemented

## Approach

The riskiest assumption is that `Design alignment` can become canonical without
deadlocking the current transition gate or making legacy plans ambiguous. The
cheapest proof is the heading-compatibility outline through the pure parser,
followed by the real plan-transition gate. Build that slice first.

Proof plan:

| Scenario | Primary proof | Why this scope is sufficient |
| --- | --- | --- |
| Principle applicability produces a proportional plan entry | Integration contract over installed planning/review skills, plus the recorded quality-review result | The observable is the workflow contract and its reviewed output; no deterministic test can decide delight semantically. |
| An unexplained conflict cannot pass independent plan review | Installed-skill contract plus an independent plan-review record in `verify.md` | Wiring proves the reviewer receives the rule; the review record proves the semantic rejection actually occurred. |
| A recorded principle conflict can pass independent plan review | Installed-skill contract plus an independent plan-review record in `verify.md` | Discriminates deliberate deviation from constant rejection without pretending static files prove judgment. |
| Each installed host review stage receives relevant configured knowledge | Wiring integration: real config → production-derived setup/generated host artifact → follow its configured-resolver instruction → captured resolver input | Proves all 12 host×stage delivery chains with real collaborators, mocking only the temporary filesystem boundary. It proves the instruction and current input, not that a host model obeyed soft guidance. |
| Labels alone cannot satisfy a source-grounded review | Installed-skill contract plus independent review evidence | The contract proves source delivery is required; the review record proves labels alone were refused. |
| A later review resolves current knowledge instead of stale intake content | Wiring integration with a changed configured file | Proves resolution happens at review time rather than from cached intake prose. |
| Evidence is judged against the kind of claim it supports | Quality/verify skill contract plus independent review evidence recorded in `verify.md` | Deterministic assertions pin claim-linked evidence; the review record owns experiential judgment. |
| Audit reports each broken principle trace as E010 | Integration fixture executing the audit trace block | Runs missing source, incomplete mapping, dead proof, and an explicit conflict marker lacking a deviation link through the real resolver/checker. |
| Semantic disagreement is not an audit failure | Trace-checker unit and integration rejection fixture | Prevents the objective checker from becoming semantic scoring. |
| Setup scaffolds absent knowledge and preserves authored knowledge | CLI integration through `safeword setup` | Exercises schema → reconcile → filesystem with real collaborators. |
| A configured knowledge path suppresses its default scaffold | CLI integration through `safeword setup` | Proves `configKey` suppression for all three knowledge types. |
| A valid override passes health without an orphan advisory | CLI integration through `safeword check --offline` | Covers config → resolver → health aggregation and rendered result. |
| A missing configured knowledge file fails health checks loudly | CLI integration through `safeword check --offline` | Pins non-zero exit and type-specific diagnostic. |
| An overridden default is reported without deleting it | CLI integration through `safeword check --offline` | Pins zero-exit advisory and both resolved paths. |
| An orphaned default remains untouched during reconciliation | CLI integration through `safeword setup` | Compares user-authored bytes before and after the real reconcile entry point. |
| A single supported alignment heading passes the plan gate | Parser unit table plus transition-gate integration | Unit proof covers aliases; integration proves the hook consumes the normalized result. |
| An ambiguous alignment contract is rejected with remediation | Parser unit table plus transition-gate integration | Forces distinct missing/both diagnostics through the real boundary. |
| Synchronized host artifacts pass parity | Integration through schema parity and Codex generation | Exercises canonical template, dogfood, thin Cursor, and generated Codex artifacts. |
| Host drift fails parity at the changed surface | Table-driven parity integration | Mutation fixture proves each canonical/host omission is named. |
| Public documentation distinguishes a complete contract from an incomplete one | Documentation contract test over README and website sources | Pins all keys plus ownership, preservation, health, and orphan behavior. The website is a documentation channel for the Safeword CLI contract, not an additional runtime surface. |

Proof boundary: installed-artifact and resolver tests prove that a review entry
point receives the right current source. They do **not** prove an LLM made a wise
judgment. Acceptance/rejection and experiential claims require an independent
review record in `verify.md`, including the reviewer, input surface, outcome,
and evidence limitation. The NTB-facing verification summary translates those
records into plain language under Experience, Surface Evidence, and Evidence
limits so trust does not depend on reading test internals.

Build order:

1. **Alignment compatibility.** Update
   `templates/hooks/lib/impl-plan.ts`, the doc template, SAFEWORD/BDD/TDD text,
   `stop-quality.ts`, and `health.ts`. Prove canonical and legacy plans through
   `plan-gate`, `phase-provenance`, `boundary/engine`, stop-quality citation and
   reconciliation paths, architecture health advice, review-stamp hashing, and
   the existing transition/integration suites. Reject missing and dual aliases.
2. **Configured-path lifecycle.** Extract the factual helper in `health.ts`,
   add principles missing/orphan behavior, and retain persona-only parse/
   validation. Use table-driven resolver/reconcile tests plus one real setup and
   one real check wiring case; avoid repeating preservation tests per caller.
3. **Review-source production and host delivery.** Update canonical
   `SAFEWORD.md`, BDD discovery/planning/TDD, self-review, review-spec,
   quality-review, and verify. Add the standalone production API
   `hooks/lib/project-knowledge.ts#resolveReviewKnowledgeSources` with the
   `hooks/resolve-project-knowledge.ts` JSON wrapper, registered in schema and
   built on the existing namespace/config resolver. Derive the host×stage
   wiring matrix from the production sources—`schema.ts` Claude/Cursor assets
   and the generated Codex catalogue—then exercise it in
   `tests/integration/project-knowledge-review-entrypoints.test.ts`. The harness
   follows each installed or generated procedure's resolver command and captures
   its current input in a temporary project; live model compliance remains
   outside deterministic proof.
4. **Evidence and objective audit.** Define the trace grammar in the plan
   template; add the pure checker and sentinel audit block after mapping
   production exists. E010 may validate only explicit facts, including an
   explicit conflict marker with no matching deviation. Update verify guidance
   and record independent semantic/persona evidence separately. Each review
   record in `verify.md` must name **Review stage**, **Host surface**, **Resolved
   sources**, **Claim**, **Evidence**, **Verdict**, and **Limitations**; summarize
   those records for an NTB under Experience, Surface Evidence, and Evidence
   limits.
5. **Public contract and distribution.** Update README and website config docs,
   regenerate Codex assets, sync dogfood, run schema/parity contracts, Gherkin,
   focused integration lanes, then the full suite.

Only the installed TypeScript/testing skills apply. No component-design or data
model document is warranted: this changes document parsing, reconciliation
diagnostics, and shipped workflow assets without introducing a new service,
storage model, or cross-package dependency.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Alignment compatibility | Make `Design alignment` the parser's canonical section and map legacy `Arch alignment` to it; detect raw alias cardinality before normalization [2] | Keep `Arch alignment` internally; merge both headings | Keeping the old key perpetuates the misleading contract; merging both hides ambiguous documents. |
| Knowledge health | Add one local factual helper for configured-file existence and orphan-default advice, then layer persona parsing separately [1][3] | Copy principles functions; derive all health behavior directly from schema | Copying creates a third drift-prone pair; schema-derived semantics would couple health rendering to installation metadata. |
| Principle audit | Add a pure trace parser/checker and invoke it from a sentinel audit block; an `explicit-conflict` marker without a matching deviation is factual, while latent conflict discovery stays in quality review [5][6] | Prose-only audit guidance; infer conflicts from implementation; move E010 into `safeword check` | Prose is not objective proof; inference violates the semantic boundary; project health is the wrong lifecycle boundary. |
| Host proof | Derive installed entry points from the production schema and generated Codex catalogue, follow their resolver instruction, and require independent review records for semantic outcomes [4] | Duplicate a test-only host matrix; string-search only; claim live-agent judgment from static tests | A duplicate matrix drifts, string search misses install wiring, and static files cannot prove model compliance or judgment. |
| Feature shape | Keep one feature and five implementation slices | Promote to epic with parser/health/review/audit children | The >15-scenario split signal is real, but every slice edits the same schema, workflow contract, and generated surfaces; children would duplicate compatibility and parity work. |

Figure-it-out recommendation: use canonicalization, factual shared helpers, and
executable boundary checks because the project architecture explicitly assigns
reconciliation ownership to schema/reconcile and host synchronization to
canonical templates plus parity [1][4]. The smaller alternatives save files but
leave the exact silent-drift risks this feature exists to remove.

Premortem: six months from now this design most likely fails because a new host
or review stage is added outside the 12-row contract; mitigate by keeping host
entry points in the canonical catalogue/parity tests rather than another list.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| 1. Structure enforces; instructions suggest | Alignment-heading cardinality is an executable parser contract. | packages/cli/tests/hooks/impl-plan.test.ts | |
| 1. Structure enforces; instructions suggest | Configured project-knowledge paths change scaffold ownership. | packages/cli/tests/reconcile-configured-paths.test.ts | |
| 1. Structure enforces; instructions suggest | Every installed host review stage resolves current knowledge. | packages/cli/tests/integration/project-knowledge-review-entrypoints.test.ts | |
| 1. Structure enforces; instructions suggest | Objective principle traces reject incomplete or dead evidence. | packages/cli/tests/hooks/principle-trace.test.ts | |
| 2. Fire at boundaries, not every turn | Semantic challenge runs at review boundaries; health and audit check only objective facts. | packages/cli/tests/skills/principles-review-documentation.test.ts | |
| 3. Add, never replace | Setup preserves authored knowledge, overrides suppress defaults, and legacy alignment plans remain readable. | packages/cli/tests/reconcile-namespace-root.test.ts | |
| 5. Clarity before correctness | New plans use one canonical alignment name and public docs describe one shared knowledge lifecycle. | packages/cli/tests/docs/project-knowledge-config.test.ts | |

Architecture alignment: preserve schema as the managed-file source of truth,
reconcile as the ownership/mutation engine, standalone hook helpers for deployed
runtime parsing, and templates as the canonical payload feeding dogfood/Cursor/
Codex parity [1][4]. No ADR is emitted: these are localized, reversible
extensions of recorded architecture rather than a new structural or
cross-service decision.

## Known deviations

- Compatibility shipped as planned: new plans use `Design alignment`; the
  parser still reads a single legacy `Arch alignment` heading and rejects a
  document containing both aliases.
- The exploratory spike produced some scaffold, guidance, and surface-health
  code before the full BDD contract was frozen. During implement, already-green
  behavior is treated as characterization and must demonstrate mutation/failure
  evidence; it is not credited as a RED merely because a test exists.
- The >15-scenario splitting checkpoint was evaluated under delegated user
  authority and declined because the five slices share load-bearing files and
  parity boundaries. Do not re-suggest the same split in this session.

## Doc impact

- `README.md`: document `paths.principles`, the shared principles/personas/
  surfaces ownership lifecycle, missing configured-file failures, and orphan
  advisories.
- `packages/website/src/content/docs/reference/configuration.mdx`: add the same
  public configuration keys, defaults, preservation semantics, and health
  behavior.
- Shipped workflow docs under `packages/cli/templates/skills/` and generated
  Claude/Cursor/Codex surfaces: migrate terminology and source/evidence
  contracts as implementation tasks, then enforce parity.

## Assessment triggers

- A fourth project-knowledge type needs different ownership or diagnostics:
  reassess whether the local health helper should become a schema-level
  descriptor registry.
- A new agent host or review phase is added: extend the installed-entry-point
  matrix and parity catalogue before shipping it.
- `impl-plan.md` gains another alignment alias or structured format: replace
  cardinality checks with an explicit versioned document schema.
- Principle proof needs cross-ticket or remote evidence: replace local link
  resolution with a typed evidence registry rather than widening E010 heuristics.
- Live agent execution becomes deterministic and available in CI: add a smoke
  lane without replacing deterministic installed-artifact wiring tests.

## Sources

1. `ARCHITECTURE.md` and `.project/architecture.generated.md` — current module,
   schema/reconcile, template, and test ownership.
2. `packages/cli/templates/hooks/lib/impl-plan.ts` — current five-section parser
   and deployed standalone-hook constraint.
3. `packages/cli/src/health.ts` — current persona/surface configured-path and
   architecture advisory behavior.
4. `packages/cli/src/parity.ts`, `packages/cli/src/cursor-wrappers.ts`, and
   `packages/cli/scripts/generate-codex-plugin.ts` — current host distribution
   and parity boundaries.
5. `packages/cli/tests/skills/audit-domain-documentation.test.ts` — executable
   sentinel-block fixture pattern for audit automation.
6. `PRINCIPLES.md`, the accepted spec, dimensions, and feature source — project
   principles and fixed behavioral contract.
