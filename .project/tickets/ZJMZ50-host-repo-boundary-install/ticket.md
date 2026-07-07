---
id: ZJMZ50
slug: host-repo-boundary-install
type: feature
phase: define-behavior
phase_anchors:
  - define-behavior: 0337cd9
status: in_progress
scope:
  - Hook-manager world detection (husky | lefthook | pre-commit | bare) computed once at plan time into ProjectContext
  - "TextPatchDefinition applicability predicate (when?: ctx => boolean) so schema entries can gate on the detected world"
  - Marker-guarded shim blocks appended to .husky/pre-commit and .husky/pre-push in husky hosts (create-if-absent), installing/healing/reverting via reconcile
  - Printed copy-paste integration snippets (self-quiescing nudge) for lefthook, pre-commit-framework, and bare worlds
  - Setup-into-temp-host tests across the four worlds (setup-core harness pattern)
out_of_scope:
  - Server-side required check / --at pr profile (#810 child 3)
  - Auto-editing lefthook.yml or .pre-commit-config.yaml (user-owned YAML — nudge only)
  - Writing .git/hooks directly (linked-worktree .git-file hazard; per-clone invisibility)
  - Bootstrapping husky into hosts that have no hook manager (gate-deferred; nudge instead)
  - Any change to the boundary engine or command semantics (CDRJTW owns those)
done_when:
  - Setup in a husky host appends both shims exactly once; re-running setup/upgrade is byte-idempotent
  - Pre-existing hook content in .husky/pre-commit and pre-push survives install and reset byte-for-byte
  - safeword reset removes the shim blocks (and only them)
  - Lefthook / pre-commit / bare hosts get a nudge with a verbatim-usable snippet, exactly once (self-quiescing)
  - Non-git directories get no hook writes and no nudge
  - Shim line is existence-guarded, explicit-path, whole-line-|| true (sh -e safe); scenarios prove a missing/broken binary never blocks
  - Feature scenarios green in the BDD lane; full suite green
created: 2026-07-07T04:23:13.747Z
last_modified: 2026-07-07T04:23:13.747Z
---

# Install the boundary gate into host repos via setup/upgrade (#810 child 2)

**Goal:** `safeword setup`/upgrade installs the boundary-gate shims into host repos' git hooks — coexisting with whatever hooks exist, healing on upgrade, reverting on reset, and never blocking a commit.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-07T04:23:13.747Z Started: Created ticket ZJMZ50
- 2026-07-07T04:57:27.759Z Phase: intake → define-behavior
