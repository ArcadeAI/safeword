---
id: 2H2XKH
title: 'Formatter coexistence: inert install, zero formatter collisions, self-contained ignores'
type: epic
phase: planning
status: in_progress
created: 2026-06-18T16:58:14.654Z
last_modified: 2026-06-18T17:35:00.000Z
children: ['9C2CFX', 'V7GGJZ', 'EYRK34']
---

# Formatter coexistence: inert install, zero formatter collisions, self-contained ignores

## Goal

Safeword must behave like a **guest** in a customer repo: installing it never reformats
their files, its auto-format hook never fights the formatter they already use (any language),
and its own folders are invisible to the customer's formatters. Adding safeword should produce
**zero unsolicited diff** to customer source.

## The Problem

Safeword's _install-time_ logic is already careful and additive — it detects biome/dprint/rome
and an existing prettier config, skips writing configs that would shadow the customer's, merges
`.safeword/` into biome's excludes, and emits a prettier-free ESLint config. Ticket
[8BNSTE](../8BNSTE-prettier-config-shadow/ticket.md) hardened this after a customer had **225 files
flipped double→single quote** by a shadowing `.prettierrc`.

But the **runtime auto-lint hook is formatter-blind.** `post-tool-lint.ts` →
`lib/lint.ts` runs on _every_ edited file and unconditionally executes `eslint --fix` +
`prettier --write` for JS/TS, and `prettier --write` for json/css/yaml/md — with **no awareness
of the customer's toolchain**. Worse, it shells out via `bunx prettier`, which
[auto-fetches prettier from npm even if it was never installed](https://bun.com/docs/pm/bunx) —
so "we skip Prettier installation" does **not** stop prettier from running and reformatting.

**The asymmetry is the bug:** the installer computes formatter ownership and acts on it; the
runtime hook ignores that same signal and reformats anyway. On a biome shop, every LLM edit gets
prettier-default styling, the customer's biome flips it back, and the diff ping-pongs forever.
The README even claims "both tools coexist without conflict" (false at runtime), and
`session-lint-check.ts` _nags biome users to `bun add -D prettier`_.

### The 80/20: this is essentially a JS/TS problem

Real-world (mid-2026) formatter adoption shows fragmentation is concentrated in **one** ecosystem:

| Language  | Dominant                | Challenger                         | Collision risk | Why                                                            |
| --------- | ----------------------- | ---------------------------------- | -------------- | -------------------------------------------------------------- |
| JS/TS/web | Prettier (~45M/wk)      | Biome (~1.5M/wk), oxfmt (beta '26) | **HIGH**       | Multiple tools, _incompatible_ output (Prettier vs Biome ≈97%) |
| Python    | Black + Ruff (~180M/mo) | —                                  | **LOW**        | Ruff is >99.9% Black-compatible — near-identical output        |
| Go        | gofmt (toolchain)       | gofumpt (superset)                 | **~NONE**      | Monolithic; gofumpt is backwards-compatible with gofmt         |
| Rust      | rustfmt (`cargo fmt`)   | —                                  | **~NONE**      | Effectively 100%; toolchain-native                             |

So the high-value detection is "_is there a non-Prettier JS/TS formatter present?_" (biome / dprint
/ oxfmt / deno). Python/Go/Rust don't fragment into incompatible styles; the fix there is mostly
not imposing safeword's config and staying out of their ignore scope.

## Design Principle

**Safeword is additive and inert on customer choices.** Configs add rules, never replace them
([project_additive_config]). Extending that to _actions_: the hook must never impose a formatter
the repo didn't choose, install must never trigger a mass reformat, and safeword's own files must
never appear in the customer's formatter scope.

## The three requirements → children

This epic decomposes into the three issues raised, each a child ticket:

### 1. No immediate churn on install — [9C2CFX](../9C2CFX-inert-install-no-churn/ticket.md) (task)

Installing or upgrading safeword must not reformat a single customer file. Audit every
install/upgrade write for a path that changes the _resolved_ formatter style (the additive
`.prettierrc` JSON-merge that fills in safeword defaults is the prime suspect), and guarantee no
bulk format step runs as part of setup. Generalizes 8BNSTE's prettier-shadow fix into a standing
"install is inert" guarantee.

### 2. No collision with existing formatters — [V7GGJZ](../V7GGJZ-formatter-aware-lint-hook/ticket.md) (feature)

Make the runtime hook (and `session-lint-check`) honor the formatter-ownership signal the
installer already computes. Category-level detection of a non-Prettier JS/TS formatter →
**skip or delegate** the prettier step (decision below). Keep `eslint --fix` for security/complexity
(biome lacks `eslint-plugin-security`/`sonarjs`). Fix the README "coexist without conflict" claim and
the prettier nag. This is the core bug and the bulk of the work.

### 3. Customer formatters ignore safeword folders — [EYRK34](../EYRK34-formatter-ignore-safeword-paths/ticket.md) (task)

The inverse direction: when the customer runs _their_ formatter, it must skip safeword-owned paths
(`.safeword/`, `.claude/`, `.project/`, `.cursor/`, `.codex/`, `.agents/`) so safeword's own files
never churn in their diffs/CI. Safeword already does this for biome excludes and eslint ignores;
extend additively to `.prettierignore`, ruff `extend-exclude`, rustfmt `ignore`, dprint excludes,
oxfmt, and respect `.editorconfig`.

## Scope

- Runtime `lib/lint.ts` + `post-tool-lint.ts` formatter-awareness (JS/TS category detection).
- `session-lint-check.ts` formatter-awareness (no prettier nag on biome/dprint shops).
- Install/upgrade inertness audit + guarantee (no resolved-style change, no bulk reformat).
- Additive ignore wiring across the formatters customers actually use.
- Honesty fixes: README formatter FAQ, any "coexist without conflict" claim.
- Extend `ALTERNATIVE_FORMATTER_FILES` to cover oxfmt + deno fmt (the new JS/TS entrants).

## Out of Scope

- Migrating/merging a customer's formatter config into safeword's defaults (detection-and-respect only).
- Python/Go/Rust formatter _delegation_ — low collision risk; covered by inertness + ignores, not new dispatch.
- Per-workspace (monorepo sub-package) formatter detection — root-cwd detection matches how the tools resolve (consistent with 8BNSTE / 1J6JKP).
- Replacing safeword's ESLint security/complexity value-add (that stays, additive).

## Approach — decided (2026-06-18)

The figure-it-out pass surfaced a fork for requirement 2; **locked to A (detect & skip)** (full
analysis in [V7GGJZ](../V7GGJZ-formatter-aware-lint-hook/ticket.md)):

- **A — Detect & skip (CHOSEN).** Non-Prettier JS/TS formatter present → skip the prettier step
  entirely. Minimal, can't regress, customer's own tooling formats.
- **B — Detect & delegate** (`biome format --write`) — deferred fast-follow; better end state, more
  surface. Use `biome format` only, never `biome check` (its linter/import-sort fights eslint).
- **D — Customer switch** (`formatter: auto | off | <tool>`) — deferred; revisit only if skip-by-default
  proves insufficient.

Detection is category-level so the next fast-Rust formatter isn't another silent collision.

## Open Questions

- ~~A vs B for the default `auto` behavior~~ — **resolved 2026-06-18: A (skip).**
- ~~Ship the `formatter` config switch (D) in this epic?~~ — **resolved: defer (fast-follow).**
- Detection granularity: root-cwd only, or per-workspace in monorepos? (Out of scope above leans root-only.)
- Should `.editorconfig` presence alone (no formatter config) soften safeword's greenfield formatting defaults?

## Origin

Customer reports (2026-06-18): safeword installs into repos and (a) churns files immediately,
(b) collides with their existing biome/prettier (and the same risk across Python/Go/Rust), and
(c) makes safeword's own folders show up in their formatter runs. Investigation + figure-it-out
this session traced it to runtime formatter-blindness despite careful install-time detection.

## Work Log

- 2026-06-18T16:58:14.654Z Started: Created ticket 2H2XKH
- 2026-06-18T17:02:00.000Z Scoped: Promoted to epic. Investigation traced the collision/churn to a
  formatter-blind runtime hook (`lib/lint.ts` runs eslint+prettier unconditionally; `bunx` auto-fetches
  prettier even when "skipped"), while install-time detection is already careful (8BNSTE). 80/20 research:
  collision is essentially a JS/TS problem (Python Ruff/Black compatible; Go/Rust monolithic). Decomposed
  into 3 children: 9C2CFX (inert install), V7GGJZ (formatter-aware hook), EYRK34 (self-contained ignores).
  A-vs-B default-behavior decision left open pending user converge.
- 2026-06-18T17:35:00.000Z Converged (user "do what you recommend"): default-behavior decision **locked
  to A (skip)**; B (delegate) and D (config switch) deferred to fast-follow. Normalized `children` to a
  YAML list. Epic adopted as-is. (Note: epic + children were co-authored by a concurrent worktree session
  on the 2H2XKH scaffold; verified settled — no writes for ~32 min — before editing.)
