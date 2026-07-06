# Spec: Auto-stamp ticket work-log entries on phase transitions (#772)

## Intent

Every bdd phase file today ends with a template step — "Add work log entry: `- {timestamp} Complete: <phase> - …`" — that asks the agent to write a timestamp it cannot know: an LLM has no clock, so the `{timestamp}` values in ticket work logs are fabricated. This feature moves the transition record to the machine: a PostToolUse hook observes the ticket.md edit that changes `phase:` and appends a work-log line stamped with the real system time. The per-file templates then shrink to a pointer, and agent-authored entries go back to being what they're good at — narrative ("trimmed 23 scenarios to 17"), not clock-keeping.

## Intake Brief

- **Requested by:** Safeword Maintainer (issue #772, de-prescription audit under #765/#680; the hook half was explicitly deferred out of PR #803's prose pass and re-scoped as its own feature).
- **Cost of inaction:** every ticket's transition history carries invented timestamps — an audit trail that lies about *when*. The prose templates also repeat across five skill files (drift risk the de-prescription epic exists to remove), and they can't be trimmed until the hook owns the entry.
- **Reversibility:** two-way door. One observer hook + settings entry; removing it restores today's behavior. No data model, no public API, no migration. The only mutation is an appended markdown list line in a file the agent already owns.

## References

- Issue #772 (sites + the four design constraints: duplicate ownership, file-mutation safety, format contract, real-timestamp justification).
- `lib/phase-provenance.ts` — the PreToolUse side of the same event (polices the transition this hook records); its prior/proposed reconstruction idiom is reused.
- `post-tool-quality.ts` / `post-tool-lint.ts` — the house PostToolUse observer pattern (matched on EDIT_TOOLS, silent fast-exit).
- Ticket K4STDR (sibling #773 rung) — same graduate-then-trim shape: enforce in code, then cut prose to a pointer.

## Personas

- **Technical Builder (TB)** — reads ticket work logs across sessions to reconstruct what happened when; gets transition lines whose timestamps are real.
- **Non-Technical Builder (NTB)** — can't audit diffs; the ticket history is their evidence of orderly progress. They inherit a trustworthy timeline without knowing the hook exists.
- **Safeword Maintainer (SM)** — deletes five copies of the same template prose and gains one code-owned invariant.

## Surfaces

Affected:

- Claude Code

Unaffected:

- OpenAI Codex / Cursor — their PostToolUse adapters wire hooks individually (`codex/post-tool-quality.ts`, `cursor/after-file-edit.ts`); forwarding this observer is a follow-up ticket so this one stays a single reviewable step. The skill-file trims stay honest on those surfaces — see Open Questions resolution.

## Vocabulary

- **Transition stamp** — the hook-authored work-log line `- <ISO-time> Phase: <from> → <to>` appended when a `phase:` frontmatter change lands.
- **Narrative entry** — an agent-authored work-log line (findings, decisions, summaries). The stamp never replaces these.

## Jobs To Be Done

### phase-work-log-stamp.TB1 — Trust the ticket timeline

**Persona:** Technical Builder (TB)

> When I re-open a ticket after days away, I want its phase-transition history stamped with the real times the transitions landed, so I can reconstruct the session sequence without wondering which timestamps the agent invented.

#### phase-work-log-stamp.TB1.R1 — A phase transition that lands in ticket.md gains exactly one work-log line recording the transition and the real time it happened

#### phase-work-log-stamp.TB1.R2 — The stamp is an append: the ticket's frontmatter and existing body survive byte-for-byte

#### phase-work-log-stamp.TB1.R3 — Edits that are not phase transitions leave the work log untouched

### phase-work-log-stamp.SM1 — Own the invariant in code, not prose

**Persona:** Safeword Maintainer (SM)

> When I maintain the bdd skill files, I want the transition-entry ceremony owned by the hook, so the five per-phase templates reduce to a pointer that can't drift.

#### phase-work-log-stamp.SM1.R1 — After the hook ships, no bdd phase file instructs the agent to fabricate a `{timestamp}` transition entry

## Rave Moment

skip: table-stakes — an audit-trail correctness fix; nobody screenshots a timestamp.

## Outcomes

- Ticket work logs show `Phase:` lines with true ISO timestamps for every transition made through the Edit channel.
- The bdd phase files (DISCOVERY/SCENARIOS/TDD/VERIFY) carry no `- {timestamp} Complete:` template; each exit step points at the auto-stamp and invites optional narrative entries.
- Duplicate ownership resolved as: hook owns *that/when* (the transition line), agent owns *what/why* (narrative lines).

## Open Questions

- ~~Should the hook also fire on full-file `Write` rewrites of ticket.md?~~ defer: a Write payload carries no prior content at PostToolUse time, so the from-phase is unknowable post-hoc; the canonical flow (and every gate) drives phase changes through Edit. Documented as a detection limit.
- ~~Codex/Cursor parity in this ticket?~~ defer: separate follow-up ticket; each adapter needs its own wiring block, and until it lands those surfaces simply keep today's behavior (manual entries), which the trimmed prose still permits as narrative.
