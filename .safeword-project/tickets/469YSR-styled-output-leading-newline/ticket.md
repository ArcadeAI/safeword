---
id: 469YSR
slug: styled-output-leading-newline
parent: VKNF1T-platform-uplift-epic
type: task
phase: done
status: done
created: 2026-06-06T18:37:39.821Z
last_modified: 2026-06-06T18:37:39.821Z
scope: |
  Fix the orphaned-glyph rendering in the styled output helpers
  (`success` / `warn` / `error` in packages/cli/src/utils/output.ts). When a
  message starts with `\n`, the helper prints `✓ \n<message>`, dropping the
  glyph onto its own line and the text onto the next with no glyph. Lead fix:
  hoist a leading newline in the helper so the blank line prints BEFORE the
  glyph; alternatively move the `\n` out at the 5 known call sites. Add a
  regression guard so the antipattern can't return.
out_of_scope: |
  - The coverage-advisory path in check.ts — verified working and correctly
    scoped to spec-bearing in-progress tickets (XT1FFM). Not a bug.
  - Any non-cosmetic check / diff / reset / upgrade behavior.
  - Restyling glyphs, colors, or the output helper API beyond the
    leading-newline hoist.
done_when: |
  - `safeword check` on a healthy project prints `✓ Configuration is healthy`
    on ONE line (glyph attached to text); no orphaned `✓ ` line.
  - Same fix confirmed for diff.ts:232, reset.ts:61, upgrade.ts:81 and :103.
  - A regression guard prevents recurrence: a unit test asserting the helper
    hoists leading newlines, OR a lint rule banning a leading `\n` in a
    success/warn/error argument.
  - `npx vitest run` for any touched test files passes from packages/cli/.
---

# Styled CLI output orphans its glyph on a leading-newline message (check/diff/reset/upgrade)

**Goal:** Stop the styled output helpers from orphaning their glyph (`✓` / `⚠`) when a message begins with a newline.

**Why:** It's the first thing you see running `safeword check` — `✓` sits alone on a line and "Configuration is healthy" drops below it with no checkmark, so healthy output reads as broken. The same antipattern hits four common commands.

## Repro

`safeword check` on a healthy project prints:

```text
✓ CLI is up to date
✓
Configuration is healthy
```

The second line should read `✓ Configuration is healthy` on one line.

## Root cause

`success(msg)` / `warn(msg)` / `error(msg)` in [output.ts:17–35](../../../packages/cli/src/utils/output.ts) prepend the glyph unconditionally (`` `✓ ${message}` ``). A leading `\n` in the message lands **after** the glyph, so the glyph gets its own line and the text loses its glyph.

## Affected call sites (leading `\n` in a styled helper)

- [check.ts:433](../../../packages/cli/src/commands/check.ts) — `success('\nConfiguration is healthy')`
- [diff.ts:232](../../../packages/cli/src/commands/diff.ts) — `success('\nNo changes needed …')`
- [reset.ts:61](../../../packages/cli/src/commands/reset.ts) — `success('\nSafeword configuration removed')`
- [upgrade.ts:81](../../../packages/cli/src/commands/upgrade.ts) — `warn('\nPython tools not auto-installed …')`
- [upgrade.ts:103](../../../packages/cli/src/commands/upgrade.ts) — `warn('\nSQL tools not auto-installed …')`

## Fix options

- **A — Fix the helper (lean).** Hoist leading newlines in `success` / `warn` / `error`: emit the blank line(s) first, then `glyph + message`. ~3 lines, kills the whole class, no call-site churn, immune to recurrence.
- **B — Fix the 5 call sites.** Move the `\n` out (`info(''); success('…')`). Local and zero-risk to other callers, but leaves the footgun for the next caller.
- Lean **A** plus a regression guard (test or lint). Fall back to B only if some caller deliberately wants a post-glyph newline — none seen.

## Verified NOT a bug

The coverage-gap advisory SAFEWORD.md attributes to `safeword check` (uncovered ACs / orphan scenarios) **is** implemented ([check.ts:148](../../../packages/cli/src/commands/check.ts)) and works — scoped to `in_progress` tickets carrying a `spec.md` (XT1FFM), so it correctly stayed silent on the intake tickets created this session. No action there.

## Work Log

- 2026-06-06T18:37:39.821Z Started: Created ticket 469YSR
- 2026-06-06T18:38:00Z Found while dogfooding `safeword check` (user asked "does it work right?"). Functionally fine — health/version/index-regen/coverage all correct; coverage stayed silent because intake tickets carry no spec.md (deliberate XT1FFM scoping). Bug is cosmetic: `success('\nConfiguration is healthy')` renders `✓` then an unglyphed "Configuration is healthy". Grep found 5 sites of the same leading-`\n`-in-styled-helper antipattern across check/diff/reset/upgrade. Sized task (mechanical, 4 files, no behavior to discover); scope/out_of_scope/done_when set — build-ready. Lean: fix the helper (root cause) + regression guard.
- 2026-06-11T23:58:00Z DONE (option A). Revalidated vs merged main first: still-good — same 5 sites (reset:61, diff:232, upgrade:82+104, check:439), output.ts untouched. Extracted `formatGlyphLine(glyph, message)` (hoists leading newlines above the glyph); success/warn/error route through it — fixes the orphaned glyph across all 4 commands in one place. Unit test (output.test.ts) guards the helper: 3/3. No test pinned the old broken output (grep empty); check + upgrade command tests pass (32); tsc clean. Commit 71c8523c. Done_when met (helper-test guard + wiring covers all 5 sites). Final umbrella full-suite runs with AKZJXC.
