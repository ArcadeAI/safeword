---
id: 060
slug: golangci-lint-additive-config
type: task
status: done
phase: done
---

# Task: Fix golangci-lint config to not override customer settings

**Type:** Bug

**Scope:** Change `.safeword/.golangci.yml` generation to preserve customer's linter choices instead of replacing them. Same principle as the ruff fix (commit 3738493): safeword adds rules, never replaces.

**Out of Scope:** Adding new Go linters, govulncheck integration, /lint command Go support, golangci-lint v1 deprecation.

**Context:** The ruff fix used `extend-select` (additive) instead of `select` (replacement). golangci-lint v2 doesn't have an equivalent `extend` directive in YAML — need to research what merging strategy is correct for YAML-based config.

**Current Problems:**

- `default: all` overrides customer's `default: standard` choice
- Customer's `disable` list is replaced, not merged with safeword's
- Customer's `exclusions.presets` are replaced, not merged
- `deepMerge()` is object-level merge where safeword wins — arrays are replaced entirely

**Done When:**

- [ ] Customer's `default` linter selection is preserved
- [ ] Customer's `disable` list is merged with safeword's (union, not replacement)
- [ ] Customer's `exclusions.presets` are merged with safeword's
- [ ] Customer's `linters.settings` are preserved (safeword only adds missing settings)
- [ ] Tests updated to verify additive behavior
- [ ] Existing invisible-extension and golden-path tests pass

**Tests:**

- [ ] Existing customer `disable` entries survive merge
- [ ] Existing customer `exclusions.presets` survive merge
- [ ] Customer with `default: standard` — safeword adds via `enable` instead of forcing `all`
- [ ] Standalone config (no customer config) unchanged
- [ ] v1 format merge preserves customer settings

**Research Needed:**

- golangci-lint v2 config inheritance/extend semantics (if any)
- Whether `default: standard` + `enable: [extra-linters]` is equivalent to cherry-picking from `all`
- How `disable` interacts with `default: all` vs `default: standard`

## Work Log

- 2026-03-27 Created from ruff fix (commit 3738493). Same override problem identified during audit.
- 2026-03-27 Researched golangci-lint v2 config semantics. No extend mechanism exists. `default: all` discouraged (same as ruff ALL). Community uses explicit enable lists.
- 2026-03-27 Implemented: replaced default:all with default:standard + 24 curated linters. Rewrote merge to union arrays and fill-gap settings. All 19 Go tests pass.
