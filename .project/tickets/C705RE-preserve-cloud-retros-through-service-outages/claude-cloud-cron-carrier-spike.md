## Spike result: PARTIAL

- Question: Can Claude Code Cloud's documented `CronCreate` scheduler run one
  bounded health probe after the initiating Cloud task has become idle?
- Hypothesis: `CronCreate` is permitted by the default auto-mode classifier and
  can deliver a one-minute continuation, providing a detached completion
  carrier.
- Pre-spike base: `faa0a2fe58d8561073b6af42fe1162631df5529f`
- Proof command or walkthrough: A Claude Code Cloud task on
  `spike/claude-cloud-cron-carrier` created exactly one one-minute `CronCreate`
  task. Its prompt was to run
  `bun .claude/spike-claude-cloud-cron-carrier.mjs`, then report completion.
- Evidence: The task fired on schedule and delivered its prompt verbatim as a
  new user turn. The scheduled turn read the bounded probe and then attempted
  the exact Bun command. Cloud's auto-mode permission classifier denied that
  Bash execution before the probe could contact Railway or write its ignored
  local evidence file.
- Constraints or wall: Scheduling needs no exception, but executing the
  carrier needs a human permission grant or a Bash permission rule. Either
  makes completion non-invisible and changes the zero-setup contract. This
  proof exercises `/health`, not the real public receipt route, so a successful
  command would still have required a second, receipt-specific proof.
- Useful shortcuts: `CronCreate` has one-minute granularity and survives the
  initial visible response only as a session-scoped scheduled turn. It is a
  supported scheduling primitive, unlike the previously denied opaque
  `send_later` MCP route, but the scheduler's availability does not grant
  arbitrary Bash execution to the resulting turn.
- Decision: Do not use `CronCreate` as the shipped Claude Cloud retro carrier.
  It validates Cloud's detached scheduling capability, but not the required
  default, silent, end-to-end execution path. Do not add a repository or user
  permission exception merely to make this spike pass.
- Production consequences: Keep every public-cloud route disabled and retain
  the existing carrier-readiness gate. A future candidate must execute and
  obtain a durable receipt in the normal Cloud runtime without a per-run human
  approval, configuration, visible narration, or builder-facing delay.
