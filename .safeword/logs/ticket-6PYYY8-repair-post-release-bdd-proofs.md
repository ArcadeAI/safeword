# Work Log: Make post-release BDD proofs catch their claimed regressions

**Anchored to:** `.project/tickets/6PYYY8-repair-post-release-bdd-proofs/ticket.md`

## Session: 2026-09-06

- [08:20] Started from the v0.83.1-to-HEAD feature and proof-manifest diff.
- [08:23] Found the structural provenance gate passes while multiple mappings point to tests for different behavior.
- [08:25] Found the worker deployment test claims every CI gate but checks only `worker-inputs`.
- [08:27] Decision: preserve authored scenarios; remap to exact existing behavioral tests where possible and add or strengthen only the missing proofs.
- [08:50] Implemented public-command route, deadline, status, provenance, mutation, and failure evidence for the repaired mappings.
- [09:13] Verified 291 targeted tests across review jobs, runtime, policy, public wiring, deadlines, deployment workflow, and BDD provenance; two platform-specific tests skipped.
- [09:20] Verified the full CLI suite: 9,203 tests passed across 557 files; 16 platform- or condition-specific tests skipped.
