---
id: QJ3EK7
slug: lean-session-guidance
type: task
epic: 3TJD0A
scope:
  - Session handbook reductions and their real effects on Claude and Codex.
out_of_scope:
  - Changes to model behavior through hooks or vendor-specific prompts.
done_when:
  - Each change has a recorded keep-or-revert decision and the paired trials are accounted for.
phase: done
status: done
created: 2026-11-26T11:37:33.659Z
last_modified: 2026-11-26T15:20:27Z
---

# Keep workflow decisions reliable with a shorter session handbook

**Goal:** Keep only session guidance that changes observable behavior.

**Why:** Every session loads the handbook.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-26T11:37:33.659Z Started: Created ticket QJ3EK7

## Decision and evaluation protocol

Use the existing two-host Harbor trial to test the feature intake gate with a hidden preference and an already supplied preference. Keep question counts, plan correctness, reviewer approval, premature edits and measured spend separate. Use the real handoff parser for the literal Next/Need/Open contract. For the remaining decisions, use small isolated workspaces with the same input and model for each handbook. Inspect actual tool calls, edits and artifacts.

| Change | Observable evidence |
| --- | --- |
| Drop compulsory recaps and typography advice | Compare first substantive reply and repeated questions. Preserve supplied preferences and ask about missing ones. |
| Remove generic anti-pattern examples | Exercise a real bug, including an error path. Check that the fix passes a hidden test and inspect the diff for unrelated abstractions. |
| Move stale-plan details to the planning guide | Flip only the user's consent. On refusal, no investigation. On acceptance, look for a scoped review, a chat verdict, and an untouched ticket. |
| Move architecture decision steps to the architecture guide | Use a durable shared choice and a mechanical control. Inspect guide access, alternatives, tradeoff and decision record. |
| Remove Build recap | One-file new capability enters intake, regression gets a failing test before an edit, typo gets a direct verified fix. Keep explicit workflow overrides. |

Full builds on every prompt would give realistic traces but mix unrelated failures. Text assertions alone are cheap but cannot show what the agent does. Pair focused trials with real intake and deterministic contract checks. The chief risk is that a moved rule becomes invisible. Treat an unexplained candidate miss as grounds to keep the old rule. Results on one case per host are a smoke test, not a reliability estimate.

Method references: [Agent Skills specification](https://agentskills.io/specification), [CheckList behavioral evaluations](https://aclanthology.org/2020.acl-main.442/), [Anthropic agent evaluations](https://www.anthropic.com/research/demystifying-evals-for-ai-agents).

[Scorecard and reproducible evidence](./scorecard.md)

All 78 planned trials have scored outcomes. The approved shift plan allows back-to-back assignments and rejects positive-duration overlap for the same employee.
