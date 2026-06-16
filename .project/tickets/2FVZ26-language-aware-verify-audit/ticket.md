---
id: 2FVZ26
slug: language-aware-verify-audit
type: task
phase: implement
status: in_progress
created: 2026-06-16T13:07:38.959Z
last_modified: 2026-06-16T13:07:38.959Z
---

# Make verify and audit work for Python, Go, and Rust projects

**Goal:** `/verify` and `/audit` should run the right test/build/dead-code/drift checks for the project's actual language(s), not just JS.

**Why:** The completion gate is effectively broken on non-JS repos — `/verify` runs `bun run test` / `bun run build` against an empty `scripts: {}`, so it reports nothing useful while appearing to pass. `/audit` skips architecture, dead-code, and dependency-drift entirely for non-JS code.

> Source: `PRODUCT-AUDIT-leakage.md` → Axis 2-B. Note: `/lint` already fans out across Ruff/golangci/clippy via the `post-tool-lint` hook — mirror that pattern.

## Findings (file:line)

- `skills/verify/SKILL.md:56-70`, `commands/verify.md:56-66` — runs `bun run test`, `bun run build`, plus a `node -e` `package.json` script probe; unguarded, JS-only.
- `skills/verify/SKILL.md:95-108`, `commands/verify.md:91-104` — dependency-drift reads `package.json` deps vs ARCHITECTURE.md; no Cargo/go.mod/pyproject path.
- `skills/audit/SKILL.md:44-100`, `commands/audit.md:40-96` — `bunx depcruise`/`knip`/`jscpd`/npm `outdated`; only knip+outdated are `[ -f package.json ]`-gated, so architecture + drift are JS-only.

## Acceptance criteria

- [x] `/verify` detects language and runs the matching test + build commands (e.g. `pytest`/`go test`/`cargo test`); JS path stays behind a real `test`-script check.
- [x] `/verify` dependency-drift reads the project's actual manifest (pyproject/go.mod/Cargo.toml) when JS is absent.
- [x] `/audit` runs dead-code / outdated / architecture checks per language where tools exist, and says so explicitly when a check is skipped (not silent).
- [x] Both updated in the SKILL.md and the mirrored commands/\*.md.
- [x] Bonus: stop-hook `test-runner.ts` extended (native fallback) so the _automatic_ done-gate also verifies non-JS projects — 8 unit tests.

## Work Log

- 2026-06-16T13:07:38.959Z Started: Created ticket 2FVZ26
- 2026-06-16 Implemented: language-aware verify/audit skills+commands + test-runner.ts native fallback. 51/51 tests pass (test-runner + verify-skill + parity), tsc clean. Awaiting user confirmation before marking done.
