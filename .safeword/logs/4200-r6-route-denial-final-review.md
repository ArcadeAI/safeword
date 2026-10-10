# R6 final blocked-route denial proof

Production repair reviewed and approved in
8017dab3-549d-434e-b5fd-6482164e5c5d. No production change since that review.
Its root-proof warning is corrected: the actor-visible Cursor user_message must
contain the literal reviewer-route reconciliation heading for plan-implementation,
in addition to the exact review id and blocked-receipt reason. The focused final
case passes 57 steps. Prior broad controls pass 21 cases / 1197 steps, including
all three hosts' pending/approval/fallback and stale-receipt cases. Targeted
receipt/helper and phase-gate controls pass 98 tests. All three typechecks pass.

The callback exposes only the verifier's already-authenticated rejection, with
the receipt fields used to distinguish blocked routes from other receipt errors.
Only planning exits with no verified stamp show the new diagnostic. Other phase
exits retain their prior message. The actual rerun command is included in the
visible message for adapters that omit additionalContext. A good stamp alongside
the rejected one still permits admission. No authentication or approval policy
change, provider qualification, schema exemption or new origin mechanism.

The proof covers only accepted row172. The earlier wrong-kind substitute for
ungated origin was rejected by review and removed; origin remains undefined.
Simulated-host evidence uses actual installed Cursor hooks/CLI/configuration/job
store/status/writer, mocking only reviewer processes. Independent functional RED
69a96a26-fa03-44be-8ead-94226e9ea227 has an incorrect ledger argument and is not
claimed as checkbox-transition authority. The whole typed-route outline remains
unfinished. Historical failures, 40 undefined cases, 16 explicit host deferrals
and separate user-deferred R7 remain open. Full normal verification will be
recorded separately; never append results to this frozen context. No Ready/merge.
