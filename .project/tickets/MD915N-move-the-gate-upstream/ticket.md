---
id: MD915N
slug: move-the-gate-upstream
type: feature
phase: intake
status: backlog
scope:
out_of_scope:
done_when:
parent: WAWQA6
created: 2026-07-17T14:01:03.466Z
last_modified: 2026-07-17T14:01:03.466Z
---

# move-the-gate-upstream

**Goal:** Review the ticket/spec BEFORE the code exists, so the PR reviewer becomes a thin last net instead of the main control — humans review specs, not PRs.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-17T14:01:03.466Z Started: Created ticket MD915N

## Why (measured, 2026-07-17)

**55% of arcade's human review attention lands on specs/scenarios/docs, not production code** (140 human inline comments across the last 50 merged PRs; the single most-reviewed file is a `.feature`). They are already doing spec review — just performing it *after* the code exists, as a PR, at the costliest point in the pipeline and in the one channel where a bot's authority is lowest (Is_Human rho=0.99, arXiv 2508.18771).

**Nearly every good finding the PR reviewer produced is the shadow of a gate arcade doesn't have:**

| PR-review finding | The upstream gate that would have caught it |
| --- | --- |
| 2118 — `toMatchObject` can't catch the loop regressing | scenario-gate (AODI) |
| 2146 — semver test uses values where lexical == numeric | scenario-gate |
| 2128 — eval proxy could execute REAL tools (ticket forbade it) | `done_when` gate |
| 2120 — "Closes TOO-1358" but doesn't ship `mute_thread` | scope / `done_when` |
| 2113 — metric counts batches; ticket specified `batchSize` | impl-plan review |

So the PR reviewer is a **compensating control for not running safeword upstream**. It is worth building (WAWQA6) — but it is treating the symptom.

## The cheapest test — the corpus is free

Run `/review-spec` (or its equivalent) against the last ~10 shipped arcade Linear tickets and ask: would it have caught what the PR reviewer caught late? If yes, that is the whole argument in one artifact.

## The failure mode to instrument from day one

**The spec gate becomes the new rubber stamp.** The automation-bias literature names the diagnostic: rejection rate under ~1% and sub-5-second approvals = "just passing things through." Arcade's PR changes-requested rate is already **0 of 50** — the code-review axis is hollow by that measure. If the spec gate lands under ~5% rejection, we have moved the hollowness upstream and achieved nothing but a longer pipeline. Measure rejection rate + time-to-approve from the first week.

## Out of scope

- The PR reviewer itself (WAWQA6's other children). This is the upstream half; that is the last net.
