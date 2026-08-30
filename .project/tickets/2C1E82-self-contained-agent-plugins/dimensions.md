# Dimensions: Make each agent plugin fully self-contained

| Dimension | Partitions and boundaries | Behavioral consequence |
| --- | --- | --- |
| Agent host | Codex; Claude Code; OpenCode; Cursor | Each agent executes every advertised workflow from one declared authority. |
| Runtime authority | Profile plugin; project-local host delivery | Plugin-backed agents need no project executable copies; project-delivered agents are complete without borrowing another host's assets. |
| Project runtime payload | Complete legacy payload; no hooks/skills/scripts; selected host-only payload; partially missing runtime | Workflows do not recover code through a broader or cross-host installation. |
| Project enrollment | Enrolled with authored knowledge; unenrolled; malformed/unreadable enrollment | Workflows may use enrolled knowledge/state, fail open outside enrollment, and never invent authored configuration. |
| Runtime state | Existing; missing file; missing parent directory; unwritable location | Missing framework state initializes lazily; creation failure names the exact path and bounded recovery. |
| Ignore hygiene | Rule absent; exact rule present; broader customer rule present; unrelated existing content | Initialization adds at most one precise rule and preserves the customer's bytes and effective policy. |
| Selected agents | Each host alone; every pair; three-host selections; all hosts | Plans contain the deterministic union of declared requirements and no unselected host assets. |
| Asset ownership | Plugin executable; shared enrollment/knowledge; durable framework state; transient state; authored state; host-specific adapter; optional tooling | Every planned effect has one declared owner/classification and follows that lifecycle. |
| Plan scale | Small repo; monorepo with many language workspaces | Selecting a native plugin never fans out unrelated development dependency changes. |
| Capability failure | Packaged helper present; packaged helper absent; state creation denied | Recovery stays capability-specific and does not escalate to full installation. |
| Upgrade provenance | Replacement plugin proven; not proven; recognized legacy runtime; edited/ambiguous legacy content | Cleanup occurs only with proof and only for recognized obsolete runtime. |
| Release integrity | All references packaged; undeclared project-local executable reference; version mismatch | Release/parity validation rejects incomplete or incoherent plugin bundles. |
| Repeatability | First plan/run; repeated plan/run; selected-agent order reversed | Results are idempotent and order-independent. |

skip: Three-host selections are represented by all pairwise boundaries plus the stricter all-four union; implementation-level tables will exhaust the remaining combinations.

skip: Zero-agent installation is not a supported selection in this epic; the CLI requires at least one delivery authority.

## Boundary reconciliation

- **Zero project runtime files for plugin-backed hosts** and **only the selected project authority for project-delivered hosts** are the load-bearing cold-start boundaries.
- **One missing transient state file** proves lazy creation without installer escalation.
- **Many monorepo workspaces** proves selected-agent setup cannot trigger dependency fan-out.
- **Mixed plugin-backed agents and Cursor** proves self-containment does not remove or broaden Cursor's project-local authority.
- **Unproven or ambiguous legacy content** proves cleanup remains fail-closed.
