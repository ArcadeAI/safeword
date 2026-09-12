---
id: EM9ZSV
slug: quiet-unenrolled-reviews
type: feature
phase: implement
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/EM9ZSV-quiet-unenrolled-reviews/spec.md'
  - 'scenario-gate: packages/cli/features/quiet-unenrolled-reviews.feature'
  - 'plan-implementation: .project/tickets/EM9ZSV-quiet-unenrolled-reviews/impl-plan.md'
scope:
  - establish one enrollment-preflight contract before every Safeword workflow first accesses project-owned state beyond the enrollment check
  - inventory and guard CLI commands, packaged helpers, generated agent workflows, and agent-authored artifact paths that can read or write Safeword project state
  - present one plain-language consent prompt per initiating operation with the bounded canonical install plan required by that workflow and host
  - after acceptance, apply the reviewed install plan and resume the initiating operation exactly once
  - after decline, stop the state-dependent operation and continue only through an explicitly declared stateless path
  - resume after installation only when the initiating workflow's required setup is proven complete, without reclassifying the installer's result or recovery
  - exempt explicitly invoked enrollment lifecycle operations from recursively prompting themselves
  - preserve existing enrolled behavior, configured namespace roots, authored project knowledge, and invocation-proof gates
  - prove the shared contract across Claude Code, OpenAI Codex, OpenCode, Cursor, and the Safeword CLI
out_of_scope:
  - automatically enrolling or installing Safeword without explicit consent
  - prompting merely because a profile plugin loaded or a stateless capability ran without needing project state
  - intercepting or classifying unrelated customer files as Safeword state
  - persisting a declined choice outside an enrolled repository
  - redesigning managed artifact contents, BDD behavior, or review logic beyond enrollment recovery
  - installing unrelated agent integrations or development dependencies as part of the bounded enrollment plan
done_when:
  - every catalogued Safeword project-state access route checks enrollment before accessing state beyond the marker
  - an unenrolled route prompts once in plain language before any Safeword project state is created or consumed
  - acceptance uses the bounded canonical install plan and resumes the exact initiating operation once
  - decline, cancellation, and unmet installation requirements leave no unapproved Safeword state, preserve the installer's truthful result, and do not loop
  - stateless continuation exists only where the workflow explicitly declares and proves it; required-state workflows stop plainly
  - automatically routed BDD prompts before creating its ticket, spec, feature source, dimensions, or logs
  - no-ticket quality-review prompts before invocation logging and can continue review after a declined enrollment without retrying proof
  - enrolled repositories and custom namespace roots retain current workflow and gate behavior without an enrollment prompt
  - executable cross-surface and parity tests prevent a supported host or generated skill from bypassing the shared boundary
product_plan_contract: v1
created: 2026-09-12T05:20:43.360Z
last_modified: 2026-09-12T16:50:34.000Z
---

# Prompt for enrollment when Safeword first needs project state

**Goal:** Ask before Safeword first depends on its project files or directories, then enroll only with explicit consent and resume the initiating workflow.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-12T05:20:43.360Z Started: Created ticket EM9ZSV
- 2026-09-12T05:24:00.000Z Intake: Figure-it-out compared silent no-op,
  explicit not-applicable, and lazy-enrollment designs. Chose an internal
  not-applicable signal plus silent review continuation; drafted the Product Bet
  and Technical Builder job for user confirmation.
- 2026-09-12T05:26:00.000Z Intake revision: User identified enrollment as the
  useful recovery action. Considered prompting before, during, or after review.
  User selected a one-time consent prompt before review; decline preserves the
  requested review without mutation.
- 2026-09-12T05:29:00.000Z Scope correction: User generalized the trigger from
  quality-review to the first point any Safeword workflow needs project-owned
  files or directories. Reconciled this with the existing explicit-enrollment
  architecture: one shared preflight prompts before state access; successful
  canonical install resumes the initiating workflow; decline never mutates the
  repository.
- 2026-09-12T05:35:00.000Z Figure-it-out: Compared strict stop, declared
  stateless degradation, and universal informal fallback. Current Apple,
  Android, and VS Code guidance supports point-of-need consent plus bounded
  restricted behavior. Chose fail-closed state access with continuation only
  where the higher-level workflow explicitly supports a stateless path.
- 2026-09-12T05:42:00.000Z Intake: User accepted the rules. Drafted one
  milestone spanning the shared state boundary and all supported agent surfaces,
  with the observed no-ticket review as the Killer Demo.
- 2026-09-12T05:45:00.000Z Killer Demo revision: User named Safeword's automatic
  BDD routing as a first-class trigger. Made the pre-ticket BDD boundary the
  decisive demo and retained no-ticket quality-review as the optional-state
  partition.
- 2026-09-12T05:47:00.000Z Scope correction: User rejected example-led trigger
  framing. Generalized the milestone, Killer Demo, and engineering scope to every
  Safeword-owned project-state access path; BDD and quality-review remain only
  representative required-state and optional-state proofs.
- 2026-09-12T05:51:00.000Z Intake self-review: Tightened installation failure
  from an impossible all-or-nothing claim to prerequisite-proven resume with
  truthful partial effects, and exempted explicitly invoked enrollment
  lifecycle operations from recursive prompts.
- 2026-09-12T05:52:00.000Z Intake exit: User accepted the universal
  project-state boundary and engineering scope. Corrected spec passed the
  content-bound self-review and advanced to define-behavior.
- 2026-09-12T05:55:00.000Z Define-behavior correction: The scenario creation
  gate rejected code-formatted persona syntax. Corrected the spec to the
  catalogue's canonical `Non-Technical Builder (NTB)` form before retrying.
- 2026-09-12T05:58:00.000Z Authoring review: Removed a duplicate partial-install
  reporting contract; this feature consumes the existing installer result and
  owns only prerequisite-proven resume. Added direct prompt-language coverage.
- 2026-09-12T05:54:41.092Z Define-behavior exit: User confirmed the then-current 21 named
  scenarios fully describe the intended behavior and important boundaries.
  Advanced the executable feature source and matching test ledger to the
  independent scenario-quality gate.
- 2026-09-12T05:59:00.000Z Scenario gate: Independent reviewer routes were
  unavailable, so the bounded fresh-context fallback reviewed the accepted
  targets. It found that concurrent enrollment could resume without proving
  required setup. Split that case into sufficient and insufficient outcomes;
  resume now remains prerequisite-gated without duplicate installation.
- 2026-09-12T06:12:57.000Z Scenario gate retry: At the user's request,
  revalidated the then-current corrected 22-scenario source and launched a fresh independent
  review. Claude Opus and Sonnet and the Codex fallback again exited with
  `process_failed`; OpenCode remained unavailable. No independent review was
  recorded, so the ticket remains at scenario-gate.
- 2026-09-12T16:23:41.000Z Scenario-gate exit: Independent Claude Opus review
  `691a8da1-f9e4-41d7-88ae-87aa3694da70` approved the final 41-scenario feature
  and exact R/G/R ledger with no blocking findings. All review-blocking issues
  were resolved; cross-surface positive consent, abandoned-choice handling, and
  out-of-repository dismissal observation remain explicit implementation-proof
  obligations. Advanced to plan-implementation with a verified cross-agent
  review stamp.
- 2026-09-12T16:50:34.000Z Plan-implementation exit: Independent Claude Opus
  review `48560a8c-ca96-4123-a055-ce9ac40079ce` approved the parse-valid plan
  with no blocking findings. Runtime-observer scope and captured real
  Codex/Cursor provenance remain implementation-proof obligations. Advanced to
  implement with a verified cross-agent review stamp.
