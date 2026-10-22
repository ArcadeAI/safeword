# Native OpenCode commands reference canonical workflows

Review scope: shared metadata ownership, SDK-native command semantics and
argument/attachment preservation, native resource closure, current proof and
compatibility limits. This is PR 2's command component, not a completed full
outline, status/admission, or V1 resource proof.

Fresh executable RED dfbe0cf7-e7c1-4660-9184-c77f76f16e81 (Claude/opus) approves
the final CLI/TUI missing-command proof after the CLI readback operation was
fixed and proved as a Given prerequisite. The prototype was restored to the
no-command source before that execution, then reapplied only after approval.
Earlier receipts c38d3d95 and e2b01c43 were strengthened with actual command
resolution, user-role content and native CLI message assertions. The earlier
message.list facade mismatch was infrastructure, never product RED/GREEN.

The generator writes commands.json from the existing shared command declarations
already consumed by OpenCode V1. It validates workflow references against the
actual packaged skill index using the existing V1 validator. Exporting the V1
workflow-target extractor lets both projections use that one implementation.
PackagedCommandContract is the generated wire shape, and schema owns its path.
There is no new hand-maintained command list, description or workflow body.
The legacy curated list currently lives in cursor-wrappers.ts; PR 3 still owns
full inventory/metadata consolidation rather than pretending that legacy name
already represents the final canonical declaration model.

The SDK registers the generated names through ctx.command.transform. Its
executor calls ctx.session.prompt with unchanged text, files, agents and
delivery, preserving existing skill attachments and appending the selected
canonical skill ID. The host materializes that skill after the existing first
prompt resource-ordering hook and before model admission. It reads the same
packaged skill body and guide/helper graph as normal skill invocation. No
workflow body or permission decision is authored inside the command wrapper.

Actual CLI and TUI command proof now exits 0:
/tmp/safeword-opencode-command-green-final.log, roots opencode-native-E6VZDO and
opencode-native-0fTQbO. It proves a resolved command, canonical user-role workflow
content, preserved argument nonce, native guide/helper tool results, exact
package bytes and helper origin/runtime. CLI additionally checks the actual
session.message.list projection contains workflow, guide, helper and argument
markers. The CLI invokes its public api session.command against an owned
loopback native server; the TUI submits the real slash command. The test's
160-column real PTY fixes terminal clipping without changing dispatch or
counting a timeout as a result. No user service/profile or trust is changed.

Four focused catalogue/population/parser files pass 19 tests. CLI and SDK
typechecks and targeted source lint pass. Full native group and generated-surface
refresh are in flight separately; no terminal result is claimed for those here.
The required native-opencode runner now includes this command probe and still
refuses whole-group completion while required registration/status and V1
resource cases remain.

Compatibility boundary: this command proof uses a clean synthetic catalogue,
with only fixture legacy command/skill directories removed. It does not certify
first-command replacement of retained V1 command wrappers, unknown same-name
user commands, pre-prompt UI ordering or public protection status. The host's
post-plugin file command discovery can take precedence over initial package
commands; those retained command/collision and lifecycle cases still need their
own proof before customer admission. Existing V1 source command bytes are
unchanged by the shared extractor rename.

Primary SDK behavior was checked against the exact target, including its
[command transform](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/plugin/src/promise/command.ts),
[command admission](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session/command.ts),
[skill materialization order](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session/prompt.ts),
[CLI message operation](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/protocol/src/groups/message.ts).
The pinned SDK and audited dependency closure are unchanged; no dependency was
added. Principles/personas remain the current review-knowledge sources:
one behavior owner, preserved customer configuration, and independent native
observation. The full SWM inventory and automatic NTB experience remain open;
these mechanical checks do not establish persona experience.
