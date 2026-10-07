---
id: 90R1W9
slug: record-approved-authored-reviews
type: task
subtype: bug-investigated
scope: [receipt transport, implement coverage, coordinator exclusion validation, generated delivery, authorized Sharp security patch]
out_of_scope: [historical proofs, RED enforcement, release, unrelated session edits]
done_when: [valid exclusions permit recording, uncovered authored files fail, invalid and stale exclusions fail]
phase: done
status: done
created: 2026-10-05T19:40:29.941Z
last_modified: 2026-10-06T07:02:17Z
---

# Record valid authored reviews for developers

**Goal:** Honor authenticated generated-file exclusions while rejecting uncovered authored changes

**Why:** The reviewer and implement-phase approval recorder disagree on generated targets

## Current delivery continuation — 2026-10-06

The human requested quality-review of synchronizing main and proceeding as
appropriate. Independent review approved the bounded plan; normal additive
branch synchronization and supported generators preserve both parents' authored
work. The opening verify.md section records the actual checks and limits.
Earlier closure stamps precede the later Sharp/main follow-ups and do not claim
coverage of them. Fresh independent review and exact-head CI are required before
guarded Ready promotion and actual configured model inspection. The original
request authorizes that Ready-then-inspect sequence for PR #5443 specifically.
No PR merge, release, manual approval proof or historical #2121 edit is authorized.

## Authorized dependency follow-up — 2026-10-06

Current-head CI exposed newly published Sharp advisory GHSA-wq5f-xc86-pv6w.
The human selected the smallest patched Sharp investigation rather than leaving
this delivery blocked for a separate dependency fix. Astro 7.2.10 already permits
Sharp ^0.35.4; the patch updates only Sharp 0.35.4 → 0.35.5 and its matching
platform/libvips packages in bun.lock. No direct dependency, manifest, override,
audit ignore or unrelated package update remains. Verification is in verify.md.

## Current guarded closure

Normal installed implement stamp succeeded for independent Claude/Opus review
`53a9e548-0918-46f6-9ecb-df081c8c67fa`; the live guard accepted implement →
verify. Earlier closure-attempt text below is historical, superseded by this
actual shared-profile result. The reviewer approved with no errors. Its
warnings are answered in verify.md: tampering proves integrity rejection;
separate signed unclassified exclusions prove classification enforcement.

Independent Claude/Opus review `eb4c864e-e146-40d5-ac2e-11987c8ca1f3`
approved with no errors. The normal installed writer earned the verify-phase
stamp; guarded edits accepted phase done and status done. Audit, scope and
scenario/refactor assessments are recorded in the ticket artifacts. Subsequent
warnings were answered without source changes: historical instructions below
are retained only as history; generated content equivalence remains a separate
gate; source-map-js's override is inherited from main; deadline sensitivity is
already tracked in the verification report.

**Next:** Commit and push the closure evidence, await current-head CI, mark
PR #5443 Ready and inspect its configured review. No merge or release.

## Local activation decision

- Frame: activate the reviewed payload through the supported installer so normal closure guards can verify it.
- Options: refresh the actual local marketplace install; use the isolated candidate profile; wait for publication.
- Domains: Codex cache replacement/reload, Safeword distribution-owned receipt routing, shared-profile provenance and recovery.
- Evidence: official <https://developers.openai.com/plugins/build/plugins> documents local marketplace registration and installed cache delivery; local CLI requires marketplace removal before replacing its source. Safeword's receipt route deliberately excludes project source CLIs. The isolated profile cannot fix the active guard; publication is outside scope.
- Decided: supported local marketplace replacement plus `codex plugin add safeword@safeword --json`. Both installed and reviewed generated runtime hashes now match `b281fe1bc7ece3f7b9c238753fd7a7bbe56ebca499ebdfe857616e1e1569456a`, retaining 1.0.0. No hand-edited cache or approval proof.
- Premortem: the running app retains old code; require actual normal stamp and phase-gate success rather than assuming the install result proves activation.
- Recovery source: the previous marketplace was `/Users/alex/.codex/worktrees/4951/safeword`; restoring it, if needed, uses the same supported marketplace commands.

## Root Cause

The reader drops coordinator excluded_targets; implement coverage then requires
generated bundles in review_targets, which the coordinator removes. Real review
44522b75-5f0e-4d6e-ae54-81cf121adc0d for J8MQQ6 approved source/tests, ruling out
reviewer rejection and missing authored coverage. Released 1.0 reproduces.

## Figure-it-out investigation

