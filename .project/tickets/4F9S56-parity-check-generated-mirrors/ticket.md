---
id: 4F9S56
slug: parity-check-generated-mirrors
type: task
phase: intake
status: in_progress
created: 2026-08-20T15:03:21.339Z
last_modified: 2026-08-20T15:03:21.339Z
---

# Make parity-check account for generated mirrors

**Goal:** Have parity-check either cover generated mirrors (plugin/runtime, codex-plugin/skills) or state plainly that its all-in-sync result excludes them

**Why:** parity-check reports 'All 255 pairs and 8 contracts in sync' while generated mirrors still carry stale content, so a maintainer reads it as full coverage and ships drift; this has now caused two separate misses - the Codex skills version pin (AMK8BC) and the Claude plugin runtime hook specifiers, the latter caught only by CI after a clean local parity run

## Evidence

Two misses in one session, same root cause.

**1. Codex skills version pin (`AMK8BC`).** Generated skills under
`packages/cli/codex-plugin/skills/**` embed `bunx --bun safeword@<version>`
(V2AH4B). Cutting 0.78.7 needed nine of those regenerated beyond the four
artifacts the release checklist named. `parity-check` was clean throughout.

**2. Claude plugin runtime hook specifiers.** Converting six `.ts` sibling
imports to `.js` across `templates/hooks/lib/` and the `.safeword/` dogfood
copy left `plugin/runtime/hooks/lib/` on the old specifiers.
`parity-check --mode=all` reported:

```
All 255 pairs and 8 contracts in sync; no unregistered templates; ...
```

...and CI then failed `lint` and `CLI contract`. The drift was real; the
checker simply does not look there.

## The problem, precisely

`parity-check` compares hand-maintained pairs. Generated trees —
`plugin/runtime/**`, `packages/cli/codex-plugin/skills/**` — are reproduced
from source by `generate:claude-plugin` / `generate:codex-plugin` and are
outside its scope. That is defensible as a scope choice; the harm is the
**wording of the result**. "All 255 pairs and 8 contracts in sync" reads as a
whole-repo clean bill, so a maintainer who runs it stops looking.

## Options

1. **Cheapest:** change the success line to name what was checked and what was
   not, e.g. `...in sync (generated trees not checked — run generate:* to
   refresh)`. Removes the false assurance without new machinery.
2. **Stronger:** have `parity-check` shell out to the generators in `--check`
   mode and fail on any diff, making one command authoritative.
3. **Structural:** treat generated trees as build output and stop tracking them
   in git. Much larger change; probably out of scope.

Option 1 is the minimum that would have prevented both misses; option 2 is what
makes the guarantee real.

## Out of scope

- Changing what the generators emit.
- Whether generated trees should be committed at all.

## Work Log

- 2026-08-20T15:03:21.339Z Started: Created ticket 4F9S56
