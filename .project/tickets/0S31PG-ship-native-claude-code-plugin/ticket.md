---
id: 0S31PG
slug: ship-native-claude-code-plugin
type: feature
phase: verify
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/0S31PG-ship-native-claude-code-plugin/spec.md'
  - 'scenario-gate: features/native-claude-plugin.feature'
  - 'plan-implementation: .project/tickets/0S31PG-ship-native-claude-code-plugin/impl-plan.md'
  - 'implement: .project/tickets/0S31PG-ship-native-claude-code-plugin/test-definitions.md'
  - 'verify: .project/tickets/0S31PG-ship-native-claude-code-plugin/test-definitions.md'
scope:
  - Generate a complete native Claude plugin from canonical Safeword hooks, skills, commands, agents, and their transitive runtime/reference assets.
  - Add user-scoped `safeword claude install`, read-only `status`, explicit project-scoped `cleanup`, and conflict-safe `recover` lifecycle commands with versioned JSON results.
  - Support live-task activation through Claude's `/reload-plugins`, with exact plugin identity proof recorded by SessionStart or the next UserPromptSubmit event.
  - Migrate with Expand -> Prove -> Contract so viable legacy Claude protection remains authoritative until a current plugin proof exists and cleanup is explicitly confirmed.
  - Remove only fingerprinted Safeword-owned Claude hooks, skills, commands, agents, and settings fragments through an atomic recoverable transaction while preserving user and third-party content.
  - Guard plugin generation, marketplace/version alignment, cache execution, lifecycle safety, and cross-host workflow parity with public integration, release, BDD, and opt-in live tests.
out_of_scope:
  - Automatically accepting plugin or workspace trust, or programmatically forcing Claude's interactive `/reload-plugins` command.
  - Project-scoped plugin installation by default; teams may opt into Claude's project scope separately.
  - Preserving unnamespaced legacy slash-command aliases after cleanup; native plugin workflows use `/safeword:<skill>`.
  - Removing project assets still required by Cursor, project instructions, language tooling, or the status line until their own native boundary exists.
  - Migrating Cursor's plugin lifecycle or changing the existing Codex plugin lifecycle beyond shared parity/reusable safety helpers.
  - Claiming full Claude Code Cloud or Claude Desktop parity for local profile, marketplace-cache, or trust behavior.
done_when:
  - Fresh project setup does not materialize Claude-only legacy assets and points users to an explicit user-scoped plugin install; ordinary upgrades never install a profile plugin or remove legacy protection.
  - Install verifies the official marketplace identity and an enabled exact plugin version, is repeatable, and never changes project files.
  - After install or update, `/reload-plugins` makes the new plugin available without restarting the task; the next prompt or a new session records proof bound to the bundled identity and hook-manifest digest.
  - Status is read-only and distinguishes unsupported-host, missing, disabled, wrong-version, errored, unproven, coexistence, cleanup-ready, recovery-required, and plugin-mode states with one safe next action.
  - Cleanup performs no marketplace, plugin, enablement, update, reload, or trust mutation and refuses missing, stale, malformed, or conflicting proof/configuration.
  - Cleanup preserves user-authored and third-party settings, hooks, skills, commands, and agents; interruption or concurrent edits produce recoverable state without overwrite.
  - The installed cache runs hooks after the marketplace source plugin directory is unavailable, and automated tests distinguish cache execution from marketplace health.
  - Release, schema, catalogue, documentation, and parity checks fail on missing, unexpected, stale-version, or behaviorally unmapped Claude plugin assets.
created: 2026-08-02T15:35:27.838Z
last_modified: 2026-08-02T21:28:13Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1785
---

# Ship native Claude Code plugin for Safeword users

