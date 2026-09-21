---
id: Z3C2SE
slug: make-data-architecture-guidance-complete
type: feature
phase: implement
status: in_progress
scope:
  - replace the data-architecture guide with a concise universal decision boundary and applicable-only core
  - add six triggered modules: relational, encryption, live migration, temporal, erasure, and generated artifact
  - require independent evidence for completeness claims and discriminating evidence for conditional claims
  - distinguish durable data decisions from implementation planning, generated representations, ADRs, and evidence
  - route data-heavy implementation planning to the guide without duplicating issues 4200 or 4210
  - keep the issue's guide surfaces coherent: Safeword CLI owns the `.safeword` copy read by Cursor and Codex, Claude uses its generated path-adapted resource, and Codex adds no copy while retaining its project-guide route
  - add a nine-case cold-start corpus covering the seven issue cases plus decision-routing and artifact-ownership cases
out_of_scope:
  - prescribing a database, schema language, migration framework, cloud provider, or encryption service
  - requiring SQL, migrations, encryption, erasure, or query-plan dumps when their triggers are absent
  - requiring production credentials, real secrets, real ciphertexts/nonces/tokens, or plaintext customer data under any trigger
  - moving task ownership, staffing, milestones, or rollout bookkeeping into data architecture
  - implementing the broader implementation-plan completeness work from issue 4200
  - implementing the broader artifact-boundary reconciliation from issue 4210
done_when:
  - a fixture containing durable identity/lifecycle decisions plus a reversible helper choice retains the durable contracts and routes the helper choice only to implementation planning
  - each conditional module states its trigger, required decisions, and sufficient falsifiable proof
  - the seven issue cases plus decision-routing and artifact-ownership cases each define expected and forbidden guide decision IDs and proof-fact IDs; a cold-start agent receives only the guide, one case, and a neutral JSON response format, and one current content-bound recorded result per case matches both rubric sets exactly without extra decisions or proof claims
  - a documented cold-start command uses fixed decoding parameters and records model/version, decoding configuration, exact prompt, canonical guide hash, case/rubric digest, response, and recomputed pass/fail result for all nine cases; deterministic verification re-grades against the current rubric and rejects stale hashes, missing records, a recorded model/version or decoding configuration that differs from the checked-in evaluation contract, or a response that fails its rubric
  - a bounded guide-ablation control removes the independent-proof requirement/proof text while preserving decision-ID labels, then uses the identical model/version, checked-in decoding configuration, case text, response format, and rubric loader as its paired full-guide result; verification rejects mismatched recorded model/version or decoding configuration, re-derives the ablated guide from the canonical guide and named transform, checks both hashes, and re-grades both responses through the same path, while an ablation pass or paired-control failure fails the evaluation
  - the same deterministic rubric grades recorded agent output and seeded negative examples; required and forbidden proof-fact IDs make incomplete query-plan context, generic encryption assertions, feature-branch-only migration evidence, primary-only erasure, missing erasure isolation controls, self-generated manifest coverage, non-boundary temporal proof, and cross-tenant parent binding fail with focused diagnostics
  - data architecture, implementation planning, generated representations, qualifying ADRs, and linked evidence each resolve to one named owner without duplicating a source of truth
  - all evaluation fixtures use a fixed synthetic-placeholder convention or checked-in migration-equivalent inputs; a deterministic corpus scan rejects credential/token/key prefixes, email-shaped strings, and non-placeholder high-entropy values, and tests seed each rejection class, so no production credentials, secrets, real ciphertexts/nonces/tokens, or plaintext customer data are needed or stored
  - after the supported install/generation workflow, an independent hand-maintained inventory equals the exact repository-relative guide paths for the canonical template, installed `.safeword` copy, and Claude resource; template and `.safeword` are byte-identical, Claude differences equal a separately maintained literal canonical-to-plugin path substitution rather than generator-derived expected output, and Codex contributes no guide copy; seeded missing-copy, Codex-managed extra-copy, Claude body-drift, and non-path-substitution fixtures all fail
  - generated Claude planning references resolve to the plugin resource while generated Codex and Cursor references resolve to `.safeword/guides/data-architecture-guide.md`; missing or cross-surface targets fail validation
  - a repository check confirms the OpenCode profile catalogue contains no data-architecture guide copy or planning reference, documenting why that surface remains unaffected
  - focused tests, documentation checks, lint, typecheck, and full configured verification pass because shipped guide content changes
product_plan_contract: v1
phase_anchors:
  - "define-behavior: .project/tickets/Z3C2SE-make-data-architecture-guidance-complete/spec.md"
  - "scenario-gate: features/make-data-architecture-guidance-complete.feature"
  - "plan-implementation: .project/tickets/Z3C2SE-make-data-architecture-guidance-complete/impl-plan.md"
external_issue: https://github.com/ArcadeAI/safeword/issues/4560
created: 2026-09-13T22:52:33.607Z
last_modified: 2026-09-13T22:52:33.607Z
---

# Make the data architecture guide complete, conditional, and independently verifiable

**Goal:** Give context-free authors and reviewers a concise, conditional data-contract standard with independent proof.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-13T22:52:33.607Z Started: Created ticket Z3C2SE
- 2026-09-13T22:58:00.000Z Intake: adopted issue #4560 as the accepted product contract; its decision, boundaries, acceptance criteria, and seven evaluation cases leave no material product question open.
- 2026-09-14T01:02:00.000Z Define behavior: derived eight dimensions and authored fourteen representative scenarios across seven Rules, including one rejection path per Rule and the nine cold-start cases.
- 2026-09-16T16:27:00.000Z Scenario gate: user approved sixteen independently reviewed scenarios after prompt-isolation, positive-ablation, and deterministic-record false-pass paths were closed.
- 2026-09-16T16:45:00.000Z Plan implementation: selected a dependency-free, content-bound corpus with separate cold-start recording and deterministic verification; five slices across four components, no ADR and no split.
- 2026-09-19T00:40:00.000Z Independent quality review: Claude Opus approved the repaired ablation verifier with no error-level findings after canonical hash/config binding, focused diagnostics, no-op and malformed-transform rejection, prompt equality, rubric-consistency checks, and independently falsifiable configuration tests; focused Vitest passed 26/26 and TypeScript passed.
- 2026-09-21T20:40:00.000Z Implement reconciliation: independent review exposed that the original 12-file packet proved only isolated verifier logic. Added the canonical conditional guide, isolated recorder and nine live Claude Opus records, deterministic corpus/safety verification, supported reconciliation/generation coverage, durable OpenCode rationale, BDD proof manifest, cross-surface negatives, causal ablation grading, and prompt re-derivation. Four decisions remain unchanged and no design deviations were introduced.

## Root Cause

The executable-RED retry was inadmissible because another checkout held the shared package-test
lock, so Vitest never started and the expected assertion failure did not match. The independent
review route itself was healthy: Claude Opus completed with cross-agent provenance. Once the lock
released, focused RED runs exposed two verifier defects behind the review findings:
`JSON.stringify` treated equivalent object key orders as different, and forbidden rubric entries
collapsed into the same generic set-mismatch diagnostic.

Confirmed by review record `d3d87b87-2db9-4f49-a459-7a8a3da3200c` plus focused failing tests for
reordered decoding configuration, reordered rubric properties, and a forbidden proof fact. Ruled
out authentication and reviewer launch failure because the retry reached a completed independent
verdict; ruled out a stale lock because the recorded owner PID was an active Vitest process in the
named checkout.
