# Design: Trusted executable RED review

**Guide**: `.safeword/guides/design-doc-guide.md`
**Related**: Feature Spec: `spec.md` | Test Definitions: `test-definitions.md`

## Architecture

Extend the durable review coordinator with one `executable-red` kind. The foreground CLI validates
structured execution options and stores them in the integrity-protected job. The trusted worker
executes the command once, captures a bounded attestation, and supplies that same attestation to
every independent reviewer route. Existing source fingerprints and HMAC-sealed job records bind the
receipt to its proof inputs and make later changes stale. One read-only receipt gate recomputes that
identity when a host claims GREEN.

The attestation proves the observable fact that a command ran and how it terminated. The model
review remains a separate judgment: whether that failure represents the intended missing behavior
at the named actor boundary. Neither layer claims scenario completeness. The shared edit hook blocks
the GREEN ledger transition unless the gate finds a fresh approved cross-agent receipt.

## Components

### Component 1: Execution request boundary

**What**: Parse and validate direct argv, contained cwd, evidence class, expected literal, and timeout.
**Where**: `packages/cli/src/cli-protocol/catalog.ts`, `public-handlers.ts`, `review/contract.ts`
**Interface**:

```typescript
interface RedExecutionRequest {
  scenario: string;
  ledger: string;
  argv: readonly [string, ...string[]];
  cwd: string;
  evidenceClass: 'pure-contract' | 'simulated-host' | 'local-live-host' | 'external-live-host';
  expectedFailure: string;
  timeoutMs: number;
}
```

**Dependencies**: Existing typed CLI protocol and Commander 15.
**Tests**: Public option validation, no-shell argv preservation, path containment, exact retry command.

### Component 2: Trusted attestation collector

**What**: Execute once and capture process/run evidence without leaking full environment values.
**Where**: `packages/cli/src/review/red-execution.ts`
**Interface**:

```typescript
interface RedExecutionAttestation {
  schema_version: 1;
  source_fingerprint: string;
  argv: readonly string[];
  cwd: string;
  evidence_class: RedExecutionRequest['evidenceClass'];
  environment: { sha256: string; variable_count: number; platform: string; arch: string };
  started_at: string;
  finished_at: string;
  exit_code: number | null;
  signal: string | null;
  stdout: CapturedStream;
  stderr: CapturedStream;
  expected_failure: { literal: string; matched: boolean };
}
```

**Dependencies**: Node `child_process` and `crypto`; no new package.
**Tests**: Real subprocess assertion failure, timeout signal, full-stream digest after truncation,
environment secrecy, distinct commands.

### Component 3: Durable review binding

**What**: Persist the execution request in the HMAC-sealed job, add the attestation to neutral review
packets, fingerprint every material input, and reuse only an identical fresh approved receipt.
**Where**: `packages/cli/src/review/job.ts`, `packet.ts`, `coordinator.ts`, `command.ts`
**Dependencies**: Existing review job store, packet snapshot, route coordinator, and status contract.
**Tests**: Tamper rejection, stale-on-input-change matrix, one execution across fallback routes,
identical-proof reuse, distinct-proof separation.

### Component 4: Attribution rubric and workflow

**What**: Give every reviewer and agent one generated standard for right-reason RED and fail-closed
recovery.
**Where**: canonical `tdd-review` and `bdd` templates, generated reviewer rubric, shipped host copies.
**Dependencies**: Existing rubric generators and plugin generation scripts.
**Tests**: Rubric extraction, generated/source parity, all-host command parity, built-CLI BDD wiring.

## Data Model

`ReviewJobRecord` gains an optional execution request for `executable-red`. Its HMAC covers that
request and the terminal result containing the attestation. `ReviewPacket` gains an optional
attestation that is required only for `executable-red`. Legacy schema-1 records and the three
existing review kinds remain readable and unchanged.

## Component Interaction

1. The agent calls `review run executable-red` with reviewed files plus direct execution options.
2. The foreground CLI validates the request, fingerprints sources/configuration, and starts one job.
3. The worker executes once and captures the attestation.
4. The coordinator sends one neutral packet containing that attestation through its existing routes.
5. The job seals the result; `review status` rechecks source freshness and record integrity.
6. A later identical proof may reuse the approved receipt; any material input change starts fresh.
7. At the GREEN ledger transition, every host calls the same public gate with the scenario and
   project-relative ledger path; direct CLI integrations call it themselves.

## User Flow

1. An agent writes a primary acceptance proof that currently fails.
2. Safeword runs the exact targeted test command before production implementation.
3. A separate reviewer sees the observed failure plus the scenario and proof plan.
4. The builder sees “independently confirmed,” “changes requested,” or “not independently
   confirmed” with one exact next action.
5. The shared hook permits GREEN only when the public gate finds the current approved receipt.

## Key Decisions

### Direct argv, not shell text

**What**: Spawn the executable with an argument array.
**Why**: Preserves canonical identity and removes shell interpolation from an already sensitive boundary.
**Trade-off**: Shell pipelines must be wrapped in a project-owned script and named as one proof target.

### One execution, separate judgment

**What**: Observe the command once, then reuse the attestation across reviewer fallback routes.
**Why**: Prevents flaky tests from presenting different failures to different reviewers and avoids
duplicating test cost.
**Trade-off**: A stale or failed reviewer requires a new review job bound to the same attestation only
while the job remains valid.

## Implementation Notes

**Constraints**:

- No new runtime dependency.
- No shell execution.
- Project-relative cwd and proof paths must remain inside the project root.
- Output excerpts and runtime are bounded; full stream hashes survive truncation.
- Environment values never appear in the packet or human output.
- Internal review variables are removed from the proof environment, but proof commands remain
  trusted same-user project code rather than OS-sandboxed adversaries.

**Error Handling**:

- Invalid execution options fail before the job starts with one correction.
- Spawn failure, timeout, signal, expected-literal miss, route exhaustion, and stale inputs remain
  distinct typed outcomes.
- An attestation may describe a failed run, but only the independent reviewer can approve intended RED.

**Gotchas**:

- Fingerprint execution configuration as well as files.
- Never rerun the proof for each reviewer route.
- Never treat nonzero exit alone as intended RED.
- Bind admission to both scenario and ledger so a same-named scenario in another ticket cannot
  reuse the receipt.
- Keep self-review and cached green status visibly weaker than a fresh receipt.

**Open Questions**:

- skip: no blocking questions; FY1NHB owns promotion evidence.

## References

- https://slsa.dev/spec/v1.2/build-provenance
- https://bun.com/docs/runtime/child-process
- `ARCHITECTURE.md` — Host-owned cross-agent adversarial review coordinator
