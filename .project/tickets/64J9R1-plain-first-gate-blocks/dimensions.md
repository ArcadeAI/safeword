# Dimensions: plain-first gate blocks

The behavior under test is a **property of the rendered hard-block message**.
Two dimensions partition the space; a third fixes conformance direction so every
rule gets a rejection example (the guard must catch a violation, not just pass a
clean message).

## Dimension 1 — Which hard block fires

Each gate builds its own message, so each is a partition. Coverage picks
representative gates per rule rather than the full cross-product (7 gates × 4
rules would be 28 near-duplicates); the guard (Dimension 3) runs over **all**
gates, closing the gap that per-rule sampling leaves.

| Partition           | Trigger                                                    |
| ------------------- | ---------------------------------------------------------- |
| LOC                 | uncommitted project LOC crosses the threshold              |
| phase               | tool used in a phase whose prerequisite artifact is absent |
| plan                | feature enters implement with no valid impl-plan           |
| done                | stop attempted without verify evidence                     |
| spec/JTBD/criteria  | test-definitions.md attempted without spec/JTBD/criteria   |
| bash-ledger-write   | a write to the ledger via bash is attempted                |
| process-kill        | a broad process-kill command is attempted                  |

## Dimension 2 — Which plainness invariant (the Rules)

| Partition            | Rule | Invariant                                              |
| -------------------- | ---- | ------------------------------------------------------ |
| leads-plain          | R1   | first sentence is plain; no file/phase/verdict token first |
| one-next-action      | R2   | exactly one concrete next action named                 |
| no-bare-jargon       | R3   | no bare internal term stands alone; glossed or replaced |
| self-sufficient      | R4   | understandable + actionable without `/explain`         |

## Dimension 3 — Conformance direction

| Partition | Meaning                                                              |
| --------- | ------------------------------------------------------------------- |
| conforms  | a rewritten block message satisfies the invariant (guard passes)    |
| violates  | a message that breaks the invariant is flagged by the guard (`@rejection`) |

## Partitioning notes

- **Boundary — "exactly one" action (R2):** zero actions and two actions are both
  violations; the conforming case is exactly one. Both boundaries feed rejection
  scenarios.
- **Domain knowledge:** the done gate and plan gate carry the densest jargon
  today (`verify.md`, `impl-plan.md`, phase names), so they're the natural
  representative gates for R1/R3; the LOC gate is already near-plain, so it's the
  representative "easy" case that must still name one action (R2).
- **Enforcement unchanged is not a behavioral dimension here** — it's an
  invariant across all scenarios (no gate trigger/threshold changes), asserted
  once as a guard that the set of gates and their fire conditions are untouched,
  not partitioned.
