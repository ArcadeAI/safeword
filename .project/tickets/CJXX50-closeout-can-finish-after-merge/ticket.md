---
id: CJXX50
slug: closeout-can-finish-after-merge
type: patch
phase: verify
status: in_progress
created: 2026-08-04T00:12:56.287Z
last_modified: 2026-08-04T01:15:46.000Z
---

# Let authenticated closeout finish after merge

**Goal:** Let Codex Desktop authenticate closeout and keep mutable dependency policy from stranding cleanup of immutable merged heads.

**Why:** Dogfooding left three merged delivery worktrees preserved despite successful delivery evidence.

**Tracker:** #1856; related dependency-policy bug #1857.

**Scope:**

- reuse the established `CODEX_THREAD_ID` fallback when no fresh Codex hook binding exists;
- keep a fresh hook binding authoritative when one exists;
- keep dependency auditing in delivery-time `/verify`, but exclude it from the post-merge cleanup recheck;
- cover both dogfooded failure modes in the existing closeout feature and focused automated tests.

**Out of scope:**

- weakening exact PR/ref/worktree identity checks or cleanup compare-and-swap behavior;
- bypassing dependency audit before merge;
- changing Claude Code or Cursor identity resolution.

**Done when:**

- Codex Desktop can preview closeout from its authenticated thread environment without a hook cache;
- hook bindings still take precedence and missing identity still fails closed;
- post-merge verification runs verify, build, typecheck, and BDD but not dependency audit;
- focused tests, full verification, audit, parity, and quality review pass.

## Work Log

- 2026-08-04T00:12:56.287Z Started: Created ticket CJXX50
- 2026-08-04T00:18:00.000Z Revalidated: #1856 still fails on current main; PR #1833 remains stranded by a newly failing dependency audit on its immutable merged head. Filed #1857 for the policy deadlock.
- 2026-08-04T00:19:00.000Z Decided: Reuse SafeWord's existing Codex Desktop `CODEX_THREAD_ID` identity fallback with hook precedence. Preserve dependency audit as a pre-merge `/verify` gate and rerun only deterministic code-state lanes after merge.
- 2026-08-04T01:15:46.000Z Verified: Full unit, Gherkin, build, typecheck, lint, dependency, parity, and architecture lanes pass. A real PR #1855 closeout preview authenticated through Codex Desktop and produced a safe exact-OID cleanup plan without rerunning dependency audit.
