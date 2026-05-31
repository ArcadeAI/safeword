---
id: TT1MQW
slug: upstream-changelog-monitor-epic
type: feature
phase: intake
status: open
epic: upstream-changelog-monitor
---

# Epic: Automated upstream changelog monitor (CC, Cursor, Codex)

**Goal:** Automatically detect when Claude Code, Cursor, or OpenAI Codex ship changelog/docs changes, and hand a human/agent the diff to triage — turning the manual review done in this thread into a standing process.

**Why:** Safeword rides three fast-moving agent platforms; an upstream hook/behavior change can silently weaken a gate (this thread found exactly that). We need to *notice* changes promptly without babysitting three changelogs.

## Design decision (figure-it-out, 2026-05-31)

**Automate detection; keep triage human-initiated.** Detection ("did it change?") is deterministic, cheap, and reliable. Triage ("is it safeword-relevant, and how?") needs judgment — and this thread proved that judgment needs human verification (a delegated agent got a load-bearing Codex `Stop` fact wrong). So the system reliably *surfaces* diffs and a human/agent triages on demand (our existing review flow + tickets). An LLM pre-triage step is a deliberately-additive Phase 2 (J4BTMT), never the core.

**Shape:** a scheduled GitHub Actions workflow fetches each source's most stable artifact, normalizes to text, diffs against a snapshot committed in-repo, and on change opens/updates a GitHub Issue with the diff + a relevance checklist. The committed snapshots double as the "which upstream version have we reviewed" baseline that ticket 116 wanted.

## Per-source artifact (researched)

| Source | Best diffable artifact | Notes |
| --- | --- | --- |
| Claude Code | `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` | git markdown — clean line diff |
| Codex CLI | `github.com/openai/codex/releases.atom` (+ developers.openai.com/codex/changelog) | atom feed = clean; latest stable 0.135.0 (May 28 2026) |
| Cursor | `cursor.com/changelog` (HTML) | hardest — no confirmed RSS; hash normalized text |

A uniform "fetch → normalize to text → hash → diff vs snapshot" works for all three; feeds are a nicer input where available.

## GitHub Actions reliability caveats (verified, docs.github.com)

- `schedule` min interval 5 min; **runs can be delayed or dropped under high load, worst at the top of the hour** → use an off-hour, off-:00 cron (e.g. `17 9 * * 1`, weekly).
- **Public repos: scheduled workflows auto-disable after 60 days of no repo activity** (ArcadeAI/safeword) → heartbeat/health-check (ERD9BB).
- Scheduled workflows run only on the **default branch**, latest commit.
- Needs `permissions: { issues: write, contents: write }` (commit snapshot + open issue).

## Tickets

| ID | Title | Phase |
| --- | --- | --- |
| **R6ARF5** | Detection skeleton: CC source → diff → open issue | walking skeleton |
| **3ZRP8G** | Cursor + Codex source adapters (HTML hash + releases.atom) | breadth |
| **99XBFG** | Snapshot store = upstream-version baseline (subsumes 116) | state |
| **NBRWN8** | Issue output: diff + safeword-relevance review checklist | output |
| **J4BTMT** | Phase 2 (optional): LLM pre-triage of diffs | additive |
| **ERD9BB** | Reliability: off-hour cron, 60-day heartbeat, failure alert | hardening |

## Sequencing

R6ARF5 (one source end-to-end) → 99XBFG (snapshot/baseline) → 3ZRP8G (add the other two) → NBRWN8 (issue polish) → ERD9BB. J4BTMT only if manual triage proves too slow.

## Out of scope

- Auto-filing safeword tickets or PRs from the diff (triage is human-initiated; the issue links to the review flow). Revisit only after J4BTMT.
- Auto-applying upstream-driven code changes.

## Related / supersedes

- Ticket **116** — its "establish upstream version baseline + recurring review" intent is largely **subsumed** here (snapshots = baseline; this epic = the recurring mechanism). Reconcile/close 116 against 99XBFG.
- Epics **8R54HV / VAX3Z2 / QM5G9M** — the manual reviews this automates; the issue checklist points at their triage tiers.

## Work Log

- 2026-05-31 Created. figure-it-out: automate detection, human-triage; scheduled GH Actions + committed snapshots; filed 6 child tickets.
