# Author completeness check

Superseded provenance framing: the issuer-only diagnostic below did not resolve
fresh fabricated execution with fresh review. The current design is the fixed
CI producer, isolated signer, exact artifact/run binding and five-minute signed
completion checkpoint in ci-provenance-design.md and the revised scenarios.
provenance-result.md preserves the withdrawn conclusion, not current authority.

This is an inline author check, not independent review or a phase approval.
Planning only; no paid call, execution test or implementation occurred.

| Accepted rule | Draft coverage |
| --- | --- |
| R1: exact EP9 eligibility | Full positive; wrong ticket/profile; prerequisite self-eligibility refusal; T0 regression control |
| R1: complete current behavior | Missing/duplicate/mismatched/failed proof; aggregate count cannot substitute for bindings |
| R2: independent authority | Fixed CI workflow SHA and artifact/run binding; arbitrary uploads, replaced artifacts, runner credential exposure, candidate runtime/profile and forged validation cache/pin all refuse under explicit installed-verifier trust |
| R2: independent certification | Qualified positive; same-agent/reduced/unqualified/forged/mismatched/partial review; approve-with-error and per-group rejection |
| R2: currency | Changed/deleted inputs, latest execution-mode attempt, later failures, admission-to-close change, CI-signed checkpoint expiry and clock anomalies |
| R3: honest completion | Explicit closing only; mixed genuine/missing history preserved; all ordinary prerequisites remain |
| R3: boundaries | No automatic parent/sibling closure, no prerequisite self-exemption, no qualification changes; all 33 deferrals retained |

Closed gaps: the first draft treated all EP9 history as missing even though its
first scenario has genuine recorded RGR. It now preserves each group's actual
history. Added contradictory approval outputs, no automatic closing, and a
change between successful admission and closing. These refine accepted rules;
they add no eligibility or host support.

## Historical technical uncertainty — superseded

The existing external-path resolver is useful but is not proof of independent
issuance. currentProofTag in src/review/job.ts signs using readOrCreateIntegrityKey;
validation reads the corresponding profile-owned key. The signature binds root
and payload, not by itself a separately installed executable identity. Source
code running as the same operator may be able to invoke that signing primitive.
Other execution/review checks may still refuse its result; this inspection has
not demonstrated an accepted forgery or established that they do.

Therefore first prove the complete refusal path using isolated synthetic
fixtures: compare a genuine external observation with a candidate-issued record
having equivalent content and a valid-looking signature. It must be rejected
for missing trusted execution provenance while the positive control passes.
Do not read real keys into logs or alter real records. If both are accepted,
simple profile reuse is insufficient; revise the design before implementation.
No new signing service or OS-level attacker model is assumed in advance.

Formal approval remains outstanding; ordinary review-and-repair cycles are now
authorized. The historical reasoning above grants no review stamp, historical
RED, coding authority or permission to install a new runtime. Current scenarios
and CI design supersede its identical-content/source-issuer refusal proposal.
