# Refactor Ledger: Honor host JavaScript toolchains

Scout date: 2026-07-24

1. [x] **Leaf — source clarity:** Extracted `HostToolchainOwner` in the shared resolver and replaced repeated owner unions. `host-toolchain.test.ts` passes.
2. [x] **Leaf — test duplication:** Extracted the repeated `lintFile` Bun-subprocess fixture helper in `host-toolchain.test.ts`. The focused suite and typecheck pass.
3. [x] **Struck — marginal orchestration extraction:** Keep Codex post-tool lint-input construction inline. It is short, routing-specific, and a helper would not improve the public behavior or test readability.

Mechanical scout notes: target-scope jscpd found three clones in the wider test set, but none were host-toolchain-specific. Knip reports an unrelated existing `which` ignore-binary hint in `knip.json`; it is outside this feature's scope.
