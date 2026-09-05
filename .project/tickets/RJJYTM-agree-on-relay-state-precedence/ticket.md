---
id: RJJYTM
slug: agree-on-relay-state-precedence
type: task
phase: todo
status: todo
scope: |
  Decide, and then encode once, what a relay request's state is when several
  of its spool files exist at the same time. Today two functions in
  packages/cli/src/retro/relay-delivery.ts answer that question differently.

  Both classify the same five filename shapes with the same five parsers
  (parsePrimary, parseMaterializing, parseDeadLetter, parseClaim,
  parseRecoveryClaim), and both resolve collisions by a precedence number.
  They disagree:

    reservedRequestStates (:788)      missing 0 < primary 1 < dead-letter 2
                                      < materializing 3 < delivery 4 < recovery 5
    relaySpoolStatePrecedence (:2026) active 0 < materializing 1 < dead-letter 2
                                      < delivery-claim 3 < recovery-claim 4

  Mapping the vocabularies (primary == active, delivery == delivery-claim,
  recovery == recovery-claim), every rung lines up EXCEPT materializing and
  dead-letter, which are swapped. So for a request that has both a
  `<id>.materializing.json` and a `<id>.dead-letter.json`:

    reservedRequestStates      reports materializing
    relaySpoolStatePrecedence  reports dead-letter

  No test pins that collision — tests/retro/relay-delivery.test.ts:370
  exercises primary/materializing/dead-letter independently, never together —
  and nothing documents which is intended.

  THE QUESTION: should a dead-lettered request that also has a materializing
  file be treated as dead-lettered or as materializing, and should both call
  sites agree? Reservation/materialization decisions read the first; spool
  reporting and drain read the second. The divergence may be deliberate
  (different questions) or a latent bug; the code says nothing either way.

  WORK: answer the question, encode the answer in ONE ordered state table
  that both call sites consume, and pin the collision with a test. The two
  vocabularies should collapse to one at the same time, so a single word
  means a single state.

  BLOCKED ON: the semantics decision above. Do not unify the tables before
  it is answered — the two orders are not interchangeable, and this is
  durable recovery state.
out_of_scope:
  - The `path` payload difference between the two state shapes (mechanical once precedence is settled).
  - The forward/backward filename grammar duplication (path builders at :289-348 vs parsers at :457-491) — same seam, but safe to do only after the state table exists.
  - Any change to what the five filename shapes mean.
done_when:
  - One documented precedence order exists and both call sites read it.
  - A test asserts the materializing-plus-dead-letter collision resolves the intended way.
  - `primary`/`active`, `delivery`/`delivery-claim` and `recovery`/`recovery-claim` are one name each.
---

## Why now

Found while attempting the relay-state unification during a refactor sweep
(2026-09-05). The scout that proposed the unification asserted both functions
"resolve collisions by the same precedence" — they do not, and unifying on
that assumption would have silently changed one of the two paths.

Filed rather than fixed because the correct order is a domain decision about
durable recovery, not an implementation choice, and getting it wrong risks
re-materializing a dead-lettered request or dead-lettering one that is still
being written.

## Evidence

Verified the five filename patterns are mutually exclusive (all anchored, with
distinct literal infixes: `.json`, `.dead-letter.json`, `.materializing.json`,
`.claim.<id>.<n>.json`, `.recovery-claim.<id>.<n>.json`), so the differing
parser ORDER between the two functions is harmless. The precedence divergence
is the only real disagreement.
