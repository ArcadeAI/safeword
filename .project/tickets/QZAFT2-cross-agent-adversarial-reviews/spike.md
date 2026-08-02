# Spike charter — Claude launches Codex headlessly

## Question

Can a fresh headless Claude process launch an authenticated `codex exec` child with the required read-only, neutral-workspace, and parseable-result contract?

## Hypothesis

Yes. Claude can invoke the installed Codex CLI noninteractively; Codex can reuse its existing authenticated profile without a manually copied key; removing Claude-specific credential variables from the Codex child does not prevent Codex authentication; and the nested run can return a unique marker without changing the spike worktree.

## Kill criterion

Reject the subprocess-coordinator direction if the bounded proof hits any of these after at most one setup correction:

- Claude or nested Codex exits non-zero or times out;
- Codex cannot authenticate without receiving Claude-specific credentials;
- the unique nested-Codex marker cannot be recovered from Claude's result;
- the spike worktree differs after the read-only run.

## Proof

From the isolated spike worktree, run one fresh `claude -p` session in plan mode. Permit it only to read and to execute the exact nested Codex command. The nested command uses `codex exec --ephemeral --ignore-user-config --disable hooks -c 'mcp_servers={}' --sandbox read-only --json --skip-git-repo-check`, with Claude-specific credential variables removed, and asks for the unique marker `NESTED_CODEX_OK_QZAFT2`.

The proof passes only when:

1. Claude exits zero and returns `CLAUDE_WRAPPER_OK:NESTED_CODEX_OK_QZAFT2`;
2. Codex's output shows the unique marker;
3. `git status --porcelain` in the spike worktree is unchanged before and after.

## Budget

One vertical invocation plus at most one bounded setup correction, capped at 20 minutes. No production modules, feature implementation, or cloud-environment emulation.

## Scope constraint

This machine can prove real local Claude → Codex nesting. Managed-cloud credential parity remains a separate acceptance concern covered through contract simulations and any available live cloud smoke evidence; this spike does not claim to impersonate either vendor's cloud secret store.

## Result

**Classification: PARTIAL**

The isolated spike worktree was created from `ca9c56d3b6e9f41a651e981db30d57c8ae11dbc5` and was clean before and after both bounded attempts. Neither attempt reached a Claude model turn or the nested Codex process:

1. The installed Claude CLI rejected the documented `--tools Bash` option as unknown.
2. The one permitted setup correction removed `--tools`, but `--allowedTools Bash` consumed the trailing prompt under this CLI's variadic argument parsing; Claude then exited because `--print` received no prompt.

The experiment therefore produced no authentication, isolation, or parseability evidence for Claude → Codex nesting. It also produced no evidence that the nested subprocess design itself is unsound: the failure was confined to the outer test harness's CLI argument construction.

## Decision

Keep the shared subprocess-coordinator design, but do not treat local Claude → Codex nesting as validated. During implementation, invoke reviewer CLIs directly with structured argument arrays and stdin input instead of relying on an agent-authored shell command. Cover the Claude-hosted route with executable contract tests, and require a real desktop/cloud smoke check before claiming live parity. If that smoke check cannot start, report the exact missing installation or authentication prerequisite and use the already-specified loud fallback path.
