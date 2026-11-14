# Verification process incident (2026-10-19 PDT)

The root full-suite command ran relay/collector tests and then queued behind
another worktree's shared CLI lock (owner PID 18014, `/worktrees/6ef9/`, started
21:02:30 PDT). The foreign Vitest child started at about 21:02:34. The root
relay/collector segment overlapped that process. Separately, `check:cli-contract`
was launched while the CLI suite was lock-waiting; its internal direct Vitest
invocation bypasses that lock and overlapped the foreign run. On discovery,
termination of only our direct contract Vitest PID 35735 was attempted; it
had already exited before the signal (no such process). The foreign job was
left intact; our CLI suite remained queued. This violates the single-Vitest
rule; affected runs are retained and are not clean serialized verification.
The queued CLI suite reached the one-minute lock timeout (exit 75): no CLI
test started. The next targeted command again ran the root relay/collector
preamble before queuing; that overlap is also retained and not counted as clean
verification. Further package runs must invoke the CLI workspace directly.
Rerun affected relay/collector and CLI-contract checks only after the queued
CLI suite completes and a process inventory confirms no other Vitest run.