**Goal:** Deliver Safeword's framework-owned Claude Code surfaces through a native plugin with a safe, explicit legacy migration path.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-02T15:35:27.838Z Started: Created ticket 0S31PG
- 2026-08-02T15:38:05Z Found: Current Claude Code supports scriptable marketplace install/list/update, project/user/local scopes, cache-resolved plugin assets, and in-session reload; isolated install proved the existing plugin is copied into the profile cache.
- 2026-08-02T15:38:05Z Decision proposal: use profile-first Expand -> Prove -> Contract migration, with fresh install separate from cleanup and cleanup forbidden from mutating marketplace, plugin, or trust state.
- 2026-08-02T15:41:56Z Confirmed: User approved the intake brief and three persona jobs; decomposed them into lifecycle safety, ownership, parity, release, and smoke-test Rules.
- 2026-08-02T15:43:00Z Amended: User requires plugin changes to be reflected in the live Claude task where supported; added live-reload behavior and an open proof-boundary question.
- 2026-08-02T15:59:00Z Proposed scope: user-scoped install, direct bundled Bun runtime, SessionStart/UserPromptSubmit identity proof, explicit atomic cleanup/recovery, native namespaced workflows, and generated cross-host parity.
- 2026-08-02T16:02:30Z Confirmed: User accepted the final engineering scope; advanced from intake to define-behavior.
- 2026-08-02T16:11:53Z Quality review: Added missing positive install, declined-cleanup, read-only status, plugin-mode reconciliation, cache-path proof, unsupported-host, and duplicate workflow-name acceptance boundaries.
- 2026-08-02T16:19:06Z Quality re-review: Install now refuses unsupported Claude hosts before any profile mutation; clarified the 2.1.170 tested support floor.
- 2026-08-02T16:22:18Z Confirmed: Quality-review loop approved with 32 synchronized scenarios and no remaining critical issues; advanced define-behavior -> scenario-gate.
- 2026-08-02T16:36:44Z Scenario gate: Three adversarial passes expanded coverage to 40 synchronized scenario groups; final review found 0 must-fix and 0 should-strengthen, and the independent review stamp passed. Advanced scenario-gate -> plan-implementation.
- 2026-08-02T16:48:00Z Planned: Defined the generated bundle, exact profile proof, per-event authority, reusable migration transaction, reconciliation modes, seven green implementation slices, and release/documentation proof in design.md and impl-plan.md.
- 2026-08-02T16:57:00Z Plan review correction: Real Claude 2.1.170 add/remove leaves changed private profile files, so replaced an infeasible byte-identical install-failure promise with exact partial-effect reporting; pinned installation to the official release tag, made cache/source preconditions explicit, and bound Gherkin automation to each implementation slice.
- 2026-08-02T16:59:19Z Plan review: Fresh independent review passed after three corrections; stamped plan-implementation and advanced to implement. Four components and seven stacked slices remain under the split threshold.
- 2026-08-02T20:40:32Z Implemented: Generated and sealed the native Claude plugin, added install/status/cleanup/recover lifecycle commands, retained per-event legacy authority until proof, shared canonical Cursor skills, and added release/parity contracts across commits ending at efc416145.
- 2026-08-02T20:40:32Z Verified pre-release: 408 Vitest files (6,156 passed, 5 skipped), 772 BDD scenarios (769 passed, 3 skipped), ESLint, formatting, TypeScript, dependency audit, 157-asset plugin generation, release alignment, and 229 parity pairs/8 contracts all pass. Advanced to verify; interactive live-host and actual release boundaries remain intentionally unexecuted.
- 2026-08-02T21:28:13Z Live-host verification: Claude Code 2.1.170 loaded the generated plugin session-only as `safeword@inline`, exposed all 18 Safeword skills, ran SessionStart/UserPromptSubmit/five Stop hooks, and wrote identity-bound execution proof. The first run exposed a Bun child-environment defect in aggregate dispatch; fixed it with explicit environment forwarding and added a reproducing integration test. Final headless run had zero hook stderr and returned the exact sentinel; 409 Vitest files (6,157 passed, 5 skipped), release alignment, lint, root TypeScript, and parity all pass. Interactive `/reload-plugins` and release remain intentionally open.
