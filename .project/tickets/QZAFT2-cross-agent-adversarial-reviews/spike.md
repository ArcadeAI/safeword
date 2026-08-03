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

## Initial result

**Classification: PARTIAL**

The isolated spike worktree was created from `ca9c56d3b6e9f41a651e981db30d57c8ae11dbc5` and was clean before and after both bounded attempts. Neither attempt reached a Claude model turn or the nested Codex process:

1. The `claude` selected by `PATH` was an obsolete 1.0.43 installation. It rejected the current `--tools` option and later requested a retired model that returned HTTP 404.
2. A trailing prompt was also unsafe after variadic `--allowedTools`; that option consumed the prompt, so `--print` received no input.

These were test-harness and executable-resolution failures, not evidence against cross-agent execution. The user explicitly authorized a follow-up investigation and bidirectional proof.

## Follow-up result

**Classification: VALIDATED, with a host-boundary constraint**

Current vendor documentation and installed help both support noninteractive prompts through stdin. Explicit executable discovery found Claude Code 2.1.170 at `/Users/alex/.bun/bin/claude` behind the stale `PATH` entry, and Codex CLI 0.141.0 at `/opt/homebrew/bin/codex`.

Using explicit binaries and stdin prompts produced both required end-to-end markers:

- Claude → Codex exited zero with `CLAUDE_WRAPPER_OK:NESTED_CODEX_OK_QZAFT2`. The Codex child was ephemeral, ignored user config and hooks, received no Claude credential variables, used JSONL output, and requested a read-only sandbox.
- Codex → Claude exited zero with `CODEX_WRAPPER_OK:NESTED_CLAUDE_OK_QZAFT2`. The Claude child received no Codex credential variables, had no tools, used safe mode, and disabled session persistence.

The Codex → Claude proof first reproduced an important boundary condition: a read-only nested Codex sandbox could start Claude but could not expose Claude's desktop profile login, yielding `Not logged in`. Running the isolated outer proof at the host boundary allowed Claude to reuse the existing `claude.ai` profile. This is consistent with treating nested sandbox permissions as insufficient proof of credential-store or filesystem isolation. The spike worktree remained clean throughout.

## Decision

Recommend a host-owned coordinator that resolves and capability-checks executable candidates, spawns them with structured argument arrays, sends review packets through stdin, and separately captures stdout and stderr. This is the smallest contract supported by both CLIs and avoids shell quoting, variadic-option, and stale-`PATH` failures. On desktop it may reuse a reviewer profile only when the host boundary can access that credential store; cloud sessions should pass only the reviewer vendor's managed credential. A nested auth denial is a classified authentication failure, never permission to weaken the judged-work sandbox silently.

Keep the neutral snapshot and post-run integrity check even when a CLI reports read-only mode: nested sandbox behavior can differ from top-level enforcement. Require exact structured completion and reviewer provenance before accepting a review. If executable resolution, capability checks, authentication, or output validation fails, use the specified loud fallback and give one concrete recovery action.

Evidence: [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage) and [Codex noninteractive CLI](https://github.com/openai/codex/blob/main/codex-rs/README.md).
