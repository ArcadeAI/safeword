# Impl Plan: Stop hollow acceptance proofs before implementation

**Status:** implemented
**Planned on:** 2026-09-06
**Implemented on:** 2026-09-06

## Approach

The riskiest assumption is that Safeword can execute an arbitrary project test command once,
capture enough trustworthy evidence to review why it failed, and preserve the existing review
coordinator's freshness guarantees without adding a second subsystem. The cheapest proof is
`A real missing-behavior failure produces trusted execution evidence`, wired through the built CLI
with a fixture executable that emits a known assertion failure.

Build in four slices:

1. **Trusted observation.** Add an `executable-red` review request with structured argv, a contained
   working directory, a literal expected-failure matcher, an evidence class, and a bounded timeout.
   Execute without a shell. Stream-hash all stdout/stderr while retaining bounded excerpts; record
   exit/signal, timestamps, runtime/environment identity, and the existing source fingerprint.
   Primary proof: integration tests in `tests/review/red-execution.test.ts`; CLI wiring proof in
   `tests/cli-protocol/executable-red-wiring.test.ts`.
2. **Durable binding and freshness.** Carry the execution request in the integrity-sealed review
   job, execute once in the trusted worker, attach the attestation to every reviewer packet, bind
   execution parameters into the source fingerprint, and reuse a fresh approved receipt only for
   identical canonical proof inputs. Primary proof: `tests/review/job.test.ts` and
   `tests/review/packet.test.ts`.
3. **Independent failure attribution.** Add one generated executable-RED rubric sourced from the
   canonical `tdd-review` skill. It requires intended actor-boundary failure, rejects syntax/import/
   fixture/configuration/infrastructure/unrelated failures, refuses missing or tampered execution
   evidence, and treats route exhaustion as advisory. Primary proof:
   `tests/review/red-rubric-generation.test.ts` plus the built-CLI BDD feature.
4. **Workflow and parity.** Update the canonical BDD/TDD and TDD-review skill sources so every
   supported agent invokes the same CLI command once per distinct proof implementation. Regenerate
   Claude/Codex/Cursor deliveries, update the CLI reference and the existing review-coordinator
   architecture decision, then run dogfood parity. Primary proof:
   generated-delivery checks, schema/parity checks, and the feature scenarios.

Scenario proof map:

| Scenarios | Primary proof | Why this scope is sufficient |
| --- | --- | --- |
| Real failure; distinct proofs; author output; modified attestation; timeout | Integration through the real attestation collector with controlled executables | Proves process execution, byte capture, termination, and integrity behavior at the OS boundary |
| Intended failure; wrong-reason outline; complete packet | Built CLI plus scripted independent reviewer | Proves the reviewer receives authenticated execution evidence and the fixed attribution rubric |
| Material-input freshness outline; proof identity outline | Durable job integration tests | Proves exact input/config fingerprints, HMAC record integrity, stale status, and reuse decisions |
| Route exhaustion; advisory truth outline | CLI protocol integration tests | Proves plain typed outcomes and no blocking gate at the public command boundary |
| Shared outline; distinct implementations | Job reuse tests plus skill contract tests | Proves one receipt per canonical proof identity without per-row ceremony |
| Supported-agent parity | Generated Codex and Claude freshness checks plus canonical workflow tests | Proves every affected agent surface carries the same host-neutral command contract |

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://slsa.dev/spec/v1.2/build-provenance and https://bun.com/docs/runtime/child-process | 2026-09-06 | SLSA 1.2 and Bun current docs | Safeword 0.83.1 on Node 26 types and Bun 1.3.x runtime | SLSA separates explicit inputs from trusted run details and digested byproducts; Bun documents argv execution, cwd/env control, exit/signal capture, timeout, and output bounds | Bind a trusted executor identity, exact inputs, run metadata, and digested output without exposing environment secrets | This is diagnostic test evidence, not SLSA-certified provenance; no source code is reused, so no redistribution obligation is introduced |

**Decision impact:** changed: replaced reviewer-trusted author output with a Safeword-produced
execution attestation while retaining the existing coordinator and receipt store.
**Decision informed:** Extend the durable review job with one executable-RED kind

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Extend the durable review job with one executable-RED kind | Reuse the existing packet, worker, source-fingerprint, HMAC record, route, and receipt lifecycle | New RED-review subsystem; source-only review | A second subsystem duplicates trust and lifecycle code; source-only review cannot authenticate execution |
| Execute structured argv directly | Add explicit execution options to `review run executable-red`; never invoke a shell | Shell command string; checked-in JSON manifest | Shell text adds injection/canonicalization ambiguity; a new manifest is unnecessary state for the first advisory release |
| Bind declared proof inputs and execution configuration | Fingerprint scenario, proof plan, proof/support targets, argv, cwd, evidence class, matcher, and timeout; status fails stale after material changes | Whole-repository content snapshot; caller-declared hash | Whole-tree snapshots are noisy and expensive; caller hashes preserve the trust gap |
| Roll out at the RED boundary as advisory | Skills invoke the review and report evidence honestly; no GREEN/done hard gate | Immediate blocking gate; final-only review | FY1NHB owns route-reliability and false-positive evidence; final-only review cannot prove test-first causality |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Default output says confirmed/not confirmed and gives one action; verbose JSON retains exact technical evidence | `packages/cli/tests/cli-protocol/executable-red-wiring.test.ts` | |
| 1. Structure enforces; instructions suggest | Safeword, not the author, executes and integrity-seals the observable RED evidence | `packages/cli/tests/review/red-execution.test.ts` | |
| 2. Fire at boundaries, not every turn | The workflow runs once for each new or changed distinct proof, immediately before GREEN implementation | `packages/cli/tests/review/surface-parity.test.ts` | |
| 5. Correct and safe; then clear; then simple | One review job lifecycle owns execution, review, freshness, and receipt integrity; no second store or dependency | `packages/cli/tests/review/job.test.ts` | |

Architecture decisions honored: `ARCHITECTURE.md` section “Host-owned cross-agent adversarial
review coordinator” (one neutral packet, typed failures, durable source-bound review provenance)
and “CLI Protocol and Output Contract” (typed observation/mutation effects and actionable recovery).

## Known deviations

The trusted executor runs in the project working directory while binding a sealed snapshot of every
declared proof input; it does not clone the entire repository into an isolated filesystem. This is
acceptable for the advisory release because whole-tree copying would break host harnesses and add
large latency. Any undeclared helper is a proof-plan defect; FY1NHB evidence determines whether a
stronger sandbox is warranted before hard enforcement.

## Doc impact

- Update `packages/website/src/content/docs/cli-reference.md` through the CLI reference generator.
- Update canonical `bdd/TDD.md` and `tdd-review/SKILL.md`, then regenerate shipped Claude, Codex,
  and Cursor copies.
- Update `ARCHITECTURE.md` in the existing host-owned review coordinator decision; no new ADR is
  needed because this extends that reversible feature-scoped mechanism.

## Assessment triggers

- FY1NHB shows unacceptable false-positive rate, route availability, or latency.
- Real projects routinely need undeclared transitive proof helpers, making declared-input freshness
  unreliable.
- A supported host exposes a stronger hermetic execution or signed-attestation primitive.
- Executable RED packets regularly exceed current file/output bounds.
