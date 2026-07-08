# Retro: Transcript-Mining Session Retrospective

**Triggered playbook.** Run this when asked to do a session retrospective for
safeword (`/retro`, "retro this session", or at session wind-down). It is the
**qualitative** complement to the deterministic self-report spool: the spool
catches crashes / non-zero exits / gate escalations; retro catches the
**experiential** friction those miss — confusing gate messages, awkward flows,
missing capabilities — by mining the session **transcript**.

Filing is **autonomous** (no human approval) and goes **upstream** to
`ArcadeAI/safeword` — these are safeword's _own_ rough edges, reported to the
maintainers who can fix them. The command sanitizes every field at egress, so
there is nothing for a human to pre-approve.

## Why a fresh-context reader (not your own memory)

Do **not** extract from your own working memory of the session. Safeword's own
learning (`natural-vs-self-report-gates.md`) measured agent self-report ~40% less
reliable than evidence-grounded signals, and self-correction has a large
in-context blind spot. So the reliable path is to **mine the transcript with a
fresh context** that hasn't lived the session:

- **Claude Code / Cursor:** spawn a fresh subagent (e.g. `context: fork`) whose
  only job is to read the transcript and extract findings.
- **Codex:** run the extraction as an explicit, separate analysis pass.

## Procedure

1. **Locate the transcript.** Use the path the harness provides (Claude Code: the
   `transcript_path` from the hook payload). **Never guess it** — if you don't
   have a readable path, say so and stop; `safeword retro` will refuse without
   `--transcript`.

2. **Extract friction into the schema (fresh context).** Have the fresh reader
   scan the transcript for **safeword's own** friction and emit a JSON array of
   findings, each exactly this shape (snake_case):

   ```json
   {
     "category": "bug | rough-edge | gap",
     "title": "<concise, canonical title describing the SAFEWORD behavior>",
     "safeword_surface": "<a real safeword path: hooks/…, packages/cli/…, templates/…, dist/…, or .safeword/…; for friction with no single-file surface use process/<area>, a short lowercase-hyphen area (≤32 chars) like process/tdd-loop>",
     "what_happened": "<what safeword did, in your own words>",
     "why_friction": "<why it was friction / what it blocked>",
     "repro": "<in terms of safeword commands>"
   }
   ```

   Rules for the reader:
   - **Safeword's friction only.** Not the host project's bugs. If a finding
     has no single-file surface, use `process/<area>` (e.g. `process/tdd-loop`);
     if it can't name a safeword surface at all, drop it — the command drops it
     anyway.
   - **Canonical titles.** Title by safeword's behavior ("Coverage gate message
     omits file and number"), not the customer's situation. Stable titles keep
     recurrences on one issue.
   - **Don't hand-sanitize and don't pad.** Write plainly; the command redacts
     secrets/paths at egress. Do **not** paste customer code, paths, or output to
     "add context" — there is no schema field for it and it would be stripped.

3. **File.** Write the array to a temp file and run:

   ```bash
   safeword retro --transcript <path> --findings <findings.json>
   ```

   The command normalizes → drops findings with an unresolvable surface →
   sanitizes every field → assembles the body → files upstream, deduped, under
   the caps. It prints a one-line summary (filed / recurrences / new
   manifestations / deferred / failed).

## Rules

The three bold invariants are shared word-for-word with
`self-report-filing.md`; a parity contract (`packages/cli/src/schema.ts` →
`contracts`) keeps the two guides from forking again (#801). Guide-specific
rules follow them.

- **Autonomous** — no human approval; sanitization + dedup + caps are the safeguards, not a human gate.
- **Upstream only** — `ArcadeAI/safeword`, never the host project's tracker.
- **Code owns egress** — nothing leaves beyond what the sanitized output contains.

Specific to this playbook:

- The friction is in safeword, not the host product. You provide raw findings;
  the command sanitizes and files. Never file issues yourself from the
  transcript — that bypasses the guard. If the agent lacks GitHub access to the
  upstream repo, the command says so and no-ops — that's fine.
- **Empty is a valid result.** A smooth session yields zero findings. Don't
  invent friction to fill the array.
