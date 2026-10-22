# OpenCode resource control review follow-up

This supersedes the runner-completion paragraph in
opencode-resource-controls-green.md. The new native controls pass, but the
worker-tool rejection is deliberately an adapter setup failure, not the
separate required host-schema rejection/status scenario. The native group
therefore still returns 3 with that remaining gap and complete required-case
population named. No scenario checkbox or customer admission is cleared.
The generic rejected-schema/status scenarios remain pending the shared
required/optional classification and admission reader in the accepted scope.

The earlier independent review approved the narrow native controls. Its
relevant warnings have been addressed: the worker fixture selects canonical
safeword-reviewer explicitly and confirms the expected Read restriction;
candidate lookup uses an exact path/directory boundary; guide and helper
markers must occur on the actual read and bash results, respectively. The
feature-only diagnostic JSON now declares its scope and the log says feature
cases passed, avoiding a whole-group success claim before supplements finish.
The existing 180-second probe budget remains a fail-closed availability limit;
no timing sleeps or arbitrary retries were added.

The full package suite caught an unrelated-lane regression introduced by the
native proof scaffold: steps/consistent-host-opencode-controls.steps.ts used
BeforeAll and lived under the default steps/**/*.ts scan. Thus unrelated
Cucumber scenarios demanded a native OpenCode fixture before their first step.
Root cause was reproduced with the exact installed-CLI evidence presentation
scenario command; it failed at that hook before any scenario. The unchanged
control hook is now outside the shared steps scan, at
packages/cli/tests/fixtures/host-contract/opencode-controls.ts, explicitly
imported only by cucumber.native-opencode.mjs. The same default Cucumber command
now passes 5 scenarios / 235 steps. Required OpenCode fixture checks remain
unconditional in its own native lane. No environment skip was introduced.

Review the final source changes for proof fidelity, accidental weakening,
fixture isolation, and the precise incomplete-group claim. Prior source and
native observations are in opencode-resource-controls-green.md. Final required
worker and V1 guide/helper reruns both pass in their respective final.log files.