- [x] Frame: honor verified exclusions without granting uncovered authored work approval.
- [x] Options: carry coordinator exclusions; reclassify at recorder; new generated attestation.
- [x] Domains/questions: authorization (who excludes); identity/freshness (which snapshot); paths (aliases/directories); compatibility (legacy absence); testing (real boundary).
- [x] Research: https://slsa.dev/spec/v1.2/verification_summary requires trusted producer, intended subject/purpose and successful verification for delegated decisions. https://cwe.mitre.org/data/definitions/863.html distinguishes existing checks from correct authorization. Local review status authenticates its job and reruns packet preparation/fingerprint; exclusions still must classify as oversized generated regular files. They earn no review credit.
- [x] Debate: reclassification repeats policy and cannot prove reviewer scope. New attestation duplicates signed state. Carry verified scope with exact-file matching and remaining authored coverage: no dependency or persistent state.

Recommend **carrying coordinator exclusions** because review status already
authenticates fresh review scope.

**Premortem:** directory exclusions become blanket approval; use exact-file
matching and require nonempty remaining reviewed implementation.

## Proof plan

Reader-to-gate accepts source plus excluded bundles, rejects uncovered authored
changes, directory exclusions, dot and absolute aliases that widen scope,
malformed exclusions, stale status and all-excluded changes. Legacy receipts
without exclusions retain strict coverage. The coordinator alone classifies
generated files; review status must publish only recorded exclusions also
confirmed by the current packet's oversized/generated/regular-file classifier.
Coordinator tests reject signed worker exclusions of non-generated authored
files and tampered stored exclusions. No caller exclusion flag or duplicate
hook classifier is added. Excluded bytes are not credited as reviewed; changing
their generated classification invalidates the review's effective scope.

## Historical work log — prior states and next steps are superseded

- 2026-10-05T19:40:29.941Z Started: Created ticket 90R1W9.

## Implementation evidence

- Intake review 1303122e independently approved by Claude/Opus, normally stamped before implementation.
- Genuine RED: /tmp/approval-exclusions-red.log (two coverage/reader failures); /tmp/approval-exclusions-classification-red.log (unclassified exclusion); /tmp/approval-exclusions-schema-red.log (invalid provenance shape).
- Current targeted proof: 185/185 in /tmp/approval-exclusions-targeted-final.log before schema extension.
- Independent source reviews 100b3c43 and d0de462c approved. Addressed warnings by reusing the packet classification already computed for freshness and adding real source CLI status-to-reader-to-gate coverage.
- Legacy scope is fail closed: only `review_excluded_targets` carries authenticated current exclusions; the old raw field remains unchanged and cannot waive coverage.
- Classifier requires oversized AND generated AND regular, with committed attributes. Every non-ticket authored changed file still needs review. Excluded bytes get no review credit; content-only changes to still-generated exclusions are intentional. Exact normalized lexical paths support dot/absolute aliases without widening directory coverage; case differences fail closed.
- Checkpoint fa298f4b6 was required by LOC guard while provenance-field integration was incomplete; not claimed green. Final verification follows the completed reader/schema integration.
- Pinned Bun 1.3.14 is used without replacing global Bun 1.4.0. Generated lifecycle result hashes remain unchanged; tree hashes reflect template bytes.

## Final verification and review responses

- Full frozen suite passed: CLI 609 files / 10,453 tests / 14 expected skips, relay 198 tests / one expected skip, collector 153 tests. Evidence: /tmp/approval-exclusions-full.log. Targeted coordinator, reader, gate, schema and CLI contract tests passed 259/259 in /tmp/approval-exclusions-targeted-contract.log.
- Root lint and typecheck passed; all five generated surfaces, supported parity sync and version-sync passed with pinned Bun 1.3.14. Lifecycle result hashes are unchanged.
- Independent review 88d593cf approved production source and contract tests; supplementary review 7269afde approved the final schema fixture and documentation. Both were actual separate Claude/Opus processes with no errors.
- Nested-project warning is answered by currentWorkFiles: both Git diff calls explicitly use --relative, and untracked ls-files paths are project-relative. The new exact-file exclusion uses that same project base. No speculative path rewrite was introduced.
- The schema's completed-review requirement for raw excluded_targets predates this change. The diff adds only an optional, typed review_excluded_targets field; legacy receipts remain valid and cannot waive coverage.
- Schema shape tests intentionally do not authorize exclusions. Coordinator classification, real source CLI status-to-reader-to-gate, malformed/legacy receipt, stale result and uncovered authored-file tests separately cover the trust decisions.
- Regenerated plugin/runtime/cli.js read actual review 7269afde as approved with review_excluded_targets:[]; installed 1.0.0 read the same authenticated job approved without the field. Logs: /tmp/approval-exclusions-bundled-status.json and /tmp/approval-exclusions-installed-status.json. Installation was not changed. Exclusion-aware recording requires deployment of this fix; older verifiers remain strict.

