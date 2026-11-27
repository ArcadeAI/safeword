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
