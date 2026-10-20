# Portable content checkpoint review

Scope: first production increment only; the full feature remains in implement.
No activation, enforcement, compatibility admission, or shipped-host parity claim.

## Review questions

- Source currency: does the root manifest follow Agent Plugins 1.0's closed
  fields and fixed skill locations, without inventing portable shell variables?
- Risk and regression: does explicit pilot generation preserve the default
  shipped bundle and the existing custom-output generation contract?
- Ownership and simplicity: do both native resource probes exercise one content
  renderer, with host syntax confined to projections rather than copied skills?
- Wiring and proof: does Codex select the root extension and load packaged fixture
  resources, and does Cursor exercise the production renderer and actual packaged
  helper origin, with distinct negative controls?
- Principle and experience: preserve customer configuration and avoid requiring
  users to select an agent. This checkpoint proves resource mechanics only;
  automatic selection and persona recovery walkthroughs remain unimplemented.

## Current evidence and limits

Host date: 2026-10-20, from the supplied environment. Agent Plugins 1.0 source
fetched this pass:
https://github.com/agentplugins/agent-plugins-spec/blob/ff8ab5e392cc87bd88d87c060815a87490e51003/spec/1.0.0.md

The source requires root plugin.json, fixed skills/, namespaced client extensions,
and package-contained resources. PLUGIN_ROOT is a stdio-MCP subprocess contract;
the renderer instead gives skill-relative runtime resolution guidance. That
guidance is model-mediated, not a deterministic enforcement mechanism.

Exact native Codex 0.160.0 portable example: 3/3 steps passed, report
host-contract-proof-mU0euz. Installed cache and generated candidate match by
tree bytes; distinct skill/reference nonces and native metadata readback passed.
The Codex actor replaces the rendered explain skill with a fixture skill: this
proves installed resource discovery and extension precedence, not the rendered
workflow's runtime binding or helper execution on Codex.
Exact native Cursor 3.24.18 resource example: 4/4 steps passed, report
host-contract-proof-Ow0kNV; actual shell helper origin and nonce observed.
The Cursor registration bootstrap is test-owned, not a production installer.
Both required groups intentionally return HOST_CONTRACT_PROOF_INCOMPLETE (3).
No scenario ledger checkbox is complete.

Targeted schema, catalogue, generation and version regression: 71 tests passed.
Full CLI suite passed: 687 files, 11,358 tests passed, 14 skipped; 769.17 seconds.
Lint/typecheck and all five generated-surface checks
passed before this review. No dependency added or version target changed.

The first full regression caught three legacy custom-output expectations.
Portable generation now requires explicit --portable-core plus --version and
--output; all legacy output modes retain their existing renderer.

## Deferred obligations

Native enforcement, bounded continuation, exclusive authority, production
bootstrap/enrollment, OpenCode V2, complete catalogue/policy consolidation and
proof-admitted delivery remain in the approved execution plan. This checkpoint
must not be reviewed as completion of those later slices.

## Independent result

Review da5cba7d-e9c2-4b73-b579-56441e05a759: approved, independent Claude/opus,
no blocking errors. This file was updated afterward to narrow the Codex evidence
claim as recommended; reviewed production and proof targets remain unchanged.

Non-blocking findings retained for subsequent work: fail loudly when the portable
runtime binding is unset; make reference-only runtime instructions self-contained;
add renderer/helper coverage on Codex; validate portable manifest fields against
the specification; remove redundant pilot generation work and obsolete fixture
fallbacks after their baseline role ends. These remain explicit limitations of
the isolated pilot, not accepted shortcomings of the final shipped delivery.
