# Validate worktree readiness at the execution boundary

Covers: Codex hooks, exec_command workdir, PR readiness, cross-worktree evidence.

Codex 0.160.0's shell PreToolUse payload keeps the session cwd but omits the
per-command workdir. A hook receiving that payload cannot distinguish a command
executed in the session checkout from one executed in another worktree. Parsing
the command or preferring another environment hint cannot recover missing data.

For authorized Ready promotion, `project pr-ready --cwd <delivery-worktree>`
checks the worktree at execution time and invokes GitHub from that same root.
Reuse the shared exact-HEAD receipt validator, reject repository overrides,
compare the inspected PR head, freeze its number, and recheck local evidence
before mutation. Never copy another checkout's ticket or receipt to satisfy a
guard. The raw shell hook retains the upstream metadata limitation.

Prove both directions with real linked Git worktrees and a fake GitHub boundary:
a verified delivery must work despite an unfinished launch checkout, and a
verified launch checkout must not authorize an unfinished delivery. Record the
actual cwd of both GitHub inspection and promotion.

GitHub's Ready API has no atomic expected-head condition. A concurrent remote
push remains a disclosed limitation, separate from choosing the correct local
worktree.

Evidence: issue #5511; tickets S7F7PP and 0VN2X5; upstream
https://github.com/openai/codex/issues/32360.
