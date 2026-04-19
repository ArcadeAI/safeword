---
id: 137
type: feature
phase: implement
status: in_progress
created: 2026-04-18T03:11:12Z
last_modified: 2026-04-18T03:11:12Z
scope: |
  Prove via BDD integration tests that a customer's rule override in their
  customer-owned lint config file (eslint.config.mjs, ruff.toml, .golangci.yml,
  clippy.toml, .sqlfluff) is (a) honored by safeword's LLM hook lint run and
  (b) not mutated by `safeword upgrade`. Covers all 5 supported languages with
  idiomatic override types per ecosystem.
out_of_scope: |
  - Ticket 019's .safeword-project/*-overrides.* secondary override surface
  - Formatter configs (.prettierrc, rustfmt.toml) — no rules to override
  - Type-checker configs (tsconfig.json, mypy.ini) — no severity model
  - Fixing any bugs discovered; failures spawn follow-up tickets
done_when: |
  Scope reduced 2026-04-19 when pivoting to ticket 138.
  - Rule 1 (TypeScript, 3/3) and Rule 2 (Python, 3/3) are GREEN in
    tests/integration/override-survival.test.ts — captured as regression
    coverage for the PRE-138 composition architecture.
  - Rule 3 (Go), Rule 4 (Rust), Rule 5 (SQL) explicitly DEFERRED. Those
    linters already honor the unified contract via Path C (generation-time
    merge / fill-gap merge). Adding scenarios there is lower value than
    verifying the redesign under ticket 138.
  - Scenario 1.4 (pre-existing eslint.config.mjs) MOVED to ticket 138 — it's
    the regression proof for the flipped composition order.
  - Ticket 138 filed with full design rationale, supersedes 019.
---

# Verify customer lint rule overrides survive safeword upgrades (BDD)

**Goal:** Prove, per-language, that a customer's override in their own lint config file is honored by safeword's LLM hook AND is not touched by `safeword upgrade`.

**Why:** Safeword advertises (in FAQ + configuration docs) that `eslint.config.mjs`, `ruff.toml`, `.golangci.yml`, `clippy.toml`, and `.sqlfluff` are customer-owned and never overwritten. This is the core promise that makes safeword safe to adopt — but there are no dedicated tests asserting the invariant holds across upgrade. Existing `upgrade.test.ts` covers `.safeword/` files, custom hooks, and learnings, but not the customer-owned lint configs.

**Scope:** Direct override surface only (customer-owned config files). Excludes ticket 019's `.safeword-project/*-overrides.*` secondary surface — that's a separate feature, not yet built.

## The Invariant

For each supported language, a rule override placed in the customer-owned config file must:

1. Be honored by the LLM hook lint run (behavior preserved across upgrade)
2. Not be mutated by `safeword upgrade` (file integrity preserved)

## Scenarios

See [`test-definitions.md`](./test-definitions.md) for the full Gherkin spec.

Summary:

| Language   | Customer config                   | Override types covered                           |
| ---------- | --------------------------------- | ------------------------------------------------ |
| TypeScript | `eslint.config.mjs`               | disable rule, change threshold, add new rule     |
| Python     | `ruff.toml`                       | ignore rule, per-file-ignores, extend-select     |
| Go         | `.golangci.yml`                   | disable linter, enable linter, settings override |
| Rust       | `clippy.toml` + source attributes | clippy.toml threshold, `#![allow(clippy::X)]`    |
| SQL        | `.sqlfluff`                       | `exclude_rules`, `[sqlfluff:rules:X]` settings   |

## Implementation Plan

1. Write Gherkin scenarios as `test-definitions.md` (BDD spec, reviewable before code).
2. Implement as one vitest integration test file: `packages/cli/tests/integration/override-survival.test.ts`.
3. Test shape per scenario: spawn safeword setup → seed customer override → run `safeword upgrade` → assert (a) hook lint run doesn't flag seeded violation and (b) customer config file is byte-identical.
4. Use existing golden-path test patterns (`typescript-validation.test.ts`, `python-golden-path.test.ts`, `rust-golden-path.test.ts`, `sql-golden-path.test.ts`, `golang-golden-path.test.ts`) for scaffolding.
5. If a scenario fails during implementation, that's a bug in the pack; file a follow-up ticket, don't fix inline.

## Acceptance Criteria

