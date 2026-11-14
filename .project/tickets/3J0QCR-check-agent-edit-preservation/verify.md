# Verification

**PR Scope:** ✅ This local follow-up contains only the authorized opt-in smoke, its grader tests, and task evidence; no unrelated product changes.

Scope: one opt-in experiment and a deterministic grader suite. No product hook,
template, dependency, version, or existing test changes. The original formatter
fix's CI is historical evidence for that separate task, not a CI result for these
new files. This experiment is not yet published to the existing Draft PR.

- Live smoke: one launch, **pass**, five turns, approximately eleven seconds,
  estimated cost **$0.021314**. Model usage confirms claude-haiku-4-5-20251001.
  Both actual source-hook observations preserved source bytes. The unused import
  finding appeared after adding it and disappeared after use. The unrelated
  unformatted export remained identical; all three functional inputs passed.
- No-cost probe: passed before the live launch and after strengthening structured
  feedback checks and replacing the dependency-directory symlink with a private
  ESLint launcher. At initial closeout there was no live rerun; the later
  final-layout observation below now supplies that coverage.
- Grader calibration: initial empty grader failed a direct no-op rejection
  assertion before implementation; six direct assertions passed afterward.
  This is not historical Vitest RED evidence. The first Vitest command waited
  twenty minutes and exited 75 without starting a test. After that command ended,
  the same focused suite passed **14/14** on retry (one file, 76ms test duration).
- CLI package typecheck, standalone strict experiment typecheck, focused ESLint,
  and formatting checks passed after correcting duplicate test fixture fields.
  These checks confirm that the test's import of the pure experimental grader
  is accepted by the actual package typecheck; no runtime/package import was added.
- No live test runs by default or in CI. One model run never retries, uses no
  second AI judge, and is bounded by eight turns, 120 seconds, and the CLI's
  $0.10 estimated-cost limit. That limit can overshoot and is not a bill guarantee.

Raw local artifacts are under .project/tmp/3J0QCR-live-1/ and
.project/tmp/3J0QCR-probe-{1,2,3}/. The model ran against production HEAD
5454818bf9cc184e81969e2d7e388d0b21b057b7 with an uncommitted experiment. The
entrypoint hash is recorded; that commit is not claimed to contain this experiment.
One elicited task is a wiring/behavior smoke, not a reliability rate, native-host
parity guarantee, or Biome/Ultracite agent-response result.

Reviews: intake ca7c7bb3-fa2c-4d21-b691-55331c57ca2f approved. Implementation
review f05bbfc1-08b1-4f46-bc3c-a81e81d8fe52 requested the same duplicate-field
correction caught by typecheck; all variants were corrected. Re-review
0ce9704d-25d7-4546-9758-f0785e66e266 approved; its private-dependency warning was
then addressed with the private launcher and passing no-cost probe. Final review
approved in full-diff review 3dde6678-2d8a-4f6a-94f0-6b99162fee01; canonical grader execution passed 14/14 afterward without further code changes. The matcher covers exactly the exposed Edit/Write tools; MultiEdit is not exposed in this bounded smoke. At initial closeout the final private-launcher fixture had probe coverage only; the later observation below closes that live-evidence gap. No broader live result is claimed.

No behavior outside the accepted smoke emerged. No shared abstraction or
cross-scenario refactor is warranted for one fixture. Existing Cursor diagnostic
delivery, other-language mutation, and the unrelated GEPA scorer's malformed-output
weakness remain outside this task.

## Final completion

Verification review 816d1b3d-fea2-44c4-b6b3-c61c4f6ea6d8 approved the evidence.
The actual source CLI Codex Stop returned {} and updated this ticket to done at
2026-11-14T06:02:27.696Z after its configured completion checks passed. The
automatic ticket resolver found two changed tickets in this branch; explicit
selection of 3J0QCR and the source post-edit observer for the real verification
artifact edit established the correct session binding before that completion run.
No test result or review receipt was hand-authored.

The approximately eleven-second duration is in agent.json (duration_ms 10979).
The functional child result is in task-check.json; the three frozen inputs are
visible in run.ts, and the live pass was computed only after those checks succeeded.
These are local captures and observed exits, not signed billing or CI attestations.

The audit used base 5454818bf, so the experiment is the audit boundary, not the
earlier formatter implementation. Code/config/learning/domain checks passed with
no findings. The configured dependency analyzer saw one module and zero edges;
experiments are outside its shipped-source graph, so explicit strict typechecking
and manual review supply that source coverage. Principle-trace analysis is N/A:
the explicitly resolved task has no impl-plan.md. The automatic resolver's initial
ambiguity remains an operational limitation, not a claimed successful trace run.
Whole-repository unused-code, clone and dependency-freshness discovery were skipped
by diff-audit policy. No additional refactoring was justified.

## Final-layout live observation

The user requested another bounded observation after the initial build. The final
committed private-launcher fixture passed at 2026-11-14T14:42:54.832Z on
c7ca7253eceabeeefe0b9344794492019f9c2fff: five turns, 9,473ms, estimated cost
$0.029803, normal agent exit, no grading issues. Both actual hook observations
preserved bytes. The unused-import diagnostic appeared after the import edit and
cleared after use; unrelated formatting remained untouched. task-check.json
records exit 0 for the three frozen functional cases.

Raw local artifacts: .project/tmp/3J0QCR-final-layout-20261114T1442/. The model,
CLI version, and production hook hash match the initial observation. The two
recorded live launches total estimated $0.051117; neither was an automatic retry.
This remains one elicited case observed twice, not a reliability study. No source,
test, dependency, or configuration changed during the final-layout run or this
evidence-only update. The earlier 14/14 grader, audit, and completion results are
retained with their original scope; no new suite or CI execution is claimed.
