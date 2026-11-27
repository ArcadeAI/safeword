# Harbor comparison scorecard

Record the task and dataset version, job IDs, host and model pins, release and
checkout revisions, attempts per arm, budgets, and reply policy. For repeated
runs, report the pass numerator and denominator plus the range or per-trial
values for effort. List setup failures and replacements alongside the results. Record when an
agent reaches a turn, spend, or time limit after producing passing code.

| Measure                                                        | No Safeword | Latest release | Checkout |
| -------------------------------------------------------------- | ----------- | -------------- | -------- |
| Harbor functional checks                                       |             |                |          |
| Feature quality (required checks passed / required checks run) |             |                |          |
| Code: public interface compatibility                           |             |                |          |
| Code: correctness and failure handling                         |             |                |          |
| Code: maintainability                                          |             |                |          |
| Code: scope and complexity                                     |             |                |          |
| Proof quality (faults caught / tried, exit status propagated)  |             |                |          |
| Delivery status (delivered, awaiting input, or incomplete)     |             |                |          |
| BDD intake started / advanced past intake                      |             |                |          |
| BDD scenarios before first applied production edit             |             |                |          |
| BDD scenarios authored / observed passing                      |             |                |          |
| Standalone test cases authored / observed passing              |             |                |          |
| TDD cycles verified / scenarios or cases exercised             |             |                |          |
| Product eval cases / graders                                   |             |                |          |
| Human input requests / replies (live or replayed)              |             |                |          |
| Checkpoints resolved (what changed; did the agent resume?)     |             |                |          |
| Elapsed time (setup / agent work / waiting for input)          |             |                |          |
| Agent turns                                                    |             |                |          |
| Total tokens including cached input / output tokens            |             |                |          |
| Estimated author spend (USD)                                   |             |                |          |
| Estimated reviewer spend (USD)                                 |             |                |          |
| Estimated author and reviewer spend (USD)                      |             |                |          |
| Implementation lines / test and scenario lines                 |             |                |          |

Verify function against Harbor and delivery against the artifacts and handoff.
Count a TDD cycle when the same check fails for the intended reason before the
fix and passes after it. Note whether the command propagates failures. A BDD
scenario can also be TDD evidence. Count product evals the agent authored,
excluding Harbor's graders. Record what human replies resolved and whether
the agent resumed.

Count ticket or spec scaffolding as intake started. Report advancement past
intake from observed ticket phases. Use the first applied change to shipped
behavior or a public contract for implementation chronology. Link the tool call
and result. Mark runs that stop before implementation as no production edit,
and use unobservable when the trace does not establish an order.

For feature trials, `python grade_workflow.py TRIAL --relay RELAY` can replay
saved evidence with a separate judge. Retain cited trace lines for review and
report hidden correctness independently.

For resumed Claude sessions, sum turns across distinct result events. Take
token totals and estimated cost from the latest cumulative session result.
Use `model_spend` in `trial-report.json` for author and reviewer dollars.
Include usage from repeated review attempts. Link the comparison's frozen
model IDs and dated rates. Record any budget stop and mark the combined
cost unknown when any required cost is missing.
Cached input is already part of total input. Count final lines, including comments and
blank lines, in implementation files and proof files. Exclude generated setup
and planning files. Link the traces, verifier results, and proof artifacts.

## Quality grading

- **Feature:** Freeze acceptance checks before the comparison. Exercise the
  documented interface, grade each requirement, and require every mandatory
  check for a pass. Preserve per-requirement results and record additional
  diagnostics separately from the original
  scored result.
- **Code:** Review the diff with arm labels and scores hidden when possible.
  Record material findings by dimension. Name the affected behavior, trigger,
  and consequence. Use an overall merge verdict only as a separate decision.
  Flag whether the reviewer knew the arm. Record when no material finding
  was observed, with the scope of review. Avoid treating one underlying
  issue as multiple independent defects.
- **Proof:** Rerun authored checks on clean delivered code. On disposable
  copies, apply the same small set of behavioral faults independently.
  Count a fault only when the expected assertion or behavior fails. Record
  whether the command exits nonzero, and mark incompatible artifacts as
  not comparable. Keep historical TDD evidence separate.
- **Human input and time:** Distinguish clarifications from approval requests.
  Count a useful question even if the trial ends awaiting a reply. Include
  wait time in elapsed time and report it separately from agent work. Use
  unknown when the trace cannot support a time breakdown.
