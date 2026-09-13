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
  - establish one project-context resolution contract before every Safeword workflow first accesses project-owned state beyond the enrollment check
  - inventory and guard CLI commands, packaged helpers, generated agent workflows, and agent-authored artifact paths that can read or write Safeword project state
  - present one plain-language consent prompt per initiating operation with the bounded canonical install plan required by that workflow and host
  - after acceptance, apply the reviewed install plan and resume the initiating operation exactly once
  - discover an enrolled ancestor before offering a new repository install
  - use an enrolled ancestor automatically inside the same repository, and offer it as a storage choice when it belongs to a containing project
  - after decline, no response, prompt interruption, or install cancellation, create or reuse an isolated global project partition and continue the initiating workflow there
  - partition global project knowledge and mutable state by checkout identity without mutating the repository
  - when the repository is enrolled later, automatically hydrate its local namespace from global project data as part of the reviewed install plan without retiring the global partition
  - treat project-local state as a transparent overlay while preserving the existing global partition as a durable fallback snapshot
  - fall back to global state without prompting when a branch or checkout lacks the local overlay
  - resume after installation only when the initiating workflow's required setup is proven complete, without reclassifying the installer's result or recovery
  - exempt explicitly invoked enrollment lifecycle operations from recursively prompting themselves
  - preserve existing enrolled behavior, configured namespace roots, authored project knowledge, and invocation-proof gates
  - prove the shared contract across Claude Code, OpenAI Codex, OpenCode, Cursor, and the Safeword CLI
out_of_scope:
  - automatically enrolling or installing Safeword without explicit consent
  - prompting merely because a profile plugin loaded or a stateless capability ran without needing project state
  - intercepting or classifying unrelated customer files as Safeword state
  - requiring separate consent for user-private global state that is part of the installed Safeword runtime contract
  - redesigning managed artifact contents, BDD behavior, or review logic beyond enrollment recovery
  - installing unrelated agent integrations or development dependencies as part of the bounded enrollment plan
done_when:
  - every catalogued Safeword project-state access route checks enrollment before accessing state beyond the marker
  - a route with no usable local, enclosing, or global context prompts once in plain language before creating its project context
  - acceptance uses the bounded canonical install plan and resumes the exact initiating operation once
  - decline, no response, prompt interruption, and install cancellation leave the repository unchanged, select global state without a second prompt, resume once, and do not loop
  - every global fallback is isolated by checkout identity, private to the user, and reusable by later operations without repository mutation
  - later repository enrollment hydrates and verifies the local overlay without deleting the global partition or requiring a separate migration decision
  - project-local writes remain local, and a branch missing the local overlay continues automatically from the preserved global state
  - automatically routed BDD prompts before creating its ticket, spec, feature source, dimensions, or logs
  - no-ticket quality-review prompts before invocation logging and records proof in the selected global partition after repository enrollment is declined
  - enrolled repositories and custom namespace roots retain current workflow and gate behavior without an enrollment prompt
  - executable cross-surface and parity tests prevent a supported host or generated skill from bypassing the shared boundary
product_plan_contract: v1
created: 2026-09-12T05:20:43.360Z
last_modified: 2026-09-13T20:19:38.000Z
---

# Prompt for enrollment when Safeword first needs project state

**Goal:** Ask before Safeword first depends on project files, use local storage only with consent, and otherwise continue from an isolated global project partition.

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
- 2026-09-12T19:55:12.000Z Behavior correction during RED: User clarified
  that declining repository-local installation selects an isolated global
  Safeword project partition rather than stateless operation. Returned to
  define-behavior before further implementation; no-response and cancellation
  remain non-consent and create no state.
- 2026-09-12T20:00:28.472Z Behavior correction: User selected automatic global
  storage as Safeword's no-consent baseline. Decline, silence, interruption, or
  cancellation never authorize repository mutation, but they do create or
  reuse a user-private global partition and resume the initiating workflow.
  A later repository install must include verified migration and reconciliation
  of that partition in its reviewed plan before local state becomes authoritative.
- 2026-09-12T20:00:28.472Z Define-behavior revision: Re-derived 20 behavior
  dimensions and authored 56 scenarios under six numbered Rules using
  review-spec Authoring mode. Added enclosing-project selection, automatic
  global fallback for every non-acceptance path, checkout isolation, worktree
  partitioning, and plan-driven verified migration during later installation.
  Gherkin lint and feature-to-ledger parity pass; user completeness and split
  decisions remain open before returning to scenario-gate.
- 2026-09-13T04:17:01.068Z Behavior correction: User rejected retiring the
  global partition after local installation. Project-local state is now a
  transparent shadow over a durable, current global fallback. Hydration during
  install, ongoing write-through, and fallback when a branch lacks local files
  must be automatic and require no separate migration prompt.
- 2026-09-13T04:17:01.068Z Define-behavior revision: Reconciled the durable
  global backing-store decision into 22 dimensions and 59 scenarios. Added
  verified local hydration without global deletion, write-through continuity,
  invisible branch fallback, and an explicit stale-fallback failure. Gherkin
  lint and feature-to-ledger parity pass; completeness and split confirmation
  remain open.
