# Test Definitions: Customer Override Survival (#137)

**Feature**: Customer lint rule overrides in customer-owned config files are honored by safeword's LLM hook AND not mutated by `safeword upgrade`.
**Related Issue**: #137
**Test File**: `packages/cli/tests/integration/override-survival.test.ts` (new)
**Total Tests**: 13 (0 passing, 0 not implemented)

---

## Rule: TypeScript overrides in eslint.config.mjs survive upgrade

> Rationale: `eslint.config.mjs` is customer-owned and never overwritten. Flat config's "later wins" semantics should carry the customer's `rules:` block through any `safeword upgrade`.

- [x] Given a safeword TypeScript project with `rules: { 'security/detect-non-literal-fs-filename': 'off' }` in eslint.config.mjs, when I run `safeword upgrade`, then eslint.config.mjs is byte-identical and the LLM hook lint run does not flag security/detect-non-literal-fs-filename on a seeded violation.

### Scenario 1.1: TS — disable safeword rule via `rules: { 'X': 'off' }`

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given a safeword TypeScript project with `rules: { complexity: ['error', 50] }` in eslint.config.mjs (safeword sets complexity to 10 by default), when I run `safeword upgrade`, then eslint.config.mjs is byte-identical and a function with cyclomatic complexity 15 does not trigger the rule.

### Scenario 1.2: TS — change threshold via `rules: { 'X': ['error', opts] }`

- [x] RED
- [x] GREEN
- [x] REFACTOR

- [x] Given a safeword TypeScript project with `rules: { 'no-console': 'error' }` in eslint.config.mjs (a rule safeword does not enable by default), when I run `safeword upgrade`, then eslint.config.mjs is byte-identical and `console.log()` is flagged by the LLM hook lint run.

### Scenario 1.3: TS — add new rule via `rules: { 'no-console': 'error' }`

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Rule: Python overrides in ruff.toml survive upgrade

> Rationale: `ruff.toml` is customer-owned. Safeword's `.safeword/ruff.toml` uses the `extend` directive to inherit from the customer config, so customer `ignore` / `per-file-ignores` / `extend-select` must pass through unchanged.

- [ ] Given a safeword Python project with `[lint]\nignore = ["E501"]` in ruff.toml, when I run `safeword upgrade`, then ruff.toml is byte-identical and a 100-char line does not flag E501 in the LLM hook lint run.

### Scenario 2.1: Python — ignore rule via `lint.ignore`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given a safeword Python project with `[lint.per-file-ignores]\n"tests/**" = ["S101"]` in ruff.toml, when I run `safeword upgrade`, then ruff.toml is byte-identical and `assert x == 1` in tests/test_x.py does not flag S101 in the LLM hook lint run.

### Scenario 2.2: Python — per-file-ignores

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given a safeword Python project with `[lint]\nextend-select = ["PT"]` in ruff.toml (adding flake8-pytest-style rules not in safeword defaults), when I run `safeword upgrade`, then ruff.toml is byte-identical and a PT-class violation is flagged by the LLM hook lint run.

### Scenario 2.3: Python — add rule via `extend-select`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Rule: Go overrides in .golangci.yml survive upgrade

> Rationale: `.golangci.yml` is customer-owned. Safeword's v2 config uses `linters.default: standard` with unionArrays for enable/disable and fill-gap merge for settings — customer values must win on conflict.

- [ ] Given a safeword Go project with `linters:\n  disable:\n    - errcheck` in .golangci.yml, when I run `safeword upgrade`, then .golangci.yml is byte-identical and an unchecked error does not flag errcheck in the LLM hook lint run.

### Scenario 3.1: Go — disable linter

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given a safeword Go project with `linters:\n  enable:\n    - unparam` in .golangci.yml (a linter safeword does not enable by default), when I run `safeword upgrade`, then .golangci.yml is byte-identical and an unused parameter is flagged by unparam in the LLM hook lint run.

### Scenario 3.2: Go — enable new linter

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given a safeword Go project with `linters:\n  settings:\n    govet:\n      enable-all: false` in .golangci.yml, when I run `safeword upgrade`, then .golangci.yml is byte-identical and the LLM hook lint run respects the relaxed govet setting.

### Scenario 3.3: Go — settings override

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Rule: Rust overrides survive upgrade (clippy.toml + source attributes)

> Rationale: `clippy.toml` is customer-owned. Clippy has no enable/disable in clippy.toml — disabling a lint is done via source attributes `#![allow(clippy::X)]`. Both surfaces must be preserved.

- [ ] Given a safeword Rust project with `cognitive-complexity-threshold = 50` in clippy.toml, when I run `safeword upgrade`, then clippy.toml is byte-identical and a function with complexity 45 does not flag clippy::cognitive_complexity in the LLM hook lint run.

### Scenario 4.1: Rust — clippy.toml threshold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given a safeword Rust project with `#![allow(clippy::too_many_arguments)]` at the top of src/lib.rs, when I run `safeword upgrade`, then src/lib.rs is byte-identical and a 9-argument function does not flag clippy::too_many_arguments in the LLM hook lint run.

### Scenario 4.2: Rust — source-level `#![allow(clippy::X)]`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Rule: SQL overrides in .sqlfluff survive upgrade

> Rationale: `.sqlfluff` is customer-owned. Safeword patches sqlfluff config key-by-key (additive memory) — customer's `exclude_rules` and `[sqlfluff:rules:X]` sections must be preserved.

- [ ] Given a safeword SQL project with `[sqlfluff]\nexclude_rules = L010` in .sqlfluff, when I run `safeword upgrade`, then .sqlfluff is byte-identical and uppercase keywords do not flag L010 in the LLM hook lint run.

### Scenario 5.1: SQL — `exclude_rules`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given a safeword SQL project with `[sqlfluff:rules:capitalisation.keywords]\ncapitalisation_policy = lower` in .sqlfluff, when I run `safeword upgrade`, then .sqlfluff is byte-identical and lowercase SQL keywords do not flag capitalisation.keywords in the LLM hook lint run.

### Scenario 5.2: SQL — per-rule settings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Implementation Notes

**Shared test shape** per scenario:

```typescript
// 1. Scaffold project with given language
// 2. Run `safeword setup`
// 3. Write customer override into customer-owned config file
// 4. Capture byte-for-byte snapshot of the customer file
// 5. Seed a src file whose content would trigger `rule` if the rule were active
// 6. Run `safeword upgrade`
// 7. Assert: customer file unchanged (byte-identical to snapshot)
// 8. Invoke LLM hook lint run against the seeded file
// 9. Assert: violations do NOT include `rule`
```

**Helpers** (check-before-write; likely reusable from existing \*-golden-path.test.ts):

- `createTempProject({ language })`
- `runSafewordSetup(dir)` / `runSafewordUpgrade(dir)`
- `runLlmLintHook(dir, file)` — parse violations from hook output; add if missing

## Expected Failure Modes

Each is a real bug, not a test flake. If surfaced: file follow-up ticket, document in 137 work log, do not patch inline.

- **ruff.toml override ignored**: `extend` directive fails → customer `ignore` not inherited
- **.golangci.yml override ignored**: v2 config regenerates and overwrites customer settings
- **clippy.toml threshold ignored**: fill-gap merge regresses
- **eslint.config.mjs rewritten**: setup/upgrade idempotently rewrites customer file
