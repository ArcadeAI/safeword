---
id: NBRWN8
slug: monitor-issue-output
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
---

# Issue output: diff + safeword-relevance review checklist

**Goal:** Make the opened issue immediately actionable: the diff plus a checklist that points triage at safeword's surfaces (hooks, skills, gates) and the tiering used in the manual epics.

**Why:** The issue is the human/agent handoff. A raw diff alone repeats the cold-start cost; a relevance checklist makes triage fast and consistent.

## Build

- Issue body: source + version/date, the new entries (diff), and a checklist: "Touches hooks lifecycle? skills/commands? settings schema? gate-bypass risk (cf. EKNEW0)? → triage as Breaks / Adopt / Watch and file ticket(s)."
- Link to the relevant platform epic (8R54HV / VAX3Z2 / QM5G9M) and to `/figure-it-out`.
- Update (not duplicate) the open issue if one already exists for unreviewed changes.

## Done when

- Generated issue carries the diff + relevance checklist + epic links; re-runs update rather than spam.

## Source

This thread's triage structure (Breaks/Adopt/Watch tiers).

## Work Log

- 2026-05-31 Created from monitor epic.
