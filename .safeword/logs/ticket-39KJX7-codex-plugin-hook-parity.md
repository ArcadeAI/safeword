# Work Log: codex-plugin-hook-parity (39KJX7)

## 2026-07-13

- Started after PR #993 command-name rename landed and CI passed.
- Scope call: do not reopen `4DK9H4-test-codex-plugin-migration`; that ticket proved the harness and package/plugin boundaries. This ticket owns behavior parity gaps in the production packaged CLI path.
- Current packaged command: `packages/cli/src/commands/codex-hook.ts` only implements a narrow subset: intake-field denial, SessionStart SAFEWORD.md context, queued prompt/post-tool context files, Stop continuation file, and skill invocation identity.
- Legacy repo-local Codex adapters still encode broader behavior:
  - `packages/cli/templates/hooks/codex/pre-tool-quality.ts`: translates Codex tool payloads into Claude-shaped quality gate inputs, preserves denial output, records skill invocation and review-stamp run identity, installs crash capture.
  - `packages/cli/templates/hooks/codex/post-tool-quality.ts`: translates Codex edit/shell payloads and runs the shared post-tool quality accumulator for LOC/review/session state.
  - `packages/cli/templates/hooks/codex/post-tool-skill-nudge.ts`: forwards language-skill nudges through PostToolUse additionalContext.
  - `packages/cli/templates/hooks/codex/stop.ts`: runs Codex retro extraction, architecture drift continuation, retro filing continuation, and fail-open self-report capture.
- Current OpenAI docs constraints checked: plugin hooks can be bundled and loaded with enabled plugins, but are not automatically trusted; `CODEX_HOME` owns local state; plugin hooks receive plugin root/data env vars. Local tests should keep isolated `CODEX_HOME` and the live lane should stay opt-in.
- Full-suite follow-up: a serial verbose trace proved the apparent Vitest hang was ordinary progress through slow setup/upgrade fixtures, including network-backed optional skill installation. The first normal full run passed 5,177 tests and failed only two runner-lock assertions because this validation command exported `SAFEWORD_TEST_LOCK_MAX_WAIT_MS=0`; the lock tests intentionally inherit that environment and then observe the forced warning. The focused lock suite passes 6/6 with an isolated outer lock and no wait-cap override. Rerunning the full suite under those valid conditions.
- Verification: valid full suite passed with an isolated outer lock and no wait-cap override: 353 files, 5,179 passed, 5 skipped in 1,285s. The previous apparent hang was reporter silence during network-backed fixture provisioning, not a deadlock or a Codex plugin regression.
