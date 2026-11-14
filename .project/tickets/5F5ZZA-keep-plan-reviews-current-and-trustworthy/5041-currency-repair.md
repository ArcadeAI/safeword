# Preserve semantic currency across raw-copy drift

Bounded regression repair within #5041 / accepted R5. Main's semantic currency
must remain intact when a generated author copy needs reconciliation. No Product
or scenario context admission or disposition work from #5051 is authorized.

Primary proof for ledger `Scenario: Cosmetic canonical changes preserve review
currency but require copy reconciliation`: the new installed-copy test starts
from an authenticated current Implementation review and real installed/stamped
project, changes only an outside-rubric comment in its packaged author copy, and
invokes the installed shared phase hook. The hook must deny and name canonical
copy reconciliation; the public review-status CLI must still report approved;
public approve-plan must refuse the drift, then permit advancement after exact
copy restoration without another reviewer call. The project-copy row is a
supplementary partition at the same boundaries. Only the reviewer process is
simulated. Both proof and support are declared in installed-planning-copy-
admission.test.ts and review-fixtures.ts.

Expected RED: `Cosmetic copy drift must not stale the semantic review`. The
current implementation performs strict raw-copy checks when public status
reconstructs the semantic identity. That returns stale even though the plan,
reviewer contract and semantic context are unchanged.

Repair plan: distinguish internal currency reconstruction from dispatch packet
preflight. Status uses the generated canonical contract's semantic identity;
review dispatch and explicit approval keep strict full-copy checks. Real host
phase transitions must keep an explicit strict copy check, so currency-only
reconstruction cannot become authorization to use a drifted author copy. This
internal purpose is not a CLI flag, serialized packet field, or reviewer input.

Separate test maintenance: canonical matching Implementation contracts must use
the real packaged baseline; contradictory copies must still name omitted and
extra obligations plus the noncanonical reviewer identity. Native bundles must
remain byte-identical apart from their one host-specific author identity table;
verify each layout's actual paths and complete-file hashes independently.

Historical evidence remains unchanged. First full deterministic run: CLI 677
files passed / 8 failed, 11250 tests passed / 39 failed / 14 skipped. It includes
an overlapping deterministic CLI-contract rebuild and is retained as an attempt,
not clean final verification. Most failures are current Execution admission;
two test assumptions need the bounded maintenance above. The separate live
qualification was interrupted after three observed semantic failure outputs and
did not produce a complete result matrix. No admission evidence was regenerated.
