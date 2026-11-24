# Behavioral dimensions — draft

These partitions support intake planning, not reviewed executable scenarios.

Formal behavior source now exists at features/verify-existing-ep9-behavior-for-maintainers.feature
with all implementation ledger rows unchecked. Placement: distinct externally
meaningful admission/closing/refusal outcomes are feature scenarios; malformed
signatures, duplicate binding fields, identity/digest/run variants, expired or
future checkpoints, and individual missing prerequisites are planned table-driven
trust-policy and closing-adapter tests. Actual GitHub credential/artifact isolation
is a separate live integration proof; local Docker and mocked signatures cannot
substitute for it. Host parity covers Claude/Codex/Cursor without new host admission.

| Dimension | Accepted partition | Refused partitions |
| --- | --- | --- |
| Eligibility | Exact installed EP9 candidate/profile | Other ticket; this prerequisite; T0 proof presented as EP9 proof |
| Verifier origin | Installed verifier checks fixed CI workflow identity/revision and signed report | Candidate path/symlink/loader; wrong workflow/revision/repository; unavailable runtime |
| Execution provenance | Controlled CI execution with exact artifact/run-attempt binding; identical re-signing is neutral | Arbitrary upload, replaced artifact, fabricated execution with fresh review, missing attestation, runner/signing credential exposure |
| Coverage | All eight groups and their fixed accepted bindings | Missing, duplicate, mismatched or test-count-only coverage |
| Certification | Current authenticated qualified independent reviewer | Same-agent; reduced; unqualified; forged; wrong candidate/profile/verifier |
| Currency | Bound inputs valid; latest execution succeeded; CI-signed checkpoint at most five minutes old | Changed/deleted input; newer failed/interrupted/pending attempt; absent/altered/expired or wrong-run checkpoint |
| Closing | Ordinary prerequisites satisfied on supported local host | Missing dependency/proof/disposition; unsupported producer/host |
| Historical record | Distinct current credit with original history unchanged | Invented RED; altered historical rows; promoted deferrals; sibling/parent closure |

Affected local host partitions: Claude Code, Codex and Cursor. Source-CLI/private
fixture success is supporting evidence; installed-host success is separate.
OpenCode/cloud eligibility remains excluded and all 33 deferrals remain intact.

Lower-level mandatory variations: Another ticket includes 5GK1CN itself and
T0FK4H, with neither eligible for EP9's exception. Changed bound proof includes
withdrawn/deleted independent review and changing the pinned workflow revision;
invalidate observation, approval and checkpoint together. Forged local validation
has separate HMAC-cache and candidate-supplied root/pin controls. These are
table-driven trust-policy tests under the named feature outcomes, not optional
unmapped cases. Live GitHub isolation/artifact controls, latency feasibility and
installed-host walkthroughs are explicit done_when gates; mocked passes cannot
close this prerequisite.

Retry freshness variation under changed-bound-proof: a newer successful execution
paired with the older observation's review/checkpoint must refuse. Renewing only
execution or only checkpoint does not migrate the independent approval.
