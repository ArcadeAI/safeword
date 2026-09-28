---
id: CKWE2D
slug: keep-reviews-focused-on-authored-inputs
type: feature
phase: implement
phase_anchors:
  - define-behavior: .project/tickets/CKWE2D-keep-reviews-focused-on-authored-inputs/spec.md
  - scenario-gate: packages/cli/features/keep-reviews-focused-on-authored-inputs.feature
  - plan-implementation: .project/tickets/CKWE2D-keep-reviews-focused-on-authored-inputs/impl-plan.md
  - implement: .project/tickets/CKWE2D-keep-reviews-focused-on-authored-inputs/impl-plan.md
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
last_modified: 2026-09-28T02:18:43Z
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
- 2026-09-28T01:02:59Z Resumed to unblock #5018. Current Git documentation and local Git 2.54.0 still support the planned committed-tree NUL protocol; the generated plugin runtimes are 2,699,284 bytes and already marked `linguist-generated=true`. Independent Claude/Opus scenario review `b2e450d2-acb0-44d9-966d-8c9ad7cdb03d` found three blocking gaps: contradictory all-excluded behavior, missing survivor-order proof, and a post-classification race. Corrected those examples, added authored targets to three fixtures, reduced two parser matrices, and made host-level scenario skips explicit. Re-review required before implementation.
- 2026-09-28T01:09:00Z Independent re-review `2582ce55-3d99-4671-9384-4c655790aca4` found two further proof gaps: the real generated runtime was not sent through the public review command, and successful zero-exclusion results did not require an explicit empty list. Corrected both in the scenario source. Re-review required.
- 2026-09-28T01:15:00Z Independent re-review `7fb5bcfc-fe86-4f8f-a03b-deef75a25bb4` found the bare `linguist-generated` Git attribute state had been removed from the acceptance partition even though it must not qualify for exclusion. Restored that discriminating row. Re-review required.
- 2026-09-28T01:20:00Z Independent re-review `a1eddf30-e0d9-492f-845f-58fd54d4ecc5` found the pre-lookup drift assertion vacuous without a second oversized target that would otherwise need classification. Added that target and removed an incidental no-lookup assertion from the target-failure ordering outline. Re-review required.
- 2026-09-28T01:26:00Z Independent Claude/Opus scenario review `ea8c8167-9cc0-4408-94e8-1b3f182954aa` approved the 44 scenario definitions with no blocking findings. The phase stamp could not use that receipt because the feature source is outside the ticket folder; aligned the in-folder R/G/R ledger's two renamed headings and will review both targets for a stampable receipt.
- 2026-09-28T01:32:00Z Combined feature-and-ledger review `1279e723-fb86-4cfc-8048-8e0a53f6d1ba` found the dogfood proof covered only the Claude runtime. Expanded it into a two-row outline for both shipped generated runtimes (`plugin/runtime/cli.js` and `packages/cli/codex-plugin/runtime/cli.js`); updated the dimensions map. Re-review required.
- 2026-09-28T01:42:37Z Independent Claude/Opus review `009c785f-fb0b-41f9-a7ed-54b19047b52f` approved all 45 scenario definitions and the synchronized ticket ledger. Corrected rule lineage and added an unmarked runtime-shaped rejection after the preceding review. Stamped the scenario gate and advanced to implementation planning.
- 2026-09-28T02:18:43Z Independent Claude/Opus plan review `bf252280-0822-4a26-85b9-c63781b01b5a` approved the plan after corrections for environment isolation, source races, every post-finalization result, JSON contracts, scenario bindings, and lazy Git lookup. Stamped the plan gate and advanced to implementation.

- 2026-09-28T04:00:00Z Independent Claude/Opus scenario review `4d844122-ad37-4db8-8ad2-091a72a08436` approved the corrected 46-scenario feature and ledger, including intermediate-symlink containment and both packet byte limits. Plan re-review `5b1557bc-91e4-4dea-9b90-bee668d25a99` approved the matching implementation plan; both phase stamps were recorded.
- 2026-09-28T04:00:00Z Implemented committed-HEAD generated classification, bounded packet capture, typed preflight failures, ordered error selection, reduced-scope reporting, public CLI and dogfood runtime proofs, and the updated published CLI contract. The implementation remains in progress pending remaining scenario proof, full verification, and independent implementation review.
- 2026-09-28T04:16:53Z Independent Claude/Opus implementation review `9b2e3c7d-c334-4bbc-92e7-7a08841f3850` requested changes because committed-tree isolation had no discriminating executable proof. Added public-command tests for conflicting committed, working-tree, `.git/info/attributes`, and inherited Git configuration; they pass in both marker directions. Also normalized Git paths for Windows, published the scope and stable failure codes in the command catalogue, and proved a reviewer-route failure retains the exclusion list. Remaining scenario ledger work and final verification are still pending.
