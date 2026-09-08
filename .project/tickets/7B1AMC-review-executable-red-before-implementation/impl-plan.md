# Impl Plan: Stop hollow acceptance proofs before implementation

**Status:** implemented
**Planned on:** 2026-09-06
**Implemented on:** 2026-09-06
**Replanned on:** 2026-09-07

## Approach

The riskiest remaining assumption is that the existing cross-host edit gate can deny GREEN credit
without adding a second receipt store or a noisy per-edit check. The cheapest proof is the paired
`Invalid executable-RED evidence blocks the shared GREEN transition` and `Fresh exact
executable-RED evidence permits the shared GREEN transition` scenarios against an actual
`[ ] GREEN` to `[x] GREEN` edit through the built hook. The same tests exercise the public receipt
gate used by direct CLI callers, while existing job integrity and fingerprint tests prove freshness.

The trusted execution and durable receipt slices are already implemented. Complete the corrected
blocking contract with one additional slice after retaining those four foundations:

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
   evidence, and treats route exhaustion as unable to authorize GREEN. Primary proof:
   `tests/review/red-rubric-generation.test.ts` plus the built-CLI BDD feature.
4. **Workflow and parity.** Update the canonical BDD/TDD and TDD-review skill sources so every
   supported agent invokes the same CLI command once per distinct proof implementation. Regenerate
   Claude/Codex/OpenCode/Cursor deliveries, update the CLI reference and the existing review-coordinator
   architecture decision, then run dogfood parity. Primary proof:
   generated-delivery checks, schema/parity checks, and the feature scenarios.
5. **Blocking GREEN admission.** Add scenario and ledger identity to the executable-RED request and
   one read-only `review gate executable-red --scenario <name> --ledger <path>` command. It scans
   only integrity-valid durable jobs, recomputes each candidate's fingerprint from current declared
   inputs, and permits only a current approved cross-agent receipt for that scenario and ledger.
   Invoke that command from the
   existing shared pre-tool hook whenever the R/G/R ledger changes `[ ] GREEN` to `[x] GREEN`; deny
   the edit on missing, fabricated, incomplete, mismatched, stale, passing, wrong-reason, or
   non-independent evidence. Claude Code, Codex, OpenCode, and Cursor already route edit operations
   through this shared gate, while direct CLI callers use the command itself. Primary proof: built
   CLI gate tests and actual hook denial/allowance integration tests. No second receipt store or
   host-specific gate is added.

Scenario proof map:

| Scenarios | Primary proof | Why this scope is sufficient |
| --- | --- | --- |
| Real failure; distinct proofs; author output; modified attestation; timeout | Integration through the real attestation collector with controlled executables | Proves process execution, byte capture, termination, and integrity behavior at the OS boundary |
| Intended failure; wrong-reason outline; complete packet | Built CLI plus scripted independent reviewer | Proves the reviewer receives authenticated execution evidence and the fixed attribution rubric |
| Material-input freshness outline; proof identity outline | Durable job integration tests | Proves exact input/config fingerprints, HMAC record integrity, stale status, and reuse decisions |
| Passing proof; route exhaustion; invalid/fresh GREEN transition | Public gate and shared pre-tool hook integration tests | Proves an actual GREEN-credit edit is denied unless a fresh approved cross-agent receipt matches the current scenario and declared proof identity |
| Shared outline; distinct implementations | Job reuse tests plus skill contract tests | Proves one receipt per canonical proof identity without per-row ceremony |
| Supported-agent parity | Generated Claude/Codex/OpenCode/Cursor freshness checks plus canonical workflow tests | Proves every affected agent surface carries the same host-neutral blocking contract |

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
| Execute structured argv directly | Add explicit execution options to `review run executable-red`; never invoke a shell | Shell command string; checked-in JSON manifest | Shell text adds injection/canonicalization ambiguity; a new manifest is unnecessary state for this focused gate |
| Bind declared proof inputs and execution configuration | Fingerprint scenario, proof plan, proof/support targets, argv, cwd, evidence class, matcher, and timeout; status fails stale after material changes | Whole-repository content snapshot; caller-declared hash | Whole-tree snapshots are noisy and expensive; caller hashes preserve the trust gap |
| Gate GREEN at its durable credit boundary | Add one read-only receipt-check command and call it from the existing shared hook on a newly checked GREEN ledger row | Skill-only repetition; commit-only gate; second receipt store; advisory-only reporting | Skill text is bypassable, commit parsing is host-specific and can miss ledger-only work, another store duplicates trusted state, and advisory reporting allows hollow proof to earn GREEN credit |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Default output says confirmed/not confirmed and gives one action; verbose JSON retains exact technical evidence | `packages/cli/tests/cli-protocol/executable-red-wiring.test.ts` | |
| 1. Structure enforces; instructions suggest | Safeword executes and integrity-seals RED evidence, then the shared hook denies the actual GREEN ledger transition without a qualifying receipt | `packages/cli/tests/integration/write-time-annotation-gate.test.ts` | |
| 2. Fire at boundaries, not every turn | Validation runs only when GREEN credit is claimed, not on ordinary edits or turns | `packages/cli/tests/integration/write-time-annotation-gate.test.ts` | |
| 5. Correct and safe; then clear; then simple | One review job lifecycle owns execution, review, freshness, and receipt integrity; no second store or dependency | `packages/cli/tests/review/job.test.ts` | |

Architecture decisions honored: `ARCHITECTURE.md` section “Host-owned cross-agent adversarial
review coordinator” (one neutral packet, typed failures, durable source-bound review provenance)
and “CLI Protocol and Output Contract” (typed observation/mutation effects and actionable recovery).

## Known deviations

The trusted executor runs in the project working directory while binding every declared proof input;
it does not clone the entire repository into an isolated filesystem or infer undeclared transitive
helpers. Whole-tree copying would break host harnesses and add large latency. The gate therefore
recomputes the exact declared request before GREEN and relies on the proof plan to enumerate support
files; expanding this ticket into dependency-closure inference would exceed the accepted contract.

Proof commands are ordinary project processes with the invoking user's filesystem permissions, not
an OS security sandbox. Safeword strips its internal review variables from the child environment,
cleans up descendant processes, and invalidates a job completed before the trusted worker publishes
its result. Protecting against deliberately malicious same-user project code would require a
separate isolation design and is outside this issue's accepted missing-behavior trust boundary.

## Doc impact

- Update `packages/website/src/content/docs/cli-reference.md` through the CLI reference generator.
- Update canonical `bdd/TDD.md` and `tdd-review/SKILL.md`, then regenerate shipped Claude, Codex,
  and Cursor copies.
- Update `ARCHITECTURE.md` in the existing host-owned review coordinator decision; no new ADR is
  needed because this extends that reversible feature-scoped mechanism.

## Assessment triggers

- Shipped blocking-gate telemetry shows unacceptable false-positive rate, route availability, or latency.
- Real projects routinely need undeclared transitive proof helpers, making declared-input freshness
  unreliable.
- A supported host exposes a stronger hermetic execution or signed-attestation primitive.
- The product must treat deliberately malicious same-user proof code as an adversary rather than
  trusted project code.
- Executable RED packets regularly exceed current file/output bounds.
