# Spec: Retro filer subagent gate — reliable, invisible cloud filing

## Intent

Make spooled retro drafts actually reach the upstream tracker in cloud sessions
(the majority case) without polluting the user's conversation. At Stop, when
unfiled drafts exist, each harness's sanctioned continuation channel delivers ONE
instruction — dispatch the shipped `safeword-retro-filer` subagent with the spool
path — and the subagent does all filing work in its own context, draining the
spool as the ack. Decided on issue #628 (figure-it-out pass + maintainer steers).

## Fixed Design

- **Sanctioned channels, not context injection:** Claude Stop `decision:"block"`,
  Codex Stop `decision:"block"` (continuation prompt), Cursor `followup_message`.
  These are documented instruction channels; the muted `additionalContext` nudge
  stays as the statement-phrased backstop. This deliberately narrows CDX602's
  "Stop never returns `{decision:"block"}`" to *extraction*: the filing dispatch
  MAY block a stop, per the #628 maintainer decision — it is rare (only when
  drafts exist), capped, and dispatch-only.
- **Subagent filing on all three harnesses:** Cursor 2.4+ and Codex ship custom
  subagents that inherit parent MCP tools and isolate their work (verified against
  current docs on #628). The main agent never files inline when the filer exists.
- **Foreground dispatch:** background completion notifications re-open visible
  turns and race container teardown.
- **At-least-once with drain-as-ack:** the gate re-fires per Stop until the filer
  drains the spool, capped at 2 attempts per batch; a changed batch resets.
  Signature dedup (existing) makes retries idempotent.
- **Precedence:** quality-review (Cursor) and the architecture nudge (Codex) keep
  their stops; filing yields and retries at the next boundary.
- **Off-switch:** `selfReport.file: false` disables the gate and the dispatch.

## Personas

- **Technical Builder (TB)** — runs safeword in cloud sessions and must not have
  retro housekeeping interleave with or clutter their conversation.
- **Safeword Maintainer (SM)** — needs the cloud friction stream to reach
  `ArcadeAI/safeword` autonomously instead of dying with reclaimed containers.

## Jobs To Be Done

### retro-filer-gate.SM1 — Findings file themselves before the container dies

**Persona:** Safeword Maintainer (SM)

> When a cloud session spools retro findings that the REST transport cannot file,
> I want the live agent reliably instructed — through a channel it treats as an
> instruction — to dispatch the filer subagent, so I can receive the findings on
> the tracker without a human poking the session.

#### retro-filer-gate.SM1.AC1 — Gate fires on unfiled drafts, silently otherwise

At a Stop with unfiled spooled drafts, the harness adapter emits its continuation
carrying the dispatch instruction (agent name + spool path). Empty, absent, or
drained spools produce no continuation. `stop_hook_active`, missing session id,
and `selfReport.file: false` produce no continuation.

#### retro-filer-gate.SM1.AC2 — At-least-once, bounded

The same unfiled batch re-fires the gate at successive Stops until drained, at
most 2 times total (persisted, batch-keyed counter); a batch that gains a draft
resets the budget. After the cap, only the muted nudge remains.

#### retro-filer-gate.SM1.AC3 — The filer owns the procedure

The shipped agent definition instructs: read the named spool; dedup against
`ArcadeAI/safeword` by signature then title; comment recurrence or create issues
with title/body/labels verbatim; at most 5 new issues per session; drain filed
drafts from the spool; report "cannot file" in one line when write access is
missing; never touch another repo; never add content to drafts.

### retro-filer-gate.TB1 — My conversation stays mine

**Persona:** Technical Builder (TB)

> When safeword files its own findings during my session, I want the work to
> happen in a subagent's context with at most a one-line trace, so I can read my
> conversation without safeword housekeeping woven through it.

#### retro-filer-gate.TB1.AC1 — Dispatch-only instruction with a silence contract

The continuation text requests exactly one action (invoke the filer with the
spool path) and instructs no inline filing and no narration/summary of the filing
in that or later responses. No filing procedure appears in the main conversation.

#### retro-filer-gate.TB1.AC2 — Filing work is context-isolated

Spool contents, dedup searches, and issue bodies occur inside the
`safeword-retro-filer` subagent (own context window); the parent conversation
receives only the subagent's one-line summary. Trigger visibility is bounded by
the harness channel (invisible reason on Claude; one short line on Cursor/Codex).

## Outcomes

- Cloud-spooled findings reach the tracker within the same session, unprompted.
- The user's conversation carries at most one collapsed dispatch + one-line
  summary per rare filing event.
- CDX602's invisible extraction is unchanged; only filing gained a bounded,
  sanctioned continuation.
