---
id: NBRWN8
slug: monitor-issue-output
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
---

# Issue output: idempotent, diff + relevance checklist + in-flight PR links

**Goal:** Make the opened issue actionable AND deduplicated against work already in flight: one issue per source, carrying the diff, a relevance checklist, and links to any open PR that appears to address the change.

**Why:** The issue is the human/agent handoff. It must not spam across runs, and it must not make someone re-triage a change a waiting PR already covers.

## Build

- **Idempotent:** one open issue per source, keyed by source (+ optionally content hash). Re-runs **update** it (refresh the diff), never open a second.
- **Body:** source + version/date, the new entries (diff), and a checklist — "Touches hooks lifecycle? skills/commands? settings schema? gate-bypass risk (cf. EKNEW0)? → triage Breaks/Adopt/Watch and file ticket(s)." Link the platform epic (8R54HV / VAX3Z2 / QM5G9M) and `/figure-it-out`.
- **In-flight dedup (annotate, not suppress):** before finalizing, search for open PRs that touch `.github/changelog-snapshots/<source>` or reference this issue; if found, annotate: "⏳ likely addressed by #N — verify before triaging." Keep the issue open (a stalled PR must not silently drop the change).

## Done when

- Re-runs update one issue (no duplicates); body has diff + checklist + epic links.
- When an open PR touches the source's snapshot, the issue shows the "likely addressed by #N" annotation.

## Source

This thread's triage tiers; epic TT1MQW (annotate-not-suppress decision).

## Work Log

- 2026-05-31 Created from monitor epic.
- 2026-05-31 Added in-flight-PR annotation (chosen: annotate, not suppress) to dedup against waiting PRs.
