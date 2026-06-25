# Dimensions — cold-start executability test (3KKPWJ)

Behavioral dimensions derived from scope / done_when / resolved questions, plus
domain-knowledge dimensions. The deliverable is prose-instruction (a skill +
a DISCOVERY Intake Exit rung), so scenarios are proved by content/structure
assertions on the authored instructions — the same test model the sibling
epic-169 features used (TPP6Y2 `readiness-pointer.test.ts`, NWFT20
`intake-brief.test.ts`). No new hook/code kernel: the trigger is conversational
discipline (we deliberately rejected a hook nudge), so a predicate helper with
no caller would be bloat.

| Dimension              | Partitions (equivalence classes + boundaries)                                                                                               | AC                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Trigger condition      | one-way-door → offer · cross-cutting (data model/public API/migration) → offer · two-way-door → no offer · missing/`skip:` field → no offer | NTB1.AC1           |
| Trigger source         | reads the **recorded** Reversibility field (boundary: must not re-judge live)                                                               | NTB1.AC1           |
| Invocation mode        | interactive auto-offer at Intake Exit · explicit on-demand · YOLO auto-accept + log                                                         | NTB1.AC1 / TB1.AC3 |
| Cold-agent inputs      | spec + repo present · conversation history absent (boundary: zero transcript)                                                               | TB1.AC1            |
| Verdict outcome        | sufficient (plans end-to-end, no guess) · insufficient (gaps named) · plan-depth not full build                                             | TB1.AC1            |
| Verdict output         | presentation (plain-language + next action) · persistence (gaps appended to Open Questions, not overwriting)                                | NTB1.AC2 / TB1.AC2 |
| Failure mode           | sub-agent error/timeout → note one line + proceed, no gaps, no block                                                                        | NTB1.AC3           |
| Advisory force (x-cut) | never blocks regardless of verdict or mode; builder decides                                                                                 | NTB1.AC3           |
| YOLO × exit gate       | auto-appended gaps recorded as `defer:` so the auto-confirming Intake Exit isn't silently blocked (carry-forward)                           | NTB1.AC1 / TB1.AC2 |
