# Primary sources fetched 2026-10-21

https://cursor.com/docs/cli/overview
CLI has same Agent/Plan/Ask modes as editor, noninteractive print mode, cloud handoff. Same modes do not establish same installed plugin/runtime behavior.
https://cursor.com/docs/hooks
Hooks run spawned processes via stdio JSON and can observe/block/modify. subagentStart can allow/deny creation. subagentStop followup only consumed for completed, bounded loop. beforeShellExecution/beforeMCPExecution crashes/timeouts/non-2 exit fail open by default; failClosed true blocks those failures. workspaceOpen runs desktop AND CLI (cloud overview calls it IDE-specific, so interpret there as absent in cloud).
https://cursor.com/docs/subagents
Subagents in editor/CLI/cloud have separate context, no prior parent history, configurable prompts/tools/models.
https://cursor.com/docs/cloud-agent
Cloud VMs differ from local. Repo command hooks run once writable, not early read-only exploratory turns. Local ~/.cursor/hooks.json unavailable. Tab/workspaceOpen absent in cloud. No claim of Safeword cloud coverage.
https://cursor.com/docs/plugins
Portable Agent Plugins supports skills/MCP; native Cursor format also supports rules/agents/commands/hooks. Portable MCP root variable expansion differs in Cursor. Loading alone cannot establish enforcement.
These are paraphrases from current official docs, not executable proof for pinned versions. Existing accepted exact-version real-host proofs remain required.

https://cursor.com/docs/agent/agents-window
Fetched 2026-10-21: Agents Window is an interface across local, cloud and remote SSH environments; it does not identify one execution runtime.
https://cursor.com/docs/subagents
Fetched same session: configured model can fall back under admin/plan limitations; model name is not guaranteed actual reviewer identity.
