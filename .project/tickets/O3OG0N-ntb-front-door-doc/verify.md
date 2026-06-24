# Verify — ntb-front-door-doc (O3OG0N)

## Verify Checklist

**Test Suite:** ✓ 492/492 tests pass (done-gate lane) — unaffected, README-only change
**Gherkin:** ✅ Acceptance lane unaffected (README-only; last run green this session, 69/741)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean (markdownlint: 0 errors on README.md)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 6/8 done)
**Reconcile:** N/A — additive README section, matches the existing heading style

## What was verified

Added a **"Driving safeword without reading code"** section to README.md, placed
right after "How It Works" (the workflow/gates diagram) and before "What's
Inside" — the NTB front door the epic was missing. It names the three things a
non-technical builder actually sees, in plain language:

- **Blocks** — framed as protection ("a block is safeword protecting you, not an
  error"), with the message carrying the next action.
- **The end-of-turn verdict** — CONFIDENT / BLOCKED glossed in passing (ties to
  B6J2TY, which glosses them at the verdict itself).
- **`/explain`** — the plain-English lifeline, noted as working across Claude
  Code, Cursor, and Codex (true as of this epic: 5XOUDJ + DC6276).

Pure additive documentation; markdownlint clean; no code or behavior touched.

Ready to mark done.
