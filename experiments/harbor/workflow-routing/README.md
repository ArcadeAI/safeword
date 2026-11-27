# Workflow routing eval

These prompts describe user-visible behavior. The expected route and the grader
stay outside the agent workspace. Use Outlook as a separate ambiguity case.

| Split    | Patch                               | Task                                                                          | Feature         |
| -------- | ----------------------------------- | ----------------------------------------------------------------------------- | --------------- |
| Train    | `debug-routing/tasks/obvious-label` | `debug-routing/tasks/lost-import-rows`, `debug-routing/tasks/stale-dashboard` | `seat-booking`  |
| Held out | `default-banner`                    | `overlap-minutes`, `shift-rounding`, `parking-grace`                          | `library-holds` |

Patches specify a concrete edit. Tasks fix or change behavior in an existing flow. The shift-rounding case starts
with correct exact-minute totals and asks for rounded totals. Features introduce state and several actions users
can take. The feature starter comments specify the callable interface so the
hidden grader can test behavior without requiring any particular implementation.

## Run

From `experiments/harbor`, using the existing Harbor credential setup:

```sh
uv run --locked python workflow-routing/prepare.py jobs/workflow-routing-fixtures
SAFEWORD_EVAL_LOCAL_ONLY=1 SAFEWORD_EVAL_ATTEMPTS=3 \
  SAFEWORD_EVAL_TASK=jobs/workflow-routing-fixtures/seat-booking ./compare.sh checkout
```

Use the matching task path from the table for other fixtures. The generator
calibrates all new graders against a starter that fails the new behavior and a
reference that passes. Both must pass the preservation check. Only a task's
`environment/` is supplied to the agent container. Keep calibration outputs,
expected routes, and held-out traces out of GEPA's inputs.

## Score the trace

Record the observed route, evidence links in chronological order, and hidden
functional and preservation scores for every trial. An explicit route label
is optional. Judge observable actions, including file diffs and tool results,
even when the host has no standalone skill invocation event.

| Expected | Evidence for a routing pass                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Patch    | Direct narrow edit and a confirming check. No scenario-writing or plan approval detour.                                                   |
| Task     | A test asserts the requested behavior and fails for the expected reason before the first production edit. The same check passes after it. |
| Feature  | Concrete scenarios cover the main actions and a failure case before the first production edit. A skill call alone earns no pass.          |

Use `unobservable` when trace evidence is missing and `runner_error` when
setup prevents execution. Report both explicitly. For each failed routing
check, provide one concrete sentence anchored in the trace. Report correctness
and cost alongside routing. Keep the original Safeword revision as a control
and compare any prompt variant on the same model, fixtures, and budget. Require
held-out routing improvement without lower hidden correctness or added process
for patches before adopting a candidate.

For test-retention comparisons, rerun the delivered tests twice in fresh workspaces. Use the delivered implementation first, then restore only the original implementation. Count a retained regression test when a parking or other task-specific assertion passes on the delivery and fails on the starter. A shell-only assertion can establish test-first order, but cannot catch a later regression in the project.

## GEPA pilot

The pilot uses GEPA 0.1.4 with an isolated Python environment. It changes
only the sizing and build sections of the handbook in an experimental plugin
archive. Sonnet runs each Harbor fixture. A tools-disabled Haiku call grades
the observable workflow from the trace. The score gives half credit for
hidden correctness and full credit when the workflow also passes. An incorrect
result scores zero. Raw traces and the judge's reasons remain in the job folder.

From `experiments/harbor`, with the same local Claude authorization used for the
Harbor runs:

```sh
uv run --locked python preservation-pilot/prepare.py debug-routing
uv run --locked python workflow-routing/prepare.py jobs/workflow-routing-fixtures
uv venv jobs/gepa-routing/.venv --python 3.13
uv pip install --python jobs/gepa-routing/.venv/bin/python gepa==0.1.4
jobs/gepa-routing/.venv/bin/python workflow-routing/gepa_pilot.py jobs/gepa-routing/pilot
```

The pilot uses twelve GEPA metric calls by default. The four training cases
also select the candidate. Three separate fixtures are evaluated only after
selection, against both the original and selected instructions. The pilot uses
single Claude invocations per fixture without a human relay, so a run that
stops to ask for clarification may end with an incomplete patch. Use
`summary.json` for the held-out comparison and audit the judge's evidence
before treating its scores as a release decision.

## Experimental results

Keep these prompt variants in the eval lane.

| Comparison                                             | Workflow passes | Hidden correctness |
| ------------------------------------------------------ | --------------- | ------------------ |
| GEPA candidate vs. original, held-out cases            | 3/3 vs. 0/3     | 3/3 both           |
| Shortened revision vs. original, two repeats per case  | 4/6 vs. 0/6     | 6/6 both           |
| Scenarios-first vs. BDD handoff, two new feature cases | 0/2 vs. 1/2     | 2/2 both           |
| Pre-edit hook vs. BDD handoff, two feature cases       | 1/2 both        | 1/2 vs. 2/2        |

The shortened wording improved patch verification and tests-first bug fixes.
In the feature comparison, the one workflow pass came from executable tests
written before editing. None of the four runs invoked the BDD skill. The
pre-edit hook triggered BDD in both trials, and one stopped before
implementation to ask for a workflow decision. That hook is retired. Its
archives and traces are historical evidence. Future variants change the
handbook text.

Local evidence lives under `jobs/` in
`gepa-routing-20261123/pilot`, `gepa-routing-replication-20261123T223455Z`,
`gepa-feature-transfer-20261123T224448Z`, and
`gepa-bdd-entry-20261123T225353Z`.
