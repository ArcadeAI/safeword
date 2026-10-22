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
