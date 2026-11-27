# Harbor benchmark verification

**PR Scope:** ✅ The changes deliver the on-demand benchmark, its fixtures and graders, the answer relay, the scoring runbooks, and CI for the harness. Product intake changes shipped separately in PR #8398. Issue #5751 tracks the broader benchmark study.

| Check | Observed result |
| --- | --- |
| Harness tests | 52 offline Python tests and three Node tests passed across the harness and intake suites. Two credentialed Python tests skipped in the offline run. |
| End-user execution | The Harbor Docker verifier scored the untouched task 0 and its reference solution 1. The eight reservation and extractor calibration controls all matched their expected rewards. |
| Frozen intake comparison | Prepared a comparison through the documented CLI. With zero author observations the report withheld its decision. After a byte change in the frozen answer key it rejected the report. |
| Regression and structure | The four CLI documentation checks passed after describing Harbor in the architecture index. Verified the generated architecture documents from the staged source tree. The runner and reporter now share validation of the pinned harness and input hashes. |
| Evidence limits | These checks require no paid model run or live LangSmith upload. The handbook probes study trusted fixtures. Preference adherence in the exploratory handbook comparison is assessed manually. |
| Repository checks | The PR checks page records the full Node matrix, lint, type checking, CLI contract, parity, and Harbor smoke for each pushed commit. |

The reviewer and author check the same saved trial evidence. A missing protocol, an unknown budget stop, or a changed answer key cannot justify promoting a candidate. Human judgment remains necessary for new product choices and inconclusive grades.

## Review follow-up

- In the pinned Bookworm intake image, the pre-reply command produced a readable empty tar archive with exit status 0 before a ticket existed. Failure-injection tests showed a separate cleanup error could hide the original failure. The runner now records a failed optional Git snapshot and continues collecting required evidence. When two operations fail, it preserves the original exception with a cleanup note. Required archive failure after an otherwise successful run still fails the trial.
- Archived Claude traces showed 4 then 2 reported turns in the same resumed session. A combined log showed separate result intervals of 29, 5, 12, 6 and 1, matching the assistant-message counts between results. The regression replays a result across a checkpoint and the final log and checks it counts only once.
- The frozen Opus rates priced one million unclassified cache-write tokens at $8. With the default five-minute duration the estimate is $5. The mixed-duration regression prices 750,000 short and 250,000 long writes at $5.75. All 102 distinct Claude result events inspected in the local intake archive had an explicit one-hour token count, including zero. The fallback change applies when that count is absent.
- A split-model snapshot exposed an intake monitor bug. Both the intake and handbook runners now pass the selected Claude host model to the supervisor. The normal comparison runner retains its frozen author model. A real supervisor regression checks message pricing, result settlement, and rejection of an unexpected model.
- The intake verifier and offline score now treat a wrong model or unpriced usage as inconclusive even when an intake approval arrives at the same time. A real budget cap retains its previous grading behavior. The grader regression exercises all three cases.
- Both npm entry points in the pinned Docker image resolve to separate executables. Setup checks this before wrapping either CLI and removes the staged Codex login if installation fails.
