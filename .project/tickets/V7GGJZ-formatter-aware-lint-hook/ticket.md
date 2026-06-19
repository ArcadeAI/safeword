---
id: V7GGJZ
slug: formatter-aware-lint-hook
type: feature
phase: done
status: done
parent: 2H2XKH
created: 2026-06-18T17:00:07.116Z
last_modified: 2026-06-19T14:40:00.000Z
scope:
  - Make the runtime auto-lint hook (`lib/lint.ts`, `post-tool-lint.ts`) formatter-aware: detect a non-Prettier JS/TS formatter (biome / dprint / rome / oxfmt / deno fmt) at the project root and **skip** the prettier step (decision locked: **A — skip**; delegate/switch are deferred fast-follows, see Decision below).
  - Reuse the install-time ownership signal — share the detection set with `presets/typescript/detect.ts` (`hasExistingFormatter`) and the hook's `lib/lint-config.ts` (`detectPrettierConfig`) rather than inventing a third detector.
  - Keep `eslint --fix` running on JS/TS even on biome shops (safeword's security/complexity/framework rules — biome lacks `eslint-plugin-security`/`sonarjs`), but ensure it carries no stylistic rules that fight the customer's formatter.
  - Gate the markup/data prettier branch (json/css/yaml/md/graphql) the same way when biome/oxfmt own those formats.
  - Make `session-lint-check.ts` formatter-aware — stop warning "Prettier config not found" / "run bun add -D prettier" on biome/dprint shops.
  - Fix the README formatter FAQ ("Safeword detects biome/dprint and skips Prettier installation… coexist without conflict") to match real runtime behavior.
  - Extend `ALTERNATIVE_FORMATTER_FILES` to include oxfmt + deno (`deno.json`/`deno.jsonc`) config signatures.
out_of_scope:
  - Install-time inertness (9C2CFX) and ignore wiring (EYRK34).
  - Delegating Python/Go/Rust formatting — low collision risk (Ruff≈Black, gofmt/rustfmt monolithic); the hook already runs the language-native tool.
  - Per-workspace formatter detection in monorepos — root-cwd detection matches how prettier/biome resolve (consistent with 8BNSTE / 1J6JKP).
  - `biome check --write` delegation — its linter + import-sort fights eslint; if delegating, use `biome format --write` only.
done_when:
  - On a repo with biome/dprint/oxfmt/deno config and no prettier config, editing a `.ts`/`.json`/`.css` file no longer triggers `bunx prettier` (verified — no prettier process, no reformat to prettier defaults).
  - On a repo with its own prettier config, the hook formats with the customer's config (unchanged, correct post-8BNSTE).
  - On a greenfield repo, safeword's formatting is unchanged.
  - `session-lint-check` emits no prettier warnings on a biome shop.
  - README formatter FAQ matches behavior; oxfmt/deno detection covered by unit tests; full suite + lint green; hook template mirror synced.
---

# Formatter-aware lint hook: stop colliding with the customer's formatter

**Goal:** The runtime auto-lint hook honors the formatter the customer already chose — it never
imposes prettier (or prettier's default style) on a repo whose formatting is owned by biome,
dprint, oxfmt, deno, or the customer's own prettier config.

**Why:** This is the core collision bug. Install-time detection is careful, but the runtime hook
(`lib/lint.ts`) runs `eslint --fix` + `prettier --write` unconditionally on every edit, and `bunx`
auto-fetches prettier even when it was "skipped" at install. On a biome shop, every LLM edit gets
prettier-styled and biome flips it back — permanent diff churn. The 80/20 says this is essentially
a JS/TS problem, so JS/TS category detection captures ~90% of the value.

**Parent:** [2H2XKH](../2H2XKH-formatter-coexistence/ticket.md)

## Decision (locked — 2026-06-18)

When a non-Prettier JS/TS formatter is detected, the hook **skips** the prettier step (Option **A**)
and keeps `eslint --fix` for security/complexity. Chosen because it is the minimal change that stops
the collision and **cannot regress** — it only ever does less; biome/dprint/oxfmt/deno format via the
customer's own tooling.

Deferred (not this ticket):

- **B — Delegate** (`biome format --write <file>`): better end state (LLM edits match the repo
  standard on every edit) but adds per-formatter dispatch + availability/version checks. Fast-follow
  once A ships. If B ever lands, use `biome format --write` only — `biome check --write` runs biome's
  linter + import-sort and fights eslint.
- **D — Config switch** (`.safeword/config.json` → `formatter: auto | off | <tool>`): escape hatch;
  revisit only if skip-by-default proves insufficient.

## Work Log

- 2026-06-18T17:03:00.000Z Started: Created under epic 2H2XKH. Root cause = formatter-blind runtime
  hook + bunx auto-fetch. Detection should reuse install-time `hasExistingFormatter`. A-vs-B default
  is the live decision; needs scenarios once chosen.
- 2026-06-18T17:35:00.000Z Decision locked by user ("do what you recommend"): default = **A (skip)**;
  B (delegate) and D (switch) deferred to fast-follow. Scope/done_when already skip-phrased. Phase
  intake → define-behavior. Next: author scenarios (scenario-gate) against spec.md.
- 2026-06-18T19:07:00.000Z Complete: define-behavior — filled hollow spec.md (4 JTBDs / 7 ACs for
  persona DEV), wrote dimensions.md (4 dimensions), authored 8 scenarios across 5 rules in
  `features/formatter-aware-lint-hook.feature` with `@…AC` lineage tags, and the R/G/R ledger in
  test-definitions.md. Phase → scenario-gate. Next: independent /review-spec (fresh reviewer).
- 2026-06-18T19:08:00.000Z Complete: scenario-gate — independent fork review (review-spec procedure)
  returned PASS, no blockers. Applied its should-fix items: added a non-Prettier start-state to the 3
  "not restyled" scenarios (kills a vacuous-pass risk) and a 9th scenario (ESLint must not restyle on
  a Biome shop — closes the scope's anti-collision guarantee). Wrote impl-plan.md (test layers + build
  order; deno.json over-skip noted as known deviation). Stamped phase scenario-gate. Phase → implement.
  Next: TDD (RED) — requires `bun ci` in this worktree first.
- 2026-06-19T14:03:00.000Z Complete: implement — 4 commits (db6361b9 detector, 783935af install-time
  oxfmt/deno, fdc9f189 runPrettier skip-gate, 3e01a0e3 session-nag). DEV1.AC3 satisfied by the existing
  formatter-agnostic eslint config (eslint-config-prettier baked into recommendedTypeScript; security via
  basePlugins; no @stylistic) — no change. README FAQ corrected. Full suite green (3073 pass / 3 skip).
  Ledger marked; coverage is unit-level (detector + gate predicate + warning gate), full end-to-end hook
  run deferred to /verify. Phase → verify.
- 2026-06-19T14:40:00.000Z Done (user chose "write step-defs first"): /quality-review APPROVE (no
  criticals; oxfmt set re-verified vs oxc docs), refactor n/a (no smell), /audit passed (arch clean, no
  new dead code/dup). Then wired the cucumber acceptance lane — `steps/formatter-aware-lint-hook.steps.ts`
  spawns the real post-tool-lint hook against temp Biome/dprint/oxfmt/deno/greenfield/own-Prettier repos
  and asserts on file bytes; 10 scenarios green (full lane 69/741). Only DEV1.AC3 (2 scenarios) stay @wip
  (need the real safeword/eslint config in-fixture). 11 commits (db6361b9 → c1d8b652). Status → done.
