---
id: M7AZY3
slug: workflow-gate-hygiene
type: feature
phase: done
status: done
epic: workflow-gate-hygiene
created: 2026-05-31T18:31:15.834Z
last_modified: 2026-05-31T18:31:15.834Z
---

# Epic: Workflow & gate hygiene cleanup

**Type:** Feature (epic — holding pen for safeword self-enforcement cleanup)

**Goal:** Tighten how safeword enforces its own discipline — make agents actually follow the bdd/tdd phase machine, and put each gate at the right trigger — fixing drift surfaced by dogfooding.

**Why:** This long session was itself evidence that safeword's self-enforcement has gaps. Epics got closed by `status` with hand-written verify.md (the `phase: done` gate never fired because aggregation/decision tickets stay at `phase: intake`); a duplicate ticket (7GER0P) was filed because there's no capability-discovery surface; and a lot of real work happened outside the intake→done phase machine entirely. Separately, the LOC gate fires on a line-count heuristic that may not be the right trigger. This epic is the holding pen for those self-enforcement fixes.

## Tickets

| ID         | Title                                                                        | Type    | Status   |
| ---------- | ---------------------------------------------------------------------------- | ------- | -------- |
| **2JMQMX** | Explore & fix bdd/tdd workflow adherence                                     | feature | **done** |
| **MT27QG** | Review LOC gates — keep, or move trigger to phase/step                       | feature | **done** |
| **1GGD28** | Generated ticket INDEX.md (`safeword sync-tickets`) for capability discovery | feature | **done** |

(More may join — this is the cleanup holding pen. Related self-enforcement tickets that stay standalone: MBGQ89 pairing schema, 160-audit-stale-ticket-detection.)

## Merged-in PRs

- **#178** (`claude/safeword-changelog-review-BmvF0`) — safeword auto-upgrade **v0.39.0 → v0.39.1**, merged into `arcade-pipeline-sync` (merge commit `75a45d0d`). Besides the version bump it carried **34 changelog-alignment ticket files** (codex/cursor/monitor adoption, hook modernizations) that are now on the branch unsorted. Cleanup work this implies, owned by this epic: (a) triage those 34 incoming tickets — keep / fold / drop; (b) confirm the v0.39.1 upgrade integrates cleanly with this session's `.safeword/`/template/skill edits (no silent overwrite of the DZ2NM5/DXFX02 changes).

## Out of scope

- Building new product features. This epic is strictly about safeword's own workflow/gate enforcement hygiene.

## Done when

- All three children (2JMQMX, MT27QG, 1GGD28) are `done`.
- bdd/tdd adherence has a documented diagnosis + a shipped fix (guidance and/or enforcement).
- LOC-gate placement has a documented decision (keep LOC, or move to a phase/step trigger) and any resulting gate change shipped.
- The 34 changelog-alignment tickets #178 merged in are triaged (kept / folded / dropped), and the v0.39.1 upgrade is confirmed not to have overwritten this session's edits.

## Work Log

- 2026-05-31T18:31:15.834Z Started: Created ticket M7AZY3
- 2026-05-31T18:31:15.834Z Filed (backlog): cleanup holding epic for safeword self-enforcement, with two children carved from this session's dogfooding observations — bdd/tdd adherence drift (2JMQMX) and LOC-gate placement (MT27QG). Epic carries no own spec.md; children hold their own.
- 2026-05-31T18:49:35.386Z Attached **1GGD28** (ticket-discovery-index) as a third child — it's the same self-enforcement-hygiene class as 2JMQMX/MT27QG (it's the fix for the opaque-ticket discovery gap that caused the 7GER0P duplicate). Set its `epic: workflow-gate-hygiene`; moved it out of the "stays standalone" note.

- 2026-05-31T23:52:19.743Z Added PR **#178** to the epic — merged (v0.39.0→v0.39.1 + 34 changelog-alignment tickets); its triage + upgrade-integration check are now epic scope (see Merged-in PRs).
- 2026-06-01T05:17:00.000Z Closed all three children. **1GGD28** done — `safeword sync-tickets` generates epic-grouped INDEX.md + INDEX-completed.md (mirror of sync-learnings); regen on command + `safeword check` + `ticket new`. **2JMQMX** done — closed the status/phase done-gate sidestep: `resolveStopPhase` surfaces a `status: done` close (build ticket with scenarios, or epic) into `phase: 'done'` so the gate runs; gate self-tiers via `isFeature`. **MT27QG** done — KEEP the LOC trigger (phase-agnostic; the un-phased majority has no step boundary), fixed the mid-merge deadlock via `isGitOperationInProgress` suppression. All shipped with tests + /verify + /audit.
- 2026-06-01T05:17:00.000Z Item #4 — **PR #178 triage: KEEP all 34.** They are not orphans: 4 coherent backlog epics (`cc-changelog-alignment` 8R54HV +10, `codex-changelog-alignment` QM5G9M +7, `cursor-changelog-alignment` VAX3Z2 +7, `upstream-changelog-monitor` TT1MQW +7), each epic-linked with statuses set. No duplicates of this session's work, nothing obsolete → no folds, no drops. Cross-link recorded: **EKNEW0** (done-gate vs Stop-hook 8-block cap) is adjacent to 2JMQMX (different failure mode — block-cap exhaustion vs status sidestep), so `related`, not merged. **Overwrite-check: clean** — the v0.39.1 merge (75a45d0d) was purely additive (34 tickets + `.safeword/version`); zero owned hook/skill/template files touched; no post-merge reconcile; DZ2NM5's work (bdd JTBD flow, `findCoverageAdvisories`, glossary JTBD term) all intact. Epic done_when satisfied → epic closed.
