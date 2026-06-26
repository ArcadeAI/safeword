---
id: TT1MQW
slug: upstream-changelog-monitor-epic
type: feature
phase: intake
status: in_progress
epic: upstream-changelog-monitor
last_modified: 2026-06-25T20:06:00Z
---

# Epic: Automated upstream changelog monitor (CC, Cursor, Codex)

**Goal:** Automatically detect when Claude Code, Cursor, or OpenAI Codex ship changelog/docs changes, and hand a human/agent the diff to triage — turning the manual review done in this thread into a standing process.

**Why:** Safeword rides three fast-moving agent platforms; an upstream hook/behavior change can silently weaken a gate (this thread found exactly that). We need to _notice_ changes promptly without babysitting three changelogs.

## Design decision (figure-it-out, 2026-05-31)

**Automate detection; keep triage human-initiated.** Detection ("did it change?") is deterministic, cheap, and reliable. Triage ("is it safeword-relevant, and how?") needs judgment — and this thread proved that judgment needs human verification (a delegated agent got a load-bearing Codex `Stop` fact wrong). So the system reliably _surfaces_ diffs and a human/agent triages on demand (our existing review flow + tickets). An LLM pre-triage step is a deliberately-additive Phase 2 (J4BTMT), never the core.

**Shape:** a scheduled GitHub Actions workflow fetches each source's most stable artifact, normalizes to text, diffs against a snapshot committed in-repo, and on change opens/updates a GitHub Issue with the diff + a relevance checklist. The committed snapshots double as the "which upstream version have we reviewed" baseline that ticket 116 wanted.

**Detection ≠ closure (load-bearing — fixes the "waiting PR already covers it" case).** The snapshot on `main` _is_ the "reviewed" marker, and **only the review-closing PR advances it** — detection is read-only and never writes the snapshot. So:

- A change stays flagged (issue open) until the PR that reviews it merges — correct, because until then it genuinely is unaddressed on `main`. The issue is idempotent (one per source, updated not duplicated), so re-runs don't spam.
- The review PR bumps the source's snapshot + `Closes #<issue>`; merge advances the baseline and closes the issue. A CI gate (31B5AM) fails any closing PR that forgets the bump, so the monitor can't fire forever.
- To stop a human re-triaging what a waiting PR already covers, the monitor **annotates** the issue with any open PR touching that snapshot ("⏳ likely addressed by #N") rather than suppressing it — a stalled PR must never silently drop the change (NBRWN8).

## Per-source artifact (researched)

| Source      | Best diffable artifact                                                            | Notes                                                  |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Claude Code | `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`              | git markdown — clean line diff                         |
| Codex CLI   | `github.com/openai/codex/releases.atom` (+ developers.openai.com/codex/changelog) | atom feed = clean; latest stable 0.135.0 (May 28 2026) |
| Cursor      | `cursor.com/changelog` (HTML)                                                     | hardest — no confirmed RSS; hash normalized text       |

A uniform "fetch → normalize to text → hash → diff vs snapshot" works for all three; feeds are a nicer input where available.

## GitHub Actions reliability caveats (verified, docs.github.com)

- `schedule` min interval 5 min; **runs can be delayed or dropped under high load, worst at the top of the hour** → use an off-hour, off-:00 cron (e.g. `17 9 * * 1`, weekly).
- **Public repos: scheduled workflows auto-disable after 60 days of no repo activity** (ArcadeAI/safeword) → heartbeat/health-check (ERD9BB).
- Scheduled workflows run only on the **default branch**, latest commit.
- Detection needs only `permissions: { issues: write }` (read-only on contents — it does **not** commit snapshots). Snapshot commits happen in human review PRs, not the workflow.

## Tickets

| ID         | Title                                                                    | Phase            |
| ---------- | ------------------------------------------------------------------------ | ---------------- |
| **R6ARF5** | Detection skeleton: CC source → diff → open issue (read-only)            | done             |
| **3ZRP8G** | Cursor + Codex source adapters (HTML hash + releases.atom)               | done             |
| **99XBFG** | Snapshot = reviewed baseline; advances only on closing PR (subsumes 116) | state            |
| **NBRWN8** | Issue: idempotent, diff + checklist + in-flight PR annotation            | output           |
| **31B5AM** | CI gate: closing PR must bump the snapshot                               | invariant        |
| **J4BTMT** | Phase 2 (optional): LLM pre-triage of diffs                              | additive         |
| **ERD9BB** | Reliability: off-hour cron, 60-day heartbeat, failure alert              | hardening        |

## Sequencing

R6ARF5 (one source, read-only detection) → 99XBFG (snapshot = baseline) → 31B5AM (bump gate) → 3ZRP8G (add the other two) → NBRWN8 (issue polish + PR annotation) → ERD9BB. J4BTMT only if manual triage proves too slow.

## Out of scope

- Auto-filing safeword tickets or PRs from the diff (triage is human-initiated; the issue links to the review flow). Revisit only after J4BTMT.
- Auto-applying upstream-driven code changes.

## Related / supersedes

- Ticket **116** — its "establish upstream version baseline + recurring review" intent is largely **subsumed** here (snapshots = baseline; this epic = the recurring mechanism). Reconcile/close 116 against 99XBFG.
- Epics **8R54HV / VAX3Z2 / QM5G9M** — the manual reviews this automates; the issue checklist points at their triage tiers.

## Work Log

- 2026-05-31 Created. figure-it-out: automate detection, human-triage; scheduled GH Actions + committed snapshots; filed 6 child tickets.
- 2026-05-31 Hardened against in-flight-PR duplication: detection is read-only; snapshot advances only via the review-closing PR; issue annotates open PRs (annotate, not suppress); added CI bump-gate 31B5AM.
- 2026-06-25T20:06:00Z Landed the read-only monitor foundation plus breadth adapters: Claude Code markdown, Codex CLI Atom, and Cursor HTML snapshots are now monitored by a scheduled workflow. Remaining children own snapshot-bump enforcement, in-flight PR annotation, heartbeat/failure alerts, and optional LLM pre-triage.
