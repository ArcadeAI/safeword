---
id: XGQQT2
slug: retro-runtime-context
type: feature
phase: implement
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/XGQQT2-retro-runtime-context/spec.md'
  - 'scenario-gate: features/retro-runtime-context.feature'
  - 'plan-implementation: .project/tickets/XGQQT2-retro-runtime-context/impl-plan.md'
external_issue: https://github.com/ArcadeAI/safeword/issues/3429
scope:
  - Widen the existing v1 public-retro source authority for Cursor and honest unknown execution class while preserving released submissions
  - Preserve the locally generated project UUID across installs and upgrades
  - Derive one bounded source shape for Claude, Codex, and Cursor runtimes
  - Include repository, harness, host class, SafeWord CLI version, and OS family from trustworthy local carriers
  - Preserve released agent/model/plugin fields for compatibility and future documented carriers without emitting speculative values today
  - Keep every enrichment field optional and make derivation failure silent
  - Validate and durably preserve the exact canonical envelope in the existing public collector
out_of_scope:
  - User registration, authentication, identity merging, dashboards, or general analytics
  - Email, hostname, IP address, machine identifiers, source code, transcripts, command arguments, or arbitrary environment variables
  - Enabling the hosted relay readiness manifest or changing private relay delivery
  - Exact Claude/Codex cloud classification and carrier readiness, tracked in GitHub issue #3430
  - Retention policy, cleanup automation, or historical backfill
done_when:
  - Setup creates one UUID when absent and repeat setup or upgrade preserves it
  - Supported harnesses serialize the same closed source schema without guessing whether ambiguous execution is local or cloud
  - Missing or malformed optional signals are omitted independently without failing or printing during retro delivery
  - Git-config email and cloud-only actor signals are never emitted by the local producer
  - The real CLI-to-collector path stores and returns the canonical envelope with context, while legacy valid envelopes remain accepted
  - Contract, fault-injection, real-collaborator, packaged-path, and full verification suites pass
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-27T00:16:02.862Z
last_modified: 2026-08-27T17:34:00Z
---

# Attach useful runtime context to retros without signup

**Goal:** Give maintainers enough privacy-bounded runtime context to understand retro findings while keeping capture silent and registration-free.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

**Follow-ups:** Issues #3430 and #3440 own cloud carrier/classification and
legacy `userIdentity` retention respectively. Neither is an initial local-launch
gate.

## Work Log

