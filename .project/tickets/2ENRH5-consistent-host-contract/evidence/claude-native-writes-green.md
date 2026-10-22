# Exact Claude native write controls

Authentication is now resolved in the owned profile. The stale four-hour OAuth
listener had not received a callback. Cancelled only that owned listener and
started one replacement; normal browser authorization completed and the exact
CLI reports loggedIn:true/authMethod:claude.ai. No credential value was read,
copied, logged or moved between profiles.

Actual Claude2.1.170 with the current generated native plugin passes both Write
controls. Denied: incomplete task scope, native PreToolUse ran for the exact
Write tool call, returned permissionDecision:deny with all three missing scope
fields, Claude returned is_error:true for the same tool_use_id, and the target
file stayed absent. Allowed: complete scope, native guard returned0, and the
target file contains the exact unique marker. No test-supplied policy decision,
alternative tool or injected native tool result.

The first authenticated assertion expected exit2 incorrectly. Actual shared
deny() and Claude's documented protocol use exit0 plus structured JSON denial;
the observed native trace already showed correct blocking. Corrected the proof
to require that exact JSON decision, scope reason and actual correlated host
rejection, retaining the absent-side-effect assertion. No production change or
product RED was involved. Official protocol fetched this pass:
https://code.claude.com/docs/en/hooks#pretooluse-decision-control.

Passing evidence (both below the owned fixture root):native-contract-lWPBac and
native-contract-YyrfDW. Log:/tmp/safeword-claude-native-writes-structured-deny.log.
Each trace also validates actual native plugin source, enabled registration and
byte equality with both the generated source and native cache. This is the real
local-directory marketplace delivery; native execution uses its registered owned
source, not the separate cache record. It does not prove a hosted Git install.

Only the write controls pass. Required catalogue/helper and bounded-continuation
cases and their complete native-claude runner population remain to wire/prove.
No full scenario, feature completion or new native admission is recorded.

Independent review0e8e3e27-0a52-4a1a-a573-ef23335e80fb found a real proof
classification defect: a missing dispatch could report unavailable before the
forbidden side effect was checked. Corrected: denied side effects are checked
first; native event data must show an actual Write attempt before absent guard
dispatch is classified as product failure. No attempted Write stays unavailable.
The allowed control also rejects a restrictive JSON decision; scope-name checks
now require distinct field names. No policy or registration was changed in the
production package.

Real negative control probe-claude-missing-guard.ts first validates the production
fixture. In only its owned source/cache packages, removes the pre-tool-quality
registrations and reseals the normal inventory metadata. Native Claude performs
the forbidden Write; the proof observes DENIED_SIDE_EFFECT_OBSERVED instead of
unavailable. Finally restores the exact original hooks, identity and inventory
bytes and checks both package trees against current production. Negative passed:
native-contract-WOoyDj; log:/tmp/safeword-claude-native-missing-guard.log.
This is a deliberate negative fixture, not an alternative production payload.

Follow-up review e42faf5e-689d-480f-a143-25291a65deeb caught a second path
through that classification defect: turn() could throw after a forbidden Write
and before the side-effect assertion. The assertion now runs in finally, so
host timeout, process failure or invalid final events cannot conceal an already
observed forbidden file. Independent review
1c4e2670-4070-43f6-a428-e4abf1135d33 approved this repair. Remaining suggestions
concern protocol-error labels and inherited trusted caller environment; none
permits a broken guard to pass. Normal repaired-fixture rerun passed both cases:
native-contract-L44f5a/native-contract-gZDcx1, log
/tmp/safeword-claude-native-writes-after-negative.log. Lint and types pass.
