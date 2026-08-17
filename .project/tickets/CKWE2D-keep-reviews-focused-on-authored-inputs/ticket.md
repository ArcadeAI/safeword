---
id: CKWE2D
slug: keep-reviews-focused-on-authored-inputs
type: feature
phase: plan-implementation
phase_anchors:
  - define-behavior: .project/tickets/CKWE2D-keep-reviews-focused-on-authored-inputs/spec.md
  - scenario-gate: packages/cli/features/keep-reviews-focused-on-authored-inputs.feature
  - plan-implementation: packages/cli/features/keep-reviews-focused-on-authored-inputs.feature
status: in_progress
scope:
  - recognise an oversized target only when the repository explicitly marks it linguist-generated=true
  - review every remaining bounded authored target and report each omitted generated target in the command result
  - mark Safeword's generated plugin runtime outputs so dogfood reviews use the same explicit contract
out_of_scope:
  - truncating an oversized file or inferring generated status from a filename, extension, or size
  - skipping unmarked oversized targets, changing review-policy semantics, or weakening packet containment checks
done_when:
  - an oversized linguist-generated target no longer prevents a review of eligible authored targets
  - the result exposes the excluded paths and never claims they were reviewed
  - an unmarked oversized target and an all-excluded target still fail before any reviewer runs
  - packet, coordinator, public-command, and generated-artifact metadata regressions prove the contract
external_issue: https://github.com/ArcadeAI/safeword/issues/2121
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-12T15:10:06.430Z
last_modified: 2026-08-12T16:31:10Z
---

# Keep reviews focused on authored changes

**Goal:** Let independent reviews automatically exclude explicitly generated oversized artifacts while reporting the reduced scope.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-12T15:10:06.430Z Started: Created ticket CKWE2D
- 2026-08-12T15:10:35Z Revalidated #2121: `prepareReviewPacket` still rejects every target above 262144 bytes, including explicitly generated runtime output.
- 2026-08-12T15:10:35Z Figure-it-out: chose explicit `linguist-generated=true` omission with a visible reduced-scope result; retained hard failures for unmarked or all-excluded inputs.
- 2026-08-12T15:15:23Z Define-behavior: corrected the spec to distinguish Safeword's existing marker convention from the new runtime-output classification.
- 2026-08-12T15:20:34Z Scenario review: degraded Codex review requested changes. Addressed both blockers (attribute-driven command proof and complete exclusion reporting) plus boundary, false/unset, mixed-input, and typed-failure coverage; re-review required.
- 2026-08-12T15:22:18Z Scenario re-review: corrected the arbitrary-target setup and added lookup-failure, invalid-attribute, exact-byte-boundary, and concrete plugin-runtime assertions; re-review required.
- 2026-08-12T15:24:46Z Scenario re-review: added the preserved aggregate-limit rejection and made successful exclusions plus failed preflights exact JSON contracts, including option-like and nested paths; re-review required.
- 2026-08-12T15:27:32Z Scenario re-review: added duplicate-target de-duplication, exact aggregate boundaries, success status, literal Git-value semantics, and outside-project rejection before attribute lookup; re-review required.
- 2026-08-12T15:30:10Z Scenario re-review: strengthened successful packets to exact reviewer contents, split aggregate boundary success from failure, and added observable no-Git checks for lexical and symlink project escapes; re-review required.
- 2026-08-12T15:32:09Z Scenario re-review: removed the contradictory success/rejection tag and added canonical alias plus explicit non-literal Git-value coverage; re-review required.
- 2026-08-12T15:34:49Z Scenario re-review: fixed aggregate fixtures to individually valid exact byte distributions, made Git command failure a distinct public preflight error, and pinned canonical paths passed to attribute lookup; re-review required.
- 2026-08-12T15:37:14Z Scenario re-review: added below-limit generated inclusion, argv-safe Git proof, raw-content preservation, and malformed-record failures; re-review required.
- 2026-08-12T15:39:08Z Scenario re-review: changed individual and aggregate boundaries to multibyte UTF-8 byte fixtures and required original content for every successful reviewer packet; re-review required.
- 2026-08-12T15:42:01Z Scenario re-review: added capture-to-attribute TOCTOU refusal and NUL-safe newline-path behavior; recorded the unchanged packet-validation coverage as an inherited guard.
- 2026-08-12T15:45:36Z Scenario re-review: made inherited directory and UTF-8 validation explicit for marked targets, added the post-lookup race, and made special Git paths literal NUL-delimited stdin values.
- 2026-08-12T15:48:22Z Scenario re-review: made all preflight failures omit reduced-scope data, added zero-target failure, hardened same-size timestamp-restored races, and required one exact attribute record per canonical path.
- 2026-08-12T15:51:09Z Scenario re-review: standardized one NUL-stdin Git protocol, made alias and malformed tuple cases exact, added two-target failure atomicity, and pinned the public CLI JSON envelope.
- 2026-08-12T15:53:41Z Scenario re-review: specified the exact three-field UTF-8 NUL tuple and expanded malformed output coverage to invalid bytes, empty/surplus fields, and trailing data.
- 2026-08-12T15:58:31Z Scenario review timed out on the primary route but returned actionable degraded findings. Defined order-independent attribute-failure precedence and added public JSON-envelope failure coverage; final re-review required.
- 2026-08-12T16:03:02Z Define-behavior → scenario-gate → plan-implementation: the final bounded review approved the scenarios. Claude timed out, and the accepted typed Codex fallback is recorded as degraded (`author=codex`, `reviewer=codex`, `independence=degraded`).
- 2026-08-12T16:07:36Z Plan review requested changes. Added content-backed stability checks before Git and launch, separated real Git protocol tests from injected malformed-result tests, and made post-launch results retain finalized reduced scope; re-review required.
- 2026-08-12T16:31:10Z Revalidated the plan with local Git experiments: normal, cached, and `--source=HEAD` project lookups inherit `.git/info/attributes`. Reframed generated classification around an isolated bare Git directory and the committed `HEAD` tree, which rejects local overrides and working-tree marker drift. Repeated scenario reviews remain degraded because the preferred Claude route timed out; the latest pass added canonical lexical identity, order preservation, and bounded Git lookup coverage. Ticket remains at the scenario gate pending a fresh independent approval before RED tests and implementation.
