# Impl Plan: Keep failed reviews out of benchmark scores

**Status:** planned

## Approach

The riskiest assumption is that a single positive admission predicate can distinguish a genuine empty review from the hidden expert failures that invalidated the 2026-08-01 run. The cheapest load-bearing proof is the real-wiring scenario that injects an HTTP-200 provider error envelope at the network boundary and observes a preserved failed attempt with no scoreable record.

Primary proof is integration testing through the ticket-local runner, artifact writer, and scorer with real collaborators and a controllable provider boundary. Pure classification, cell-matrix, retry-state, manifest, and spend-gate partitions receive table-driven unit tests. No paid calls occur until all no-cost tests are green.

This is a recovery prerequisite sub-plan, not the ticket closeout. After the harness is proven and a fresh run completes, the ticket still owes its original asymmetric-scoring comparison, uncertainty and false-certainty report, SZZ spot checks, prompt/human ranking comparison, and final go/kill decision.

Build order:

1. Extract one exhaustive `TrialDisposition` result in `scored-run-policy.ts`: `{status: "usable", reason: "completed", retry: "never"}` or `{status: "invalid", reason: <canonical reason>, retry: "infrastructure-once" | "never"}`. Runner, writer, scorer, and tests consume that result without reclassification. Unknown or absent evidence is invalid. Positive admission validates each retained tool-call trace entry, requires the flattened trace to equal the routed outcome's retained tool calls, sums token usage from every raw provider envelope, and reconciles that sum through the expert and report aggregates. Add RED/GREEN tests for findings, explicit empty findings, every provider/reviewer/provenance failure, retry class, malformed traces, and fabricated usage.
2. Establish the minimal final writer lifecycle before the wiring proof. Replace direct writes to `active/` with provisional case directories and an explicit versioned state record. The runner is single-process and sequential; an exclusive run lock rejects concurrent writers. Each attempt is written to a temporary file, flushed, and atomically renamed before state advances, including the status-derived retry disposition for thrown provider failures. State updates use temporary-write, file flush, rename, and containing-directory flush. A completed case directory is renamed once into `active/`; an unusable case is renamed once into `quarantine/`, then the incremented reserve index and allocated identity are durably recorded before any replacement provider call. Resume reconstructs only from the state record plus sealed directories, preserves the same retry decision as uninterrupted execution, and makes the transition idempotent at every injected crash boundary.
3. Run the load-bearing real-wiring RED integration test against that final lifecycle: inject an HTTP-200 error envelope at the provider boundary and pass it through the actual runner, writer, and scorer. Extend it to connection failure, empty/truncated output, unexpected finish, schema invalid, no reviewer route, genuine empty success, one finding, and multiple findings. Re-run this same network-boundary suite after every later scorer or state change.
4. Keep two matrix artifacts distinct. The immutable preregistered matrix freezes primary cases, systems, variants, trials, and reserve order before calls. The runner derives an effective matrix only from durable quarantine and reserve-allocation records, validates each substitution against that frozen order, and never edits the preregistration. `score-results.ts` verifies the derivation, excludes verified quarantined primaries, and fails if a quarantined identity leaks into the effective matrix. It rejects missing, duplicate, extra, provisional, and unusable effective cells, then derives every gate and estimate input from admitted records.
5. Add SHA-256 raw-artifact manifests with unique relative identities. The threat model is accidental drift, loss, or path aliasing by a local operator—not a malicious host or repository maintainer. Bootstrap in two commits: first commit and push the manifest plus digest; record that exact object ID in GitHub issue #1910 before reuse; then freeze the origin URL, object ID, and issue evidence URL in the run config. The paid runner has no legacy-manifest defaults: it requires explicit fresh manifests plus preregistered corpus-role evidence, rejects void, overlapping, late, underpowered, or reserve-drifted corpora before calls, and durably retains the exact corpus-role and certified contamination-preflight bytes as raw artifacts. The scorer repeats the corpus-role guard from manifest-verified bytes before computing estimates. Verification resolves the exact Git object, fails closed if it is unavailable, rejects absolute/traversing/duplicate/symlink identities, reads each artifact once, verifies SHA-256, and passes those verified bytes directly to parsing. Hostile-filesystem Unicode/case-fold/TOCTOU hardening is out of scope. Preserve the 2026-08-01 audit as diagnostic-only metadata.
6. Keep the accepted label contract. Canary labels are mechanical records `{fixtureId, expectedAdmission, expectedReason, expectedOutputClass}` frozen before calls; unique identities cover both systems, both variants, empty success, and finding success. Confirmatory scoring uses the ticket's existing asymmetric acted-on/useful evidence, Nate's recorded 10-PR triage, the PR 2118 exchange, and documented SZZ spot checks. It requests no new engineer review time and records uncertainty where existing evidence cannot adjudicate a finding.
7. Add a canary-gate module that consumes individual fixture, operational, paid-outcome, provenance, mechanical-label, raw-provider-response, cost, and real-wiring records. The real-wiring fixture emits the concrete retained HTTP-200 provider-error output, expected route/provenance, quarantined attempt identity, active-record inventory, and failed scorer result; the gate reclassifies that output and requires one matching quarantine, zero admitted records, and no scorer output. Freeze the mechanical labels in a separate immutable Git object and unedited external issue anchor before any canary call; the post-call authorization gate independently reloads those bytes, reclassifies every retained raw attempt through `TrialDisposition`, and rejects labels that were retained late or disagree with the raw outcome. Its authorization payload has one exact binding inventory: runner, `TrialDisposition` classifier, writer, scorer, effective-matrix derivation code, fixtures, real-wiring evidence, the separately anchored labels, provider/model configuration, cost policy, corpus-role evidence, preflight bytes, primary and reserve manifests, preregistered matrix, source-commit inventory, run ID, and exactly one next checkpoint. The gate envelope itself is loaded from another immutable Git object named by an unedited external issue anchor, avoiding an impossible self-digest inside the payload. Before every gated provider call, the runner recomputes and matches the payload; any missing or extra binding, change, or replay against another run/checkpoint fails closed. Derived output and its raw-artifact manifest do not exist before paid calls, so after the run the scorer separately requires their immutable external anchor and verifies every input byte before deriving the effective matrix.
8. Freeze the disjoint ten-call canary inputs, mechanical labels, genuine-empty designation, R1 fixture taxonomy, R2 operational taxonomy, cost ceilings, and immutable canary-evidence anchor. Run the no-cost suite only. Paid execution remains a separate explicit step after review of green evidence; raw output receives its separate immutable manifest anchor only after it exists and before scoring or reuse.

