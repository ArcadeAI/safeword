# M3 verification: coexistence status coverage

**PR Scope:** ✅ One example added to the existing status outline, one fixture predicate widened, and the shared read-only snapshot corrected to include plugin state. Confirmed cleanup explicitly excludes its expected state transition. No production code, dependency, template, scenario name, or tag changed.

The new example supplies exact current plugin proof and only an unknown legacy
skill, with no recognized removable assets. It requires classification
`coexistence`, exit 2, exactly one next action `resolve reported legacy conflicts`,
and byte-identical profile/project snapshots. The existing mixed-content example
still expects `cleanup-ready`.

## Results

- RED: before the fixture change, the new example returned `plugin-mode`, exit 0; the assertion failed. Existing two ready-state cases passed.
- GREEN: all 64 native Claude cases and 3,061 steps pass.
- All 51 proof-tag tests pass. The shared test lock that prevented M2's earlier proof run is no longer a limitation.
- Gherkin lint and step-file formatting pass. The test-only change does not affect package types, builds, generated surfaces, or dependencies; M2's passing package lint/typecheck evidence remains applicable.
- Independent Claude Opus review approved with cross-agent independence, receipt `5200daf1-958a-402a-a754-b540ce3c81c9`. No blocking findings remain. The broader existing exclusion used by confirmed-cleanup comparisons remains a non-blocking limitation outside this read-only status repair.
- Extra strict step-file compilation reproduces the same 41 baseline primary diagnostics; no new primary diagnostic was introduced.

## Fault probes

Temporary copies of the step file import the real repository collaborators.
The baseline passes all three ready-state cases. Six variants alter the real
CLI response or project at the process boundary, solely for the coexistence case:

| Fault | Result |
| --- | --- |
| Report plugin-mode with the otherwise correct exit and action | Classification assertion fails |
| Return exit 0 with the correct classification | Exit assertion fails |
| Recommend cleanup instead of resolving conflicts | Action assertion fails |
| Mutate the unknown legacy skill after status | Snapshot assertion fails |
| Write a plugin-mode marker during status | Snapshot assertion fails |
| Write a cleanup transaction during status | Snapshot assertion fails |

Each variant fails the new case while the other two cases pass. Restoring the
old default snapshot exclusion lets the plugin-mode write pass, demonstrating
the pre-existing false positive and the repaired oracle. These are
targeted checks of the existing assertions, not production-runtime mutations
or a comprehensive mutation score. The Claude executable remains a fake adapter;
the status CLI, proof validation, filesystem observation and classification run
through real code.

Initial independent review `140b9f8e-107e-4de1-b42d-9cf264046cb4` correctly
identified that the old shared snapshot hid plugin-state writes from read-only
assertions. The repair changes that default for all those callers, retaining
the explicit exception only for confirmed cleanup's expected transition.

M1, M2 and M3 now have concrete repairs. The eight non-blocking assessment
suggestions remain outside this issue's scope. No PR, release, or deployment
was requested or performed.