- Release packaging passed 13 files / 81 tests in /tmp/approval-exclusions-release.log. Final read-only generated and parity gates passed all five surfaces, 268 pairs and 11 contracts.
- Complete changed-file independent review f7f7e7ee approved with no errors and classified exactly the two generated runtime bundles as verified exclusions. Its missing-classification-loss-test warning was addressed by shrinking an excluded file and asserting stale status, then restoring it for the tamper test. Current job tests passed 76/76 in /tmp/approval-exclusions-freshness-final.log. This final change was test-only; production bytes remain identical to the successful full suite.
- Committed generated attributes remain the established classification policy; attribute changes themselves require authored review. Generated equivalence is separately enforced by the five-surface and parity gates. No generic sandbox or new reclassification workflow was introduced. A malformed route may fall through only to another authenticated, well-formed status route.

- Dedicated audit and explicit behavior/TDD/refactor assessment completed; reports are audit.md and process-assessment.md. Audit caught four obsolete exact-key Cucumber expectations in current-head Node 24 CI. Genuine acceptance RED/GREEN and independent review ea439409 approved their narrow correction.
- Formal verify invocation recorded successfully. Exact resolved plan completed with two full acceptance passes (596 scenarios / 11,118 steps each), BDD proof 47/47, build and typecheck green. Aggregate exited 1: child PATH selected Bun 1.4.0, causing eight explicit pinned-generator refusals; one second-pass 500ms fake-reviewer deadline assertion also failed. Explicit pinned Bun 1.3.14 / Node 24 rerun of every affected file passed 145/145. No tests were weakened.
- Supply-chain verification reports preexisting 10 JavaScript advisories and 6 urllib3 advisories in the Python experiment. No manifests/locks changed; no unrelated upgrade performed. Full honest checklist and surface limits are in verify.md, rather than an invented all-green completion verdict.

**Next:** Push the reviewed scoped Draft PR follow-up for fresh CI. Do not merge or release, alter #2121 historical claims, or claim installed activation. The installed legacy verifier rejects the normal implement stamp until this fix is deployed; it must not be bypassed.

- Normal additive main synchronization regenerates the five conflicted generated surfaces; no authored conflict or manual bundle edit. Combined receipt/job/readiness checks passed 254/254.
- Supported installed-candidate walkthrough in an isolated Codex profile and disposable project normally records a genuine cross-agent reviewed implement stamp with the generated exclusion; an uncovered authored file rejects the same receipt without a second stamp. No user profile or original historical claim changed. Details and limits are in verify.md.
- c6d4045c5 CI passed all ordinary checks; its inherited audit policy explicitly ignores the two user-deferred high advisories. Raw scan remains non-green, not reported as patched.

## Earlier closure attempt — superseded by local activation above

- 2026-10-06T06:49:35Z Resumed the requested worktree at 862bdfba4 after reading audit.md, process-assessment.md and verify.md. Exact-head CI 37418723375 is green. Review 35ee3248 was authenticated approved before the report update; stale 754a7ca3 was not reused.
- Installed verify invocation recorded; verbatim plan ran with Bun 1.3.14 / Node 26.8.1. Both CLI runs passed 10,456 tests across 609 files; relay 198 and collector 153 passed; both acceptance runs passed 596 scenarios / 11,118 steps. Build, typecheck, final lint and five generated surfaces passed. Aggregate exited 75 because dedicated proof calls could not acquire another chat's active lock; the supported longer-wait recheck passed 47/47. No lock, assertion or guard was bypassed. Raw scans still report nine JavaScript and six root uv/urllib3 advisories; details and logs are in verify.md.
- Normal installed and repository recorders refused the implement stamp because their stable distribution receipt lacks verified exclusions. Safeword denied the actual implement-to-verify edit. The shared marketplace points at worktree 4951; the supported isolated candidate matches this branch's generated runtime. Active-profile activation/restart awaits the user's choice. Phase/status remain implement/in_progress.
- Configured Draft inspection returned a noop, not a model review. PR #5443 remains Draft. No merge, release, guard change or historical #2121 proof edit occurred. These documentation updates require fresh review before advancement.

**Next:** Resolve supported candidate activation in the shared profile, then earn
fresh review and advance through normal verify/closure before marking #5443 Ready
and inspecting its configured review. Preserve all guards and historical proofs.
