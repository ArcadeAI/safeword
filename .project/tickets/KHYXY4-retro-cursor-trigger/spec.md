# Spec: retro auto-trigger — Cursor

## Intent

Extend the retro auto-trigger (Claude in FTCQGD, Codex in 53DQJZ) to **Cursor**, so
a real Cursor session fires `safeword retro` on its own — once per substantial
session, while alive. The official Cursor hooks docs confirm every hook (incl.
`stop`) carries a base `transcript_path` to a Claude-shaped JSONL transcript, so
the Claude tool-use counter applies unchanged; only the session-id source and the
output channel are Cursor-specific. Cursor's output is a `followup_message` (it
auto-submits a new turn — the strongest nudge of the three), and the retro path
must coexist with `cursor/stop.ts`'s existing quality-review followup.

## Intake Brief

- **Requested by:** alex@arcade.dev (Safeword Maintainer). Completes the
  cross-agent set (Claude + Codex + Cursor) so the friction stream fills itself
  whatever tool a builder uses.
- **Cost of inaction:** Cursor sessions never auto-retro — that segment's
  qualitative-friction signal is lost.
- **Reversibility:** two-way door. A retro path added to the existing
  `cursor/stop.ts` + reused core; surfaces a followup only, no egress here.

## References

- figure-it-out (2026-06-28): official docs ([cursor.com/docs/agent/hooks](https://cursor.com/docs/agent/hooks),
  [cursor.com/docs/hooks](https://cursor.com/docs/hooks)) — every hook carries
  `transcript_path`; the repo's stale `cursor/stop.ts` interface omitted it.
- Parent: RV9JT4. Siblings: FTCQGD (Claude, done), 53DQJZ (Codex, done).
- Reuses: `lib/retro-trigger.ts` (countToolUses, sentinel, decideRetroNudge).
- Existing `cursor/stop.ts` already emits a quality-review `followup_message`.

## Personas

- **Safeword Maintainer (SM)** — wants the stream to fill itself from Cursor
  sessions too, same no-duplicate / no-noise guarantees.
- **Technical Builder (TB)** — runs safeword under Cursor; wants zero-effort
  reporting and a hook that never breaks their turn or fights the existing
  quality-review prompt.

## Vocabulary

- **Cursor transcript** — the JSONL conversation transcript at the stop payload's
  `transcript_path` (Claude-shaped: `message.content[].type === 'tool_use'`).
- **followup_message** — Cursor's stop-hook output that auto-submits a new turn;
  the channel the retro nudge rides.
- **Quality-review followup** — the existing `cursor/stop.ts` behavior that
  injects a review prompt after edits. Retro must compose with it, not clobber it.

## Jobs To Be Done

### retro-cursor-trigger.SM1 — The retro stream fills itself from Cursor sessions too

**Persona:** Safeword Maintainer (SM)

> When a real Cursor session ends, I want retro to have fired on its own — once,
> while alive — reading Cursor's transcript, with no duplicates and no noise, and
> without disrupting the review prompt Cursor users already rely on.

#### retro-cursor-trigger.SM1.AC1 — Fires once on a substantial Cursor session via followup_message

A substantial, not-yet-nudged Cursor session (status `completed`) emits a
`followup_message` whose text carries the live `transcript_path` and points at the
retro guide, counting `tool_use` from the transcript. A trivial session emits no
retro followup.

#### retro-cursor-trigger.SM1.AC2 — Idempotent and cloud-safe, reusing the shared core

The once-per-session sentinel (shared) suppresses a second retro followup in the
same session; a different session id still fires. The session id resolves from the
Cursor `conversation_id` (session-stable). Reads the supplied `transcript_path`;
never guesses one.

#### retro-cursor-trigger.SM1.AC3 — Coexists with the existing quality-review followup

On a stop where the quality-review followup fires, retro yields (one
`followup_message` per stop), and the retro sentinel is NOT consumed — so retro
still fires on a later stop. The existing quality-review behavior is unchanged.

### retro-cursor-trigger.TB1 — Reported with zero effort; never breaks my Cursor turn

**Persona:** Technical Builder (TB)

> When safeword is rough in a Cursor session, I want it reported for me — and the
> hook must never break or wrongly continue my turn.

#### retro-cursor-trigger.TB1.AC1 — Fails open and respects non-completion

Malformed stdin, an absent `transcript_path`, an unreadable transcript, or a
non-`completed` status all resolve to: no retro followup, valid output, the turn
is never wrongly continued. The sentinel is left unset on these paths.

## Rave Moment

skip: inherits the epic (`#344`) — child slice.

## Outcomes

- A substantial Cursor session auto-submits one retro followup pointing at the
  guide, counting tool_use from the hook-provided transcript; a trivial one does
  not.
- Re-fires within a session are suppressed by the shared sentinel; the existing
  quality-review followup is never clobbered.
- The hook never wrongly continues the turn: bad input / non-completion → no retro
  followup.

## Open Questions

- **Empirical: is `transcript_path` non-empty and Claude-shaped at `stop` time?**
  defer: built against Claude-shaped fixtures (reusing countToolUses); validated by
  a dump-payload spike in a live Cursor session. If the shape differs, add a
  `countToolUsesCursor` variant (the seam already supports it).
- **Compose vs precedence with the quality-review followup.** Leaning: quality
  review takes the stop (it's a human-review gate); retro fires on a non-review
  stop, sentinel only consumed when retro actually emits. defer: confirm at
  scenario-gate.
