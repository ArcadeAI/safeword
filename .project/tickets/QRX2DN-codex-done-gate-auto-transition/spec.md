# Spec: Close Codex tickets when evidence passes

## Intent

Codex has the same evidence artifacts as the other runtimes, but its Stop
adapter does not transition a validated ticket to done. The ready-PR guard then
rejects otherwise-ready work and makes builders add a separate status-only
commit. Codex should make that state transition in its Stop lifecycle, using
the shared evidence checks already trusted by Cursor.

## Intake Brief

- **Requested by:** Retro burn-down automation, from GitHub issue #1388.
- **Cost of inaction:** Every affected Codex PR has an avoidable guard failure and a mechanical done-flip that obscures the real verification diff.
- **Reversibility:** Remove the adapter-only completion call without changing ticket format, evidence records, Git history, or public APIs.

## References

- GitHub issue #1388: https://github.com/ArcadeAI/safeword/issues/1388
- CI guard: `scripts/check-pr-ticket-done.ts`
- Existing Cursor enforcement: `packages/cli/templates/hooks/cursor/pre-tool-quality.ts`
- Shared predicate: `packages/cli/templates/hooks/lib/done-gate.ts`

## Personas

- Technical Builder (TBU): expects Safeword to carry verified Codex work through the ready-PR guard without a ceremony-only commit.
- Safeword Maintainer (SWM): needs one evidence predicate rather than a drifting Codex-specific definition of ready-to-close.

## Jobs To Be Done

### codex-done-gate.TBU1 — Complete verified Codex work without a ceremony-only commit

#### codex-done-gate.TBU1.R1 — Valid evidence completes the session-bound ticket

The Codex Stop adapter transitions only the ticket bound to the current Codex
session from in-progress done-phase state to done when all shared evidence
checks pass. An unbound, non-done-phase, or already-done ticket is never an
implicit fallback closure target.

When Codex Desktop omits `session_id` from a PostToolUse payload but exposes
`CODEX_THREAD_ID` to the hook process, PostToolUse and Stop resolve that same
durable identity. The edited ticket is therefore bound to the session Stop
evaluates; if neither durable identity is available, the session stays unbound.

#### codex-done-gate.TBU1.R2 — Failed evidence remains visible and cannot close work

When any shared evidence check fails, Codex leaves the ticket in progress and
returns a `decision: "block"` continuation containing the predicate's exact
remediation. It must not concatenate an architecture or filing continuation.

### codex-done-gate.SWM1 — Keep completion behavior composable and non-invasive

#### codex-done-gate.SWM1.R1 — Completion composes with existing Codex Stop work

Completion does not skip retro extraction. Failed evidence has first visible
continuation priority over architecture and filing. After successful transition,
architecture keeps its priority over the filer and the filer remains visible
when no architecture advisory is due. For an eligible completion, Codex
captures any architecture advisory while the ticket is still in-progress/done,
discards it on evidence failure, and returns it only after a successful state
transition.

An unbound Codex session retains the existing global-active-ticket fallback
only for the architecture advisory; it must never become a lifecycle-mutation
fallback.

#### codex-done-gate.SWM1.R2 — Completion never writes Git state

The hook changes only validated ticket state. It never stages, commits, or
opens a PR; those remain builder-owned decisions.

## Outcomes

- Passing evidence changes only the bound ticket to done.
- Failed evidence leaves it in progress and emits exact remediation.
- Retro, filer, and architecture Stop behavior remains observable and ordered.
- The ready-PR guard can see done status in the same coherent change as verification.

## Open Questions

defer: Codex-specific session invocation proof is outside this low-risk ticket;
the established shared predicate is the current cross-runtime evidence contract.
