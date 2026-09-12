# Execution Plan: Split large contributions into independently reviewable PRs

**Status:** planned

## Pull-request slicing

**Decision:** multiple pull requests.

**Rationale:** contract delivery, structural judgment, reviewer admission, and
public CLI activation are distinct concerns with distinct proof. Keeping the
public command disabled until the final slice lets the first three merge as
inert foundations. Combining them would force a reviewer to reason about the
authoring contract, schema compatibility, model behavior, routing, persistence,
and CLI presentation at once.

Line and file counts do not justify these boundaries. Each slice below has one
independently provable purpose and leaves existing review kinds and commands
working.

## PR 1 — Package the canonical Execution Planning contract

- **Purpose:** give plan authors and semantic reviewers one exact contract for
  PR slicing.
- **Boundary:** add the Execution Planning authoring/reference file, artifact
  template, reviewer-safe rubric extraction, generated rubric, generator
  command, schema registration, and package inventory. The contract prose owns
  the reviewer instruction to return the slicing decision, complete slices,
  obligation owners, and unchanged decisions. Regenerate every repository-owned
  derivative needed to keep template, Claude plugin, Cursor wrapper, Codex
  bundle, and catalogue parity; do not add host workflow references or phase
  migration, which remain with YCFFNC. Do not accept the `plan-execution`
  review kind or change review output yet.
- **Prerequisites:** none.
- **Proof:** generation tests compare the extracted author rubric byte-for-byte
  with the generated reviewer rubric; clause-deletion cases show that R1–R5 are
  each present in the canonical contract; schema and package tests prove every
  new template and generated asset ships.
- **Completion signal:** the package contains one canonical Execution Planning
  contract and reproducible generated reviewer rubric, exposes no new public
  review kind, and the full package suite reports no regression.
- **Relies on an unmerged successor:** no. The contract is inert until public
  activation.

### Tasks and tests

1. RED: add contract-generation and package-inventory expectations for
   `PLAN_EXECUTION.md`, the Execution Plan template, and its generated rubric.
2. GREEN: add the author/reviewer contract, extraction helper, generator script,
   package script, schema entries, and generated asset.
3. REFACTOR: keep shared rubric-generation mechanics shared only where doing so
   reduces real duplication; do not create a general framework for four small
   generators.
4. Run:
   `bun run test tests/review/execution-plan-rubric-generation.test.ts tests/schema.test.ts tests/npm-package.test.ts`.
5. Run `bun run generate:codex-plugin`, `bun run generate:claude-plugin`, and
   `bun run generate:cursor-wrappers` for their repository-owned derivatives,
   then inspect and commit only changes caused by the new contract; workflow
   migration remains out of scope.
6. Run `bun scripts/parity-check.ts --mode=all` from the repository root to
   prove template, dogfood, plugin, wrapper, and catalogue parity.
7. Run the full package test suite before this slice is considered independently
   mergeable.

## PR 2 — Validate a typed Execution Plan judgment

- **Purpose:** make an approval's slicing judgment structurally checkable
  without changing existing review-result shapes.
- **Boundary:** add `execution_plan_record` types, the strict
  `plan-execution` provider schema, and a pure post-schema validator. The field
  is required but nullable for that schema only; the schema describes shape,
  while PR 1's exact contract remains the sole authority for judgment. Do not
  expose a public review command or alter coordinator routing.
