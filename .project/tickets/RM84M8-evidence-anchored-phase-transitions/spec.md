# Spec: Evidence-anchored phase transitions (SHA-per-transition provenance)

Issue #809 · child of epic #808 (deliverable-boundary workflow enforcement).

## Intent

Make a feature ticket's `phase:` advance carry a machine-checkable commit-SHA
anchor — the same evidence guarantee the R/G/R ledger already has per tick — so
a transition can't be forged by a raw `sed`/Bash write without leaving a
detectable, unanchored trace.

## Intake Brief

- **Requested by:** alex (TheMostlyGreat) — epic #808, from the #644 session-divergence audit.
- **Cost of inaction:** Phase state stays self-declared and forgeable — a `phase:` frontmatter edit via raw `sed`/Bash advances a feature ticket with no evidence and no way to tell a real transition from a fabricated one. This is #644 cluster 1 (self-declared, malleable state); child #810's boundary gate must reconcile against these anchors, so without them #810 has nothing to hard-block on.
- **Reversibility:** Two-way door. The anchor is additive frontmatter (a new optional field) plus a pure detection predicate; nothing existing is removed and the format can still change before #810 consumes it. Not a public API or a data migration.

## References

- Epic #808 — deliverable-boundary workflow enforcement.
- #644 — session-divergence audit (evidence/gap record); cluster 1 = self-declared state.
- #693 `phase-provenance.ts` — validates transition legality (reused, not rebuilt).
- #721 `bash-ledger-writes.ts` — blocks the Bash ledger-write channel (the "channel implicit" precedent).
- Ledger SHA model — `ledger-validation.ts` `checkSha`, `ledger-git.ts` rebase-aware resolver (the anchor's design template).

## Personas

- Safeword Maintainer (SM) — builds and extends safeword's gates; needs enforcement state that is trustworthy and verifiable before it ships.

## Surfaces

Affected:

- skip: none — the anchor lives in ticket.md frontmatter and pure hook-lib logic that runs identically across every agent runtime (Claude Code, Cursor, Codex, cloud). No surface-specific behavior; nothing to tag.

Unaffected:

- Claude Code / Cursor / OpenAI Codex and their cloud variants — the write-path gate is already harness-general (`phase-provenance.ts` runs in each pre-tool adapter); this change adds a field + predicate they all read the same way.

## Vocabulary

- **Anchor** — a commit SHA recorded alongside a workflow state change, cross-checkable against git history; the unit of evidence #808 introduces.
- **Unanchored** — a forward phase advance carrying no anchor, or one whose SHA is malformed or not reachable from HEAD.

## Jobs To Be Done

### evidence-anchored-phase-transitions.SM1 — Tell a real phase advance from a forged one

**Persona:** Safeword Maintainer (SM)

> When a feature ticket's `phase:` advances, I want the transition to carry a
> commit-SHA anchor that's cross-checkable against git history, so I can
> programmatically distinguish a real transition from one a raw `sed`/Bash write
> forged — the same evidence guarantee the R/G/R ledger already has.

#### evidence-anchored-phase-transitions.SM1.AC1 — A legitimate forward phase advance records a commit-SHA anchor for the phase entered

The anchor is per-phase and appended, never an overwritten scalar — so each phase entered keeps its own evidence and #810 can reuse the ledger's distinct-SHA collision check (a copy-pasted `HEAD` can't silently pass across every phase).

#### evidence-anchored-phase-transitions.SM1.AC2 — A forward advance whose anchor is missing or not a valid, reachable SHA is programmatically detectable as unanchored

Detection is a pure, unit-tested predicate. It fires only on the policed act — a feature ticket's forward phase advance. It does not false-positive on backward moves / re-declarations (rework, never gated, mirroring `phase-provenance.ts`) nor on legacy tickets at rest (the gate polices transitions, not history).

## Rave Moment

skip: table-stakes — forgery-resistance plumbing for the SM; the persona-facing "whoa" belongs to #810's boundary gate, not the anchor substrate.

## Outcomes

- A forward phase advance in a feature ticket writes an anchor tying the entered phase to a commit SHA.
- An advance whose anchor is missing, malformed, or not reachable from HEAD is detected as unanchored; backward moves, re-declarations, non-feature tickets, and at-rest legacy tickets are left silent.
- Anchor validity and transition legality reuse safeword's existing ledger and phase-provenance checks — one detection path, not a duplicate.
- No new prose nag: the invariant is expressed in code, per the de-prescribe thesis (#765).

## Open Questions

_None — the anchor model (SHA-per-transition, channel implicit) was settled via `/figure-it-out`; see the Design Decision recorded in ticket.md. Anchor SHA semantics mirror the ledger's `checkSha` (7–40 hex, HEAD-reachable via the rebase-aware resolver)._
