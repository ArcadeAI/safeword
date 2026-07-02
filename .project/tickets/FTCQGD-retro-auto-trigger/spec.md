# Spec: retro auto-trigger (Claude-first)

## Intent

Make `safeword retro` fire on its own at the end of real sessions — reliably in
ephemeral cloud containers — so the qualitative-friction stream doesn't depend on
a human remembering to run `/retro`. A `stop-retro.ts` Claude Code **Stop** hook
surfaces a fact-phrased nudge that directs the agent to run the retro pipeline
(fresh-context extraction → `safeword retro`) **while the session is alive**, at
most once per substantial session. Stop-anchored, not SessionEnd: friction is
already in the transcript the moment it happens, and the occurrence ledger makes
re-fires idempotent, so early-firing is both safe and necessary (SessionEnd is
killed before async work finishes in cloud and the transcript is deleted on
container reclaim).

## Intake Brief

- **Requested by:** alex@arcade.dev (Safeword Maintainer). RV9JT4 shipped the
  retro pipeline + a manual `/retro`; this slice removes the "someone has to
  remember" gap so the stream fills itself.
- **Cost of inaction:** retro exists but only runs when a human types `/retro`.
  Most sessions skip it, so the qualitative-friction signal RV9JT4 built is mostly
  unrealised.
- **Reversibility:** two-way door. One Stop hook + one settings.json registration;
  surfaces context only, performs no egress itself (the pipeline it nudges owns
  egress). Trivial to remove.

## References

- Parent: `RV9JT4-retro-transcript-mining` (the pipeline this fires).
- Cloud-firing research: `code.claude.com/docs/en/hooks`,
  `…/claude-code-on-the-web`, gh `anthropics/claude-code#41577` (SessionEnd killed
  on async work), `#69750` (session lifecycle hooks).
- Pattern sibling: `templates/hooks/stop-self-report.ts` — the established
  fact-phrased `additionalContext` Stop emitter this mirrors.
- Cross-agent follow-ons: `53DQJZ` (Codex Stop), `KHYXY4` (Cursor stop).

## Personas

- **Safeword Maintainer (SM)** — owns the friction stream. Wants retro to fire on
  its own at the end of real sessions, with no duplicate filing and no noise from
  trivial sessions. Primary beneficiary. (Also a TB when dogfooding.)
- **Technical Builder (TB)** — runs safeword on a real project. Wants their
  friction reported with zero effort and the hook to never get in the way of their
  turn.

## Vocabulary

- **Substantial session** — a session whose transcript shows real work, measured
  by tool-use / turn count in the JSONL crossing a threshold. The transcript is
  the substance measure; no separate counter.
- **Nudge** — a fact-phrased line surfaced via Stop
  `hookSpecificOutput.additionalContext` that states retro is available and carries
  the live `transcript_path` + a pointer to the retro guide. A statement of fact,
  never an imperative (imperatives trip injection defenses and get echoed verbatim
  — the `stop-self-report.ts` learning).
- **Once-per-session sentinel** — a per-session marker (keyed by resolved session
  id) that makes the second and later Stop invocations stay silent, so one session
  nudges at most once.

## Jobs To Be Done

### retro-auto-trigger.SM1 — The retro stream fills itself, reliably and cleanly

**Persona:** Safeword Maintainer (SM)

> When a real session ends, I want retro to have fired on its own — once, while the
> session was alive — without anyone remembering to run it, without firing on
> trivial sessions, and without ever driving a duplicate issue.

#### retro-auto-trigger.SM1.AC1 — Fires once on a substantial session

A session whose transcript crosses the substance threshold gets exactly one retro
nudge, surfaced at a Stop, carrying the live `transcript_path` and a pointer to the
retro guide so the agent can run the pipeline.

#### retro-auto-trigger.SM1.AC2 — Stays silent on a trivial session

A session whose transcript is below the substance threshold produces no nudge — no
noise, no wasted extraction on a session with nothing to report.

#### retro-auto-trigger.SM1.AC3 — Never nudges twice in one session

After the first nudge, the once-per-session sentinel makes every later Stop in the
same session stay silent, so re-fires can't drive duplicate filing (the occurrence
ledger covers idempotency across sessions; the sentinel covers within a session).

#### retro-auto-trigger.SM1.AC4 — Runs while the session is alive; never depends on SessionEnd

The hook is Stop-anchored and reads the live `transcript_path` from the hook input
— it never constructs or guesses a path, and never relies on a SessionEnd/teardown
event. It resolves the session id in cloud (`CLAUDE_CODE_REMOTE_SESSION_ID`) and
local (`session_id` / `CLAUDE_SESSION_ID`) alike.

### retro-auto-trigger.TB1 — Reported with zero effort; never in my way

**Persona:** Technical Builder (TB)

> When safeword is rough mid-session, I want it reported for me with zero effort —
> and I never want the hook itself to break or interrupt my turn.

#### retro-auto-trigger.TB1.AC1 — The nudge is a fact, not a command

The surfaced text is a statement of fact (mirroring `stop-self-report.ts`), never
an imperative — so it informs the agent without tripping prompt-injection defenses
that would surface it verbatim instead of acting on it.

#### retro-auto-trigger.TB1.AC2 — The hook never breaks the turn

Malformed or missing stdin, an absent `transcript_path`, or an unreadable
transcript file all resolve to: emit nothing, exit 0. Stop is never blocked and the
turn is never interrupted by a hook error.

## Rave Moment

skip: inherits the epic (`#344`) — this is a child slice; the epic owns the
persona-facing rave.

## Outcomes

- A substantial Claude session surfaces exactly one fact-phrased retro nudge at a
  Stop, carrying the live transcript path and a guide pointer; the agent runs the
  pipeline while the session is alive.
- A trivial session surfaces nothing; a session that already nudged surfaces
  nothing on later Stops.
- The hook never blocks Stop: any error or missing input → empty output, exit 0.
- The substance gate + sentinel live in shared `lib/` so the Codex (53DQJZ) and
  Cursor (KHYXY4) adapters reuse one core.

## Open Questions

- **Substance threshold value + boundary inclusivity** — what count (tool-uses?
  user turns?) and is the threshold inclusive (`>=` nudges at exactly N)? Leaning:
  count assistant tool-use entries, inclusive `>=`. defer: resolve at scenario-gate.
- **Sentinel storage location** — `/tmp/safeword-retro-<sessionid>` vs under
  `.safeword/`. Leaning `/tmp` (ephemeral, matches `cursor/stop.ts`'s marker
  pattern; container is ephemeral anyway). defer: resolve at scenario-gate.
- **On by default?** — leaning yes (consistent with stop-self-report being on),
  gated by the same `selfReport`/retro config surface. defer: resolve at
  scenario-gate.
