# Dimensions: Make each agent plugin fully self-contained

| Dimension | Partitions and boundaries | Behavioral consequence |
| --- | --- | --- |
| Agent host | Codex; Claude Code; OpenCode; Cursor | Each agent executes every advertised workflow from one declared authority. |
| Runtime authority | Profile plugin; project-local host delivery | Plugin-backed agents need no project executable copies; project-delivered agents are complete without borrowing another host's assets. |
| Project runtime payload | Complete legacy payload; no hooks/skills/scripts; selected host-only payload; partially missing runtime | Workflows do not recover code through a broader or cross-host installation. |
| Project enrollment | Enrolled with authored knowledge; unenrolled | Workflows may use enrolled knowledge/state, fail open outside enrollment, and never invent authored configuration. |
| Runtime state | Existing; missing file; missing parent directory | Missing framework state initializes lazily without invoking installation. |
| Ignore hygiene | Rule absent; exact rule present; broader customer rule present; unrelated existing content | Initialization adds at most one precise rule and preserves the customer's bytes and effective policy. |
| Selected agents | Each host alone; native host plus Cursor | Plans contain shared substrate plus the selected project authority and no native project runtime. |
| Profile ownership | Current identity; previous identity-owned bytes; edited owned asset; unrelated profile content | Upgrade and uninstall mutate only bytes proven by the profile identity. |
| Release integrity | All references packaged; undeclared project-local executable reference | Release validation rejects native catalogues that borrow project runtime. |

skip: Zero-agent installation is not a supported selection in this epic; the CLI requires at least one delivery authority.

## Boundary reconciliation

- **Zero project runtime files for plugin-backed hosts** and **only the selected project authority for project-delivered hosts** are the load-bearing cold-start boundaries.
- **One missing transient state file** proves lazy creation without installer escalation.
- **Mixed plugin-backed agents and Cursor** proves self-containment does not remove or broaden Cursor's project-local authority.
- **Edited OpenCode profile content** proves identity-owned cleanup remains fail-closed.
