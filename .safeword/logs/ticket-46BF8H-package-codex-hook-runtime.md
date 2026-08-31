# Work Log: Keep Codex protection active after plugin updates

**Anchored to:** `.project/tickets/46BF8H-package-codex-hook-runtime/ticket.md`

## Session: 2026-08-31

- [23:03] Reproduced installed 0.82.3 PreToolUse failure: packaged hook `codex/pre-tool-quality.ts` is missing.
- [23:05] Restored local command access with an untracked emergency cache-only no-op; this is not a source fix.
- [23:10] Traced the runtime lookup to `templates/hooks/**` and `templates/SAFEWORD.md`; neither is emitted by the Codex plugin generator.
- [23:12] Ruled out restart and npm file-list causes. Selected complete runtime-tree copying over bundling or project fallback.
- [23:18] Full audit surfaced generated-mirror false positives; aligned existing analyzer exclusions without changing runtime behavior.
- [01:20] Independent quality review found no release blocker. Fixed its concrete ESM import finding, added direct missing-artifact rejection coverage, retained formatting for authored manifests, and added installed-cache SessionStart proof for the packaged handbook.
- [01:20] Targeted release contract passes 8/8; generated Codex plugin check is current.
- [02:15] Full verification exposed the copied handbook's Claude slash-command examples in the Codex payload. Reused the catalogue's Codex invocation adapter; the focused Cucumber scenario passes, as does the full 73-test review-wiring file after its load-sensitive failure.
- [02:17] Post-fix quality review found archive coverage only spot-checked hook assets. Replaced it with an exact complete-tree comparison; release contract remains 8/8 green.
