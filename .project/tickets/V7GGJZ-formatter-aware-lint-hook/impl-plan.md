# Impl Plan: Formatter-aware lint hook

**Status:** implemented

## Approach

The behavior splits into one shared detector plus four consumers. Build order is bottom-up so each
step lands on green:

1. **Shared detection (unit).** Extend `ALTERNATIVE_FORMATTER_FILES` in
   `packages/cli/src/presets/typescript/detect.ts` to add oxfmt + deno (`deno.json`, `deno.jsonc`),
   and add a `detectAlternativeFormatter(entries)` helper to the hook's `lib/lint-config.ts`
   (mirroring the exact-filename set, the way `detectPrettierConfig` already does — duplication is
   mandated by the `cli-presets-self-contained` rule, not an accident). Pure function over directory
   entries → **unit tests** (fast; covers the oxfmt/deno detection that `done_when` routes to units,
   and the `.prettierrc.bak` exact-match guard).
2. **Gate the hook (integration).** In `lib/lint.ts`, compute formatter ownership once at module
   init (root cwd) and gate **both** prettier branches — the JS/TS branch (`runPrettier` after
   `eslint --fix`) and the `PRETTIER_EXTENSIONS` markup branch — to skip when an alternative
   formatter owns the repo. **Integration tests** drive `lintFile` against temp-repo fixtures
   (biome/dprint/oxfmt/deno config + a file in that tool's style) and assert the bytes are unchanged.
   Covers TB1.AC1, AC2, and the both-configs precedence boundary.
3. **ESLint stays non-style (integration).** Confirm the `existingFormatter` ESLint config carries
   no stylistic rules; add the regression scenario (TB1.AC3 "no restyle") and the security-finding
   scenario. Fixture asserts a security finding still surfaces and a biome-styled file gets no format
   change from `eslint --fix`.
4. **Session check (unit/integration).** Make `session-lint-check.ts` skip the "Prettier missing /
   install prettier" warnings when an alternative formatter is present (TB4.AC1).
5. **Docs + mirror (no test).** Fix the README formatter FAQ ("coexist without conflict") to match
   real runtime behavior — tracked on the `/verify` done-checklist, not a scenario. Sync the
   `.safeword/hooks/` ↔ `packages/cli/templates/hooks/` mirror for every touched hook file.

Own-Prettier-config (TB2.AC1) and greenfield (TB3.AC1) scenarios are **integration** regression
guards — they assert the unchanged post-8BNSTE behavior survives the new gating.

## Decisions

| Decision                        | Choice                                                                                          | Alternatives considered                                             | Rejected because                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Default behavior                | **A — skip** prettier when an alternative formatter owns the repo                               | B (delegate to `biome format`); D (config switch)                   | Locked in ticket: A is minimal and can't regress; B/D are deferred fast-follows                         |
| Detection sharing               | Mirror an exact-filename set into the hook's `lib/lint-config.ts` (like `detectPrettierConfig`) | Import `hasExistingFormatter` from presets; invent a third detector | `cli-presets-self-contained` forbids cross-import; a third detector drifts (the exact bug 1J6JKP fixed) |
| `deno.json` as formatter signal | Treat presence of `deno.json`/`deno.jsonc` as alternative-formatter ownership (presence-based)  | Parse `deno.json` for a `fmt` section before skipping               | Presence-based matches how `biome.json` is already treated; parsing adds complexity for a rare edge     |
| Detection scope                 | Root cwd                                                                                        | Per-workspace (monorepo) detection                                  | Root matches how prettier/biome resolve and is consistent with 8BNSTE / 1J6JKP; revisit only if forced  |

## Arch alignment

Honors, from `ARCHITECTURE.md`:

- **"Language Detection: Detect Languages Before Framework"** — formatter ownership is a detection
  signal computed before any tool runs; this extends that pattern to the runtime hook.
- **"ESLint Plugin Configuration"** — keeps ESLint's security/complexity value additive while removing
  the formatting overlap.
- **"Config Schema"** — no new owned/managed files; detection reads existing customer configs only.

Also honors the additive-config principle (configs/actions add, never replace customer choices) that
the epic restates — here applied to hook _actions_, not just written config.

## Known deviations

- **`deno.json` may over-skip.** Treating its mere presence as formatter ownership means a Deno repo
  that doesn't actually run `deno fmt` would get no safeword formatting. Acceptable: deferring to the
  repo's own tooling is the safe default, and the worst case (a Deno repo with no active formatter
  goes unformatted by the agent) is greenfield-equivalent, not a collision.
- **Test altitude: shipped unit, deferred acceptance (deviation from Approach steps 2–3).** The plan
  called for integration tests driving `lintFile` against temp-repo fixtures. As shipped, the gate is
  proven by unit tests of the decision seam — `detectAlternativeFormatter`,
  `projectOwnsAlternativeFormatter` (skip-gate), `shouldWarnMissingPrettier` (session nag) — plus the
  trivial `runPrettier` early-return wiring. TB1.AC3 needed no code: the existing formatter-agnostic
  ESLint config already bakes in `eslint-config-prettier` (in `recommendedTypeScript`) and carries no
  `@stylistic` plugin, with security via `basePlugins` — verified by inspection. The 9 Gherkin
  scenarios that would assert the full end-to-end hook run are tagged `@wip` (cucumber step defs
  deferred): spawning the hook pulls in `bunx eslint/prettier` and can trigger an upgrade on a bare
  dir, so it isn't a cheap test. Tracked as a follow-up under epic 2H2XKH.

## Assessment triggers

Revisit these choices if: a customer reports wanting safeword to format a Deno/alt-formatter repo
(would argue for Option B delegate); a new fast JS/TS formatter appears whose config isn't in the set
(category detection should absorb it — confirm); per-workspace formatters in monorepos become common
(would force non-root detection); or Option B (delegate to the customer's formatter) is greenlit as
the fast-follow.
