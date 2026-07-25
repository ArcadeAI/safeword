---
id: 13E3EN
slug: honor-host-toolchains
type: feature
phase: done
status: done
phase_anchors:
  - define-behavior: .project/tickets/13E3EN-honor-host-toolchains/spec.md
  - scenario-gate: features/honor-host-toolchains.feature
  - implement: .project/tickets/13E3EN-honor-host-toolchains/impl-plan.md
  - verify: .project/tickets/13E3EN-honor-host-toolchains/test-definitions.md
  - done: .project/tickets/13E3EN-honor-host-toolchains/verify.md
scope:
  - Add a host-toolchain dispatch seam to the JavaScript/TypeScript post-edit lint hook, with explicit detection, safe local-binary execution, fix, and check behavior.
  - Add an Ultracite adapter that recognizes an existing installed Ultracite project and runs the nearest owner's local `ultracite fix -- <file>` then `ultracite check -- <file>` commands as argument arrays, never through a shell.
  - Add a direct Biome adapter that runs the nearest owner's local `biome check --write -- <file>` then `biome check -- <file>` commands as argument arrays when Biome, rather than Ultracite, is the declared host owner.
  - Resolve host-toolchain ownership from each edited JavaScript/TypeScript file upward to the Safeword project root: select the nearest supported toolchain configuration directory, run with that directory as `cwd`, and pass the edited file relative to it.
  - Recognize Biome's supported configuration filenames (`biome.json`, `biome.jsonc`, `.biome.json`, `.biome.jsonc`); an Ultracite configuration takes precedence over direct Biome when it extends either legacy `ultracite/core` or current `ultracite/biome/*` presets.
  - Resolve only a project-local executable through the canonical ancestry from the owning directory to the canonical Safeword project root, including an intentionally hoisted workspace binary; do not use `npx`, `bunx`, package-manager download commands, or a global PATH fallback.
  - Clear `BIOME_CONFIG_PATH` and `BIOME_BINARY` from the child environment for direct-Biome and Biome-backed Ultracite commands so the selected owner, configuration, and executable cannot be overridden by ambient process state.
  - Keep Safeword's workflow, test, typecheck, secret, architecture, and completion gates independent of the host JavaScript toolchain.
  - Record the project-wide ownership and dispatch convention in ARCHITECTURE.md and the feature-specific implementation design in this ticket.
out_of_scope:
  - Running `ultracite init`, changing a host toolchain's dependencies/configuration/editor settings/agent hooks, or taking over its upgrade lifecycle.
  - Providing adapters for dprint, oxfmt, Deno, or every future formatter in this feature; they retain the existing no-Prettier behavior until an adapter is deliberately added.
  - Replacing or weakening Safeword's non-JavaScript checks or its workflow/evidence gates.
  - Cross-workspace or sibling-workspace toolchain inheritance; only an edited file's own directory ancestry may supply a host owner.
  - Adding a generic adapter for unrecognized formatter configurations or guessing an owner from a bare `package.json` without a supported toolchain configuration.
done_when:
  - An already-installed Ultracite project is detected without configuration churn, and an edited JavaScript/TypeScript file is fixed through local `ultracite fix -- <file>` then checked through local `ultracite check -- <file>`.
  - A direct Biome project is fixed through local `biome check --write -- <file>` and then checked through `biome check -- <file>`, without Safeword ESLint or Prettier applying a competing JS policy.
  - In a polyglot monorepo, an edited nested JavaScript/TypeScript file uses the nearest configured workspace toolchain and its local command context; a sibling workspace's toolchain is never selected.
  - A failing host check is surfaced to the agent; a recognized owner with a missing local binary produces an actionable warning, never auto-downloads a different tool version, and runs neither Safeword ESLint nor Prettier for that file.
  - Safeword-generated paths are excluded from host-toolchain edit-time dispatch, and existing projects using an unsupported alternative formatter keep their current behavior.
  - Focused unit and hook-level integration tests prove detection precedence, command arguments/cwd/environment isolation (including hostile `BIOME_CONFIG_PATH` and `BIOME_BINARY` values), no-configuration-churn, nested config inheritance, missing-binary/failing-command behavior, excluded files, root-hoisted binaries, dash-prefixed filenames, canonical-root containment/symlink escape, and safe fallback behavior.
created: 2026-07-24T13:38:59.369Z
last_modified: 2026-07-24T13:38:59.369Z
---

# Honor host JavaScript toolchains during agent edits

