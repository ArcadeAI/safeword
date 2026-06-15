---
id: E0J9N2
slug: agent-worktree-dependency-bootstrap
type: task
phase: done
status: done
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-06-13T21:34:07.157Z
last_modified: 2026-06-14T01:01:27.000Z
---

# Bootstrap dependencies in Claude-created worktrees

**Goal:** Ensure Claude Code sessions and subagents that enter fresh worktrees have project dependencies bootstrapped before safeword asks them to run tests, lint, build, or other dependency-backed commands.

**Why:** Claude Code creates fresh git worktrees for `--worktree`, desktop parallel sessions, and `isolation: "worktree"` subagents; ignored install artifacts such as `node_modules/` are absent, so agents hit misleading tool failures like `tsup: command not found` before reaching the actual RED/GREEN/verify signal.

## Scope

Add safeword-managed agent bootstrap for dependency-backed projects:

- A `SessionStart` dependency-readiness hook that detects missing or stale local install artifacts in a fresh worktree.
- An explicit auto-install mode that can run the safest reproducible install command when the project opts in.
- A `PreToolUse` Bash guard that blocks dependency-backed commands when bootstrap failed or has not run, returning a recovery instruction to the agent.
- Package-manager detection for at least Bun projects, with room to extend to npm/pnpm/yarn without hard-coding safeword's own repo.
- A stamp keyed to lockfile plus relevant `package.json` files so bootstrap is skipped when the install state is current.

## Out of Scope

- Replacing Claude Code's default `WorktreeCreate` behavior.
- Copying or sharing `node_modules/` between worktrees.
- Installing runtime/application dependencies for non-JS ecosystems beyond existing package-manager semantics.
- Overriding managed policy, disabled hooks, or user-denied network/install permissions.
- Solving missing Bun itself; `session-bun-check.sh` already owns that precondition.

## Proposal

Use `SessionStart` for readiness detection and `PreToolUse` as the hard backstop.

`WorktreeCreate` is the wrong primary hook because Claude Code documents it as a replacement for the entire default git worktree creation path, and `.worktreeinclude` is not processed when a custom hook takes over. Safeword should not reimplement Claude's base-ref, PR, branch naming, cleanup, and temporary-subagent-worktree behavior just to run package installation.

`SessionStart` is the right readiness point because it runs after Claude lands in the new worktree, where tracked safeword hooks and project lockfiles are available. It can inject context before the first user turn, and can install only when the project explicitly opts into auto-bootstrap. Since `SessionStart` cannot be treated as the only reliability boundary, `PreToolUse` must deny known dependency-backed commands when the install state is not ready.

Default mode should be detect-and-guard: safeword notices the missing install, tells the agent the frozen install command to run, and blocks dependency-backed commands until that command succeeds. This keeps network access and project lifecycle scripts inside the normal agent/tool permission flow. Auto-install can be a project config option for teams that want fully fire-and-forget worktree sessions.

For Bun projects with a committed `bun.lock`, prefer `bun ci` over bare `bun install`; Bun documents `bun ci` as equivalent to `bun install --frozen-lockfile`, failing when `package.json` and `bun.lock` disagree. If there is no lockfile, or the frozen install fails, safeword should not silently rewrite dependency metadata during session startup. It should record the failure and tell the agent/user what command needs approval.

## Done When

- [x] A fresh Claude-created worktree for a Bun workspace is detected as missing dependencies before the first dependency-backed command runs.
- [x] In default mode, the agent is instructed to run the frozen install through the normal tool flow; no hook silently performs network install work.
- [x] In explicit auto mode, bootstrap runs once and then `bun run test` reaches the project test runner instead of failing on missing `node_modules/.bin` tools.
- [x] Bootstrap uses a frozen/reproducible install when a lockfile exists and does not silently update lockfiles.
- [x] Re-entering the same worktree with unchanged dependency manifests skips the install.
- [x] If install is missing or bootstrap fails, the next dependency-backed Bash command is blocked with the install command and recovery instruction.
- [x] Non-JS projects and JS projects without recognized package-manager files skip without noise.

