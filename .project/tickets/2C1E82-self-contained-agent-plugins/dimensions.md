# Dimensions: Make each agent plugin fully self-contained

| Dimension | Partitions and boundaries | Behavioral consequence |
| --- | --- | --- |
| Agent host | Codex; Claude Code; OpenCode; Cursor | Each agent executes every advertised workflow from one declared authority. |
| Runtime authority | Profile plugin; project-local host delivery | Plugin-backed agents need no project executable copies; project-delivered agents are complete without borrowing another host's assets. |
| Project runtime payload | Complete legacy payload; no hooks/skills/scripts; selected host-only payload; partially missing runtime | Workflows do not recover code through a broader or cross-host installation. |
| Audit diff cardinality | No changed files; two changed files | A sourced audit helper exports a stable empty list as well as a populated list without ending the caller shell. |
| Project enrollment | Enrolled with authored knowledge; unenrolled | Workflows may use enrolled knowledge/state, fail open outside enrollment, and never invent authored configuration. |
| Runtime state | Existing; missing file; missing parent directory | Missing framework state initializes lazily without invoking installation. |
| Ignore hygiene | Rule absent; exact rule present; broader customer rule present; unrelated existing content | Initialization adds at most one precise rule and preserves the customer's bytes and effective policy. |
| Selected agents | Each host alone; native host plus Cursor | Plans contain shared substrate plus the selected project authority and no native project runtime. |
| Remaining consumer after removal | Cursor; another native plugin; no remaining host | Remove only the selected delivery while retaining enrollment/configuration required by another host; existing single-host uninstall contracts cover the no-consumer case. |
| Profile ownership | Current identity; previous identity-owned bytes; edited owned asset; unrelated profile content | Upgrade and uninstall mutate only bytes proven by the profile identity. |
| Release integrity | All references packaged; undeclared project-local executable reference | Release validation rejects native catalogues that borrow project runtime. |

skip: Zero-agent installation is an existing project-only mode rather than an agent runtime authority. Its explicit project-removal counterpart (`uninstall --agents=none`) is covered because remaining-host preservation must not disable that control.

skip: Cross-host package-reference syntax is host-specific and already rejected by each native catalogue's own reference validator; the shared release gate covers the portable project-runtime reference class.

skip: Filesystem permission failures are platform policy rather than a Safeword behavior partition; durable writes surface the underlying failure and never trigger installation fallback.

skip: A non-version-controlled directory has no version-control status in which transient state could appear; precise ignore behavior is verified in enrolled Git repositories, where the guarantee is observable.

skip: OpenCode is the representative identity-owned profile lifecycle because Codex and Claude Code use their hosts' package managers rather than Safeword-managed profile asset identities.

skip: User-facing drift-report wording is owned by the existing OpenCode lifecycle contract; this epic preserves its typed drift finding and recovery action without redesigning CLI copy.

skip: Cleanup of obsolete native project runtime copies remains owned by the existing proof-bound Codex and Claude migration contracts; this epic proves legacy copies cannot regain execution authority and does not authorize deleting unproven project content.

skip: Complete and partial legacy project payload precedence is exercised through Codex as the representative native package-cache host; Claude's plugin-root migration authority remains covered by its existing proof-bound lifecycle contract rather than duplicating that migration matrix here.

## Boundary reconciliation

- **Zero project runtime files for plugin-backed hosts** and **only the selected project authority for project-delivered hosts** are the load-bearing cold-start boundaries.
- **One missing transient state file** proves lazy creation without installer escalation.
- **Mixed plugin-backed agents and Cursor** proves self-containment does not remove or broaden Cursor's project-local authority.
- **Edited OpenCode profile content** proves identity-owned cleanup remains fail-closed.
