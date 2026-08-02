# Spec: Prevent stale Safe Word guidance from blocking Codex users

## Intent

Prevent obsolete Safe Word instructions in a Codex profile from blocking current workflows, while preserving the user's ownership of global guidance.

## Intake Brief

- **Requested by:** Safeword maintainer during dogfooding
- **Cost of inaction:** Codex can stop before implementation because legacy global instructions point at directories and guides current Safe Word no longer uses.
- **Reversibility:** Two-way door; diagnostics and context wording are removable, and cleanup retains a backup.

## References

- OpenAI Codex AGENTS.md discovery: global guidance loads before project guidance and is merged into every session.
- OpenAI Codex hooks: SessionStart `additionalContext` is developer context and is size-limited by default.
- Historical Safe Word `example-claude.md` blob `938e0616c1e4d54550adaa27a3b8a86d599c9b5d`.

## Personas

- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- OpenAI Codex
- Safeword CLI

Unaffected:

- Claude Code — does not read `$CODEX_HOME/AGENTS.md`
- Cursor — does not read `$CODEX_HOME/AGENTS.md`

## Vocabulary

- **Legacy global guidance:** Safe Word-authored instructions copied into `$CODEX_HOME/AGENTS.md` that reference retired Safe Word paths.
- **Exact legacy content:** A file whose full content matches a registered historical Safe Word revision and is safe to back up as a unit.

## Jobs To Be Done

### prevent-legacy-global-instructions.TBU1 — Keep current workflows authoritative

**Persona:** Technical Builder (TBU)

> When I upgrade Safe Word and start Codex, I want current project workflow paths to override obsolete Safe Word guidance in my profile, so I can continue building without diagnosing historical configuration.

#### prevent-legacy-global-instructions.TBU1.R1 — Current Safe Word project paths remain authoritative when legacy profile guidance is present

#### prevent-legacy-global-instructions.TBU1.R2 — Conflicting profile guidance is diagnosed without changing user-owned content

#### prevent-legacy-global-instructions.TBU1.R3 — Positively identified historical content has an explicit recoverable cleanup path

## Rave Moment

skip: table-stakes

## Outcomes

- A Codex session follows `.project/` tickets and `.safeword/guides/` even when the profile contains retired Safe Word paths.
- Read-only diagnostics name the conflicting file and the safe next action.
- Cleanup never destroys modified customer instructions.

## Open Questions

None.
