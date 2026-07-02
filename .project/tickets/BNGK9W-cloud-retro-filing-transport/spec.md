# Spec: Cloud retro filing — try-REST-then-agent-subagent transport (#568)

## Intent

Make the invisible retro actually **file** its findings in a Claude **cloud**
session. Today extraction + egress work there, but the headless CLI's REST
transport 401s (in cloud, `GITHUB_TOKEN` is the platform's token, not a GitHub
one, and `gh` is absent), so every finding is `failed` and the sanitized drafts
are lost. This adds a "cheapest transport that works" two-path design, selected
automatically: file directly via REST when a token works (silent), else **spool**
the post-egress drafts and let the live agent file them via its inherited GitHub
MCP — keeping the extraction itself invisible.

## Intake Brief

- **Requested by:** the invisible-retro epic (#344) / alex@arcade.dev — the whole
  point is a friction stream from **real** sessions, and cloud is the dominant one.
- **Cost of inaction:** in the dominant target environment the retro **cannot
  file at all** — it extracts, sanitizes, then drops everything on the floor
  (`0 filed, N failed`). The feature looks live but silently produces nothing where
  it's meant to run. (Proven live this session: cloud REST → 401; #568.)
- **Reversibility:** two-way door. Adds a spool + a transport-selection fallback +
  a filing-nudge hook; the egress guard, schema, sanitizer, and REST path are
  untouched. Revert = drop the spool/fallback and the retro is REST-only again.

## References

- Decision: `/figure-it-out` (ticket.md) — try-REST-then-agent-subagent, in-session,
  auto-selected. **#568** is the filing gap it closes.
- **Design reconciliation (2026-07-01, in ticket.md):** PATH B's original "Stop
  hook surfaces a line" cannot fire from ZFGWS1's shipped `async:true` Stop hook
  (backgrounded, surfaces nothing) — so the agent-filing **trigger moves off the
  Stop hook** to a `SessionStart`/`UserPromptSubmit` "unfiled drafts" check.
- Parent **RV9JT4**; sibling **7D8PJP** (built invisible extraction), **ZFGWS1**
  (delta re-arm + sonnet + async hook — the recall this transport delivers).
- Reuses: the self-report spool pattern; the `IssueTracker` egress-safe drafts.
- Slice 1 shipped: `packages/cli/src/retro/draft-spool.ts` (persist post-egress drafts).

## Personas

- **Safeword Maintainer (SM)** — receives the friction stream. Wants it to keep
  flowing from **cloud** sessions (where it currently can't file), using whatever
  GitHub access the environment already has, with no duplicate issues.
- **Technical Builder (TB)** — runs safeword in a cloud agent. The filing must stay
  near-invisible: the extraction silent, and the cloud fallback at most **one**
  factual line + one isolated subagent, at a boundary — never a mid-turn hijack.
- **Non-Technical Builder (NTB)** — can't audit the diff. Needs the no-leak
  guarantee to hold on disk too: the spool must carry only post-egress, sanitized
  drafts, never raw finding text.

## Surfaces

Affected:

- Claude Code (cloud) — the environment where REST fails and PATH B applies.
- Claude Code (local, token present) — PATH A (direct REST, silent).

Unaffected:

- OpenAI Codex, Cursor — separate agent-owned write paths, separate tickets
  (#551 / #552).

## Vocabulary

- **PATH A (silent REST)** — a valid token exists; the (backgrounded) Stop hook
  files each draft via REST and drains the spool. Zero conversation footprint.
- **PATH B (agent subagent)** — REST 401/absent (cloud); drafts stay spooled, and a
  surfacing-capable hook (NOT the async Stop hook) emits one factual line so the
  live agent spawns **one** filing subagent that posts each draft verbatim via
  GitHub MCP and drains the spool.
- **Draft spool** — per-session on-disk queue of post-egress, code-assembled drafts
  (`{signature,title,body,labels}`) under `.safeword/retro-drafts/`.
- **Mark-filed** — a filed draft is removed from the spool so it neither re-nudges
  nor double-files.

## Jobs To Be Done

### cloud-retro-filing.SM1 — Keep the friction stream flowing from cloud sessions

**Persona:** Safeword Maintainer (SM)

> When a substantial session runs in a cloud container where the REST token is
> invalid, I want its findings filed anyway, so my friction stream doesn't silently
> go dark exactly where most real sessions run.

#### cloud-retro-filing.SM1.AC1 — Findings from a cloud session reach the tracker

When REST filing fails, the sanitized drafts are spooled (not lost) and filed via
the live agent's GitHub access; a substantial cloud session ends with its findings
filed, not dropped.

#### cloud-retro-filing.SM1.AC2 — A local session with a token still files directly and silently

When a valid token is present, filing goes straight through REST with **zero**
conversation footprint (no spool hand-off surfaced) — the existing behavior is
preserved, not regressed.

#### cloud-retro-filing.SM1.AC3 — No duplicates across the fallback

A draft filed via either path is marked filed so it is neither re-nudged nor
re-filed; signature dedupe still guards recurrences.

### cloud-retro-filing.TB1 — The cloud fallback stays near-invisible

**Persona:** Technical Builder (TB)

> When retro falls back to agent filing in my cloud session, I want it to intrude
> as little as possible — one factual line at a boundary, never a stolen mid-turn.

#### cloud-retro-filing.TB1.AC1 — Extraction + spool stay silent

The extraction and spooling happen on the backgrounded `async:true` Stop hook and
add **nothing** to the conversation, regardless of which filing path is taken.

#### cloud-retro-filing.TB1.AC2 — The fallback nudge is a factual, bounded, boundary-time signal

PATH B surfaces exactly one **fact-phrased** line (a statement, never an
imperative — imperative phrasing trips prompt-injection defenses and gets surfaced
verbatim) at a session boundary (SessionStart / next prompt), only when unfiled
drafts exist — never mid-turn, and only once per unfiled batch.

### cloud-retro-filing.NTB1 — No leak, on disk too

**Persona:** Non-Technical Builder (NTB)

> I can't audit the diff, so the no-leak guarantee has to hold for the spool file on
> disk, not just the GitHub issue.

#### cloud-retro-filing.NTB1.AC1 — The spool holds only post-egress sanitized drafts

Only the code-assembled `{signature,title,body,labels}` (already run through the
egress pipeline) is written to the spool — no raw finding text, no off-schema
fields, ever reach disk.

## Rave Moment

Inherits 7D8PJP's "the feature with no felt presence." This slice adds the honest
version: *"it works in my cloud sessions too — I never provisioned a token, and the
bugs still got filed."*

## Outcomes

- A substantial **cloud** session (REST 401) ends with its findings filed via the
  agent path; a test proves REST-failure → drafts spooled + a factual nudge, and the
  spool carries post-egress drafts only.
- A **local** session with a valid token files directly via REST and surfaces
  **no** additionalContext (zero footprint); a test asserts the silent path.
- A filed draft is marked filed (spool drains); no re-nudge, no double-file.
- Extraction + spool never break Stop and add nothing to the conversation.

## Open Questions

- defer: the filing subagent's exact dedupe (search-then-file) is reused from
  self-report-filing.md; hardening is 1FGE1C, out of scope.
- defer (#563): the friction gate still precedes any filing attempt; unchanged here.
- The surfacing hook's home — `SessionStart` vs `UserPromptSubmit` — is an
  implementation choice settled at scenario-gate/impl-plan (both can surface; pick
  the one that fires soonest without being mid-turn). Not a spec-level unknown.
