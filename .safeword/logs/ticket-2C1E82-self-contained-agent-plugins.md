# Work Log: 2C1E82 — Make each agent's plugin fully self-contained

## 2026-09-02 — Proof-fidelity repair

- Re-read the completed epic after the user requested the suggested BDD/TDD quality changes.
- Confirmed the branch is current with `origin/main` (0 behind, 88 ahead) before editing.
- Reopened the ticket at `implement`; runtime behavior remains in scope only if a real boundary test exposes a defect.
- Repair targets: replace adjacent/static proof mappings with discriminating entry-point tests, make outline examples change the exercised fixture, correct the missing-authored-input claim, remove unrelated ticket-lineage behavior, and refresh ledger evidence after rebase.
- RED: the proof manifest named the missing real-entry-point tests and `bdd-proof-tags.test.ts` failed on the first absent declaration. The repository-root wrapper was separately blocked by three unrelated retro-relay timeouts; the package-local proof command isolated the intended failure.
- GREEN: real generated/installed workflow tests now cover Codex legacy-runtime precedence, unavailable package failure, Claude/OpenCode quality-review dispatch, Cursor audit execution, and all four state-writing authorities. Real lifecycle apply tests cover Codex-only profile removal while Cursor remains and mixed-authority reconciliation.
- Product gaps found by the stronger tests: direct Claude/Cursor helper calls skipped ignore creation; Codex plugin audit lookup assumed `dist/` rather than `runtime/`; uninstalling one native profile could remove shared project enrollment while Cursor remained. Fixed each at its narrow shared boundary and regenerated the native plugin artifacts.
- Focused lane: 103/103 tests passed across proof provenance, workflow execution, state initialization, lifecycle reconciliation, OpenCode identity, and schema isolation.