- 2026-09-13T04:21:56.802Z Behavior correction: User rejected write-through
  from project-local state to global state. The global partition remains the
  preserved pre-install fallback snapshot; local changes stay local. Removed
  ongoing synchronization and its stale-mirror failure path. The current set is
  21 dimensions and 57 scenarios; Gherkin lint and ledger parity pass.
- 2026-09-13T05:24:29.988Z Define-behavior exit: User confirmed the revised
  57-scenario set, including preserved global fallback without write-through,
  and directed work to continue in the existing ticket after the split
  suggestion. Advanced to scenario-gate for a fresh independent review.
- 2026-09-13T05:27:00.000Z Scenario-gate review: Independent review
  `37be05ba-25df-4f72-9cf4-f134c47c7747` requested changes. It found one
  blocking invariant gap: no scenario proved that local writes leave the
  preserved global snapshot unchanged. Returned to define-behavior, added that
  proof plus explicit global-store failure, optional-state, corrupt-hydration,
  and missing-overlay partitions, and tightened route wiring and Rule ownership.
  The revised set contains 22 dimensions and 61 scenarios; Gherkin lint and
  feature-to-ledger parity pass.
- 2026-09-13T19:19:45.199Z Define-behavior exit: User confirmed the final
  failure boundary: when repository-local storage was not approved and private
  global storage is unavailable, Safeword stops with recovery guidance and
  leaves the repository untouched. All 61 behavior scenarios are confirmed;
  advanced to scenario-gate for independent re-review.
- 2026-09-13T19:23:00.000Z Scenario-gate review: Independent review
  `b3f19f5e-45a9-4e0c-b03c-b050bcfc842a` found the scenarios behaviorally
  sound but required a new packet because ticket-level exclusions were omitted.
  Tightened its non-blocking findings before redispatch: exact-checkout global
  state wins over an unrelated enclosing project, a real installed-artifact
  path proves decline-to-global resume, observable hydration cancellation
  replaces an authority label, worktree knowledge and mutable state are split,
  and custom namespace coverage now belongs to the overlay Rule. Current set:
  63 scenarios with passing Gherkin lint and exact ledger parity.
- 2026-09-13T19:31:00.000Z Scenario-gate review: Complete-context review
  `3e144bfd-b96a-48d3-b0a8-9f5020768f39` found one blocking proof weakness:
  two empty worktree partitions could falsely satisfy the knowledge-sharing
  scenario. Replaced it with a named record written in one linked worktree and
  read in the other. Also made reuse observable through named records, scoped
  quiet loading explicitly, removed cross-Rule plan wording, and covered the
  already-compatible hydration boundary. Current set: 64 scenarios.
- 2026-09-13T19:42:00.000Z Scenario-gate review: Ledger-inclusive review
  `3fbeefc4-b896-4128-9df3-cf86f3e1cdbb` exposed one blocking wording conflict:
  point-of-need observation allowed only the current marker read even though
  correct resolution also reads ancestor markers and probes checkout-global
  state. Made the read-only resolution allowance explicit while keeping every
  write forbidden. Also made local reuse and worktree isolation observable,
  bound custom-namespace hydration to global data, proved the global branch of
  the three-way context choice, and cleared the stale original RED mark. Current
  set: 65 scenarios with passing lint and exact ledger parity.
- 2026-09-13T19:49:00.000Z Scenario-gate review: Independent review
  `244bed31-5b6a-4892-a026-b98382b8a0ee` found one remaining precedence gap:
  current-local versus enrolled-ancestor resolution was not directly proven.
  Added the current-repository-wins case, made concurrent local reuse read a
  named value, made builder consent independently observable, split cancellation
  ownership, and covered deterministic interactive abandonment. Current set:
  69 scenarios with passing lint and exact ledger parity.
- 2026-09-12T16:50:34.000Z Plan-implementation exit: Independent Claude Opus
  review `48560a8c-ca96-4123-a055-ce9ac40079ce` approved the parse-valid plan
  with no blocking findings. Runtime-observer scope and captured real
  Codex/Cursor provenance remain implementation-proof obligations. Advanced to
  implement with a verified cross-agent review stamp.
- 2026-09-13T20:02:53.000Z Scenario-gate exit: Review
  `f39cd788-05ce-47fd-8bab-e82b62757bec` found one blocking independent-observer
  gap and five clarity issues. Corrected all six while preserving exact
  69-scenario ledger parity and passing Gherkin lint. The terminal retry
  `1a494c06-af84-464d-b67e-89cc95f75304` exhausted independent routes; under
  the configured `prefer` policy, the prescribed main-thread fallback approved
  the corrected live sources with no findings. Logged the non-independent skip
  explicitly; no independent provenance was claimed. No build-only kill-risk
  remains that code, repository contracts, and bounded tests cannot settle, so
  advanced to plan-implementation.
- 2026-09-13T20:19:38.000Z Plan-implementation exit: Figure-it-out selected a
  Git-native two-level global identity, root-level local shadowing without
  write-through, and canonical-plan hydration with activation last. Replaced
  the stale stop/stateless plan, updated the feature design and living
  architecture record, and passed the implement-entry parser. Review
  `efb852ae-8fa4-4462-ab07-222b85342816` exhausted independent routes; under
  the configured `prefer` policy, the prescribed main-thread fallback approved
  the frozen plan with no findings. Logged the non-independent skip explicitly
  and advanced to implement.
