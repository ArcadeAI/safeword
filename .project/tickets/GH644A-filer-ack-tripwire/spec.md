# Spec: Filer ack + bare-drain tripwire

## Intent

A drained retro spool no longer self-certifies that findings were filed. The
filer stamps a per-signature ack (naming the issue it created or commented on)
before it drains, and the stop gate converts a drain *without* acks — the forge
observed live in #644 G7 — into one deduped self-report signal, so destroyed
findings become tracked telemetry instead of silence.

## Fixed Design (figure-it-out, 2026-07-03 — full rationale on #644/#658)

- **Ack file:** `<spool-dir>/<session>.acks.jsonl`, one `{signature, issue}` per
  line, appended by the filer **immediately after each successful post, before
  draining that draft** (per-post appends bound the crash-desync window). The
  guide's inline fallback writes the same records.
- **Dispatch snapshot:** the existing `.filing-attempts` marker gains optional
  `signatures: string[]` (the batch the dispatch named) and `tripwired: boolean`
  fields. Migration-safe: markers already in the field lack them → tripwire
  stays disarmed for in-flight batches (fail-open).
- **Bare-drain detection:** at a later gate evaluation, any dispatched signature
  that is gone from the spool AND absent from the ack file is an unacked
  removal. Fire `captureBareDrain` — a `recordSignal` call mirroring
  `captureGateEscalation` (`errorClass: 'RetroBareDrain'`, allowlist-only
  fields) — once per batch (`tripwired` flag), through the existing self-report
  lane (own caps, own dedup via `signatureOf`, own filing playbook). No loops:
  the tripwire never writes to the retro spool.
- **Prohibition:** dispatch text and both filer agent definitions state that
  only the filer drains the spool; ack validation is shape-only (no network, no
  issue-number verification — over-validation turns honest crashes into false
  alarms).

## Personas

- **Safeword Maintainer (SM)** — needs destroyed findings to surface upstream as
  counted telemetry, and honest filing to never be punished with false alarms.
- **Technical Builder (TB)** — must see no new conversation noise or blocking
  behavior from the tripwire; it observes, it never gates their work.

## Jobs To Be Done

### filer-ack-tripwire.SM1 — A bare drain becomes telemetry, not silence

**Persona:** Safeword Maintainer (SM)

> When an agent empties the retro spool without filing, I want safeword to
> record that as its own runtime failure signal, so the loss shows up counted on
> the tracker instead of vanishing with the container.

#### filer-ack-tripwire.SM1.AC1 — Unacked removals trip once per batch

Given a dispatch snapshotted signatures, when a later evaluation finds any of
them gone from the spool and absent from the ack file, exactly one
`RetroBareDrain` self-report signal is captured for that batch (the `tripwired`
flag suppresses repeats), and the gate's normal dispatch behavior is unchanged.

#### filer-ack-tripwire.SM1.AC2 — Acked drains stay silent

Signatures removed from the spool that appear in the ack file (shape-valid
`{signature, issue}` lines; malformed lines skipped fail-open) trip nothing.

#### filer-ack-tripwire.SM1.AC3 — Pre-upgrade and absent state fails open

A marker without `signatures` (written by GH628F code), a missing marker, a
missing ack file with nothing dispatched, and `selfReport.capture: false` all
produce no tripwire and no crash.

### filer-ack-tripwire.SM2 — The filer's ack is part of filing

**Persona:** Safeword Maintainer (SM)

> When the filer posts a draft, I want the ack recorded before the draft is
> drained, so a crash between post and drain never looks like a forge.

#### filer-ack-tripwire.SM2.AC1 — Agent definitions carry the ack procedure

All shipped filer definitions (Claude/Cursor markdown, Codex TOML) instruct:
append the `{signature, issue}` ack line after each successful post and before
draining that draft; the drain rule "only the filer drains" appears in the
dispatch text and the guide's fallback documents ack-writing.

#### filer-ack-tripwire.SM2.AC2 — The reference seam writes acks

The executable reference-spec for filing (`fileSpooledDrafts`) records an ack
per successfully posted draft, so the contract is pinned by tests, not prose.

### filer-ack-tripwire.TB1 — Observation without interruption

**Persona:** Technical Builder (TB)

> When the tripwire fires, I want nothing new in my conversation and no blocked
> stop, so safeword's self-policing never costs me a turn.

#### filer-ack-tripwire.TB1.AC1 — Tripwire is invisible and non-blocking

The tripwire only appends to the self-report spool; it emits no continuation,
no context line, and never changes the gate's dispatch/silence decision for the
current evaluation.

## Outcomes

- A forged "filed" state is detectable and counted upstream within the session.
- Honest crash desync (posted but unacked) costs at most one deduped signal.
- Zero new conversation surface; zero network.
