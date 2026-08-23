---
id: V1TBJ0
slug: automate-review-canary-with-short-lived-credentials
type: task
phase: intake
status: in_progress
created: 2026-08-23T09:48:04.810Z
last_modified: 2026-08-23T09:48:04.810Z
---

# Keep the advisory review canary independent of personal credentials

**Goal:** Use short-lived GitHub App installation tokens for both disposable sandbox owners.

**Why:** The canary currently depends on one missing long-lived personal token, while the production App lacks the necessary sandbox authority.

## Scope

- Mint separate short-lived installation tokens for the base and fork sandbox owners.
- Route each repository operation through the token for the owner it mutates.
- Keep the existing create, exercise, and permanent-cleanup canary behavior.
- Document a dedicated smoke App rather than widening the production Safeword App.

## Out of Scope

- Changing the automatic advisory reviewer or its customer-facing workflows.
- Reusing the production Safeword App.
- Granting the smoke App access to production repositories.
- Replacing the disposable GitHub compatibility proof with a simulated test.

## Acceptance Criteria

- The canary generates one installation token for each configured sandbox owner.
- No long-lived personal access token is stored or consumed by the workflow.
- Base and fork mutations use their corresponding owner token, including cleanup.
- Missing either token fails before creating a repository.
- Existing deterministic workflow-contract checks and the full repository suite pass.
- The live canary creates, exercises, and deletes both disposable repositories.

## Design Notes

GitHub documents that installation tokens expire after one hour and that creating an
organization repository requires repository Administration write permission. Creating a
fork with an installation token additionally requires Contents read and an all-repositories
installation on both source and destination accounts. The dedicated smoke App therefore
uses all-repositories installations only on the two sandbox owners; it is not installed on
production owners.

## Work Log

- 2026-08-23T09:48:04.810Z Started: Created ticket V1TBJ0
- 2026-08-23 Verified the existing Safeword App is unsuitable: it is installed only on
  ArcadeAI for selected repositories and grants only Issues write plus Metadata read.
