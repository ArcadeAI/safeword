# Spec: Codex retro parity — invisible local extraction and Lane-2 filing

## Intent

Replace Codex's visible Stop `{decision:"block"}` retro trigger with the same
invisible-retro shape Claude now uses: the Stop hook runs extraction out-of-band
in a separate child session, emits nothing to the user's conversation, and routes
sanitized drafts through the existing spool/direct-file/fallback nudge path.

## Fixed Design

- **Sync Stop hook:** Codex skips `async:true` hooks, so local extraction runs
  synchronously inside the Stop hook with the hook's 600s budget.
- **OpenAI model for Codex:** Stock Codex cannot call Claude; Codex extraction
  defaults to an OpenAI model while Claude remains on sonnet. `.safeword/config.json`
  `retro.model` still overrides the default.
- **Lane 2 is UserPromptSubmit:** unfiled spooled drafts surface via
  `hookSpecificOutput.additionalContext` using `decideRetroNudge`; Stop never
  returns `{decision:"block"}`.
- **Cloud out of scope:** Codex cloud hook support is unknown.
- **Shared core reuse:** retro trigger/delta state, digesting, egress, draft spool,
  and nudge logic stay shared.

## Personas

- **Technical Builder (TB)** — runs safeword under local Codex and wants automatic
  filing with no turn hijack.
- **Safeword Maintainer (SM)** — wants the Codex friction stream to reach the same
  tracker path as Claude, with no weaker egress boundary.

## Jobs To Be Done

### codex-retro-parity.TB1 — End a Codex turn without retro hijacking the chat

**Persona:** Technical Builder (TB)

> When I finish a local Codex session that hit safeword friction, I want retro
> extraction to happen outside my conversation, so I can keep working without a
> continuation prompt hijacking my next turn.

#### codex-retro-parity.TB1.R1 — Stop extraction is synchronous and invisible

At Stop, the adapter uses the supplied readable `transcript_path`, runs child
`codex exec` with closed stdin and a schema output file, awaits completion, and
writes no conversation-visible Stop output.

#### codex-retro-parity.TB1.R2 — Stop fails open

Malformed input, absent/unreadable transcripts, child failures, empty child
output, and schema-invalid child output all exit zero, surface nothing, and do not
advance retro state as if extraction succeeded.

### codex-retro-parity.SM1 — Codex uses the same safe filing path as Claude

**Persona:** Safeword Maintainer (SM)

> When I receive retro findings from Codex sessions, I want them to pass through
> the existing egress and spool pipeline, so I can trust the Codex stream without
> weakening the no-leak boundary.

#### codex-retro-parity.SM1.R1 — Codex extractor uses an OpenAI default

Codex extraction defaults to the configured Codex/OpenAI model when no
`retro.model` override exists, while Claude extraction still defaults to sonnet.

#### codex-retro-parity.SM1.R2 — Extracted findings flow through egress, spool, and direct filing

Valid child findings are normalized through the existing `safeword retro`
auto-extract path, persisted only as post-egress draft fields, and direct-filed
when the local GitHub REST transport succeeds.

#### codex-retro-parity.SM1.R3 — Unfiled drafts use Lane 2

When direct filing is unavailable, drafts remain spooled and the Codex
UserPromptSubmit hook surfaces the existing factual nudge via
`hookSpecificOutput.additionalContext`, once per unfiled batch.

## Outcomes

- Local Codex Stop no longer returns `{decision:"block"}` for retro.
- Child extraction is schema-constrained, stdin-safe, and guarded by
  `SAFEWORD_RETRO_CHILD=1`.
- Codex and Claude share the same post-egress spool and nudge lane.

## Open Questions

skip: the live gating spike answered the only blocking local unknown for #602.
