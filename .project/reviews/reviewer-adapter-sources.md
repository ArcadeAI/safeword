# Review evidence — 2026-09-03

Scope: proposal review only. No Cursor inference or protection conformance has
been executed. No new dependency or dynamic plugin loading is proposed.

## Investigation questions

- Currency: do current docs and the installed CLI support the proposed integration?
- Safety: who owns isolation, credential filtering, cancellation, and result trust?
- Models: can unknown catalogue or actual model identity be mistaken for proof?
- Extensibility: can an adapter be registered without new routing special cases?
- Regression and bloat: which behaviors must remain identical during migration?

## Current primary sources

Fetched this session:

- https://cursor.com/docs/cli/reference/parameters — headless mode has tool access;
  model selection, catalogue listing, ask/plan modes, sandbox toggle and JSON output
  are documented. ACP is a hidden command, so omission from default help does not
  establish absence. Sandbox enablement is not by itself read-only confinement.
- https://cursor.com/docs/cli/reference/permissions — global and project permission
  configuration covers shell, reads/writes, web access and MCP tools.
- https://cursor.com/docs/cli/acp — stdio JSON-RPC transport with session lifecycle,
  permission requests and cancellation. It is an integration option, not proof
  of Safeword review safety, model independence, or output provenance.

Local observation: `agent --version` reports `2026.08.25-3e8eec8`;
`agent --help` exposes print, output-format, mode, model, list-models, sandbox,
force, approve-mcps and plugin-dir options. This proves advertised capabilities
only, not working authentication, inference, or confinement.

## Existing source constraints

`runtime.ts` has vendor argument/capability maps and branches for output parsing,
schema files and model catalogues. `environment.ts` filters credentials and applies
OpenCode deny-all permissions. `contract.ts` uses a closed reviewer union.
`route-config.ts` rejects unknown reviewer/author keys, and `policy.ts` has
three named author plans. Inspection is explicitly read-only, without inference
or authentication; catalogue absence is distinct from runtime incompatibility.
Reviewer model metadata currently records requested configuration; do not infer
verified backend model identity from that field alone.

Relevant principle: safety and correctness are gates; prefer the smallest complete
solution. Preserve customer configuration and prove observable behavior, not just
adapter declarations or mocked internal seams.
