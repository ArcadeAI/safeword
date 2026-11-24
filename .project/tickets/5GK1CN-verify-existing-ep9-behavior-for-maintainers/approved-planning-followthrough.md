# Approved planning packet and carried implementation obligations

Review 0f3addde-34ce-4e0a-ae67-20351c3fc9ec approved the exact current packet,
actual reviewer Claude, selected claude-opus-5-5, coordinator independence
cross-agent. The supported helper recorded its intake review stamp. The full
approval and every warning are retained in evidence/. No qualification,
implementation, CI dispatch, installation or ticket completion is inferred.

Earlier changes_requested reviews 628139a4, 4f3dc321 and d4f81dbd remain intact.
The blocking provenance/cache findings were addressed by fixed CI execution,
separate signing, direct closing verification of external signatures and an
explicit trusted-installation baseline. This is not OS-enforced protection of
user-owned plugin caches, and deliberately replacing the installed verifier can
defeat local enforcement. Do not advertise end-to-end same-account protection.

## Nonblocking warnings to resolve before implementation

- Candidate/run association: workflow_dispatch head_sha identifies the workflow,
  not the tested candidate. Define a trusted workflow-generated candidate/profile
  run identifier present before execution; enumeration must include newer runs
  without artifacts, including pending, failed and interrupted runs.
- Per-binding confidence: trusted controller process observations establish
  command execution, not arbitrary candidate reporter assertions. Choose trusted
  per-binding selectors/commands or explicitly limit reporter-derived claims to
  independently reviewed semantics; do not attest candidate JSON as ground truth.
- Installation trust: same-account code replacing installed verifier or pins is
  outside the promised boundary, even if it does not require OS privilege.
- Checkpoint versus execution: define distinct predicate types emitted only by
  the pinned workflow, or separately pinned reusable-workflow identities; verify
  that checkpoints cannot impersonate execution. Do not assume certificates
  identify an ordinary job within a workflow.
- Honest clock: five-minute offline freshness assumes a correctly advancing
  verifier system clock; a deliberately held-back clock is outside that guarantee.
- Root rotation: expired roots fail closed. Define preparation and trusted
  installation/root refresh lifecycle; candidate-supplied roots remain forbidden.
- Traceability: 4f3dc321 findings led to scope/spec reconciliation, fresh-fabrication
  and runner-token/artifact scenarios, dimensions, explicit attempts/checkpoints
  and historical-status corrections. d4f81dbd led to closing-time external
  signature verification and the explicit installed-verifier trust decision.
- Operational cost: changing a frozen relevant EP9 input requires a new reviewed
  workflow SHA/profile and trusted verifier installation before new proof.
- Historical proposal: planning-proposal.md's older local-only decision is
  superseded by its header and ci-provenance-design.md, not current authority.

Do not rewrite the just-reviewed packet merely to hide warnings. These items
belong in subsequent Implementation Planning with discriminating proof and
actual feasibility checks. The approval covers planning readiness only.

## Critical-path boundary

The requested ordinary review/repair cycle reached approval. The corrected
execution-review corpus still has no newly qualified execution-plan reviewer;
its old packaged admission is stale. Feature coding cannot be authorized by
this intake approval. The explicit hold on qualification campaigns remains.

Before paying again, independently check the corrected benchmark examples.
The smallest proposed qualification follow-up is 63 Opus execution cases plus
18 Sol capability calls, retaining Opus's existing unchanged 18-call capability
evidence. Verify all corpus/rubric/settings identities before reusing it; do not
repeat or relabel old evidence. This is at most one proposed 81-call campaign,
not authorized, and can still fail. Preserve Sol's original failed call and all
earlier results; no repeat-until-green loop. CI execution and implementation
authorization remain separate. Missing historical RED and all 33 deferrals stay.
