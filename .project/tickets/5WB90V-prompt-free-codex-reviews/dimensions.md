# Scenario dimensions

| Dimension | Partitions and boundaries | Rule |
| --- | --- | --- |
| Review kind | quality, scenario, plan allowed; executable RED rejected | R1 |
| Packet | bounded relative files under the model-supplied absolute project root; missing, absolute, escaping, and symlinked-outside-root files rejected by coordinator; Codex supplies no authenticated workspace root to this plugin, and secret avoidance remains agent judgment | R1 |
| Project state | authored files unchanged; signed `.safeword/state/reviews` receipt revalidated by normal gate | R1, R3 |
| Plugin install | fresh local Codex home; versioned bundled runtime; no profile/rule changes | R2 |
| Tool availability | discovered; unavailable; startup failure | R2 |
| Review status | running; terminal independent; failed; degraded; unknown; completed receipt after MCP restart | R3 |
| Permissions | built-in workspace profile; no approval prompt; shell network denied | R3 |

Outside scope: executable RED through MCP, profile or rule installation, hook trust, cloud-only sessions.
