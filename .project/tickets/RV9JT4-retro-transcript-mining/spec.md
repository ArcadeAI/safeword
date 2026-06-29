# Spec: safeword retro — transcript-mining session retrospective

## Intent

Capture the **qualitative** safeword friction a session hits — bugs, rough
edges, missing features — that the deterministic self-report spool can't see (it
only fires on non-zero CLI exits, uncaught hook exceptions, and gate
escalations). `safeword retro` mines a session **transcript** (grounded
evidence, not the agent's volatile end-of-session memory) and produces local,
human-reviewed issue drafts that compose with the existing
spool → drafts → filing-guide pipeline.

## Intake Brief

- **Requested by:** alex@arcade.dev (Safeword Maintainer), automating the manual
  session-retrospective he runs by hand today ("did I hit any safeword bugs /
  rough edges / gaps this session?" → triage against GitHub).
- **Cost of inaction:** qualitative friction stays invisible. The deterministic
  spool catches only crashes/exits/escalations; everything experiential
  (confusing gate messages, awkward flows, absent capabilities) depends on the
  maintainer remembering to comb the session by hand — which most sessions skip,
  so the signal is lost.
- **Reversibility:** two-way door. A new manual command + skill writing a local
  draft file; no data-model change, no public-API change, **no autonomous
  egress**. Trivial to remove.

## References

- Epic: GitHub `ArcadeAI/safeword#344` — "safeword detects its own bugs and files
  GitHub issues" (the deterministic slices shipped as #345, #353; PR #524/#528).
- Composes with: `templates/hooks/lib/self-report.ts` (sanitize-at-capture spool,
  `{signature,title,body,labels}` draft shape, `signatureOf`) and
  `templates/guides/self-report-filing.md` (dedup + caps + transport).
- Design provenance: this session's `/figure-it-out` + `/quality-review`
  (RECONSIDER-APPROACH → revised to manual, local-draft-only, no autonomous
  filing — the human is the only viable sanitizer for transcript-derived prose).

## Personas

- **Safeword Maintainer (SM)** — dogfoods retro on their own session transcript,
  reviews the local draft, and decides what to ticket. (Always also a TB in their
  own sessions, but the retro reviewer here is the Maintainer.)

## Vocabulary

- **Transcript** — the agent harness's on-disk conversation log for a session
  (Claude Code: JSONL at the hook-provided `transcript_path`). The evidence
  retro mines.
- **Qualitative friction** — safeword bugs / rough edges / gaps that leave no
  deterministic signal (no non-zero exit, no exception, no escalation).
- **Local draft** — a retro output file written to disk for human review; never
  itself published to GitHub.

## Jobs To Be Done

### retro-transcript-mining.SM1 — See the friction I'd otherwise forget

**Persona:** Safeword Maintainer (SM)

> When I finish a safeword session, I want a transcript-grounded list of the
> qualitative safeword friction I hit that the deterministic spool didn't catch,
> so I can decide what to ticket without trusting my volatile end-of-session
> memory — and without ever auto-leaking the customer data the transcript holds.

#### retro-transcript-mining.SM1.AC1 — Retro reads a transcript I point it at, never one it guesses

`safeword retro --transcript <path>` mines the transcript at the path I supply.
With no readable path it fails loudly rather than guessing a session file from
the environment.

#### retro-transcript-mining.SM1.AC2 — Friction comes out as namespaced drafts in the existing shape

Output drafts use the existing `{signature, title, body, labels}` shape, and
every signature is `retro:`-namespaced so it can never collide with a
deterministic spool signature for the same session (no double-filing a crash the
spool already drafted).

#### retro-transcript-mining.SM1.AC3 — Nothing is published without me

Retro stops at a **local draft file**. It never opens an issue, comments, or
otherwise writes to GitHub on its own. Filing stays the existing separate,
human-driven step — so the deny-by-default egress guarantee holds even though
the transcript input is unsanitized.

## Rave Moment

skip: inherits the epic (`#344`) — this is a child slice; the epic owns the
persona-facing rave.

## Outcomes

- Running `safeword retro --transcript <real-session.jsonl>` produces a local
  draft file and writes **nothing** to GitHub (no network issue/comment).
- Drafts carry the existing `{signature,title,body,labels}` shape; every
  signature is `retro:`-prefixed and never equals a spool signature for the same
  session.
- With no readable `--transcript` path, retro exits non-zero with a clear message
  and produces no draft (never falls back to guessing a path).

## Open Questions

- Extraction mechanism: does `safeword retro` **spawn its own subagent**, or does
  it (like the filing guide) emit a transcript-analysis **prompt/guide** for the
  calling agent to execute, then ingest the agent's structured result? The
  quality-review leaned toward a prompt/guide over the existing emitter rather
  than embedding a subagent in the command — resolve at the scenario-gate.
- Transcript format scope: Claude Code JSONL only for this first slice
  (Codex/Cursor transcript shapes deferred)? Leaning yes.
- `retro:<slug>` signature derivation — what the slug is keyed on (stable hash of
  title?) — defer to implement.
