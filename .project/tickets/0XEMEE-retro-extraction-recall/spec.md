# Spec: Retro re-arm timing (0XEMEE — Phase 0)

Engineering contract (scope / out_of_scope / done_when) lives in `ticket.md`.
This file holds the **why and who** for the **timing** slice. The full 0XEMEE
evidence (the tier eval + the timing concept test) lives in `ticket.md`.

## Intent

The invisible retro is supposed to catch safeword's OWN friction across a whole
session and file it. Today it fires once, at the first Stop with ≥3 tool-uses
(0.2% into a real session — concept-tested), then a once-per-session sentinel
suppresses it forever, so it reads only the opening. This slice replaces the
boolean sentinel with a **growth-gated re-arm**: re-fire on later Stops once the
transcript has grown enough, so the last fire sees ~the whole session — while the
existing occurrence ledger keeps re-fires from opening duplicates.

## Persona

**The safeword maintainer (SM — dogfooding).** Runs long cloud/local sessions
that hit safeword's own rough edges *throughout* — most friction surfaces mid- and
late-session. They never see the retro run (invisible by design, 7D8PJP); they
only see its output: issues on `ArcadeAI/safeword`. They want those issues to
reflect the whole session, without the retro becoming a cost sink or a duplicate
spammer.

## Jobs To Be Done

### retro-rearm-timing.TB1 — Fire on a session worth reviewing

**Persona:** Safeword Maintainer (SM)

> When my session did real work, run the retro; when it was a trivial Q&A, don't
> bother. And remember that it ran, so a later check can tell what's new since.

#### retro-rearm-timing.TB1.AC1 — First substantial Stop fires and records the count

At the first Stop where the transcript shows ≥ the substance threshold of
tool-use events, the re-arm decision runs extraction and records the transcript's
tool-use count as the last-fired count. A below-threshold session never fires and
records nothing.

### retro-rearm-timing.TB2 — See the whole session, not just its opening

**Persona:** Safeword Maintainer (SM)

> Most of my friction shows up after the first turn. The retro has to re-read the
> session as it grows so late friction still gets surfaced — without re-running on
> every single Stop.

#### retro-rearm-timing.TB2.AC1 — Growth-gated re-fire

A later Stop re-fires only once the transcript has grown by ≥ the re-arm growth
threshold of tool-uses since the last fire (updating the last-fired count); below
that growth it does not re-fire (cost bound), leaving the count unchanged.

#### retro-rearm-timing.TB2.AC2 — The re-fire reads the current, fuller transcript

A re-fire hands the *current* transcript (including end-of-session content added
since the first fire) to extraction — not the shorter first-fire transcript.

#### retro-rearm-timing.TB2.AC3 — A back-half finding is surfaced

A friction that appears only after the first fire reaches the egress pipeline on
the re-fire (the recall win the concept test predicts).

### retro-rearm-timing.TB3 — Never open duplicate issues

**Persona:** Safeword Maintainer (SM)

> Re-reading the session must not file the same bug twice. New friction gets a new
> issue; friction an earlier fire already filed does not.

#### retro-rearm-timing.TB3.AC1 — Re-fires dedupe via the occurrence ledger

A finding whose manifestation was already filed by an earlier fire opens no
duplicate; a genuinely new manifestation on a re-fire is filed.

### retro-rearm-timing.NTB1 — Bounded, guarded, fail-open

**Persona:** Safeword Maintainer (SM)

> The retro must never break my Stop, never recurse into itself, and must key its
> state to the right session.

#### retro-rearm-timing.NTB1.AC1 — Recursion guard first; state-write failure never blocks

A retro headless child never fires (guard evaluated before any other gate). A
failure to record the last-fired count still lets the fire proceed and never
throws (fail-open).

#### retro-rearm-timing.NTB1.AC2 — Re-arm state keyed to the resolved session id

The last-fired count is stored under the session id resolved by the documented
precedence (cloud id before local id).

## Outcome

At a long session's later Stops the retro re-reads the fuller transcript; the last
fire before the session goes quiet sees ~the whole session; back-half friction is
filed; nothing already filed is re-filed; extra reads are bounded by the growth
gate. The maintainer's tracker reflects the whole session's friction, invisibly.

## Non-goals (this slice)

- Tier (A), coverage (B), and the eval scorer (C) are later phases under this
  ticket, measured by the scorer — not in the timing slice.
- Transport/filing in cloud is BNGK9W (#568).
- The #563 friction-gate *mechanism* is #563's; this slice consumes it.
