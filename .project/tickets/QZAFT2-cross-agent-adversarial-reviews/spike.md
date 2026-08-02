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
