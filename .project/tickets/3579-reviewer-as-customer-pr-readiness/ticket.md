---
id: '3579'
slug: reviewer-as-customer-pr-readiness
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/3579
scope:
  - Ship one reviewer-as-customer readiness workflow for preparing and promoting pull requests.
  - Require the issue's seven readiness conditions before a pull request leaves Draft.
  - Keep PR descriptions reviewer-oriented, scoped to the actual diff, and truthful about verification.
  - Carry the same contract through quality review, review-thread handling, and closeout.
  - Deliver the workflow with Claude Code, Cursor, Codex, and dogfood parity.
out_of_scope:
  - Automating GitHub review-thread replies or resolution through a new API client.
  - Replacing repository branch protection, CI, or human approval policy.
  - Treating Safeword's advisory PR reviewer as approval or merge evidence.
done_when:
  - A dedicated shipped workflow keeps a PR Draft until all seven issue-defined gates have current evidence.
  - The workflow builds a reviewer-oriented description without inventing verification or cumulative stack scope.
  - Review guidance requires replying before resolving, preserves disagreements, and re-requests review after material pushes.
  - Closeout refuses merge when reviewer-readiness evidence or unresolved review work is missing.
  - Canonical, installed dogfood, Cursor, and generated Codex surfaces stay in parity.
created: 2026-09-01T06:12:32Z
last_modified: 2026-09-01T07:26:28Z
---

# Make every ready PR understandable and immediately mergeable

**Type:** Internal improvement

**Scope:** Adopt #3579's reviewer-as-customer contract as the single PR-readiness workflow used before Ready promotion and carried through review and closeout.

**Out of Scope:** New GitHub API automation, branch-protection replacement, or any claim that AI review substitutes for human approval.

**Done When:**

- [x] Ready promotion is gated on the seven non-negotiables from #3579.
- [x] PR bodies orient the reviewer and report concrete, truthful evidence.
- [x] Review-thread and stacked-PR behavior follows the issue contract.
- [x] Shipped host surfaces and the dogfood install agree.

**Tests:**

- [x] Contract: the new PR-readiness skill is schema-registered and shipped to Claude, Cursor, and Codex.
- [x] Contract: the skill names all seven gates and the reviewer-oriented body fields.
- [x] Contract: incomplete end-user verification remains Draft and is reported as a blocker.
- [x] Contract: review threads are answered before resolution, disagreements stay unresolved, and material pushes re-request review.
- [x] Contract: SAFEWORD, quality-review, finish-review, and closeout route through the same readiness model.

## Work Log

- 2026-09-01T06:25:00Z Started from the complete contract embedded in GitHub issue #3579. The user's explicit “go tackle it” confirms scope; the inaccessible private announcement is not supplemented from memory.
- 2026-09-01T06:25:00Z Planning triage classified this as an internal task: multiple guidance surfaces, but no new product state or user flow. Chose one dedicated skill plus local boundary reminders over duplicated full checklists.
- 2026-09-01T07:26:28Z Shipped the canonical workflow to Claude, Cursor, Codex, OpenCode, plugin, and dogfood surfaces. Independent review found and drove fixes for unrequested PR-state mutation, fail-open required AI review, and an unobservable closeout handoff.
- 2026-09-01T07:26:28Z Final independent review approved. Focused and integration verification passed after refreshing the intentional Cursor/Codex lifecycle tree hashes; full-suite coverage remains yellow only for unrelated pre-existing/environmental failures documented in verify.md.
