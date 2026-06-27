# Verify: CXP9LM Codex live parity smoke

## Verify Checklist

**Test Suite:** Pass
**Gherkin:** `packages/cli/features/codex-live-parity-smoke.feature` remains `@live @manual`; executable proof is the opt-in Vitest smoke.
**Build:** Pass via focused test commands (`tsup` runs before Vitest).
**Lint:** Not run for the whole repo; docs/ticket-only changes plus focused smoke update.
**Scenarios:** 4/4 complete inside the documented support boundary.
**Dep Drift:** Clean — no dependency changes.
**Parent Epic:** QM5G9M can close after this ticket.
**Reconcile:** The observed Codex `file_change` path is explicitly documented as outside Safeword's claimed PreToolUse coverage.
**Experience:** Codex block text points users at `$explain`, and repo-scoped safeword skills are visible in prompt input.

## Evidence

Local environment:

- Codex CLI: `codex-cli 0.141.0`
- Revalidation time: 2026-06-25T06:31:00Z

Focused supported-hook tests:

```sh
SAFEWORD_TEST_LOCK_DIR=/Users/alex/.codex/worktrees/revalidate-codex-active/.test-lock SAFEWORD_RUN_CODEX_LIVE_SMOKE=1 bun run --cwd packages/cli test tests/smoke/codex-parity.live.test.ts --config vitest.live.config.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

Run-identity and Codex adapter regression tests also passed during this revalidation:

```sh
SAFEWORD_TEST_LOCK_DIR=/Users/alex/.codex/worktrees/revalidate-codex-active/.test-lock bun run --cwd packages/cli test tests/hooks/run-identity.test.ts tests/hooks/quality-state-read.test.ts tests/hooks/record-skill-invocation.test.ts tests/integration/review-stamp.test.ts tests/hooks/codex-pre-tool-quality-helpers.test.ts
```

Result:

```text
Test Files  5 passed (5)
Tests       33 passed (33)
```

Manual prompt-input check:

- Clean fixture created from `node packages/cli/dist/cli.js setup --yes --no-modify`.
- Fixture contains `.codex/config.toml`, `.agents/skills/explain/SKILL.md`, and `.safeword/hooks/codex/pre-tool-quality.ts`.
- `codex debug prompt-input` from inside the fixture includes the project safeword instructions and repo skill root (`.agents/skills`).

Manual live edit check:

- A live `codex exec --json --dangerously-bypass-hook-trust --dangerously-bypass-approvals-and-sandbox` run in the fixture attempted the requested `apply_patch` edit.
- Codex emitted `Command blocked by PreToolUse hook` for the supported `apply_patch` path before later reporting `file_change` execution items after satisfying ticket prerequisites.
- The opt-in live smoke now requires that supported-path denial instead of accepting `file_change` alone.

## Findings

- Supported Codex hook payload path works: invoking `.safeword/hooks/codex/pre-tool-quality.ts` with an `apply_patch` payload denies an incomplete feature ticket and allows the same path after `scope`, `out_of_scope`, `done_when`, `dimensions.md`, `spec.md`, and `personas.md` are present.
- Trusted Codex prompt input can see the generated safeword instruction context and repo-scoped `.agents/skills`.
- Current Codex CLI can report `file_change` execution items during `codex exec`. Official Codex hook docs describe `PreToolUse` matching for `Bash`, `apply_patch`, and MCP tool names, not `file_change`; Safeword now documents `file_change` as outside the supported Codex PreToolUse coverage it claims to enforce.

## Verdict

Done. The live/customer smoke proves the supported Codex hook path and documents the current runtime boundary honestly.
