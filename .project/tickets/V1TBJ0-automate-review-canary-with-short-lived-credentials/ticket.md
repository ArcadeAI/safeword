---
id: V1TBJ0
slug: automate-review-canary-with-short-lived-credentials
type: task
phase: intake
status: in_progress
created: 2026-08-23T09:48:04.810Z
last_modified: 2026-08-23T09:48:04.810Z
---

# Keep the advisory review canary isolated from production repositories

**Goal:** Use short-lived GitHub App installation tokens against one fixed sandbox fork pair.

**Why:** The canary currently depends on one missing long-lived personal token, while the production App lacks the necessary sandbox authority.

## Scope

- Mint separate short-lived installation tokens restricted to the fixed base and fork repositories.
- Route each repository operation through the token for the repository it mutates.
- Update the fixed base fixture, exercise a temporary fork branch and pull request, and clean up
  those temporary resources independently.
- Document a dedicated smoke App rather than widening the production Safeword App.

## Out of Scope

- Changing the automatic advisory reviewer or its customer-facing workflows.
- Reusing the production Safeword App.
- Granting the smoke App access to production repositories.
- Replacing the disposable GitHub compatibility proof with a simulated test.

## Acceptance Criteria

- The canary generates one installation token for each fixed sandbox repository.
- No long-lived personal access token is stored or consumed by the workflow.
- Base and fork mutations use their corresponding repository token, including cleanup.
- Missing either token fails before creating a repository.
- Existing deterministic workflow-contract checks and the full repository suite pass.
- The live canary exercises the fixed fork pair and independently attempts pull-request, branch,
  and local cleanup even when an earlier cleanup action fails.

## Design Notes

GitHub documents that installation tokens expire after one hour. The dedicated smoke App is
installed for selected-repository access only on
`ArcadeAI/safeword-pr-review-smoke-base` and its real fork,
`TheMostlyGreat/safeword-pr-review-smoke-base`. The workflow cannot choose a different
repository at runtime, and neither installation grants the App production authority.

## Work Log

- 2026-08-23T09:48:04.810Z Started: Created ticket V1TBJ0
- 2026-08-23 Verified the existing Safeword App is unsuitable: it is installed only on
  ArcadeAI for selected repositories and grants only Issues write plus Metadata read.
