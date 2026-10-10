# R6 unrecognized-result admission proof

Bind accepted typed-route row169 using the existing installed CLI/coordinator
fixture. First obtain a valid qualified producer approval, record its authenticated
phase locator through the real stamp writer, and prove public plan admission.
Restore the planning phase and add only a harmless plan comment so that the
earlier receipt is actually stale; assert its public stale status. Require an
independent review, then change the mocked producer's schema version from
1 to 0 and add an error finding that must not escape validation. Clear its
previous invocation and packet markers so old calls cannot
satisfy the new invocation assertion.

The actual coordinator must evaluate the one configured qualified Codex route,
attempt it, classify invalid_output, return blocked with independence none, and
omit reviewer_output. The normal public phase gate must refuse and preserve the
planning phase. Public status must identify that same blocked job without an
approved body. Neither malformed producer content nor the old approved summary
may be rendered as reviewer findings. No ledger entry may claim approval for
the malformed job. The real stamp writer is invoked for that blocked job;
it must refuse with exit 1, name the blocked status, and preserve the ledger byte for byte. No signed
record or job result is manufactured. Only the
reviewer process is mocked; this is a structural route proof, not semantic or
live-provider qualification.

The coordinate fixture now accepts an explicitly expected blocked status without
assuming its errors are empty or that an actual reviewer produced a valid body.
Existing approved/declined/continuation expectations remain intact. The shared
no-approval Then retains the original declined-review checks and adds a separate
invalid_output branch. Actual route failure, missing validated output and public
job status are asserted; a generic missing-receipt refusal alone cannot pass.

Independent wiring RED a5ab59a6-6f1f-4421-9a38-9d027fc6ddd1 approves the initial
undefined Given at row169 with the correct ledger path. Its vacuous-GREEN concern
is addressed by the valid admission control, cleared markers, exact invalid_output
classification and same-job status assertions. The first setup run omitted the
required authenticated phase locator and failed before the malformed producer;
that failure is retained and is not a production defect. Adding the existing
phase stamp writer fixed setup without adding the removed redundant artifact stamp.

GREEN: malformed and genuine-decline cases pass (six behavior steps, 108 cleanup
hooks). Broader controls pass 27 scenarios (81 behavior steps, 1458 cleanup hooks),
including pending, route fallback/capability/independence and all three installed
hosts' current/pending/stale/fallback cases. Normal production verification at
e39b7352b remains recorded; no production or generated source changed. Current
proof-tag checks will be recorded outside this frozen context.

The whole typed-route outline stays incomplete; no checkbox transition is made
from a single-row proof. Inventory is expected to become 121 bound / 38 undefined,
with all explicit host and R7 deferrals unchanged. Ungated origin remains unbound;
the qualified weaker catalogue pair is absent and its scope decision is pending.
Do not call binding counts passes or claim broad acceptance, Ready, merge or epic
completion. Old source reviews including this fixture are historical, not current.
