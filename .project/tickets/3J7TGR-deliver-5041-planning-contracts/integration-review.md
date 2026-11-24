# Current-main integration review context

Accepted work: only the remaining #5041 planning-contract contribution plus
integration with main f48275b5e (#5856). Task 3J7TGR records this delivery;
5F5ZZA remains in progress. The user explicitly approved the separate task and
admin merge. Completing this task does not complete the feature or #5051.

Main replaced per-hook CLI lookup with `hooks/lib/safeword-cli.ts`. Preserve
that helper and all unrelated hook changes exactly. The planning-copy gate
now uses its `trustedSafewordClis`, `projectWritablePluginCli`,
`trustedEnvironment` and `askTrustedSafeword` instead of retaining its private
PATH-based runner. It validates the exact command, phase and current status;
typed copy mismatch/missing findings deny use. Other invalid/unavailable answers
deny without inventing a copy mismatch. Legacy non-Cursor hosts with no checker
remain advisory. Project-owned CODEX_HOME remains a refusal, checked through
the shared environment policy, preserving the existing cached-runtime test.

New test: launch the installed shared hook with a trusted Bun binary, introduce
a project-owned `bun` shim into PATH, and require copy-drift refusal without
executing the shim. With the old planning checker retained temporarily during
conflict resolution, this failed on the shim-executed marker (RED). With shared
trusted lookup it passed, alongside all existing tests in four files: 86/86.
Those files cover installed copies, plan transition, coding authorization and
the shared CLI resolver. Existing tests were not weakened or retimed.

Preserved investigation limit: the initial new test used the outer Cursor
adapter and failed after the planning-checker edit because `runClaudeHook` in
`hooks/cursor/gate-adapter.ts` itself starts `bun` from PATH before reaching the
shared hook. That separate bootstrap boundary is outside this integration.
The corrected regression explicitly tests the shared checker. Existing native
Cursor drift tests remain unchanged, but no hostile-PATH native-adapter parity
is claimed. Both failed probes and the corrected RED/GREEN logs are retained.

Prior green source head 90f4124c3 has full CI 39327364010; this is historical
until the new head passes CI. No unchanged paid semantic qualification runs.
Historical live failures, parent ledger and host/private-injection deferrals
remain in the broader feature's verify.md. Do not demand their completion as
part of this bounded integration or count them as passed.

Review angles: preserve main's trust boundary and routes; retain #5041's raw
copy usability versus semantic currency distinction; fail closed on malformed
checker responses; test the actual installed shared hook with only the
subprocess reviewer boundary simulated; check scope/phase completion truth.
No dependencies or framework APIs changed. The resolver implementation and its
tests in current main are the local primary sources for this integration.

Generation initially reported the Cursor install result hash changed against
the pre-#5856 branch fixture. Inspection confirms the regenerated result is
exactly current main's accepted result
`91c131c2917d4ce79b995843ed54e2fa093a4c09cf1f88498bb365867d626635`.
All 12 result digests match current main; only tree identities incorporate the
combined template bytes. The first failed generator record is preserved, then
generation is rerun against the inspected fixtures. No result oracle weakened.

A second regression preserves main's environment defaults: the same shim probe
now covers both unset and empty CODEX_HOME. The first policy check incorrectly
treated an empty value as a project path; the empty case failed with the wrong
refusal while the unset case passed. Requiring a nonempty value restores the
shared resolver's default semantics without changing project-owned-cache denial.
