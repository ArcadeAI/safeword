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
- **Reversibility:** Two-way door. This adds a preflight and shared recovery
  contract before existing project-state dependencies. Explicit
  `safeword install` remains the only enrollment authority, and no customer
  state or public data format is migrated.

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
  workflow; decline preserves the repository and follows the workflow's
  declared stateless or stop behavior.
- **Success threshold:** Representative stateful workflows across supported
  agent surfaces reach the same preflight before every first project-state
  dependency, with a complete access inventory preventing unguarded paths.
  Automatically routed BDD and invocation proof are representative proofs, not
  special cases. Acceptance uses the bounded canonical install plan and resumes
  exactly once; decline and install failure create no unapproved state and never
  expose internal jargon. Already-enrolled workflows retain their current
  behavior without a prompt.
- **Project non-goals:** Automatically install or enroll Safeword, intercept
  unrelated customer files, invent project-authored knowledge before install,
  persist prompt-dismissal state outside the repository, weaken gates after
  enrollment, or redesign the contents of Safeword's managed artifacts.

## Jobs To Be Done

### quiet-unenrolled-reviews.NTB1 — Get a clear setup choice when Safeword needs state

**Persona:** Non-Technical Builder (NTB)

> When a Safeword workflow first needs project files in a new repository, I want
> a clear setup choice before anything changes, so I can enable the protection
> knowingly without diagnosing Safeword internals.

#### quiet-unenrolled-reviews.NTB1.R1 — State dependency triggers one enrollment choice

Before an unenrolled workflow first depends on Safeword-owned project state
beyond the enrollment check itself, it asks once whether to enroll and explains
the user-facing effect without naming invocation logs, markers, or internal
proof machinery. An explicitly invoked enrollment lifecycle operation does not
prompt recursively.

#### quiet-unenrolled-reviews.NTB1.R2 — Enrollment requires explicit consent

The repository remains unchanged until the builder accepts the enrollment offer;
acceptance invokes the canonical Safeword installation flow rather than creating
individual files or directories ad hoc.

#### quiet-unenrolled-reviews.NTB1.R3 — The initiating workflow resolves after the choice

After successful enrollment, the initiating workflow resumes exactly once. If
the builder declines, the state-dependent operation stops. Its higher-level
workflow may continue only through an explicitly supported stateless path; a
workflow whose guarantees require project state stops with a plain explanation.
Neither route repeats the prompt during the same operation.

#### quiet-unenrolled-reviews.NTB1.R4 — Resume follows the proven installation outcome

Safeword resumes only when the installation result proves the initiating
workflow's required setup succeeded. Cancellation or an unmet requirement does
not resume or retry the initiating operation; the existing installation result
and recovery remain authoritative.

#### quiet-unenrolled-reviews.NTB1.R5 — Existing Safeword workflows do not change

An enrolled repository receives no enrollment prompt and retains its current
state access, invocation-proof, and workflow-gate behavior.

## Shape

### M1 — Consent at the first project-state boundary

- **Outcome:** Every supported Safeword workflow receives the same enrollment
  decision before first access to project state, with truthful resume, decline,
  and installation-failure behavior.
- **Non-goals:** A persistent dismissal preference, automatic installation,
  workflow-specific enrollment copy, or changes to managed artifact contents.

## Killer Demo

> For a Non-Technical Builder invoking any Safeword workflow in a fresh
> repository, the exact first step that needs Safeword-owned project state asks
> once to set up the repository; filesystem observation independent of Safeword
> proves that only the enrollment check happened before consent, acceptance applies the bounded canonical plan
> and resumes once, and decline leaves the repository unchanged while preserving
> only an explicitly supported stateless path.

## Surfaces

- **Affected:** Claude Code
- **Affected:** OpenAI Codex
- **Affected:** OpenCode
- **Affected:** Cursor
- **Affected:** Safeword CLI
