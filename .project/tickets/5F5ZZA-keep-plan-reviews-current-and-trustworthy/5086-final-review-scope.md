# #5086 final review scope

Source checkpoint: 9dcac79acb6b55e939c985fff3e94ddc7bce17bc, based on main 150eb7c619b2d5852174da99ba675ae326354153. Review only ranked routes, qualified capability/model provenance, authenticated single-use host continuation and honest reduced-independence admission. No #5139 scope enforcement. Preserve #5957 contract/copy checks, #5980 context/dispositions and stronger tests.

The target patches are complete own-slice diffs against main. Core current sources are supporting context. Generated CLI bundle bytes are excluded from independent review; all five surfaces have been regenerated and checked. This is source review, not an assertion of raw compiled-byte review.

Fresh qualification of changed main rubric/schema inputs: gpt-6-astra 18/18; claude-opus-5 17/18. Both meet the unchanged floor, and per-fixture dominance yields Claude author -> Codex reviewer not_weaker; reverse weaker. Historical September evidence is retained separately. Current sealed results, catalogue and release-gate implementation are supplied. No unchanged paid qualification was repeated.

Response to source review 1c5a8a10-ce2a-45f8-a175-1763abead1fc and test review 26678f5e-2235-4b76-b0a7-edfe6e314f52:

- Unknown-reviewer rejections are retained, including the first rejection when later unknown reviewers approve. Same-agent/headless or host fallback cannot replace that rejection with approval. Status is blocked/none because no admissible qualified verdict exists; actual reviewer and findings remain visible. A later qualified independent route can still decide the review.
- Proven-weaker verdicts remain discarded per the explicitly accepted PR4 task 1. They cannot acquire either approval or rejection authority merely by being rejected. Their typed route failure is retained. This is an accepted contract, not a proposed scope expansion.
- Qualification settings now ship with the catalogue and production planning passes those exact effort settings. Release runs explicit capability verify before its test wrapper; packaged-capability.release.test.ts independently binds current rubrics/schema/corpus/settings to evidence. CI already requires test:release. This follows the generated-admission pattern; a development checkout with stale distribution output is not claimed qualified.
- Public documentation names all non-Claude author-metadata limits under require, blocked fallback when no independent route was attempted, and the host-reported origin/fresh-context trust boundary. The receipt authenticates the job, sealed packet, source currency, tier and single use; it does not prove an isolated context ran.
- The architecture tests retain ARG006 (same-model rejection), ARG007 (different-model admission), ARG006B (an unreceipted model tag is refused), absent-model failure and authenticated-reduced refusal. The differing receipt-first error in ARG006B does not remove cross-model branch coverage.
- Added a per-job dispatch regression: output for job A is rejected by job B, while A can still consume its own continuation. Renamed the release classification test so weaker results are not described as usable independent routes.
- Unknown author under require and unavailable independent routes already have installed integration coverage; tests and full diffs are supplied.

Evidence: installed CLI fallback six cases pass; 212 repair/support tests pass; refactor routing four cases pass; all three package typechecks pass. The initial full run was interrupted with exit 143 after source regeneration made dist stale; its failures/incomplete status are retained. A fresh full suite and static checks are running on frozen source. Review correctness separately from Draft/readiness evidence; no pending check is claimed passed.

Preserved nonblocking adapter limits: keyring-only credentials are not proven by the existing auth.json-only isolation path; failed-turn auth classification, per-candidate probe/fallback budget accounting, and terminal output without a unique final answer remain possible recovery/latency limitations. Do not silently claim these repaired. The coordinator's overall worker bound and fail-closed admission remain. No new credential broker or host-isolation attestation is in scope.

Historical boundaries remain: broad acceptance six failed/585 unfinished; 33 deferred/unverified cases; R7 host retrieval/private-injection human deferral; old R9 wrong-kind recovery diagnostic limitation. Parent phase, status and ledgers remain unchanged. No merge or Ready authority.
