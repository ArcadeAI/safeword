---
id: ANAXG4
slug: cursor-failclosed-gating-hooks
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
---

# Set failClosed:true on Cursor gating hooks (default is fail-open)

**Goal:** Mark safeword's security/gating Cursor hooks `failClosed: true` so a crashed/timed-out/invalid-JSON hook denies rather than silently letting the action through.

**Why:** Cursor hooks default to **fail-open**. A safeword gating hook that throws currently fails _open_ — the gate vanishes with no signal.

## Done when

- All blocking gate hooks (`beforeSubmitPrompt`, `preToolUse`, `beforeShellExecution`) carry `failClosed: true` in `.cursor/hooks.json` + generator.
- Observational hooks intentionally left fail-open (a crashing lint hook shouldn't block work) — decision recorded per hook.

## Source

cursor.com/docs/hooks (`failClosed`, default fail-open)

## Work Log

- 2026-05-31 Created from Cursor research.
- 2026-06-24 Set `failClosed: true` on the three blocking gates (`beforeSubmitPrompt`, `preToolUse`, `beforeShellExecution`) in `CURSOR_HOOKS` (`packages/cli/src/templates/config.ts`) so a crashed/timed-out/invalid-JSON gate denies instead of silently vanishing. Observational hooks (`sessionStart`, `afterFileEdit`, `postToolUse`, `stop`) deliberately left fail-open — per-hook rationale recorded inline as comments (a crashing lint/state/nudge hook must never block work; `postToolUse` failure just leaves the LOC gate without fuel, degrading to allow). The merge writes the full hook objects verbatim, so the flag flows through `schema.ts` untouched. Added a `setup-cursor` test asserting `failClosed:true` on the three blockers and `undefined` on the four observers. Regenerated this repo's dogfood `.cursor/hooks.json` to the full wired set + flags (it was still on the pre-F2TKR3 three-hook layout); takes effect next Cursor session.
- 2026-06-24 (/quality-review fix) Closed a gap found in review: the `failClosed` flag was nearly inert for the two spawn-based gates. The T3DV1K adapters were fail-open internally — `runClaudeHook` returned `''` on spawn failure and `claudeDenialReason` treated malformed/empty output as allow, and the adapter always emitted valid JSON + `exit(0)`. So when the underlying gate (`pre-tool-quality.ts`) _crashed_ — the exact case the ticket exists to catch — the adapter swallowed it into an allow and Cursor's `failClosed` never engaged. Fix: `runClaudeHook` now returns `{ stdout, failed }` (`failed` = spawn error or non-zero exit; the gate always `exit(0)` for both allow and deny, so non-zero can only mean a crash), and a new `decideFromGate` helper denies with `GATE_UNAVAILABLE_REASON` when `failed`. Both adapters (`cursor/pre-tool-quality.ts`, `cursor/before-shell-execution.ts`) now route through it; `failClosed` remains the outer backstop for wrapper-level crashes. (`beforeSubmitPrompt` was already genuinely fail-closed — its logic isn't wrapped in a catch-all, so a throw exits non-zero.) Added 4 `decideFromGate` unit tests; dogfood copies synced. Verified: gate-adapter + setup-cursor 25/25, release-gate 7/7, lint + `tsc --noEmit` clean.
