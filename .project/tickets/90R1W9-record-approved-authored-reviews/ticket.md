---
id: 90R1W9
slug: record-approved-authored-reviews
type: task
subtype: bug-investigated
scope: [receipt transport, implement coverage, coordinator exclusion validation, generated delivery]
out_of_scope: [historical proofs, RED enforcement, release, unrelated session edits]
done_when: [valid exclusions permit recording, uncovered authored files fail, invalid and stale exclusions fail]
phase: implement
status: in_progress
created: 2026-10-05T19:40:29.941Z
last_modified: 2026-10-05T19:40:29.941Z
---

# Record valid authored reviews for developers

**Goal:** Honor authenticated generated-file exclusions while rejecting uncovered authored changes

**Why:** The reviewer and implement-phase approval recorder disagree on generated targets

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

## Work Log

- 2026-10-05T19:40:29.941Z Started: Created ticket 90R1W9.

**Next:** Review intake, then add failing receipt regressions before editing helpers.
