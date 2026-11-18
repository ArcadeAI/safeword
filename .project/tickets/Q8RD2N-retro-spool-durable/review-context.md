# Review context (Q8RD2N)

Trust boundary: the agent is trusted; hooks are a correctness aid, not a security control against deliberate evasion.

Facts the design relies on (verified this session):

- Claude Code: `.git` is a protected path; Edit/Write and Bash redirect/tee targets outside the working directories, or in protected paths, need approval outside bypassPermissions (https://code.claude.com/docs/en/permissions). Running `bun script.ts` that writes files is not path-checked.
- The retro filer (agent `safeword-retro-filer`, Codex skill `retro-filer`) is handed one spool path, appends acks to `<spool>.acks.jsonl` beside it, and drains via `drain-retro-spool.ts <path>`.
- Hooks (Stop gate, nudge) and closeout run as host processes, not through the agent's file tools.
- `git rev-parse --path-format=absolute --git-common-dir` (git >= 2.31) returns the directory every worktree shares.

Callers changed: Stop gate (`decideRetroFilingGate`), nudge (`decideRetroFilingNudge`), closeout (`stageRetroSpool` before `realpathSync`), see review-closeout.diff. `retro run` writes via `spoolDrafts`.
