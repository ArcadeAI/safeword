# Impl Plan: Auto-stamp ticket work-log entries on phase transitions (#772)

**Status:** planned

## Approach

**Riskiest assumption:** a phase transition is reliably reconstructable at PostToolUse time
from the Edit/MultiEdit payload alone (old_string/new_string carrying `phase:` lines) —
without re-reading prior file content that no longer exists. Cheapest test: the unit pair
"Edit changing phase detects from→to" vs "Write full-content detects nothing" — if payload
parsing can't produce both verdicts, the channel choice is wrong at slice 1.

**Components:**

- `templates/hooks/lib/work-log-stamp.ts` (new) — pure helpers:
  - `detectPhaseTransition(toolInput) → { from, to } | undefined`: scans Edit
    `old_string`/`new_string` (and each MultiEdit edit, last phase-bearing edit wins) for
    `phase: <value>` lines; returns a transition only when both sides parse and differ.
    Write `content` payloads return undefined by design (no prior — documented limit).
  - `appendWorkLogEntry(content, entry) → string`: appends under `## Work Log` (file end by
    convention), creating the section when absent; never touches frontmatter or other bytes.
- `templates/hooks/post-tool-work-log.ts` (new) — PostToolUse observer, house pattern of
  `post-tool-lint.ts`: silent fast-exit unless `.safeword` exists, tool is Edit/MultiEdit,
  the file is a tickets-namespace ticket.md (`isNamespacePath`), and a transition is
  detected. Stamps `- <new Date().toISOString()> Phase: <from> → <to>` by read-append-write
  on the just-edited file. Never blocks (observers can't deny; crash-captured like siblings).
- `src/templates/config.ts` — `matchedHook(EDIT_TOOLS, post-tool-work-log.ts)` in PostToolUse.
- `src/schema.ts` — owned-path entries for the two new files.
- bdd skill trims — DISCOVERY.md / SCENARIOS.md (×2) / TDD.md / VERIFY.md exit steps lose the
  `- {timestamp} Complete: …` template; replaced by one pointer line ("the phase hook stamps
  the transition with real time; add narrative work-log entries as separate lines").

**Arch alignment** (ARCHITECTURE.md + house idioms):

- Hooks stay standalone under `templates/hooks/` with pure logic split into `lib/` (same as
  bash-ledger-writes, phase-provenance) — honors "hooks run standalone from .safeword/hooks".
- Template ↔ dogfood parity via scripts/parity-check.ts; templates are source of truth.
- Known deviation: none — observer + lib + settings entry is the established shape.

**Proof plan (highest practical scope per scenario):**

| Scenario | Primary proof | Why enough |
| --- | --- | --- |
| Edit advance appends one stamped line (anchor) | integration — spawn the hook against a temp project, assert file content + clock window | proves the real entry point end-to-end including the file mutation |
| MultiEdit carries the change | unit on `detectPhaseTransition` | payload-shape logic is pure; wiring proven by anchor |
| Backward move stamped | unit on `detectPhaseTransition` | same |
| Byte-identical append | unit on `appendWorkLogEntry` (content equality) + anchor integration | pure string transform |
| Missing Work Log section created | unit on `appendWorkLogEntry` | same |
| No-phase edit / same-phase edit no-op | unit on `detectPhaseTransition` (allow-side pins) | pure |
| Non-namespace / non-ticket files untouched | integration — spawn hook, assert files unmodified | the scope filter lives in the hook, not the lib |
| Write rewrite no-op | unit pin on `detectPhaseTransition` | the documented limit, pinned |
| bdd files carry no fabricated-timestamp template | doc-content test over the four skill files | repo precedent (documentation tests) |

**Build order** (each slice on green):

1. **Anchor slice:** RED integration — hook stamps nothing today (script absent → test reads
   spawn failure as red); GREEN — lib detect+append minimal, hook wired, settings entry.
2. **Precision slices:** unit scenarios on the two pure helpers (allow-side pins first).
3. **Scope slice:** non-namespace/non-ticket integration.
4. **Docs slice:** RED doc test (templates exist today) → GREEN skill-file trims.
5. Parity sync (templates → dogfood mirrors + .claude/settings.json) — per commit.

**Assessment triggers:** works at current scale; revisit if ticket.md grows sections after
Work Log by convention (append-at-end assumption) or if Codex/Cursor adapters land (follow-up
ticket extends the same lib).
