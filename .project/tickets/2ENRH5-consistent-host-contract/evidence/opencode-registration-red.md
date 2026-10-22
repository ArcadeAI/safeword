# Optional OpenCode resource rejection and independent guard

PR 2 task 4 component proof. The ledger binding is Scenario: A denied action has
no side effect, OpenCode V2 2.0.32 CLI/TUI rows. Given an isolated candidate whose
explain skill has malformed description metadata, the actor-facing When is a
real native protected shell write. The Then requires the shared guard to deny
that write despite the optional resource failure. The separate public status
scenario, required-registration reporting and admission are later obligations;
this proof cannot complete those scenarios or the full native-opencode group.

The probe copies the current generated package and changes only catalogue.json's
explain description to number 42, violating the real public Skill.Info schema.
The native host loads the package through the real profile enrollment writer,
then the scripted model asks the actual skill tool for the broken explain skill,
an unrelated cleanup-zombies skill, and finally the actual shell write. It
supplies no policy decision. Every actual call/result must be observed. The
independent native observer records the exact candidate's native plugin state,
and source/candidate bytes must match. A failed setup must identify description
schema validation; missing imports, SDKs, attempts or results are unavailable.

The intended RED is V2_OPTIONAL_FAILURE_HIDES_GUARD at the final protected-write
assertion. Author run /tmp/safeword-opencode-optional-registration-red-final.log
exits 2 in both CLI and TUI: the native plugin state is failed with a Skill.Info
schema issue pointing to description, and the protected write exists. The
native SDK tears down the earlier guard registration when setup throws.

GREEN additionally requires the native candidate active, explain rejected by
the actual skill tool, cleanup-zombies content returned successfully, and one
shared status-2 guard dispatch tied to the canonical checkout, exact command and
native session. Disabling all resources or faking denial locally cannot pass.
Production error isolation has not been implemented before this review.

The shared actor's Given now uses real profile-local enrollment rather than
the removed projectDirectory option. It declares its observer first, then lets
the production controller append the candidate. This ordering is necessary:
an execute.before observer registered after a denying guard cannot see that
call. Six native feature rows / 24 steps, four worker cases and four retained
V1 controls pass with this setup; full-group exit remains 3 because other
registration, command and V1 resource obligations are incomplete. Report
safeword-host-contract-proof-caj7Ue/cucumber.json; log
/tmp/safeword-opencode-enrolled-native-group-final.log.

Primary SDK reference:
[2.0.32 skill transform and schema construction](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/build/plugins/effect.mdx).
No full status, all-host propagation, user-experience or customer admission claim
is made from these component mechanics.
