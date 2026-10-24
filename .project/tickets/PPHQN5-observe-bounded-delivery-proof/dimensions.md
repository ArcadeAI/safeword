# Observer behavior dimensions

Scope: the observer only. C7HCN7's reviewed proposal and the user's instruction
authorize defining and reviewing this slice. All downstream authority remains
excluded. These are planned proofs, not completed test results.

| Dimension               | Meaningful partitions                                                                                                                | Proof placement                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request authority       | fixed T3E4NS request; caller-supplied command/filter/report/ticket                                                                   | Acceptance: fixed lane and refused scope substitution. Lower-level `observer-request-contract` matrix covers each supplied override and unknown ticket.                                                                                  |
| Candidate readiness     | clean committed bound source; dirty product/config/support; changed accepted scope/profile                                           | Acceptance: dirty execution input refusal. Lower-level `observer-source-identity` matrix covers staged, unstaged, untracked inputs and mismatched profile.                                                                               |
| Execution isolation     | fixed isolated run; original product tree                                                                                            | Acceptance: run uses fixed set without changing original product inputs. Lower-level `observer-execution-environment` proves fixed invocation, no live reviewer, refused loader overrides and fixed preparation.                         |
| Case mapping            | all 37 cases map to explicit named/parameterized assertions; one unmapped case                                                       | Acceptance: unmapped case refuses before execution. Lower-level `observer-required-assertions` covers every parameter row, both route declaration orders and ambiguous/duplicate assertion identities.                                   |
| Required proof outcomes | all executed and passed; missing, skipped or failed required assertion                                                               | Acceptance: complete observation and required-result outline. Lower-level `observer-required-assertions` distinguishes unrelated skips and count-only impostors.                                                                         |
| Runner aggregate        | success; nonzero exit despite passing assertions; unavailable runner/preparation; malformed report                                   | Acceptance: nonzero runner cannot issue success. Lower-level `observer-runner-failures` covers missing tool, timeout, preparation failure, no report, invalid JSON and unexpected rows.                                                  |
| Authentication          | authentic observation; unauthenticated/tampered/wrong-purpose record                                                                 | Acceptance: changed report refuses verification. Lower-level `observer-authentication` matrix covers changed metadata, changed report digest, wrong ticket/purpose/key and unrelated review receipts.                                    |
| Persistence lifecycle   | fully retained success; interruption/partial write; retry                                                                            | Acceptance: interrupted attempt remains failed and retry preserves it. Lower-level `observer-persistence` injects interruption before each durable boundary and proves no passing record is issued from partial state.                   |
| Verification freshness  | same behavior/inputs; changed product or required proof; dirty input; audit-only output write; new commit with unchanged input bytes | Acceptance: changed assertion refuses current success and audit-only write retains it. Lower-level `observer-freshness` covers source/config/toolchain/profile changes, unchanged-content commit and outputs loaded as execution inputs. |
| Historical boundary     | original ledger/receipts/33 deferred identities; execution-only record                                                               | Acceptance: successful observer changes no historical/completion authority. Lower-level `observer-history-preservation` compares exact original bytes, all 33 case/owner identities, and verifies no shared gate/phase/approval writes.  |
| Diagnostics             | invalid request, unavailable execution, incomplete proof, invalid/stale record                                                       | Every refusal includes problem and one concrete recovery action. Lower-level `observer-recovery-messages` covers the named result classes without relying on code or identifiers alone. No NTB usability claim is made.                  |
| Surfaces                | real local Safeword CLI; host/cloud integration                                                                                      | CLI scenarios carry @surface.safeword-cli and use real config/storage/parser/signing collaborators. Only subprocess boundaries are controlled. Native/cloud closing is excluded.                                                         |

## Required identity and lifecycle controls

The named `observer-source-identity` matrix must compare the candidate commit,
projected product and accepted boundary, shipped contract/profile, runtime
identity and every resolved execution-input digest before and after execution.
Inject both a commit change and an in-place lockfile/config/support change while
the fixed subprocess is paused. Neither may issue success, including when the
runner itself returns passing assertions. Candidate changes before initial
execution and during execution are distinct placements of this same obligation.

The `observer-freshness` matrix must vary ticket identity, scope, exclusions,
done_when and parent linkage one at a time: each semantic edit denies current
success. Paired controls vary status, phase, timestamps and Work Log with all
bound fields unchanged: those bookkeeping-only writes retain currency but
authorize no phase transition. Include a whole-ticket-exemption mutation and
a whole-ticket-byte-hash mutation; each must break the relevant paired control.
The acceptance outline distinguishes source/scope changes from Work Log and
non-input audit output changes.

The `observer-shipped-profile` matrix must prove that a committed project mapping
edit removing or renaming a required assertion cannot shrink the installed
required set. A caller-edited census never selects authority. An actually
unsupported case refuses; the matrix must not invent proof to make it pass.

Extend `observer-history-preservation` and `observer-recovery-messages` to refused
and interrupted outcomes: each retains execution-evidence-only meaning and
changes no historical or closing authority. Dirty-input messages must ask to
commit or clean first; only an already committed changed candidate is offered
an immediate new observation. The local user and signing-key owner stay trusted.

## Compression and limits

Retention and history controls must start from known nonempty saved evidence,
assert its identity and diagnostic bytes before the action, then prove the same
object still exists afterward. In `observer-persistence`, deleting the previous
attempt, truncating its diagnostics, reusing its identity or replacing its failed
record during retry must each fail this preservation check. An empty set of
"available" diagnostics cannot satisfy a retention claim.

Before execution, `observer-source-identity` must also reject an accepted-scope
change against the shipped contract and request review of an updated contract.
This is separate from committing or cleaning a dirty input: a clean but changed
scope cannot recover by rerunning the old shipped contract.

Twelve scenario blocks represent distinct observable outcomes. Repeated corrupt
fields and write boundaries belong to the named lower-level matrices. The three
required-result outline rows vary only the required assertion's outcome.

No scenario authenticates synthetic proof as a real completed observation. New
public-entrypoint tests must observe actual fixed-runner execution; fixture
subprocesses prove discrimination without launching paid model providers. The
production lane uses existing normal tests, not a caller-supplied report.

Historical 33-case snapshots remain research sources, never current admission
authority. This feature preserves them; it does not migrate their identities,
declare the 142-case old lane complete, or certify all 37 semantic case meanings.
