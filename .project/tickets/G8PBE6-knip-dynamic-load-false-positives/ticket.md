---
id: G8PBE6
slug: knip-dynamic-load-false-positives
type: task
phase: intake
status: superseded
superseded_by: 7JDZFF
created: 2026-05-27T11:44:58.839Z
last_modified: 2026-05-28T05:02:00.000Z
scope: |
  Make `bunx knip` stop flagging the seven stack-specific ESLint plugins
  H150ZW switched to lazy-loading as "unused dependencies." They ARE used —
  just loaded via `createRequire` at runtime when the consumer's stack
  needs them, which knip's static analyzer can't see through.

  Currently-flagged plugins:
    - @next/eslint-plugin-next
    - @tanstack/eslint-plugin-query
    - eslint-plugin-astro
    - eslint-plugin-better-tailwindcss
    - eslint-plugin-playwright
    - eslint-plugin-storybook
    - eslint-plugin-turbo

  Likely solutions (decide in /figure-it-out before implementing):
    1. Add the seven entries to `ignoreDependencies` in `knip.json`. Simple
       but documents that they're known-used in a place future readers
       can find. Risk: stale entries if H150ZW is ever reverted (W005
       would catch that).
    2. Use knip's plugin/compiler hook system to teach it about createRequire
       patterns. Higher complexity; one config block instead of seven
       string entries; survives plugin churn.
    3. Add explicit `knip:dependencies` annotations as comments next to the
       createRequire calls. Knip supports this. Co-locates the suppression
       with the code that needs it.

  Whichever path is chosen: document the pattern in a learning file or
  in CLAUDE.md so the next person who runs into "unused dependency: this
  eslint plugin" doesn't re-litigate the same investigation.
out_of_scope: |
  - Reverting H150ZW. The lazy-load pattern was deliberate — it cuts
    cold-start time for projects that don't use those stacks. Keep it.
  - Adding dummy static imports just to satisfy knip. That would undo
    H150ZW's performance win and is exactly the anti-pattern this ticket
    exists to avoid.
  - Disabling knip entirely. The dead-code check has value elsewhere.
  - Fixing the related `@vitest/eslint-plugin` peer-dep issue
    ([G2BA7M-vitest-eslint-plugin-peer-dep](../G2BA7M-vitest-eslint-plugin-peer-dep/ticket.md)).
    If G2BA7M resolves by switching the vitest preset to lazy-load too,
    coordinate so this ticket's solution covers the vitest plugin as well.
  - Touching the seven plugins themselves or how H150ZW wired them up.
done_when: |
  - `bunx knip` on a clean tree reports zero "Unused dependencies" for the
    seven lazy-loaded plugins (and for `@vitest/eslint-plugin` too, if
    G2BA7M lands as lazy-load).
  - H150ZW's lazy-load pattern is preserved — no plugin is moved back to
    an unconditional static import.
  - The chosen mechanism (knip config, plugin hook, or annotations) is
    documented in either CLAUDE.md or `.safeword-project/learnings/` so the
    next reader who sees "unused dependency: @next/eslint-plugin-next"
    can find the explanation without redoing the investigation.
  - `bun run build` + the existing test suite still pass.
---

# Resolve knip false-positives from lazy-loaded ESLint plugins

**Goal:** Suppress the seven knip "unused dependency" false-positives caused by H150ZW's lazy-load pattern, without reverting the lazy-load itself or hiding the false-positives in a way the next person can't find.

**Why:** Currently `bunx knip` emits 7 noisy lines about plugins that aren't actually unused — they're just dynamically loaded. Every future audit pass has to re-explain "no, those are deliberate." Cheaper to fix once and document the pattern. Surfaced during F14BG2/QSNKBB's verify pass.

## Repro

```
bunx knip 2>&1 | grep "eslint-plugin"
```

Today returns the seven plugins under "Unused dependencies."

## Context

- H150ZW (commit `02254f59 feat(eslint): lazy-load 7 stack-specific plugins via createRequire`) switched these plugins from static `import` to `createRequire(import.meta.url)('eslint-plugin-foo')` so they only load when the consumer's stack actually needs them. The performance win — cold start, memory — is real and shouldn't be given back.
- Knip's static analysis reads `import` and `require` literals; it can't follow `createRequire`-wrapped runtime resolution.
- The audit skill's W005 mechanism (stale `ignoreDependencies` entries) will catch this if H150ZW is ever reverted and the entries become unused — so option (1) is self-cleaning.

## Open questions for the implementer

- Which suppression mechanism (knip config, plugin hook, inline annotation)? See `/figure-it-out` candidates in scope.
- Is there a similar pattern elsewhere in the repo (other dynamic loads knip might be silently missing) that should be covered in the same change? Worth one grep pass for `createRequire` before locking the design.

## Work Log

- 2026-05-27T11:44:58Z Started: Created ticket G8PBE6 after F14BG2/QSNKBB verify pass surfaced these as pre-existing knip noise. Bounded scope (one architectural decision in /figure-it-out, one knip-config or annotation pass, documentation note). Sized task.
- 2026-05-28T05:02:00Z Superseded by 7JDZFF. Investigation confirmed the false-positive mechanism: the 7 plugins load via `createRequire(import.meta.url)` inside `lazyConfigArray` (H150ZW), which knip's static analyzer can't follow → flagged as unused dependencies. The cheap fix (add the 7 to `ignoreDependencies` in packages/cli/knip.json, matching the existing `eslint-plugin-jsdoc` precedent in the root knip.json) would be throwaway: 7JDZFF (in_progress) moves all 7 from `dependencies` to optional `peerDependencies`, and knip does not flag optional peer-deps as unused — so the migration dissolves these false-positives as a side effect. Fixing here now would leave stale `ignoreDependencies` entries that /audit's W005 check would flag once 7JDZFF lands. Folding into 7JDZFF instead; added a done_when line there so 7JDZFF explicitly owns closing the knip concern.
