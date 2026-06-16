# Work Log — 2FVZ26 language-aware verify and audit

## Session 2026-06-16

### Revalidation (before coding)

- `/verify` (`skills/verify/SKILL.md` + `commands/verify.md`): **genuinely broken** for non-JS.
  Section 2 hardcodes `bun run test` / `bun run build`; section 5 dep-drift reads only `package.json`.
- `/audit` (`skills/audit/SKILL.md` + `commands/audit.md`): **already mostly multi-language**
  (Python deadcode, Go golangci unused + `go list -u`, outdated for JS/Py/Go, jscpd all langs).
  Real gaps: **Rust absent**; ARCHITECTURE.md drift check (section 5) reads only package.json.
  → Report overstated audit's JS-onlyness; corrected.
- `hooks/lib/test-runner.ts` (stop-hook automated test run): **also JS-only** — reads only
  package.json scripts; non-JS project returns `skipped:true` → automatic done-gate silently passes.
- Detection: every project has package.json (102b), so the "is-JS" signal is a **real `test` script**,
  not the file. Confirmed in `test-runner.ts:83-85`. Forward-compatible with BE7C7B.

### /figure-it-out outcome

- Architecture: **Option A** — inline manifest-gated bash in the skills, mirroring `/audit`'s
  existing structure. Defer Option C (shared TS runner reused by test-runner.ts) to an uplevel follow-up.
- Commands (2026, verified): Python PM-aware `uv run pytest` / `poetry run pytest` / `pytest`;
  Go `go test ./...` + `go build ./...`; Rust `cargo test` + `cargo build`.

### Scope (user delegated — "your call")

verify skill+cmd + audit skill+cmd + `test-runner.ts` (template AND `.safeword/` copy — parity test
`test-runner.test.ts:65` enforces byte-identity). Defer shared-runner refactor (C) to follow-up.

### Plan

1. [x] test-runner.ts: pure injectable `nativeTestCommand(cwd, isToolAvailable)` + `getJsTestCommands`/`getTestCommands` split; edited template + `.safeword/` copy (parity OK). 8 new unit tests.
2. [x] verify skill+cmd: section 2 language-aware test+build (JS behind real `test` script; Python PM-aware; Go/Rust); section 5 manifest-aware drift; checklist allows ⏭️ Skipped. Synced `.claude/skills/verify/SKILL.md`.
3. [x] audit skill+cmd: added Rust architecture note + clippy dead-code (2d) + cargo-outdated (4d); generalized drift example. Synced `.claude/skills/audit/SKILL.md`.
4. [x] vitest: test-runner + verify-skill + parity = 51/51 pass. tsc clean. eslint clean on test file.

### Result

- Done-gate literal phrases preserved (`✓ X/X tests pass`, `**Gherkin:**`, `Audit passed`, `Ready to mark done.`) — verify-skill.test.ts green.
- `.claude` skill mirrors synced (commands not installed in dogfood repo; no sync needed).
- Deferred: Option-C shared runner (extract test-runner logic for reuse) → uplevel follow-up.

### Notes / dead ends

- test-runner runs only TESTS; build stays in the verify skill (keeps hook change small).
- Tool-absent → skip (don't block) — matches lint.ts graceful degradation; a contributor without the
  toolchain must not be blocked at the gate.