- **Prerequisites:** PR 1.
- **Proof:** table-driven unit tests cover every invariant in
  [Reviewer-output validation](./impl-plan.md#reviewer-output-validation) that
  belongs to record shape and classification: malformed positives, legible
  denials, negative tripwires, prerequisite order, obligation ownership,
  decision status, and unchanged legacy schemas. PR 4 owns bounded rerouting,
  persistence, and stamp behavior.
- **Completion signal:** a pure boundary classifies valid approval, semantic
  denial, and retryable invalid output unambiguously; legacy schemas and parsed
  results are exact golden matches. Provider compatibility remains an accepted
  risk until PR 3's live lane because this schema is still unrouted and cannot
  affect an existing command.
- **Relies on an unmerged successor:** no. The new types and validator remain
  unused by public routing.

### Tasks and tests

1. RED: add golden-schema comparisons for all existing kinds and provider-shaped
   malformed fixtures that strict structured output cannot emit naturally.
2. RED: add one case for each positive invariant and each negative tripwire.
   Assert that a readable `true` successor dependency and any readable changed
   decision become final denials, while unreadable tripwires remain retryable
   invalid output.
3. GREEN: implement the smallest record types, kind-specific schema selector,
   parser, and validator needed by those tests.
4. REFACTOR: keep semantic source interpretation out of the validator. It may
   validate asserted names and references, not infer obligations from prose.
5. Run:
   `bun run test tests/review/execution-plan-output.test.ts tests/review/runtime.test.ts`.
6. Run the full package test suite before this slice is considered independently
   mergeable.

## PR 3 — Admit only reviewer identities that prove the semantic contract

- **Purpose:** prevent an unproven model route from approving conceptual
  slicing merely because it can return valid JSON.
- **Boundary:** add the authoritative positive/rejection fixture corpus, exact
  reviewer/model-or-runtime-default admission data, the live conformance runner,
  its production evidence writer, and route filtering for `plan-execution`.
  The writer emits evidence only after the runner records a passing result for
  every authoritative case; evidence carries the exact identity, packaged
  contract digest, and authoritative fixture-corpus digest. Selection
  recomputes and compares both digests. The generated-file check proves the
  packaged manifest came from the complete-matrix writer; normal source review
  remains the trust boundary, so this design adds no separate signing system.
  For an explicitly admitted runtime-default identity, this proves the current
  contract/corpus pair, not that a vendor will never change the model behind its
  default. Keep the public CLI kind disabled. Do not change general quality,
  scenario, implementation-plan, or executable-RED routing.
- **Prerequisites:** PR 2.
- **Proof:** each admitted Claude and Codex identity must pass every scenario
  class in `features/split-large-contributions-into-reviewable-prs.feature`.
  Positive outputs must contain a one-to-one slice record, complete obligation
  ownership, and unchanged decision accounting. Rejections must name the
  missing field, two-purpose boundary, unresolved design decision, unsafe
  intermediate merge and prerequisite, line-count-only rationale, omitted
  obligation, or reopened decision as applicable. PR 1's clause-deletion checks
  prove that all R1–R5 obligations remain present; the live matrix proves their
  representative application. Deterministic routing tests prove the filter does
  not change route selection for any existing review kind.
- **Completion signal:** the route selector returns only identities with current
  packaged conformance evidence; an empty admitted set deterministically ends
  routes exhausted, and an admitted degraded fallback stays labeled degraded.
- **Relies on an unmerged successor:** no. Admission policy is inert while the
  public kind remains disabled.

### Tasks and tests

1. RED: convert `tests/smoke/execution-plan.live.test.ts` into the authoritative
   live fixture matrix. It calls the internal headless-review boundary with a
   constructed `plan-execution` packet and PR 2's strict schema, without using
   public kind parsing or the coordinator. Check typed record fields rather than
   summary echoes and give each Examples row its own case.
2. RED: add deterministic route-policy cases for exact model identity,
   explicitly admitted runtime-default identity, unadmitted routes, no admitted
   route, and degraded fallback.
3. GREEN: add the conformance runner, a generated-manifest writer that refuses
   partial or failing matrices, its `--check` path, the digest-bound evidence
   reader, and filtering of the resolved `plan-execution` route list before
   dispatch. The reader admits only an exact identity whose writer-produced
   passing matrix and recorded contract/corpus digests match the bytes currently
   packaged.
4. Run the deterministic lane:
   `bun run test tests/review/execution-plan-conformance.test.ts tests/cli-protocol/review-wiring.test.ts`.
5. Run the mandatory live lane for each proposed admitted identity with
   `SAFEWORD_RUN_EXECUTION_PLAN_LIVE=1 bun run test tests/smoke/execution-plan.live.test.ts`.
   Save the exact runtime/model identity and fixture/contract digests in the
   completion evidence; do not admit an identity whose full matrix did not pass.
6. Run the full package test suite before this slice is considered independently
   mergeable.

## PR 4 — Activate an auditable Execution Plan gate through the real CLI

- **Purpose:** activate one auditable Execution Plan approval boundary.
- **Boundary:** add `plan-execution` to public kind parsing; require exactly one
  ticket-owned nonblank `execution-plan.md`; attach the exact packaged contract;
  select the kind-specific schema and validator; preserve final denials;
  retry only malformed output across bounded admitted routes; persist and
  present `data.reviewer_output.execution_plan_record`; bind approval stamps to
  the review job. Activation and retention are indivisible here: exposing an
  approval that cannot retain and authenticate what it covered would create an
  unsafe intermediate authority state. Append the accepted narrow
  `plan-execution` extension to the existing review-coordinator decision in
  `ARCHITECTURE.md`, linking this ticket rather than restating its detailed
  contract. Do not implement the later coding-transition consumer owned by
  7CAMAD, review-currency invalidation owned by 5F5ZZA, or human-facing recovery
  copy owned by K3EBHB.
- **Prerequisites:** PR 3.
- **Proof:** a real CLI integration test replaces only the external reviewer and
  runs that stub under an exact admitted fixture identity whose evidence was
  written through the production digest-bound evidence writer. It observes the
  admission check, exact contract bytes at dispatch, a valid v1 result envelope
  and retained record on approval, no reroute after a semantic denial, bounded
  reroute after malformed positive output, and no approval/stamp after denial
  or exhaustion. Compatibility tests prove all existing kinds retain their
  provider schemas, validators, and stored result shapes.
- **Completion signal:** `safeword review run plan-execution` can approve only a
  ticket-owned plan through an admitted route with a valid record; at least one
  exact identity has current final-byte evidence before activation; and every
  denied, source-changed-during-review, integrity-invalid, malformed, or
  route-exhausted path fails closed without authority. Currency after a
  completed approval remains 5F5ZZA's scope.
- **Relies on an unmerged successor:** no. This slice completes the child and
  leaves the repository supported.

### Tasks and tests

1. RED: extend CLI protocol, packet, coordinator, job-integrity, presentation,
   and review-stamp integration tests before activating the kind. Include an
   activation precondition that fails when no identity has current conformance
   evidence.
2. GREEN: wire the kind through those existing seams; reuse the coordinator and
   job store rather than introducing another engine or ledger.
3. REFACTOR: centralize only the kind-specific selection points that would
   otherwise drift. Preserve current errors and serialized shapes for legacy
   kinds.
4. Run:
   `bun run test tests/integration/execution-plan-review.test.ts tests/review/job.test.ts tests/cli-protocol/review-wiring.test.ts tests/cli-protocol/result.test.ts tests/hooks/review-receipt.test.ts`.
5. Re-run the mandatory live conformance lane against the final packaged bytes.
   If an admitted identity fails, withdraw its admission before activation can
   complete; never retain stale admission on the strength of PR 3 evidence.
6. Run the full package test suite before this slice is considered independently
   mergeable.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| Explicit one-versus-many decision and rationale | PR 1, PR 3, PR 4 |
| Complete coherent slice fields without invented design | PR 1, PR 2, PR 3, PR 4 |
| Explicit dependency order and safe intermediate state | PR 2, PR 3, PR 4 |
| Conceptual scope and independent proof instead of size thresholds | PR 1, PR 3, PR 4 |
| Preserve accepted behaviors and affected surfaces | PR 3, PR 4 |
| Preserve migration boundary and release/rollback behavior | PR 4 |
| Canonical contract/template documentation | PR 1 |
| Public CLI documentation and review-coordinator architecture extension | PR 4 |
| Existing review-kind compatibility | PR 2, PR 3, PR 4 |
| CLI dispatch, retained approval record, and stamp integrity | PR 4 |

## Deferred scope ownership

- YCFFNC owns installed host workflow migration; this ticket ships only the
  canonical package contract and the generated derivatives needed to keep the
  current repository internally consistent.
- 7CAMAD owns coding-transition enforcement.
- 5F5ZZA owns review currency and stale-review invalidation.
- K3EBHB owns the final plain-language recovery message; this ticket stops at
  typed denials and their existing CLI presentation.

## Decision accounting

| Implementation Plan decision | Status |
| --- | --- |
| Represent PR slicing as a dependency-ordered set of independently safe conceptual changes | unchanged |
| Extend the shared semantic review route with one canonical Execution Plan contract | unchanged |
| Admit only routes with semantic conformance proof | unchanged |
| Make positive Execution Plan judgment machine-checkable | unchanged |
| Reject structurally invalid review records | unchanged |
| Bound Execution Plan approval to coding readiness | unchanged |
| Retain the machine-checkable judgment with its review receipt | unchanged |
| Keep dependency semantics host-neutral | unchanged |
| Stage this child as the slicing portion of the future canonical Execution Plan contract | unchanged |

## Delivery checklist

- Tests: targeted RED/GREEN evidence per slice, final full suite, and mandatory
  live Claude/Codex conformance on final packaged bytes.
- Monitoring: not applicable; this is a local CLI gate with typed failures and
  no production service. Review-job failures remain visible through existing
  CLI status and findings.
- Migration: no released ticket is retroactively blocked. YCFFNC owns installed
  workflow migration before the epic releases.
- Documentation: PR 1 owns the canonical contract/template; PR 4 updates CLI
  command help or schema descriptions where the new public kind appears and
  appends the narrow accepted review-coordinator decision to `ARCHITECTURE.md`.
- Rollout: merge in dependency order and release only with the enclosing epic.
- Rollback: remove the unreleased kind and contract as one epic rollback; old
  job records become inert and grant no authority.
- Ownership: Safeword maintainers own the contract, validator, conformance
  evidence, coordinator wiring, and local review-job format.
