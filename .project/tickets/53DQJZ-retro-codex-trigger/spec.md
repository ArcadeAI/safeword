# Spec: retro auto-trigger — Codex

## Intent

Extend the retro auto-trigger (FTCQGD shipped it for Claude) to **Codex**, so a
real Codex session fires `safeword retro` on its own — once per substantial
session, while alive — without anyone remembering. The trigger mechanism is
portable; the **transcript substrate is not**: Codex's Stop hook hands a
`transcript_path` pointing at the Codex-native rollout JSONL (`{type, payload}`
events), whose tool-use signal is `function_call` / `exec_command_begin` /
`mcp_tool_call_begin` — not Claude's `message.content[].tool_use`. So the shared
core's tool-use counter becomes a per-agent strategy, and Codex emits its Stop
output as a `{decision:"block", reason}` continuation, not `additionalContext`.

## Intake Brief

- **Requested by:** alex@arcade.dev (Safeword Maintainer). FTCQGD proved the
  pattern under Claude; this brings the same self-filling stream to Codex users.
- **Cost of inaction:** Codex sessions never auto-retro — the qualitative-friction
  signal is lost for every Codex builder.
- **Reversibility:** two-way door. One adapter + one `config.toml` Stop entry +
  one counter variant; surfaces a continuation only, performs no egress itself.

## References

- figure-it-out (2026-06-28, current evidence): Codex Stop payload carries
  `transcript_path`; rollout shape differs from Claude.
- [Codex Hooks](https://developers.openai.com/codex/hooks),
  [rollout trace format](https://dev.to/milkoor/reverse-engineering-codex-cli-rollout-traces-3b9b).
- Parent: RV9JT4. Sibling: FTCQGD (Claude, done). Cursor follow-on: KHYXY4.
- Reuses: `lib/retro-trigger.ts` (sentinel, resolveSessionId, decideRetroNudge),
  `lib/run-identity.ts` (Codex id via turn_id/CODEX_THREAD_ID/session_id).

## Personas

- **Safeword Maintainer (SM)** — wants the friction stream to fill itself from
  Codex sessions too, with the same no-duplicate / no-noise guarantees as Claude.
- **Technical Builder (TB)** — runs safeword under Codex; wants zero-effort
  reporting and a hook that never breaks their turn.

## Vocabulary

- **Codex rollout** — Codex's session JSONL at the Stop payload's
  `transcript_path`: one `{type, payload}` event per line.
- **Codex tool event** — a rollout event that represents the agent doing work:
  `function_call`, `exec_command_begin`, or `mcp_tool_call_begin`. The Codex
  substance measure (analogue of Claude's `tool_use` content items).
- **Continuation** — Codex's Stop output `{decision:"block", reason}`, which
  injects `reason` as a follow-up prompt (a stronger nudge than passive context).

## Jobs To Be Done

### retro-codex-trigger.SM1 — The retro stream fills itself from Codex sessions too

**Persona:** Safeword Maintainer (SM)

> When a real Codex session ends, I want retro to have fired on its own — once,
> while alive — counting Codex's own tool events, with no duplicate filing and no
> noise from trivial sessions, exactly as it does under Claude.

#### retro-codex-trigger.SM1.AC1 — Counts Codex tool events, not Claude tool_use

The Codex substance gate counts `function_call` / `exec_command_begin` /
`mcp_tool_call_begin` events in the `{type,payload}` rollout. A substantial Codex
rollout is judged substantial; non-tool events (`agent_reasoning`, `event_msg`,
`token_count`) and malformed lines do not count.

#### retro-codex-trigger.SM1.AC2 — Fires once on a substantial Codex session via a continuation

A substantial, not-yet-nudged Codex session emits one `{decision:"block", reason}`
continuation whose `reason` carries the live `transcript_path` and points at the
retro guide. A trivial session emits no continuation.

#### retro-codex-trigger.SM1.AC3 — Idempotent and cloud-safe, reusing the shared core

The once-per-session sentinel (shared with Claude) suppresses a second
continuation in the same session; a different session id still fires. The session
id resolves from the Codex payload/env (`turn_id` / `CODEX_THREAD_ID` /
`session_id`). Reads the supplied `transcript_path`; never guesses one.

### retro-codex-trigger.TB1 — Reported with zero effort; never breaks my Codex turn

**Persona:** Technical Builder (TB)

> When safeword is rough in a Codex session, I want it reported for me — and the
> hook must never break or wrongly interrupt my turn.

#### retro-codex-trigger.TB1.AC1 — Fails open with valid JSON

Malformed stdin, an absent `transcript_path`, or an unreadable rollout file all
resolve to: emit valid JSON with no blocking decision (Codex Stop requires JSON
output), exit 0, sentinel untouched. The turn is never wrongly continued.

#### retro-codex-trigger.TB1.AC2 — The Claude path is unchanged

Factoring `countToolUses` into a per-agent strategy is behavior-preserving for
Claude: the existing FTCQGD Claude trigger keeps its exact behavior (proven by the
existing FTCQGD test suite staying green).

## Rave Moment

skip: inherits the epic (`#344`) — child slice.

## Outcomes

- A substantial Codex session emits one continuation pointing at the retro guide,
  counting Codex tool events; a trivial one emits a silent valid-JSON response.
- Re-fires within a session are suppressed by the shared sentinel; the Claude
  trigger's behavior is unchanged.
- The hook never breaks the Codex turn: any bad input → valid JSON, exit 0.

## Open Questions

- **Empirical: does `transcript_path` point at a non-empty raw rollout at Stop
  time?** defer: built against rollout fixtures; validated by a dump-payload spike
  in a live Codex run (this environment likely can't run Codex). If it points at a
  normalized/empty file, fall back to resolving the newest rollout for the session.
- **Continuation disruption.** A `{decision:block}` continuation forces a follow-up
  turn. Acceptable as the nudge mechanism (stronger than passive context), gated by
  the once-per-session sentinel. defer: confirm tone/heuristic at scenario-gate.
