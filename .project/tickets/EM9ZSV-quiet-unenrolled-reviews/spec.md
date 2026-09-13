# Product Plan: Prompt for enrollment when Safeword first needs project state

<!-- safeword:product-plan-contract:v1 -->

## Intake Brief

- **Who asked:** Alex, after a no-ticket quality review in a new project exposed
  Safeword's invocation-log fallback instead of offering setup when Safeword
  first needed project state.
- **Cost of inaction:** Every affected review spends attention on bookkeeping
  that cannot gate no-ticket work, and every other stateful workflow is left to
  improvise its own missing-enrollment recovery. Users see internals instead of
  receiving one clear setup choice at the moment it becomes relevant.
- **Reversibility:** Two-way door. Repository installation remains explicitly
  approved and plan-driven. Until then, Safeword stores project knowledge and
  state in an isolated user-private global partition. A later approved install
  hydrates a project-local overlay from that partition; the preserved global
  copy remains available if a branch or checkout later lacks the overlay.

## Product Bet

- **Problem / Why now:** Packaged Safeword workflows can run in repositories
  that have not been explicitly enrolled. When one first needs a Safeword-owned
  file or directory, current behavior either exposes a low-level
  `PROJECT_NOT_ENROLLED` result or fails open without offering the useful
  recovery action. Quality-review invocation proof and automatically routed BDD
  are examples; the product boundary is every Safeword-owned project-state
  dependency. Error guidance says messages should be clear, concise, and
  recovery-oriented
  ([GOV.UK Design System](https://design-system.service.gov.uk/components/error-message/),
  [Nielsen Norman Group](https://www.nngroup.com/articles/error-message-guidelines/)).
  Established permission systems likewise ask at the point of need and preserve
  only explicitly supported restricted behavior after denial
  ([Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/privacy),
  [Android permission guidance](https://developer.android.com/training/permissions/requesting),
  [VS Code Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust)).
- **Expected outcome:** At the first state dependency of an unenrolled Safeword
  workflow, the builder receives one plain-language enrollment choice before
  any Safeword-owned project state beyond the enrollment marker is accessed.
  Acceptance runs the canonical installation flow and resumes the initiating
  workflow. Decline, silence, interruption, or cancellation preserves the
  repository and continues the same workflow from an isolated global project
  partition without a second prompt.
- **Success threshold:** Representative stateful workflows across supported
  agent surfaces reach the same preflight before every first project-state
  dependency, with a complete access inventory preventing unguarded paths.
  Automatically routed BDD and invocation proof are representative proofs, not
  special cases. Acceptance uses the bounded canonical install plan and resumes
  exactly once; every non-acceptance route leaves the repository unchanged and
  selects the same reusable global partition without exposing internal jargon.
  Later installation hydrates a local overlay through the reviewed plan without
  loss or silent overwrite. Subsequent local work stays local; already-enrolled
  workflows retain their current behavior without a prompt.
- **Project non-goals:** Automatically install or enroll Safeword in a
  repository, intercept unrelated customer files, treat global fallback as
  consent for repository mutation, weaken gates after enrollment, or redesign
  the contents of Safeword's managed artifacts.

## Jobs To Be Done

### quiet-unenrolled-reviews.NTB1 — Get a clear setup choice when Safeword needs state

**Persona:** Non-Technical Builder (NTB)

> When a Safeword workflow first needs project files in a new repository, I want
> a clear setup choice before anything changes, so I can enable the protection
> knowingly without diagnosing Safeword internals.

#### quiet-unenrolled-reviews.NTB1.R1 — State dependency resolves the nearest usable project context

Before a workflow first depends on Safeword-owned project state beyond the
enrollment check itself, it searches upward for enrolled project context. State
inside the same repository is reused without prompting; an enrolled containing
project is offered as a choice alongside local setup. If no project context is
selected, it asks once whether to enroll the current repository and explains
the user-facing effect without naming invocation logs, markers, or internal
proof machinery. An explicitly invoked enrollment lifecycle operation does not
prompt recursively.

#### quiet-unenrolled-reviews.NTB1.R2 — Repository enrollment requires explicit consent

The repository remains unchanged until the builder accepts the enrollment offer;
acceptance invokes the canonical Safeword installation flow rather than creating
individual files or directories ad hoc. Decline, silence, interruption, and
cancellation never authorize repository mutation.

#### quiet-unenrolled-reviews.NTB1.R3 — Global storage is the automatic fallback

If repository-local storage is not accepted or cannot complete, Safeword creates
or reuses one user-private global project partition and continues the initiating
workflow there without another prompt. Unrelated checkouts cannot observe one
another's global project knowledge or mutable state, while later operations for
the same checkout reuse the same partition.

#### quiet-unenrolled-reviews.NTB1.R4 — The initiating workflow resumes once from the selected context

Safeword resumes exactly once from an enclosing project, a proven local install,
or the global fallback selected for the checkout. A failed handoff never replays
the operation, and a concurrent local install is reused only when it satisfies
the initiating workflow's requirements.

#### quiet-unenrolled-reviews.NTB1.R5 — Existing Safeword workflows do not change

An enrolled repository receives no enrollment prompt and retains its current
state access, invocation-proof, and workflow-gate behavior.

#### quiet-unenrolled-reviews.NTB1.R6 — Local installation shadows a durable global fallback

When a repository with global Safeword data is later installed locally, the
canonical install automatically hydrates all compatible project knowledge and
mutable state into the selected namespace, surfaces conflicts instead of
silently overwriting either side, and verifies the local overlay before using
  it. The global partition is never retired or silently updated from local
  changes. Any branch or checkout missing the overlay falls back to the
  preserved global snapshot. A cancelled or failed hydration leaves global
  state authoritative.

## Shape

### M1 — Consent at the first project-state boundary

- **Outcome:** Every supported Safeword workflow resolves the same enclosing,
  local, or isolated-global project context before first state access, with
  explicit consent only for repository mutation and a durable global fallback
  beneath any local overlay.
- **Non-goals:** Automatic repository installation, workflow-specific storage,
  or changes to managed artifact contents.

## Killer Demo

> For a Non-Technical Builder invoking any Safeword workflow in a fresh
> repository, the exact first step that needs Safeword-owned project state asks
> once to set up the repository; filesystem observation independent of Safeword
> proves that only the enrollment check happened before consent, acceptance
> applies the bounded canonical plan and resumes once, and any non-acceptance
> leaves the repository unchanged while the workflow continues once from an
> isolated global project partition. A later approved install automatically
> hydrates a local overlay while preserving the global fallback unchanged;
> switching to a branch without that overlay continues from global state.

## Surfaces

- **Affected:** Claude Code
- **Affected:** OpenAI Codex
- **Affected:** OpenCode
- **Affected:** Cursor
- **Affected:** Safeword CLI