The internal evaluation harness is the only affected surface; no installed Safeword CLI behavior changes.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Admission | One exhaustive typed disposition shared by runner, writer, and scorer | Boolean predicate; file counts; scattered negative checks | Retry eligibility and canonical failure reason must travel with admission; the invalid run proved file presence and negative-only checks silently admit unknown states. |
| Case publication | Single-process versioned state plus provisional directory, then durable seal to active or quarantine | Write each trial directly to active; transactional database | Direct writes expose partial cases; the explicit flush/rename ordering is sufficient for one locked sequential process without adding a database. |
| Retry | One infrastructure retry; any later or semantic failure quarantines the whole pair | Per-trial exclusion; unlimited retry | Per-trial deletion breaks pairing and unlimited retry hides reliability/cost. |
| Scoring | Deterministic candidate retrieval plus the ticket's frozen asymmetric recorded-human evidence | Exact title substring; new human panel; LLM judge | Exact matching produced known false negatives/positives; new engineer time is out of scope; an LLM judge adds correlated uncertainty at this scale. |
| Artifact integrity | SHA-256 manifest commit whose object ID is also retained on issue #1910 | Local hash file only; mutable branch name; hostile-filesystem hardening | The issue record protects against accidental branch/worktree loss without pretending to defend against a malicious host; adversarial filesystem defense is outside this local research tool's threat model. |
| Spend gate | Durable authorization from ten individual paid outcomes plus no-cost taxonomies | Aggregate success flag; proceed by cost checkpoint alone | Aggregate flags recreate the hidden-failure problem and do not identify which proof failed. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| 1. Structure enforces; instructions suggest | The scorer physically cannot consume provisional, quarantined, unknown, or matrix-incomplete trials. | `.project/tickets/CWGYH0-pr-review-eval/scored-run-policy.test.ts` and new scorer integration tests | |
| 2. Fire at boundaries, not every turn | Validity checks run at attempt completion, case sealing, scoring, and paid-checkpoint authorization. | `.project/tickets/CWGYH0-pr-review-eval/features/reject-incomplete-evaluation-trials.feature` | |
| 5. Clarity before correctness | One named admission predicate and one durable case lifecycle replace scattered implicit assumptions. | `.project/tickets/CWGYH0-pr-review-eval/scored-run-policy.ts` | |

Architecture alignment: this remains ticket-local research tooling and follows `ARCHITECTURE.md`'s separation of generated state from human decisions. It does not change package or published CLI architecture.

## Known deviations

The benchmark requires explicit adapter and source-repository roots at runtime, verifies the adapter's immutable commit and clean tracked state before dynamically loading it, and binds that identity into preflight and run evidence. A packaged adapter remains preferable for distribution, but no machine-specific worktree path is embedded in the paid runner.

## Doc impact

skip: internal ticket-local evaluation recovery; no customer-visible README or website behavior changes.

## Assessment triggers

- More than one concurrent benchmark process or a remote worker requires replacing filesystem state transitions with a transactional store.
- A corpus larger than the fresh powered holdout, or adjudicator disagreement above the frozen threshold, requires revisiting the two-human scoring workflow.
- Any provider changes response/finish semantics require a new frozen fixture and explicit classifier partition before reuse.
- Any paid canary failure returns the plan to no-cost diagnosis; it does not relax the gate.
