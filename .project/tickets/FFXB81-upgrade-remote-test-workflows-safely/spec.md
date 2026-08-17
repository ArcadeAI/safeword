# Spec: Upgrade remote-test workflows safely

## Intent

When Safeword first changes its shipped remote-test workflow, upgrade every
previously released Safeword-owned version without adopting customer changes or
exposing partial workflow bytes.

## Activation condition

This feature remains blocked while only workflow v1 exists. It must move through
normal BDD intake before any pull request changes the released v1 workflow
bytes. HWZZJ8 preserves those exact bytes as an immutable fixture, and its
release-contract test names FFXB81 when current bytes drift.

## Preserved design evidence

- Ownership history is append-only over exact released byte sequences after the
  single CRLF-to-LF comparison normalization.
- Runtime configuration and filesystem discovery cannot add ownership history.
- Historical replacement writes and syncs a fresh private file, revalidates
  ownership, and atomically renames only over an admitted predecessor.
- Customer-owned, unsafe, absent, or indeterminate revalidation results never
  authorize replacement.
- Unknown crash residue is ignored; ordinary cleanup removes only the current
  invocation's private entry.
- H136BP's recovery feature is supporting input to this ticket and should be
  reconciled against the actual v1→v2 packaged migration before implementation.

## Jobs To Be Done

### Technical Builder — Upgrade without surrendering CI ownership

**Persona:** Technical Builder (TBU)

> When Safeword improves its remote-test workflow, I want my unedited Safeword
> workflow upgraded automatically while my own changes remain untouched, so I
> can adopt the release without re-auditing lost CI work.

#### Rule TBU1.R1 — Only an exact previously released Safeword workflow can authorize replacement

#### Rule TBU1.R2 — Upgrade interruption exposes a complete predecessor or successor and retry remains safe

## Outcomes

- Every released predecessor remains recognizable.
- Edited or unknown bytes remain customer-owned.
- The packaged CLI proves the real predecessor-to-successor migration.
- A failed or interrupted upgrade never exposes partial workflow bytes.
- History retirement requires an explicit migration decision.

## Open Questions

defer: Exact v2 bytes and whether v1 needs any semantic migration are unknowable until the first superseding workflow is proposed.