**Goal:** Let Safeword run the JavaScript toolchain a project has already chosen without losing Safeword quality gates.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-24T20:55:00Z Done: User explicitly confirmed completion. All scenario evidence, verification evidence, review stamps, and session-bound required skill proofs are present. Entering done; full audit follows as requested.
- 2026-07-24T20:53:00Z Verify: Fresh re-review found and then approved a correction for malformed nested Biome configs: they now remain the nearest direct-Biome owner so their host diagnostic surfaces rather than a parent configuration taking over. Added a real lint-hook regression; focused suite now passes 109 tests. Verify-phase review stamp and all required skill-invocation proofs are recorded. Ready for explicit completion confirmation.
- 2026-07-24T20:46:00Z Verify: Reconstructed 14 missing RED entries against an isolated `f8cf83556` baseline, where the required host-toolchain module was absent. The ledger is 48/48 complete; the merged-main focused verification lane is green (108 tests), and `/verify`, `/audit`, and `/quality-review` session proofs now log successfully. Fresh implementation review was stamped; entering verify. No ticket completion requested yet.
- 2026-07-24T17:18:00Z Refactor: Synced the dirty detached worktree to `origin/main` by stashing and cleanly reapplying the feature. Completed the full refactor ledger: introduced `HostToolchainOwner` and extracted the repeated host-test subprocess helper; focused checks pass after each change. Final hook/schema regression lane, lint, typecheck, build, Gherkin, whitespace, Knip, and duplication checks were run. Knip's sole `which` ignore-binary hint is unrelated and deferred. `/audit` invocation proof remains unavailable because this Codex runtime has no run identity.
- 2026-07-24T16:36:00Z Implement: Fresh independent quality re-review APPROVE. Added real packaged-Codex-hook coverage for an edited-file symlink that canonically escapes the project; it emits the containment warning and invokes neither local host tooling nor PATH generic fallback. Focused verification is green (107 tests). The required quality-review invocation helper was run again and still reports no Codex run identity, so no session-bound proof could be logged.
- 2026-07-24T16:30:00Z Implement: Fresh independent quality review APPROVE after the final Codex multi-target skill-nudge aggregation fix. Focused suite (106 tests), package lint, typecheck, build, Gherkin lint, and diff check pass. Completion remains blocked: `record-skill-invocation.ts` reports no Codex run identity, so the required session-scoped `/quality-review` proof cannot be recorded for this 2+ RGR-loop ticket.
- 2026-07-24T16:22:00Z Plan-implementation: Independent fresh-context review passed. The reviewed plan selects a schema-registered shared resolver/runner, explicit caller-root propagation, JSONC parsing, locally bounded executable lookup, and per-runtime wiring proofs. Review-stamp helper remains unavailable without a Codex run identity. Entering implement for RED slice 1.
- 2026-07-24T16:05:00Z Scenario-gate: Independent fresh-context review passed after tightening precedence, exact argv/cwd/environment assertions, canonical containment, and fallback traps. Gherkin lint passes. Review-stamp helper could not write a stamp because this Codex runtime exposes no run identity (`missing run identity for review stamp`); the independent review report is retained in the session record. Entering plan-implementation.
- 2026-07-24T15:55:00Z Define-behavior: User approved the revised scenario set. Entering scenario-gate for independent review-spec validation.
- 2026-07-24T15:54:00Z Quality-review pass 3 of behavior artifacts: APPROVE. Current Biome and Ultracite sources support the final scenario set; Gherkin lint passes and no critical scenario gaps remain.
- 2026-07-24T15:53:00Z Quality-review pass 2 of behavior artifacts: REQUEST CHANGES. Added executable coverage for all four supported Biome configuration filenames, dash-prefixed file argv safety, and byte-for-byte Ultracite ownership snapshots; re-review required.
- 2026-07-24T15:52:00Z Quality-review pass 1 of behavior artifacts: REQUEST CHANGES. Added missing executable coverage for nearest nested-owner resolution, root-hoisted local binaries, sibling isolation, canonical-path escape, and host-config exclusions; re-review required.
- 2026-07-24T15:50:51Z Intake: Engineering-scope gate passed — user approved the reviewed scope, including nested workspace resolution. Entering define-behavior; quality review elevated environment isolation into an explicit Rule.
- 2026-07-24T13:48:00Z Quality-review pass 4: APPROVE. Current Biome and Ultracite documentation supports the revised command, nearest-config, local-binary, and environment-isolation contract; no critical issues remain.
- 2026-07-24T13:47:00Z Quality-review pass 3: REQUEST CHANGES. Closed the remaining Biome launcher-override loophole by requiring `BIOME_BINARY` removal alongside `BIOME_CONFIG_PATH`, with hostile-environment coverage. Final re-review required.
- 2026-07-24T13:46:00Z Quality-review pass 2: REQUEST CHANGES. Added child-environment isolation for `BIOME_CONFIG_PATH`, canonical root-bounded executable resolution, explicit Ultracite v6/v7 Biome-preset matching, and test coverage for hostile environment/path cases. Re-review required.
- 2026-07-24T13:45:00Z Quality-review pass 1: REQUEST CHANGES. Tightening the draft with exact argument-array commands, nearest-configuration (not package-root) ownership, Ultracite-over-Biome precedence, local-binary-only lookup, and a no-fallback rule when a recognized owner lacks its binary. Re-review required.
- 2026-07-24T13:44:00Z Quality-review correction: Current Biome docs establish `biome check --write <file>` as the file-scoped operation that applies formatting, lint, and import-assist fixes. Replaced formatter-only dispatch to avoid leaving host-policy fixes unresolved.
- 2026-07-24T13:43:00Z Intake: Scope amendment accepted — per-edited-file upward workspace resolution is in scope. Replaced root-only detection with nearest-owner selection and explicitly prohibited sibling-workspace inheritance.
- 2026-07-24T13:42:00Z Intake: Surveyed existing hook conventions and architecture guidance. Proposed a reusable host-toolchain dispatch seam with two first adapters (Ultracite and direct Biome), explicit local-binary execution, and no generic delegation for unsupported alternatives.
- 2026-07-24T13:41:00Z Intake: Criteria gate passed — user confirmed the four host-toolchain invariants and added the explicit Ultracite compatibility promise: adopt an existing install in place; never initialize, overwrite, or duplicate its configuration.
- 2026-07-24T13:40:00Z Intake: JTBD gate passed — user confirmed this is a feature and that SWM1 captures the served persona and motivation. Drafting its numbered Rules.
- 2026-07-24T13:39:04Z Intake: Reused the completed formatter-aware hook decision as prior art. Confirmed Safeword detects Biome-family formatters and skips Prettier, but still runs Safeword ESLint rather than the host's configured checker/fixer. Drafted the first JTBD for maintainer signoff.
- 2026-07-24T13:38:59.369Z Started: Created ticket 13E3EN
