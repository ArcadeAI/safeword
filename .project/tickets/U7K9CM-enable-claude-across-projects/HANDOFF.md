# Continuation handoff

## Goal

Change Safeword's Claude default activation from project scope to user scope while preserving explicit `--scope=project`, then complete a real Claude BDD lifecycle in an isolated Tart VM without touching the host Claude profile.

## Repository state

Branch: `codex/claude-user-scope-default`
Base: `f15c55f7a` (`v0.83.1`)
Ticket: `.project/tickets/U7K9CM-enable-claude-across-projects/`

The implementation and deterministic verification are complete. The ticket stays in progress only because the requested full authenticated VM lifecycle has not reached independent review, TDD, verification, and closeout.

Changed behavior:

- Omitted Claude scope installs user-wide.
- Explicit `--scope=project` remains project-local.
- Non-Claude omitted scope remains valid.
- Explicit user scope without Claude remains invalid.
- Install and uninstall planning share the same default.
- Generated Claude and Codex runtime bundles were regenerated from source.

## Verified evidence

- 65/65 targeted Vitest tests passed; the final Claude profile file passed 22/22.
- 102/102 affected Cucumber scenarios and 4,787/4,787 steps passed.
- All 28 selected release assertions passed. One catalogue check exceeded its default 15-second timeout and passed 8/8 unchanged with a 60-second timeout.
- ESLint and `git diff --check` passed.
- Real Tart installation passed for default command, unified install, explicit project scope, idempotence, cross-project visibility/isolation, plugin discovery, and generated consumer BDD starters.
- Authenticated Claude loaded `safeword:bdd` from user scope in two projects, created intake artifacts, emitted valid hook proofs, and was blocked on an invalid early phase transition.

See `verify.md` and `tart-verification.md` for exact details.

## Remaining VM lifecycle

The disposable feature is `YDA70E-greeting-cli`. Its artifacts were created only inside the original VM, not in this repository. It reached `plan-implementation`; no production implementation was written.

The original VM's independent Claude reviewer cannot run because root-owned enterprise MCP configuration conflicts with the required `--strict-mcp-config`. Do not remove managed policy or weaken reviewer isolation. Same-agent supplemental feedback has independence `none` and must not be represented as an independent stamp.

A native Codex 0.152.1 reviewer was copied into an owner-only path and all required flags were verified, but its isolated profile was not logged in. On this host the retained VM is `safeword-scope-U7K9CM`; the profile is `/Users/admin/safeword-scope-test/codex-reviewer-profile`, the tools directory is `/Users/admin/safeword-review-tools`, and the Claude session ID is `c89df7fe-4892-4ea3-ae3c-37bcbc7b072b`. Those machine-local details are optional evidence, not dependencies for continuing elsewhere.

On another computer, prefer a fresh Tart VM without `/Library/Application Support/ClaudeCode/managed-mcp.json`. Install Node, Bun, Claude Code, and the branch's packed Safeword CLI; authenticate only inside the VM. If the image has managed MCP configuration, use an authenticated compatible Codex CLI as the independent reviewer. Never copy host credentials into the guest.

Then recreate or continue a tiny no-dependency Node greeting CLI through the installed `safeword:bdd` workflow. Require the real coordinator's independent scenario and plan review evidence, complete RED/GREEN/REFACTOR, run behavioral verification, create `verify.md`, and close the disposable guest ticket. Archive logs and record any limits in this task ticket. This VM exercise validates the installed released plugin payload 0.83.1 plus the changed local installer; it is not a published candidate-release upgrade test.

## Recommended verification commands

From the repository root:

```sh
bun run test packages/cli/tests/cli-protocol/catalog.test.ts packages/cli/tests/cli-protocol/plan-remove-wiring.test.ts packages/cli/tests/claude-plugin/profile-install.test.ts
NODE_OPTIONS='--import tsx' packages/cli/node_modules/.bin/cucumber-js features/choose-claude-plugin-scope.feature features/native-claude-plugin.feature --format summary
bun run --cwd packages/cli check:claude-plugin
bun run --cwd packages/cli test:release tests/claude-plugin-release.release.test.ts tests/codex-plugin-version.release.test.ts tests/codex-plugin-catalogue.release.test.ts --testTimeout 60000
bunx eslint packages/cli/src/claude-plugin/profile.ts packages/cli/src/cli-protocol/catalog.ts packages/cli/src/cli-protocol/execute.ts packages/cli/src/cli-protocol/public-handlers.ts packages/cli/src/lifecycle/commands.ts packages/cli/tests/claude-plugin/profile-install.test.ts packages/cli/tests/cli-protocol/catalog.test.ts packages/cli/tests/cli-protocol/plan-remove-wiring.test.ts steps/native-claude-plugin.steps.ts
git diff --check origin/stable...
```

Run only one Vitest process at a time. Do not use `bun test`.

## Continuation prompt

```text
Continue the Safeword ticket “Enable Claude across projects by default” (U7K9CM) on branch `codex/claude-user-scope-default`. Start by reading AGENTS.md, the packaged Safeword handbook, the applicable BDD/testing/ticket guides, and `.project/tickets/U7K9CM-enable-claude-across-projects/HANDOFF.md`. Verify the checkout and current diff before changing anything.

The product change is implemented and deterministic tests previously passed. The remaining goal is a real end-to-end BDD lifecycle in an isolated Tart VM without changing or using my host Claude profile. Use a fresh VM without enterprise managed MCP configuration if possible. Install the locally packed branch build, authenticate inside the VM, verify omitted Claude scope installs user-wide and remains visible from a second project, then invoke the installed user-scope `safeword:bdd` skill to build a tiny no-dependency Node greeting CLI through scenarios, real independent scenario/plan reviews, RED/GREEN/REFACTOR, verification, and local guest closeout.

Do not weaken reviewer isolation, remove managed enterprise policy, fabricate review stamps, treat same-agent supplemental feedback as independent, copy host credentials, publish, or modify tests to make failures pass. If a reviewer route fails, use the figure-it-out skill and preserve typed failure evidence. Stay focused on correctness and simplicity; avoid bloat and overhardening.

When the VM lifecycle is complete, update this ticket's `verify.md`, `tart-verification.md`, work log, and status honestly. Re-run only the relevant repository gates, one Vitest process at a time. Do not publish or open a PR unless I explicitly ask. Preserve the explicit `--scope=project` behavior and the validation that `--scope=user` is invalid when Claude is not selected.
```
