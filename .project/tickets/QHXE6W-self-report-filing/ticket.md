---
id: QHXE6W
slug: self-report-filing
type: feature
phase: intake
status: in_progress
created: 2026-06-24T04:11:57.301Z
last_modified: 2026-06-24T04:11:57.301Z
---

# Agent filing loop + selfReport.\* config gating (#353)

**Goal:** Close the self-observation loop — gate behavior on `selfReport.*` (capture/
surface/file, **file off by default**) and point the agent at a guide that turns
captured signals into deduped GitHub issues, without auto-filing in customer repos.

## Work Log

- 2026-06-24T04:11:57.301Z Started: Created ticket QHXE6W
- 2026-06-24T04:18:00Z Built (#353), RED→GREEN (55 self-report tests):
  - `lib/self-report.ts`: `readSelfReportConfig` (defaults capture-on/surface-on/
    file-OFF; ignores non-booleans; defaults on malformed). `formatSelfReportSurfacing`
    gains a `{ file }` option that appends a FACTUAL pointer to the guide (imperative
    procedure stays in the guide, so additionalContext isn't surfaced verbatim).
    `recordSignal` now caps the spool at 200 records/file (crash-loop bound).
  - Gating: `installCrashCapture` + `recordCliExit` skip when `capture` is false;
    the Stop hook stays silent when `surface` is false and adds the filing pointer
    when `file` is true.
  - Guide `templates/guides/self-report-filing.md`: search-by-title → comment-or-create,
    ≤1 issue/signature and ≤5 new issues/session, "never add beyond the draft" rule.
    Registered in schema; dogfood copies byte-identical.
  - `.gitignore`: added `.safeword/self-reports/` (dogfood hygiene from the review).
  - Dogfood config left at defaults (file OFF) — maintainers opt in deliberately.
