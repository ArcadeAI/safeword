# Dimensions: Customer Override Survival (#137)

## Behavioral dimensions derived from scope

| Dimension        | Partitions                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Language pack    | TypeScript, Python, Go, Rust, SQL                                                                            |
| Override surface | customer-owned config file, source-level attribute (Rust `#![allow(...)]` only)                              |
| Override type    | disable existing safeword rule, change threshold safeword sets, add brand-new rule                           |
| Override scope   | global (whole project), per-path/per-file (e.g., ruff `per-file-ignores`, ESLint `files`)                    |
| Upgrade trigger  | `safeword upgrade` (cross-version), `safeword setup` re-run at same version                                  |
| Assertion axis   | LLM hook honors override (behavior), customer config file unchanged (integrity)                              |
| Merge mechanism  | ESLint array last-wins, ruff `extend`, golangci-lint v2 union+fill-gap, clippy fill-gap, sqlfluff key-by-key |

## Coverage matrix (language × override type)

Each cell is one `Examples:` row in the scenario outline. `—` marks combinations not idiomatic for that ecosystem.

| Language | disable rule    | change threshold | add new rule                     |
| -------- | --------------- | ---------------- | -------------------------------- |
| TS       | ✓               | ✓                | ✓                                |
| Python   | ✓ (ignore)      | ✓ (per-file)     | ✓ (extend-select)                |
| Go       | ✓ (disable)     | ✓ (settings)     | ✓ (enable)                       |
| Rust     | ✓ (source attr) | ✓ (clippy.toml)  | — (clippy has no plugin model)   |
| SQL      | ✓ (exclude)     | ✓ (per-rule)     | — (sqlfluff's rule set is fixed) |

**Total: 13 example rows** across 5 languages.

## Boundary values

- Customer config file exists but is empty (no overrides) — safeword should still function
- Customer override uses a rule name that safeword doesn't enable by default (add new rule partition)
- Customer config uses a comment format the linter supports (YAML anchors, TOML dotted keys) — safeword preserves structure
- Rust customer puts `#![allow(clippy::X)]` in `main.rs` vs `lib.rs` vs per-module
- Fresh setup (no prior `.safeword/`) vs upgrade (existing `.safeword/` present) — both trigger the same override-preservation invariant

## Explicit non-dimensions (fixed for all scenarios)

- Safeword CLI version: latest published (from `packages/cli/package.json`)
- LLM runner: post-tool-use hook only (not project-level `/lint` command, which has different strictness by design — see additive-config memory)
- Override file format: native per-tool (no translation layer involved)
- Customer override file is **committed**, not gitignored (standard safeword expectation)