- [ ] `test-definitions.md` contains one `Scenario Outline` per language, parameterized with `Examples:` covering all idiomatic override types
- [ ] `tests/integration/override-survival.test.ts` implements all scenarios
- [ ] All scenarios pass (or failures are documented as separate tickets)
- [ ] Test file runnable in isolation: `npx vitest run tests/integration/override-survival.test.ts`
- [ ] Ticket referenced from FAQ + configuration doc as evidence for the "never overwritten" promise

## Design Decisions

| Decision          | Choice                                                | Rationale                                                                 |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Override surface  | Direct (customer-owned files) only                    | User explicitly scoped out `.safeword-project/*-overrides.*` (ticket 019) |
| Scenario shape    | `Scenario Outline` + `Examples:` per language         | 2026 BDD guidance: declarative, parameterized, data-driven                |
| `Then` assertions | (1) violation not flagged by hook, (2) file unchanged | Behavior first (Cucumber); file-integrity as secondary invariant          |
| Rust split        | Two Examples rows (clippy.toml + source attr)         | Clippy's disable-a-lint idiom is source attributes, not config            |
| Test style        | Integration (spawn upgrade, assert)                   | Matches `upgrade.test.ts`; invariant is end-to-end                        |

## Out of Scope

- Ticket 019's `.safeword-project/*-overrides.*` mechanism (different surface, unbuilt)
- Formatter config (`.prettierrc`, `rustfmt.toml`) — no rules to override
- Type-checker config (`tsconfig.json`, `mypy.ini`) — no severity toggles in safeword's remit

## Work Log

---

- 2026-04-18T03:11:12Z Created: BDD ticket to verify the "customer-owned configs never overwritten" invariant across all 5 language packs. Q1=direct surface, Q2=better BDD (Scenario Outline + Examples, behavior-focused Thens).
- 2026-04-18T14:30:00Z Rule 1 (TypeScript, 3/3 scenarios) GREEN. Key findings during implementation:
  1. Customer override MUST be placed AFTER `...safeword.configs.recommendedTypeScript` in eslint.config.mjs. Flat config is "later wins" — overrides at the top get silently reverted by safeword's preset. The FAQ example already shows this correctly; tests now assert it.
  2. macOS tmpdir returns the `/var/folders/` symlink; ESLint canonicalizes paths to `/private/var/folders/` and silently drops absolute paths with "outside of base path" warning. Tests call `realpathSync(createTemporaryDirectory())` to avoid vacuous passes. Non-issue in production (real paths passed by Claude Code).
  3. Initial test design put override at start of `defineConfig([...])` and had 2/3 tests vacuously pass before the path-canonicalization fix exposed the real assertion.
- 2026-04-18T15:50:00Z Rule 2 (Python, 3/3 scenarios) GREEN. Customer `ignore`, `per-file-ignores`, and `extend-select` in pre-existing `ruff.toml` propagate to the LLM hook via ruff's `extend` mechanism (mode #2). One gap surfaced for followup: mode #1 (standalone — safeword generates customer's ruff.toml) does not propagate customer overrides because the hook uses `ruff check --config .safeword/ruff.toml` which bypasses the customer's file.
- 2026-04-19T00:13:00Z **Pivoted.** Exploration of the "pre-existing eslint.config.mjs" path (Scenario 1.4 candidate) exposed a deeper design issue: safeword's LLM hook composition `[...customer, safewordStrict, prettier]` means safeword overrides the customer whenever both set a rule. The customer's `eslint.config.mjs` is NOT authoritative for the LLM hook — surprising and inconsistent with the "additive, never replaces" principle used for ruff/golangci-lint/clippy. Ticket 019 was already designed to address this via a second override surface (`.safeword-project/*-overrides.*`), but that multiplies the mental model. Decided to supersede 019 with [ticket 138](../138-unify-customer-override-contract/ticket.md), which flips ESLint composition order (Path B — native "later wins" makes customer win) and unifies ruff standalone mode to always extend customer config (Path C variant). Go/Rust/SQL already honor the contract; no change there. **This ticket's scope reduces to Rule 1 + Rule 2 as completed regression coverage for the PRE-138 architecture.** Rule 3 (Go), Rule 4 (Rust), and Rule 5 (SQL) are deferred — they'd be redundant since those linters already use Path C. Scenario 1.4 moves to ticket 138.

---
