---
id: RAS9N8
slug: stop-hook-escalation-calibration
type: task
phase: intake
status: pending
created: 2026-06-06T02:08:30.304Z
last_modified: 2026-06-06T02:08:30.304Z
---

# Stop-hook escalation path may be dead (0/10 BLOCKED) — revalidate post-F14BG2, recalibrate if needed

**Goal:** Determine whether the Stop-hook escalation path (`BLOCKED`) is actually reachable in practice, and if it isn't, recalibrate within the existing binary-verdict architecture so genuine blockers surface instead of everything defaulting to `CONFIDENT`.

**Why:** A self-graded verdict that never escalates is a silent quality hole — spec ambiguities and unresolved failures reach "done" ungated. The literature says prompt polish can't fix this: RLHF suppresses uncertainty expression (Xiong 2024 ICLR; Zhou 2024 ACL), so a prettier self-graded verdict is still miscalibrated.

## Background / lineage

This is the one surviving kernel of the retired **stop-hook-architecture epic** (drafts `BMZV8N`/`CCBTG7` + numeric `169`–`172`, discarded 2026-06-06). That epic proposed replacing `CONFIDENT/BLOCKED` with a deterministic FACTS block + a fresh-context subprocess judge. Main decided against that direction: `143-stop-hook-binary-terminal` built the binary verdict, and `F14BG2-stop-hook-verdict-shape` (done 2026-05-27) reaffirmed and refined it into a Decided/Rejected/Open/Next decision brief.

The catch that motivates this ticket: **F14BG2 reshaped the verdict for readability; it did not touch calibration.** The epic's audit claim — _10/10 CONFIDENT, 0/10 BLOCKED across real verdicts_ — is therefore neither addressed nor independently re-verified. This ticket carries that one concern forward in the current scheme.

## Scope

- **Revalidate first (don't trust the inherited claim).** Sample ≥10 recent real Stop verdicts (across available transcripts/projects) and measure the `CONFIDENT:BLOCKED` ratio _after_ F14BG2 landed. Report whether the decision-brief reshape moved the rate at all.
- **If escalation is still effectively dead,** find the lever _inside_ the binary-verdict architecture — no FACTS replacement:
  - Sharpen the deterministic disqualifiers that already gate `CONFIDENT` in `lib/quality.ts` (`novelResearchReminder`, `recentFailures`) — add hook-detectable "you cannot claim CONFIDENT while X holds" conditions.
  - And/or lower the bar for _legitimate_ `BLOCKED` in the template so escalation isn't implicitly penalized.

## Out of scope

- Replacing `CONFIDENT/BLOCKED` with a FACTS block — decided against (`143`, `F14BG2`).
- Fresh-context subprocess judge — `037` is pending; the haiku-judge variant `050` is `wontfix`.
- Anything beyond the Stop hook's verdict calibration (`pre-tool-quality`, lint hooks, BDD flow).

## Done when

- Audit of ≥10 recent real Stops post-F14BG2 with the `CONFIDENT:BLOCKED` ratio reported in the work log.
- A recorded decision, one of:
  - **Healthy ratio** → F14BG2 sufficiently addressed it; close with the evidence.
  - **Still dead** → a concrete recalibration shipped (deterministic disqualifier and/or template change), with the ratio re-measured afterward to confirm movement.

## References

- `completed/143-stop-hook-binary-terminal/ticket.md` — built the binary verdict.
- `F14BG2-stop-hook-verdict-shape/ticket.md` — reshaped it into a decision brief (the change this ticket revalidates).
- `.safeword-project/guides/stop-hook-research.md` — existing research.
- Retired epic research: UTBoost (arXiv:2506.09289, 19.78% SWE-Bench semantic-incorrectness); Xiong 2024 ICLR & Zhou 2024 ACL (RLHF suppresses uncertainty).

## Work Log

- 2026-06-06T02:08:30Z Created. Filed as the salvaged kernel of the retired stop-hook-architecture epic (FACTS-block + subprocess-judge drafts discarded after main committed to the binary verdict via 143/F14BG2). Core open question: did F14BG2's reshape make BLOCKED reachable, or is the escalation path still silently dead? Status pending — revalidation not yet run.
