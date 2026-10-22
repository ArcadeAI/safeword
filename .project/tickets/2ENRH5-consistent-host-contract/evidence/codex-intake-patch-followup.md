# Codex intake retirement: patch-route review follow-up

Review 8795d9ca-0729-4a7b-ae85-3be0807751ec requested direct apply_patch coverage
or the decoder source before accepting the private-owner removal. The decoder
already exists: templates/hooks/codex/pre-tool-quality.ts calls
translateCodexInputToClaudeInputs, then runClaudeHookAsCodex for each result.
The helper maps each Add target to Write and each Update/Delete target to Edit,
passing the target path and relevant content. The child receives the owning
project cwd and runs the actual shared pre-tool-quality.ts. No new decoder or
replacement policy is necessary.

Two new public-CLI characterization cases send a relative Add File patch under
the default .project root and configured knowledge root. Both require exit 2
with the shared missing-intake reason. A direct native-shaped CLI control of
both paths passes now, /tmp/safeword-codex-patch-intake-control.log; these are
integration checks, not additional installed-host E2E claims. The test file's
new cases will also be run after the current single full-suite process ends.

The exact pinned host protocol was verified independently against official
0.160.0 source. ApplyPatchHandler::pre_tool_use_payload serializes tool_name
apply_patch with tool_input.command containing the raw patch. Matcher aliases
Write/Edit do not change the serialized tool name. Thus the new controls use
the real host's shape rather than assuming a Claude-style input.
Sources:
https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/core/src/tools/handlers/apply_patch.rs
https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/core/src/tools/hook_names.rs

Production code is unchanged since the prior review. This follow-up supplies
the omitted decoder source and adds the requested controls. The current partial
source check remains explicitly ineligible for complete inventory/admission;
its known bypass and remaining full-graph/CI work are not treated as resolved.
The absolute symlinked configured-root edge case noted by review is retained
for the shared namespace boundary controls; no false claim of covering every
namespace representation is made. A configured '.' namespace is an existing
supported configuration, not a newly added user option in this change.
