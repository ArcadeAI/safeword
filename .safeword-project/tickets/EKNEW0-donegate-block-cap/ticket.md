---
id: EKNEW0
slug: donegate-block-cap
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.534Z
last_modified: 2026-05-31T21:05:09.534Z
---

# Done gate no longer hard-blocks under Stop-hook 8-block cap

**Goal:** Make the done gate honest (and as strong as possible) now that Claude Code caps consecutive Stop-hook blocks at 8.

**Why:** SAFEWORD.md advertises the done gate as a hard block — "can't close a ticket without `verify.md`." CC `2.1.143` capped consecutive Stop-hook blocks; that guarantee is now false by attrition.

## Finding (CC 2.1.143)

> Fixed stop hooks blocking repeatedly looping (8-block cap; `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`)

After 8 consecutive `decision: "block"` returns, CC stops honoring the block and lets the turn end regardless of what the hook says.

## Evidence in safeword

- `packages/cli/templates/hooks/stop-quality.ts` — `hardBlockDone()` returns `{ decision: 'block', reason }`, documented "No bypass: `stop_hook_active` does not skip this check" (`:314`), looping "until evidence present" (`:333`).
- Installed copy: `.safeword/hooks/stop-quality.ts:316`.
- SAFEWORD.md "Enforcement": "Done gate — can't close a ticket without `verify.md`." No longer holds past 8 rounds.

## Options

- **A — Set `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` high in installed settings.** Restores a near-unbypassable gate. Tradeoff: re-opens the infinite-loop risk the cap was added to kill; a genuinely stuck agent can't escape. Global env-var side effect on the host.
- **B — Keep a sane cap; make the gate cap-aware.** Track block rounds in quality-state; as the count nears the cap, escalate `reason` to "you are about to bypass the done gate — produce `verify.md` now," and log loudly when a bypass actually happens. Honest + maximally enforcing within CC's rules.
- **C — Soften the SAFEWORD.md claim only.** Cheapest; documents reality, loses enforcement strength.

**Lean:** B + update SAFEWORD.md wording. Decide A vs B with the user (A changes host env globally).

## Done when

- Behavior under repeated blocks verified against the installed CC version (does the cap fire at 8? is the env var respected?).
- Gate no longer silently degrades: bypass prevented (A) or surfaced + logged (B).
- SAFEWORD.md "Enforcement" wording matches actual behavior.
- Tests cover the near-cap escalation path.

## Out of scope

- Reworking the non-done soft-block one-shot escape (separate concern; see `.safeword-project/guides/stop-hook-research.md`).

## Related

- **2JMQMX** (done, epic workflow-gate-hygiene) — closed the _other_ done-gate honesty hole: a `status: done` close that bypasses the phase-keyed gate entirely. Complementary failure mode (status sidestep vs 8-block-cap exhaustion); both make "done means verified" hold. Coordinate any cap-aware escalation here with `resolveStopPhase` there. Surfaced during the M7AZY3 #178 triage.

## Work Log

- 2026-05-31T21:05:09.534Z Started: Created ticket EKNEW0
- 2026-05-31 Confirmed `hardBlockDone` has no bypass; cap (2.1.143) makes it bypassable after 8 rounds.