- 2026-08-28T07:14:00Z Closed independent review: Bound Cursor public egress to real hook-stashed transcript, conversation, and project state; released failed handoff claims for later retry; pinned live hook runtime metadata, Git precedence, declared collector rows, and refreshed installed lifecycle goldens
- 2026-08-28T06:30:46Z Tightened after review: Current producers now omit the unprovable plugin version, Cursor carries its paired conversation identity into public delivery, both private recovery lanes persist before public handoff, runtime values share one bounded normalizer, and the real collector rejects Cursor-only legacy identity leakage
- 2026-08-28T07:45:00Z Tightened after final review: Current producers omit undocumented agent/model environment signals alongside plugin version, Git credential and email privacy are proved on canonical envelope bytes, accepted submissions retain their local claim if receipt persistence misses the deadline, and Cursor state writes refuse symlinks
- 2026-08-28T08:52:00Z Fixed independent review blocker: Headless extraction now receives a shared runtime allowlist plus only the selected agent's credentials; Cursor receives no vendor credentials, and a regression test proves arbitrary, Anthropic, AWS, and OpenAI secrets do not reach its child
- 2026-08-27T17:34:00Z Transitioned: plan-implementation → implement after independent cross-agent approval of the seven-slice plan, including released-byte compatibility, Cursor opt-out, and explicit low-volume collector-before-tag sequencing
- 2026-08-27T17:25:00Z Avoided release-platform scope creep: Kept the existing manual annotated-tag boundary after full packaged matrix proof and Railway health, and recorded the low-volume operational risk instead of adding a public capability, synthetic production rows, or a new tag workflow
- 2026-08-27T17:18:00Z Corrected release mechanism: Replaced durable synthetic submissions with a validator-derived, non-writing health capability and deployed SHA; the pre-tag workflow creates the tag and invokes reusable publish jobs directly after Railway auto-deploy is verified
- 2026-08-27T17:12:00Z Corrected release ordering: Replaced the too-late tag-triggered probe with a pre-tag workflow that verifies Claude/Codex/Cursor unknown plus legacy Claude/local, then alone creates the annotated tag for npm and both Git-backed marketplaces
- 2026-08-27T17:05:00Z Re-approved: Independent cross-agent scenario gate approved and stamped the current contract after the Cursor-specific opt-out and collector UUID-boundary simplification
- 2026-08-27T17:00:00Z Simplified scenario boundary: Removed the redundant collector uppercase-UUID rejection row; install-time lowercase normalization remains covered and collector UUID compatibility remains characterized from released behavior
- 2026-08-27T16:55:00Z Strengthened launch gate: Made the new Cursor route's project opt-out explicit and required a deployed-collector cursor/unknown probe in the release-contract lane before any tagged CLI or marketplace distribution can publish
- 2026-08-27T16:44:00Z Re-approved: Independent cross-agent scenario gate approved the current 44-scenario contract after removing new GitHub Actions suppression and adding missing Cursor conversation-identity recovery; the current scenario stamp was written
- 2026-08-27T16:43:00Z Clarified plan: Cursor projects gain first public egress with the existing opt-out, released Claude Remote suppression creates a documented dataset gap, and all per-harness collector hygiene remains deferred to #3440 to avoid implicit v1 revisions
- 2026-08-27T16:35:00Z Corrected scope: Dropped the unshipped GitHub Actions delivery denial, preserved only the existing Claude Remote suppression, assigned project-identity lifecycle implementation ownership, and defined silent recovery for missing Cursor conversation identity
- 2026-08-27T16:29:00Z Corrected plan: Made collector compatibility a harness/host-class matrix and assigned new GitHub Actions plus harness-scoped Claude cloud suppression to producer wiring; documented the legacy-to-current host-class data seam
- 2026-08-27T16:23:00Z Re-approved: Independent cross-agent scenario gate approved the final 43-scenario contract after hermetic cloud evidence, authoritative derived-field boundaries, envelope-version rejection, privacy sentinels, and released compatibility were pinned
- 2026-08-27T16:12:00Z Clarified: Cursor parity covers the supported project/repository/harness/CLI/OS facts; Cursor currently exposes no supported agent, model, or separate plugin-version signal; exact public Git host matching is pinned against suffix and subdomain confusion
- 2026-08-27T16:08:00Z Privacy: Restricted new repository enrichment to GitHub and GitLab so self-hosted/internal remote names cannot reach the public collector
- 2026-08-27T16:03:00Z Simplified: Removed the unproven 100 ms enrichment budget; optional synchronous reads remain field-independent inside the existing preparation flow with no second timing authority
- 2026-08-27T15:58:00Z Re-approved: Independent cross-agent scenario gate approved the simplified 40-scenario contract after adding Cursor conversation-identity dedupe and transport-failure coverage
- 2026-08-27T15:55:00Z Pinned: Cursor `conversation_id` flows through the shared run identity and explicit retro `--session-id`; added same/different-session real-lifecycle dedupe proof
- 2026-08-27T15:27:00Z Simplified: Removed Cursor filesystem proof and eligibility gating because it added no information beyond harness; every new producer now reports honest `hostClass: unknown`, with exact classification left to #3430
- 2026-08-27T09:00:00Z Corrected: Current platform docs show cloud setup can reproduce filesystem/profile proof, so Claude and Codex now report `hostClass: unknown`; Cursor alone reports `local` from its local-only session event, with exact cloud classification left to #3430
- 2026-08-27T06:52:00Z Narrowed: Kept one widened v1 contract and deferred `GITHUB_ACTOR` with GitHub Actions/cloud classification to #3430, avoiding an unreachable local field, false `hostClass`, and a permanent second validator
- 2026-08-27T06:35:00Z Corrected: Versioned the tightened current contract as v2 because actor-absent current envelopes are indistinguishable from installed v1 clients; collector-first rollout preserves v1 byte authority and avoids a duplicate source revision marker
- 2026-08-27T03:36:00Z Transitioned: scenario-gate → plan-implementation after independent cross-agent approval of 27 local-only scenarios; no build-only spike remains because cloud carrier proof is deferred to #3430
- 2026-08-27T03:28:00Z Pinned rollout: Local collector rejects undefined/cloud host classes until #3430 widens it; added direct first-writer session-scope proof and deterministic U+0007/JSON-number/controlled-clock fixtures
- 2026-08-27T03:21:00Z Closed boundaries: Added whole-envelope path sentinel rejection, the exact 257-byte multibyte edge, explicit omission of all required fields, fully valid legacy fixtures, bounded slow enrichment, actor trim-before-bound proof, and public non-GitHub remote behavior
- 2026-08-27T03:13:00Z Finalized: Added collector required-field rejection, pinned multi-byte bounds and SSH remotes, made first-client-claim dedupe ownership explicit, and proved slow enrichment respects the existing preparation budget without new concurrency machinery
- 2026-08-27T03:05:00Z Focused: Moved dedupe proof to the real delivery/collector boundary, made legacy compatibility a real-collector assertion, removed the reviewer-induced uppercase-UUID scenario, and deferred cloud vocabulary to #3430
- 2026-08-27T02:58:00Z Reconciled: Removed the contradictory boundary row, pinned distinct CLI/plugin values and project identity, proved collector acceptance at 256 bytes and rejection of non-local vocabulary, made bad remotes literal, and added one-reader fault isolation
- 2026-08-27T02:52:00Z Corrected: Made local Claude/Codex/Cursor parity exact, added collector-side value rejection, covered transcript/source sentinels, canonical UUID and actor handling, malformed remotes, distinct empty/blank inputs, and exact minimal-source degradation
- 2026-08-27T02:44:00Z Narrowed: User chose local-first delivery; moved Claude/Codex/Cursor cloud carrier proof and classification to GitHub issue #3430 and returned the scenario set to local runtime behavior
- 2026-08-27T02:36:00Z Tightened: Seeded forbidden-value sentinels, bound the complete source and surviving optional values exactly, named non-authoritative dedupe differences, and replaced wall-clock language with a direct no-new-retry/timer/background-task guarantee
- 2026-08-27T02:29:00Z Bound: Pinned agent/model/plugin/OS values to exact runtime inputs, made Claude-cloud precedence deterministic, covered absent host signals and the accepted actor boundary, strengthened email non-collection, and kept unsupported harnesses out of scope
- 2026-08-27T02:22:00Z Strengthened: Made partial-field failure and actual submission observable; pinned exact cloud signals, actor rejection boundaries, distinct local UUIDs, the complete source key set, and rejection when legacy and current actor fields compete
- 2026-08-27T02:16:00Z Reviewed: Independent cross-agent scenario review requested changes; added first-install creation, discriminating dedupe inputs, credential stripping, both sides of the 256-byte boundary, current collector round-trip, minimal-source coverage, concrete cloud signals, and measurable silence/recovery outcomes
- 2026-08-27T01:12:00Z Transitioned: define-behavior → scenario-gate after user confirmation of 13 scenarios covering all five Rules and seven affected runtime/service surfaces
- 2026-08-27T01:04:00Z Transitioned: Intake → define-behavior after user scope approval and cold-start reconciliation
- 2026-08-27T01:02:00Z Decided: Kept the existing v1 source envelope, added bounded Cursor/cloud/actor semantics, preserved byte-identical legacy storage and dedupe identity, and chose unknown over guessed cloud classification after a cold-start review exposed six contract ambiguities
- 2026-08-27T00:48:00Z Scoped: Reconciled the proposal with the existing public-retro route; retained its project UUID, canonical envelope, raw-body SQLite durability, and dedupe boundaries while limiting new work to cross-runtime parity and privacy-safe source derivation
- 2026-08-27T00:38:17Z Defined: Drafted five product Rules covering stable local identity, cross-harness context parity, content exclusion, passive actor attribution, and silent failure
- 2026-08-27T00:32:31Z Researched: Compared PostHog anonymous identity, OpenTelemetry resource conventions, and Sentry category-level privacy; selected one optional versioned context object over issue prose or a parallel analytics stream
- 2026-08-27T00:16:29Z Framed: Recorded the registration-free, silent runtime-context job and linked GitHub issue #3429
- 2026-08-27T00:16:02.862Z Started: Created ticket XGQQT2
