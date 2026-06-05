---
id: 0WQA9V
slug: smoke-test
type: task
phase: implement
status: in_progress
created: 2026-06-05T05:44:21.502Z
last_modified: 2026-06-05T05:44:21.502Z
scope:
  - 'Deterministic tiers (DONE — commit 8cf4f1c9): `test:smoke:fast` (hermetic gate-logic + schema, ~18s/384 tests, no build/network/model) and `test:smoke` (rebuild via tsup, then the real setup→install→hook→lint golden-path). Root + cli package.json scripts.'
  - "Live real-model tier `test:smoke:live`: a skip-gated vitest test that drives the real `claude` CLI (pinned Haiku, `--setting-sources project`, `--permission-mode dontAsk`, `--allowedTools Write`, `--max-budget-usd 0.10` cost cap, forced tool use; `--max-turns` does not exist in claude 2.1.161) into a hand-wired temp project and asserts safeword's core intake-phase gate denies the agent — via the `permission_denials` array in `--output-format json`."
  - '`resolveClaude()` helper: `SMOKE_CLAUDE_BIN` env → PATH `claude`, validated with `--version` (PATH may hold a broken stub); the test `skipIf` no runnable binary or no `ANTHROPIC_API_KEY`, so the normal suite is never broken.'
  - "Anti-drift meta-test: cross-check `SAFEWORD_SCHEMA`'s hook manifest against smoke coverage; fail when a hook has no smoke coverage (extends the existing parity/owned-paths guard pattern)."
out_of_scope:
  - 'CI `workflow_dispatch` job + `ANTHROPIC_API_KEY` secret + `curl https://claude.ai/install.sh | bash -s <ver>` install — follow-up once the local live run is proven.'
  - "Tripping the 9EA27P spec.md gate — it isn't on main, so it silently allows; chose the stable, long-standing intake-phase gate instead."
  - 'Full `safeword setup` per live run — ~180s install already covered by the golden-path tier; the live test points at the real source hook directly.'
  - "Multi-gate live coverage — the live tier is a single end-to-end canary; per-gate coverage is the deterministic tiers' + drift meta-test's job."
done_when:
  - '`bun run test:smoke:fast` green in <1 min; `bun run test:smoke` green.'
  - '`bun run test:smoke:live` drives a real Claude agent into the intake-phase gate and asserts the `permission_denials` entry for the blocked Write; with no `claude`/no key it skips cleanly and the normal suite stays green.'
  - 'One confirming live run executed (~1.5¢) before commit.'
  - 'Drift meta-test goes red if a schema hook lacks smoke coverage; green for the current hook set.'
  - 'All committed on the `smoke-test` branch; ready to PR.'
---

# Smoke test for safeword — fast/e2e/live tiers + drift guard

**Goal:** An on-demand smoke test that proves safeword's core works — including a live tier that runs **real Claude Code** and confirms a real agent actually gets steered (blocked) by a guardrail.

**Why:** The deterministic tests check the hook code in isolation (fake JSON → "deny"). They can't prove a real Claude session gets stopped. For a tool whose whole job is steering an agent, only a real-model run closes that gap.

## Design (decided via `/figure-it-out`, evidence-backed this session)

- **Trip a core, stable gate (intake-phase), not 9EA27P.** Confirmed directly: the intake-phase gate denies `test-definitions.md` creation reliably; 9EA27P's spec.md gate isn't on main and silently allowed. Coupling the canary to a freshly-changed gate is the drift trap — anchor to safeword's oldest invariant.
- **Hand-wire the real source hook; no `safeword setup`.** Confirmed `bun <repo>/packages/cli/templates/hooks/pre-tool-quality.ts` runs and denies. A temp project with one `ticket.md` (intake) + a `.claude/settings.json` wiring the real hook. Same shipping code, no 180s install.
- **Assert on `permission_denials`, not "file absent."** The live JSON exposes `permission_denials:[{tool_name:"Write",…}]` — proves the agent _attempted and was denied_. "File absent" false-passes when the model just declines to act.
- **Resolve + validate the binary, else skip.** This machine has three claudes (broken bun stub on PATH, old 1.0.43, working app-bundled 2.1.161); naive PATH resolution picks the stub and false-fails. CI installs a pinned claude via the native script (npm/bun postinstall is flaky).
- **Pin the model id** (`claude-haiku-4-5-20251001`) so model updates don't silently drift the test. ~1.5¢/run.

## Slices

1. **Deterministic tiers — DONE** (commit `8cf4f1c9` on `smoke-test`). `test:smoke:fast` verified green (384 tests, 17.7s).
2. **Live tier** — `tests/smoke/steering.live.test.ts` + `resolveClaude()` + `test:smoke:live` script. One confirming live run, then commit.
3. **Drift meta-test** — schema-hook coverage guard.

## Related

- Builds on the 9EA27P session (the spec.md gate) — that gate is the _future_ assertion once it lands on main; intake-phase is the stable choice for now.
- Mechanism proven live this session: project hooks fire headless, denials surface in `permission_denials`, ~1.5¢/run on pinned Haiku.

## Work Log

- 2026-06-05T05:44:21.502Z Started: Created ticket 0WQA9V
- 2026-06-05T05:44:21.502Z Designed (via `/figure-it-out`) + proved the mechanism locally: real `claude` 2.1.161 headless fires project hooks and reports denials in `permission_denials` (~1.5¢/run). Deterministic tiers (`test:smoke:fast`/`test:smoke`) already built + committed (8cf4f1c9). Live tier + drift meta-test remain. Sized **task** (test tooling, no product behavior).
- 2026-06-05T06:13:00.000Z Slice 2 DONE — live tier built + confirmed. `tests/smoke/steering.live.test.ts` (validating `resolveClaude()`, pinned Haiku, `--setting-sources project --allowedTools Write --max-budget-usd 0.10 --output-format json`, asserts `permission_denials` for the blocked Write) + `vitest.live.config.ts` + `test:smoke:live` script (+ root alias) + `*.live.test.ts` excluded from the default suite. Confirming live run **passed** (real agent → intake-phase gate denied, 22s, ~1.5¢); skips cleanly with no key/binary. Lint clean. `/quality-review` caught `--max-turns` is absent in claude 2.1.161 — replaced with `--max-budget-usd`. Remaining: drift meta-test (slice 3), then PR.
