# Current-main integration review scope

The manual source conflict combines this feature's portable/Cursor layout
constants with main's PLANNING_CONTRACT_TEMPLATE_PATHS; preserve all three.
The Codex generator auto-merged. Its --portable-core mode is an existing,
explicitly isolated resource-capability pilot, not the shipped compatibility
container. The accepted architecture decision keeps shipped Codex on its native
compatibility container; the root-format pilot is a separate capability proof.

Response to review ef875a0a-ba0a-430e-a9b9-67c3bd0b5c27:

- Generic package.json and portable skill content are deliberate output for
  --portable-core. The root-format capability fixture needs that projection,
  rather than the native cache-addressed skill projection. Native generation
  without this flag remains unchanged.
- scripts/lib/codex-plugin-generation.ts rejects --portable-core without both
  --version and --output, rejects --check with this flag, and requires a fresh
  output destination. The default shippedRoot reconciliation path cannot use
  portableCore. Existing tests cover these rejection controls.
- codex-portable-proof.md describes the actual root-format readback/resource
  proof and its limits. Do not infer a native hook guarantee from this mode.
- Fresh post-merge native compatibility baseline passed two actual Codex 0.160.0
  cases against the regenerated installed cache, including complete source/cache
  byte equality and native trusted-hook discovery before allowed/denied writes.
  Command: SAFEWORD_CODEX_GUARD_FIXTURE=<owned fixture> scripts/dev bun run
  --cwd packages/cli test:smoke:live tests/smoke/host-contract.live.test.ts.
  Terminal result: 2/2 passed, 22.26 seconds; retained log
  /tmp/safeword-contract-main-native-codex.log. This is diagnostic, not admission.

Judge the pilot against that accepted boundary. Report a concrete path that
alters shipped native output or violates isolated portable resource behavior;
intentional differences between the two projections alone are not regressions.
