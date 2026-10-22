# Real OpenCode required host-schema rejection

Baseline proof only, no product RED or production policy change. Exact2.0.32
CLI/TUI with normally generated current V2 package and owned profile/project.

Investigation distinguished three mechanisms: an invalid optional skill remains
isolated; an unsupported required worker constraint is adapter-thrown; malformed
native plugin-definition id is rejected by the host loader's actual schema. The
latter is the missing real host-schema observation. Keep the other two controls.

Hook-registration fault injection was the alternative: it could leave a valid
plugin ID and expose a failed activation row, but would require choosing another
invalid callback/event shape and proving its failure is host validation rather
than a JavaScript argument error. The required definition id is a smaller exact
schema boundary: SDK2.0.32 Plugin declares id:string and setup:function; native
Module loader decodes default through Schema.Struct with those fields before
activation. Choose this real module-schema fault. Premortem: native log format
changes and failure provenance becomes unreadable; pin the proof to2.0.32 and
require one exact candidate-targeted native load error, not a generic warning.

Sources fetched this pass:
https://raw.githubusercontent.com/anomalyco/opencode/v2.0.32/packages/core/src/plugin/module.ts
(module schema and decode before activation); exact installed SDK Promise
plugin.d.ts and README (id/setup contract and host runtime-module resolution).
Native observation confirms both; third-party migration reports were leads only.

Probe copies the real package into an owned candidate, retains its entire valid
entrypoint in valid-definition.js, and exports that same definition with only
id changed to42. No test-thrown rejection or fake SDK. Real host starts, executes
one harmless control shell tool, and its independent observer records plugin.list.
That malformed candidate is absent from the native list; it is not represented
as an invented native 'unavailable' row. Exactly one candidate-targeted native
loader log decodes to PluginModule.LoadError/SchemaError at ["default"]["id"].
The guard runtime never dispatches. The harmless control file has exact content.
A separate unchanged production candidate then activates in the same runtime
lane and denies its forbidden-write control through the actual shared guard.
This paired control is not same-profile recovery or customer status proof.

First harness assumed native list would retain a failed row; actual loader drops
unloadable modules. Second capture established log's cause is JSON-quoted, so
parse that field before matching its schema path. Both were proof setup errors;
neither was a missing product behavior or a test-supplied native decision.

Direct native proof passes CLI and TUI:
/tmp/safeword-opencode-host-schema-native-decoded.log. Rejected candidates:
opencode-native-vkQYrw/opencode-native-rUtvqt; paired valid controls:
opencode-native-3Z5shw/opencode-native-Nb1lGu. Each owns its profile, config,
package copy and log. Current V2 package generated normally at
/tmp/safeword-2enrh5-targets.aOFAud/native-v2-rules-20261022-1.

Required native-opencode runner now executes this probe alongside the retained
worker/optional-registration controls. It still reports incomplete: public status
binding and complete required-case population remain unimplemented. No admission,
complete PR2 or full host-contract claim follows from this native observation.

Current combined native-opencode refresh executes the new probe successfully in
both lanes, alongside all prior implemented controls. Log:
/tmp/safeword-opencode-current-with-host-schema-native.log; its final exit3 is the
required HOST_CONTRACT_PROOF_INCOMPLETE status, not a failed native assertion.
Public status binding and complete required population remain outstanding.
Targeted lint and CLI types pass. Independent quality review34b3d408-84bd-
43f6-b71c-fa3acaf2e348 approved with no errors. Retained warnings concern exact
log-format-dependent error classification and the supplement's fixed time budget;
no broad parser/process-hardening change was added.
