---
id: Q4FX8Y
slug: extract-shared-test-runner
type: task
phase: intake
status: in_progress
created: 2026-06-16T13:58:31.841Z
last_modified: 2026-06-16T13:58:31.841Z
---

# Extract one shared test/build resolver for verify, audit, and the stop hook

**Goal:** Put the language→test/build command knowledge in one place so `/verify`, `/audit`, and the stop-hook `test-runner.ts` can't drift apart.

**Why:** 2FVZ26 made all three language-aware but the knowledge now lives in three forms — inline bash in `skills/verify` + `commands/verify` (and audit), and TS in `hooks/lib/test-runner.ts`. Each must be edited in lockstep when a language/tool/PM changes (e.g. a new uv subcommand, golangci v3). This is the deferred "Option C" from 2FVZ26's `/figure-it-out`.

> Source: 2FVZ26 figure-it-out (Option C, deferred) and `PRODUCT-AUDIT-leakage.md` → Axis 2-B. This is a **refactor** — behavior must not change (use `/refactor`).

## Current duplication

- `templates/hooks/lib/test-runner.ts` — `nativeTestCommand()` (TS): pytest/go test/cargo test + PM-aware Python + graceful tool-absence. Plus the `.safeword/` mirror (parity test enforces byte-identity).
- `templates/skills/verify/SKILL.md` + `templates/commands/verify.md` — section 2 inline bash (same routing) + section 5 manifest-aware dep-drift.
- `templates/skills/audit/SKILL.md` + `templates/commands/audit.md` — per-language dead-code/outdated/arch bash blocks.

## Sketch

A single source of truth the others consume — likely a small CLI subcommand (e.g. `safeword detect-commands --kind=test|build`) backed by `hooks/lib/`, that the skills call instead of inlining bash, and that `test-runner.ts` imports directly. Weigh: CLI subcommand vs exported lib + thin bash shim. Keep graceful degradation (skip when tool absent) and the done-gate literal-phrase contract intact.

## Acceptance criteria

- [ ] One module/command is the sole definition of per-language test + build commands (incl. Python PM detection).
- [ ] `test-runner.ts`, `/verify`, and `/audit` all consume it; no language command string is duplicated across surfaces.
- [ ] No behavior change vs 2FVZ26: same commands run, same graceful skips, same done-gate evidence phrases. Existing tests stay green.
- [ ] Dogfood parity (`.safeword/` mirror + `.claude/` skills) preserved.

## Work Log

- 2026-06-16T13:58:31.841Z Started: Created ticket Q4FX8Y
