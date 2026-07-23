# Impl Plan: Keep skill verification proof working in normal shell commands

**Status:** planned

## Approach

**Riskiest assumption:** both runtime hooks see the complete chained command before
any helper process runs, so they can queue its proofs in execution order. Prove
it first with the distinct-chain scenario: feed one real Codex/Cursor hook
payload containing relative `verify && audit`, run the real helper twice without
an environment session id, and assert ordered log entries.

1. **Recognized paths and ordered command discovery** — add a plural parser in
   `templates/hooks/lib/cursor-run-identity.ts` that yields every helper command
   in shell-segment order, retains duplicates, and accepts only the exact
   relative path or an absolute helper rooted at the command's installed
   project. Queue only a contiguous helper-only `&&` chain: stop before any
   other command so a short-circuited tail is never armed. Primary proof:
   unit tests for relative, same-root absolute, foreign-root absolute, distinct,
   repeated, quoted, and lookalike inputs.
2. **Runtime-specific queue** — replace the single record with an ordered queue
   in each existing Codex/Cursor cache file. A helper consumes only a fresh
   matching head; a stale or mismatched head clears the queue and records
   nothing. Primary proof: unit tests for ordered consumption, repeated skills,
   expiry, mismatch, and runtime isolation. The queue is intentionally a
   sequential bridge, not a concurrent-session isolation mechanism.
3. **Real bridge wiring** — have each adapter enqueue all parsed commands after
   its existing allow path; keep the review-stamp cache unchanged. Primary
   proof: integration tests run the real Codex and Cursor adapters followed by
   the real helper, mocking only child processes and temporary filesystem state.
4. **Dogfood parity and regressions** — sync the changed template hooks into
   `.safeword/hooks`, then verify relative and absolute single commands,
   distinct/repeated chains, short-circuited tails, quoted mentions, lookalikes,
   foreign-root paths, missing identity, expiry, and out-of-order requests across
   both bridges.

The manual Gherkin source describes the behavior; Vitest integration tests are
the executable hook-payload harness because a Cucumber process cannot supply
native Codex/Cursor hook payloads.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Command recognition | Return a contiguous helper-only `&&` prefix in order, rooted at the current project | Return every recognized segment; return only the first; reparse separately in each adapter | Every segment can arm an unexecuted tail after `false`; first-only loses valid chains; separate parsers drift. |
| Cache representation | One ordered queue in each existing runtime-specific cache file | One dynamic file per skill; one shared cache; one entry per skill | A queue handles duplicates without dynamic filenames and preserves execution order. It does not claim concurrent-session isolation because the helper receives no caller session identity. |
| Invalid queue handling | Clear the queue on stale or wrong requested head | Skip ahead to a later matching entry; retain stale data | Skipping or retaining can let a command consume another command's proof; clearing fails closed. |
| Proof scope | Unit coverage plus real adapter-to-helper integration coverage | Unit-only parser/cache tests; full Cucumber steps | Unit-only tests miss runtime wiring; Cucumber cannot model native hook payloads. |

The choice follows the POSIX execution order for `&&` lists and the existing
runtime-specific cache pattern: [POSIX Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html).

## Arch alignment

Honors `ARCHITECTURE.md`'s template-first and dogfooding design: change
`packages/cli/templates/` first, then synchronize the installed `.safeword/`
mirror. Reuses the existing shared shell tokenizer and separate Codex/Cursor
bridge files; no new dependency or public API.

## Known deviations

The cache remains project-scoped and runtime-scoped rather than session-scoped.
This is acceptable only for a normal sequential hook-to-helper command flow:
the runtimes do not pass the helper a current session identity with which to
verify ownership. Concurrent session isolation is explicitly deferred until
that runtime capability exists.

## Doc impact

skip: internal hook reliability change; existing skill instructions already
document the supported helper command and need no customer-facing wording change.

## Assessment triggers

Revisit the queue contract if a new runtime needs this bridge, helpers become
parallel/asynchronous instead of sequential shell commands, or the runtime
begins passing session identity directly to helper processes.
