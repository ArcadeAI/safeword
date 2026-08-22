# Spec: Recover remote-test setup after interruption

## Intent

Keep optional remote-test workflow setup retryable when a filesystem operation
fails or the process stops, without adding persistent recovery state.

## Boundary

HWZZJ8 manages one destination workflow. This document supplies its recovery
proof; it is not a separate production component or public command. Test
preference is outside the workflow mutation and therefore needs no coordinated
recovery.

## Rule

### H136BP.R1 — An interrupted command leaves a complete old or new workflow and an explicit retry remains safe

Setup/update selects a fresh private path for each invocation and creates it
exclusively in the workflow directory. It writes and syncs the complete file,
rechecks destination ownership, and renames the file into place. A deterministic
test adapter may pin the selected path to prove collision handling. Disable
freshly rechecks ownership before removal. Safeword reports success only after
the requested destination state is observed.

A failed or interrupted operation may leave a private temporary file. That file
is never ownership evidence and later invocations ignore it. Only the process
that created a temporary file attempts to remove it on its own ordinary failure
path. Unknown files are preserved.

## Required Recovery Cases

- Failure before rename preserves the prior destination.
- A failed rename preserves the old destination; interruption at the rename
  boundary may expose the old or new complete workflow, never a partial one.
- A repeat from absent, historical, or current destination remains idempotent.
  A repeat from customer-owned bytes preserves them and requests explicit
  move-aside confirmation through HWZZJ8's normal classifier.
- A destination change observed by the ownership recheck is preserved. A
  non-cooperating external write after that recheck races the immediately
  following rename; ordinary last-writer-wins filesystem semantics apply.
- Temporary-file creation, write, sync, rename, remove, or verification failure
  returns nonzero and leaves local testing available.
- HWZZJ8 owns destination and parent path rejection. This recovery proof owns
  only the temporary path selected for the current invocation. Creation fails
  closed if that path is occupied, and unrelated leftover temporary-looking
  objects are ignored.

No Git ref, journal, receipt, PID file, lease, or platform capability registry is
part of the design. If real incidents later demonstrate a need for coordination
across multiple managed files or concurrent setup processes, that is a new
requirement with its own evidence.

## Open Questions

None.
