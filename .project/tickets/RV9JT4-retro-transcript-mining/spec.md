# Spec: safeword retro — transcript-mining session retrospective

## Intent

Capture the **qualitative** safeword friction a session hits — bugs, rough
edges, missing features — that the deterministic self-report spool can't see (it
only fires on non-zero CLI exits, uncaught hook exceptions, and gate
escalations). `safeword retro` mines a session **transcript** (grounded
evidence, not the agent's volatile end-of-session memory) and **autonomously
files** issues — no human approval. Because the transcript is raw customer data,
autonomy is made safe not by a human reviewer but by an **automated egress
guard**: a constrained finding schema (no field to dump customer code) + a
deterministic deny-by-default sanitizer + an independent redaction pass, with the
GitHub write performed by **code** over already-sanitized fields (the agent never
writes free text to the wire). Composes with the existing
spool → drafts → filing pipeline.

## Intake Brief

- **Requested by:** alex@arcade.dev (Safeword Maintainer), automating the manual
  session-retrospective he runs by hand today ("did I hit any safeword bugs /
  rough edges / gaps this session?" → triage against GitHub).
- **Cost of inaction:** qualitative friction stays invisible. The deterministic
  spool catches only crashes/exits/escalations; everything experiential
  (confusing gate messages, awkward flows, absent capabilities) that real
  builders hit in their own sessions never reaches the maintainers — today it
  depends on someone remembering to comb the session by hand, which most sessions
  skip, so the signal is lost on both ends.
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
  (RECONSIDER-APPROACH surfaced the egress hole) → resolved to autonomous filing
  guarded by an automated egress stack (schema + sanitizer + redaction + code-owned
  write) instead of a human reviewer, since a human gate doesn't scale and invites
  rubber-stamping.

## Personas

- **Technical Builder (TB)** — runs safeword on a real project. When safeword is
  rough, retro reports it upstream *for* them with zero effort; they can read the
  diff, so they care that it's effortless and correct.
- **Non-Technical Builder (NTB)** — drives an agent but can't read the diff to
  verify what left their machine. The no-leak guarantee is existential here:
  they rely entirely on the egress guard, because they can't audit it themselves.
- **Safeword Maintainer (SM)** — receives the reports. Wants an evidence-grounded,
  deduplicated friction stream from real sessions so they fix what actually hurts.
  (Also a TB when dogfooding retro on their own transcript.)

## Vocabulary

- **Transcript** — the agent harness's on-disk conversation log for a session
  (Claude Code: JSONL at the hook-provided `transcript_path`). The evidence
  retro mines.
- **Qualitative friction** — safeword bugs / rough edges / gaps that leave no
  deterministic signal (no non-zero exit, no exception, no escalation).
- **Egress guard** — the automated safety stack that replaces a human reviewer:
  constrained finding schema + deterministic deny-by-default sanitizer +
  independent redaction pass, with the GitHub write done by code over sanitized
  fields. Its job is to ensure raw transcript data can't reach a public issue.

## Jobs To Be Done

### retro-transcript-mining.TB1 — Get my friction heard without lifting a finger

**Persona:** Technical Builder (TB)

> When safeword is rough mid-session, I want it reported upstream automatically —
> no stopping to write a bug report — so the friction I hit actually reaches the
> maintainers instead of dying in my session.

#### retro-transcript-mining.TB1.AC1 — Safeword files autonomously, no approval step

Retro searches the upstream repo by title and comments-or-creates issues itself.
No approval prompt, no local-only stopping point — the builder does nothing.

#### retro-transcript-mining.TB1.AC2 — Reads the transcript I point it at, never one it guesses

`safeword retro --transcript <path>` mines the transcript at the path supplied.
With no readable path it fails loudly rather than guessing a session file from
the environment (no `~/.claude/projects/**` construction).

### retro-transcript-mining.NTB1 — Trust that my private code never leaks, since I can't check

**Persona:** Non-Technical Builder (NTB)

> When safeword reports its own friction from my session, I want an ironclad
> guarantee that my proprietary code, paths, and secrets never appear in a public
> issue — because I can't read the diff to verify it myself.

#### retro-transcript-mining.NTB1.AC1 — Findings can't carry raw transcript prose

The agent returns a **constrained schema** per finding (`category` enum,
`safeword_surface` resolved against the spool's allowlist, bounded
`what_happened` / `why_friction`, safeword-command-only `repro`) — there is no
field for customer code or context. The issue body is assembled by **code** from
these fields, never free-written by the agent.

#### retro-transcript-mining.NTB1.AC2 — An automated guard sanitizes before egress, and fails closed

Before anything is filed, every free-text field passes a deterministic
deny-by-default sanitizer (the capture sanitizer's allowlist/secret-redaction
posture, extended to prose) **and** an independent redaction pass; the GitHub
write is performed by **code** over the already-sanitized fields — the agent
never writes free text directly to the wire. A finding whose `safeword_surface`
can't resolve to a real safeword surface is **dropped, not filed** (fail closed).

### retro-transcript-mining.SM1 — A clean, evidence-grounded friction stream I can act on

**Persona:** Safeword Maintainer (SM)

> When real users hit safeword friction, I want evidence-grounded reports in my
> tracker with **zero duplicate issues** — but I want to see **everyone** who hit
> a known issue, so I can read both its **shape** (the ways it manifests) and the
> **volume** of pain (how many sessions, which harnesses). Grounded in the
> transcript, not volatile memory.

#### retro-transcript-mining.SM1.AC1 — Findings arrive as namespaced drafts in the existing shape

Findings use the existing `{signature, title, body, labels}` shape, and every
signature is `retro:`-namespaced so it can never collide with a deterministic
spool signature for the same session (no double-filing a crash the spool already
drafted).

#### retro-transcript-mining.SM1.AC2 — Dedups against the tracker (title-match, this slice)

A signature already represented by an open upstream issue is **matched by title**
and does not spawn a second issue; new-issue creation is capped at ≤1 per
signature and ≤5 new per session, and title-match also recognizes an issue the
deterministic spool already filed. **Caveat — this slice is best-effort:** title
search is eventually-consistent on GitHub, so indexing lag or title drift can
still occasionally duplicate. The *robust* exact-dedup guarantee (signature marker
+ strongly-consistent issues-list lookup) lands in sub-ticket
**`1FGE1C-robust-tracker-dedup`** — that's where the unqualified "never a
duplicate" claim is met.

#### retro-transcript-mining.SM1.AC3 — Every encounter is counted; every new shape is recorded

When a session hits a **known** issue, retro records it two ways, without flooding
the thread:

- **Volume** — it updates a single retro-maintained occurrence ledger on the
  issue (e.g. "seen N times across M sessions; harness breakdown; last seen
  <date>"), incremented **idempotently** (one bump per session). The ledger holds
  only allowlist-safe data (counts, harness, version, date) — no egress risk.
- **Shape** — it adds a comment **only when this encounter is novel** (a
  manifestation / repro / environment the issue doesn't already document), deduped
  against existing content and passed through the egress guard (it's
  transcript-derived prose). A "me-too" with nothing new adds to the count, not a
  comment.

So the maintainer sees *everyone* who hit it (the ledger) and *all the shapes*
(novel-only comments), with no bare-"+1" flood.

## Rave Moment

skip: inherits the epic (`#344`) — this is a child slice; the epic owns the
persona-facing rave.

## Outcomes

- Running `safeword retro --transcript <real-session.jsonl>` mines the transcript
  and files autonomously — searches upstream by title, comments-or-creates under
  the dedup + caps — with no approval step.
- Every filed body is assembled by code from the constrained schema and passes
  the sanitizer + redaction guard; no free-text agent output reaches the wire. A
  finding whose `safeword_surface` can't resolve is dropped, not filed.
- Findings carry the existing `{signature,title,body,labels}` shape; every
  signature is `retro:`-prefixed and never equals a spool signature for the same
  session.
- With no readable `--transcript` path, retro exits non-zero with a clear message
  and files nothing (never falls back to guessing a path).

## Design note — three signal surfaces, one egress core

There are three ways safeword friction reaches the tracker, and they must share
one egress-guarded core (schema → scrub → code-owned write → dedup/caps), not
three parallel filers:

1. **Deterministic** — crash / non-zero exit / gate escalation → sanitized at
   capture → existing filing guide. (Built.)
2. **Retrospective** — transcript mining at session end → this ticket (RV9JT4).
3. **Conversational** — the user reports safeword friction to the agent
   in-session. **Not yet built; separate follow-up slice.** Highest-signal source
   (the human already confirmed it's real), but same egress risk as retro (a
   verbal report can contain customer data), so it MUST route through retro's
   egress guard — NOT the deterministic filing guide (that guide is only safe
   because it files from sanitized-at-capture spool drafts; a verbal report has no
   such guarantee). Future shape: a `safeword report "<what happened>"` entry
   point + a SAFEWORD.md standing trigger so the agent reaches for it instead of
   hand-writing an issue (today's unsafe default).

**Implication for RV9JT4:** factor the core as a reusable "friction → safe issue"
module with the transcript miner as its *first consumer*, so surface 3 is a cheap
front-end later, not a parallel system.

**Deferred — auto-trigger (later slice). Corrected 2026-06-28 after researching
the Claude Code cloud/web runtime.** SessionEnd is NOT a viable trigger in the
cloud: (a) async work in SessionEnd is killed before completion (claude-code
issue #41577); (b) idle reclamation is effectively a hard VM kill with no
graceful teardown; and critically (c) **the transcript lives in the ephemeral
container and is deleted on reclamation** — so the earlier "enqueue-at-SessionEnd,
drain-at-next-SessionStart reading the prior transcript" idea CANNOT work: the
prior transcript no longer exists by the next session. (verified: code.claude.com
/docs/en/claude-code-on-the-web; /docs/en/hooks; gh issue #41577.)
The only reliable pattern in cloud is to run **while the session is alive**, when
`transcript_path` is readable: either manual `/retro`, or a **Stop hook** (fires
each turn, session still up) with a winding-down heuristic. SessionStart fires
reliably, but with no persisted transcript to drain it can't run retro on a past
session. Cloud specifics: `CLAUDE_CODE_REMOTE=true`; session id is
`CLAUDE_CODE_REMOTE_SESSION_ID` (`CLAUDE_SESSION_ID` may be empty); only
repo-committed `.claude/settings.json` hooks run. Out of scope for this slice.

## Routing & provider decisions (2026-06-28)

- **Routing = upstream.** Safeword friction files to the **upstream safeword repo**
  (`ArcadeAI/safeword`), not the host project's tracker. Rationale: the report is a
  defect in the safeword *tool*, so it must reach the maintainers who can fix it —
  routing it to the customer's tracker would land it where nobody can act and
  clutter their backlog. The hardcoded upstream target is therefore correct.
- **Port generalized, GitHub first.** The tracker boundary is a provider-neutral
  `IssueTracker` port (was `GitHubTransport`); the REST client is its first adapter.
  De-GitHub-locks the architecture without adding a second provider now (moot while
  routing is always upstream GitHub).
- **Out of scope — a general "file my project's issues to my tracker" tool (1c).**
  A broader product that mines a session for the *host project's* own issues and
  files to *their* configured tracker (Linear/GitHub/…) is a **separate future
  epic**. It would reuse this slice's egress guard + pipeline + triage/ledger core
  wholesale, but needs its own spec (persona, auto-file trust/noise bar, semantic
  human-ticket dedup, multi-provider write wiring incl. Linear, which is currently
  unwired in tracker-sync). Not RV9JT4.

## Follow-ups (post-review, deferred — not blocking this slice)

- **Signature-in-body dedup (robustness).** Title-match dedup (SM1.AC2) is
  spec-faithful but has an inherent limit: GitHub search indexing-lag on a
  just-created issue, or a very common title ranked past 100 results, can still
  yield a duplicate. A more robust key embeds `retro:<signature>` in the issue
  body and searches `in:body "retro:<sig>"` (collision-free, qualifier-free).
  This **changes the AC contract**, so it's a spec-level decision for a later
  slice, not a bug-fix — flagged by two independent reviews (S2). **Tracked as
  sub-ticket `1FGE1C-robust-tracker-dedup`.**
- **Occurrence-ledger pagination cap.** `listComments` is bounded at 20 pages
  (2000 comments); a ledger sitting beyond that would double-file. Emit a debug
  warning when the cap is hit, or switch to `Link: rel="next"` traversal.

## Open Questions

- Extraction/egress split (leaning resolved): the **command** owns the
  deterministic parts (read → assemble → sanitize → redaction-pass → file) so
  egress lives in code; the **agent** owns only extraction (via a retro guide)
  and the independent redaction judgment. Confirm at the scenario-gate.
- Transcript format scope: Claude Code JSONL only for this first slice
  (Codex/Cursor transcript shapes deferred)? Leaning yes.
- `retro:<slug>` signature derivation — what the slug is keyed on (stable hash of
  title?) — defer to implement.
- Autonomous GitHub write in the CLI (needs token/transport) vs delegated to the
  calling agent's MCP/`gh` over **pre-sanitized** drafts? CLI-owned egress is
  safer (closes the smuggling hole); confirm at scenario-gate.
- **Occurrence-ledger mechanism (SM1.AC3).** How is the per-issue volume ledger
  stored and updated idempotently? Options: a single retro-maintained comment with
  a hidden marker (`<!-- retro-ledger -->`) that retro finds + edits each session
  (rich: per-harness/version counts), vs 👍 reactions (cheap aggregate, no
  metadata), vs issue labels/fields. Idempotency key = session id, so re-running
  retro on one transcript doesn't double-count. Resolve at scenario-gate. Note:
  this may warrant lifting the deterministic filing guide's "recurrence → comment
  with occurrence count" rule to the same ledger model for consistency.
- **Scrub list — resolved (quality-review, 2026-06-27, versions verified this
  session).** Don't adopt one mega-library; the scrub table is three problems and
  only the secret-token class needs a dependency:
  - **Secrets/tokens** → adopt **secretlint** rule packs (`@secretlint/core`,
    MIT, Node-native, v13.0.2 ~1mo old) in detect-mode and redact the reported
    spans; or vendor the MIT **gitleaks** ruleset. The maintained rule pack is the
    value (it tracks new key formats — the rot we're avoiding).
  - **Paths** → keep the in-house `safewordInternalTail` **allowlist** (allowlist
    beats any generic denylist; already battle-tested).
  - **Emails/URLs/IPs** → small in-house regex (stable formats; no dep).
  - **Names/company/semantic PII** → the independent LLM redaction pass (already
    planned), NOT a regex library.
  - **Struck:** `redact-pii` (abandoned ~4yr), `@redactpii/node` (phones home to
    redactpii.com), Microsoft **Presidio** (Python-only + NLP-heavy — wrong fit
    for a CLI hook).
  - Open confirmation at slice 3: that `@secretlint/core` can scan a raw string
    (not just files) and return secret spans for redaction.