## Tests

- [x] Unit: package-manager detection chooses `bun ci` for `packageManager: bun` plus `bun.lock`.
- [x] Unit: install-state stamp changes when `bun.lock` or workspace `package.json` content changes.
- [x] Unit: dependency command classifier catches `bun run`, `bun test`, `vitest`, `tsc`, `eslint`, and package-manager script equivalents without blocking unrelated shell commands.
- [x] Integration: simulate a fresh worktree without `node_modules`; SessionStart records missing dependency state and injects context in default mode.
- [x] Integration: simulate explicit auto mode; SessionStart bootstrap runs and writes a current stamp.
- [x] Integration: simulate bootstrap failure; PreToolUse denies the dependency-backed command and includes the recovery instruction.

## Quality Review Notes

- Verify against current Claude Code docs for `WorktreeCreate`, `.worktreeinclude`, `SessionStart`, `Setup`, and `PreToolUse` behavior before implementation.
- Verify against current Bun docs for `bun ci`, workspaces, lockfile behavior, and install side effects.
- Confirm whether hook timeout defaults are sufficient for a dependency install; if not, set an explicit timeout and status message.
- Document the trust/network boundary clearly: auto-install may access the package registry and run project lifecycle scripts, so it must be explicit config rather than the silent default.
- Do not rely solely on Claude Code hook `if:` filters for the PreToolUse backstop; run the Bash hook broadly enough and classify dependency-backed commands inside the hook.

## Quality Review: Proposal

**Versions:** N/A for implementation versions; current docs were checked for Claude Code worktree/hook behavior and Bun install behavior.

**Documentation:** APPROVE after adjustment. Claude Code docs confirm `WorktreeCreate` replaces the default git worktree behavior and skips `.worktreeinclude`, which supports avoiding that hook for this task. Claude Code docs also confirm `SessionStart` can add startup context and `PreToolUse` can block tools. Bun docs confirm `bun ci` is the frozen-lockfile install path and workspaces install from the repo root.

**Security:** APPROVE after adjustment. The original silent auto-install default was too broad because package installation can hit the network and run project lifecycle scripts. The ticket now defaults to detect-and-guard, with automatic install only behind explicit project config.

**Verdict:** APPROVE

**Critical issues:** None remaining after changing the default from silent auto-install to detect-and-guard.

**Suggested improvements:** During implementation, keep the PreToolUse guard independent of hook `if:` matching and add an explicit hook timeout/status message for the optional auto-install path.

**Provenance:**

- verified: Claude Code hooks docs — `SessionStart`, `PreToolUse`, `WorktreeCreate`, hook handler timeout/status fields — https://code.claude.com/docs/en/hooks
- verified: Claude Code worktrees docs — `--worktree`, `.worktreeinclude`, base-ref behavior — https://code.claude.com/docs/en/worktrees
- verified: Bun install docs — `bun ci`, frozen lockfile behavior — https://bun.sh/docs/pm/cli/install
- verified: Bun workspaces docs — root install covers workspaces — https://bun.sh/docs/pm/workspaces

**Next:** Implement the default detect-and-guard path first; add explicit auto-install mode only after the guard is tested.

## Work Log

- 2026-06-13T21:34:07.157Z Started: Created ticket E0J9N2
- 2026-06-13T21:34:38.300Z Scoped proposal: SessionStart bootstrap plus PreToolUse guard; avoid WorktreeCreate replacement and node_modules sharing.
- 2026-06-13T21:35:54.000Z Quality-review adjustment: default to detect-and-guard so installs happen through normal tool permission flow; reserve automatic install for explicit config.
- 2026-06-13T21:36:29.000Z Quality review passed after adjustment; implementation should start with detect-and-guard before optional auto-install.
- 2026-06-14T01:01:27.000Z Implemented dependency-readiness hook library, SessionStart context/auto-bootstrap hook, PreToolUse Bash guard, schema/settings registration, transient-state ignore rules, and verification coverage. Full package suite passed: 2866/2866 tests, 1 skipped.
