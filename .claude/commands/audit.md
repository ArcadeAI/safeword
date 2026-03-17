---
description: Run comprehensive code audit for architecture, dead code, and test quality
---

# Audit

Run a comprehensive code audit. Execute checks and report results by severity.

## Instructions

### 1. Code Quality Checks

```bash
# =========================================================================
# REFRESH CONFIG (detect current architecture)
# =========================================================================

# 0. Regenerate depcruise config from current project structure
bunx safeword@latest sync-config 2>&1 || true

# =========================================================================
# ARCHITECTURE CHECKS (circular deps, layer violations)
# =========================================================================

# 1a. Architecture - TypeScript/JS (depcruise)
DEPCRUISE_CONFIG=""
[ -f .dependency-cruiser.cjs ] && DEPCRUISE_CONFIG=".dependency-cruiser.cjs"
[ -f .dependency-cruiser.js ] && DEPCRUISE_CONFIG=".dependency-cruiser.js"
[ -n "$DEPCRUISE_CONFIG" ] && {
  bunx depcruise --output-type err --config "$DEPCRUISE_CONFIG" . 2>&1 || true
}

# 1b. Architecture - Python
# Note: Python circular imports cause ImportError at runtime.
# If your Python code runs, it has no blocking circular imports.
# For static analysis, consider: pip install import-linter

# 1c. Architecture - Go
# Note: Go compiler prevents circular imports between packages at build time.
# If your Go project builds, it has no circular dependencies.

# =========================================================================
# DEAD CODE DETECTION
# =========================================================================

# 2a. Dead code - TypeScript/JS (knip with auto-fix)
[ -f package.json ] && {
  bunx knip --fix 2>&1 || true
}

# 2b. Dead code - Python (deadcode)
([ -f pyproject.toml ] || [ -f requirements.txt ]) && {
  deadcode . 2>&1 || true
}

# 2c. Dead code - Go (golangci-lint unused)
[ -f go.mod ] && {
  golangci-lint run --enable unused --out-format colored-line-number 2>&1 || true
}

# =========================================================================
# CODE DUPLICATION
# =========================================================================

# 3. Copy/paste detection (all languages)
bunx jscpd . --gitignore --min-lines 10 --reporters console 2>&1 || true

# =========================================================================
# OUTDATED DEPENDENCIES
# =========================================================================

# 4a. Outdated - TypeScript/JS
[ -f package.json ] && {
  bun outdated 2>&1 || npm outdated 2>&1 || true
}

# 4b. Outdated - Python (uv > poetry > pip)
([ -f pyproject.toml ] || [ -f requirements.txt ]) && {
  uv pip list --outdated 2>&1 || poetry show --outdated 2>&1 || pip list --outdated 2>&1 || true
}

# 4c. Outdated - Go
[ -f go.mod ] && {
  go list -m -u all 2>&1 | grep '\[' || echo "All Go modules up to date"
}
```

### 2. Agent Config Checks

Find and check all agent configuration files (excluding `.safeword/`):

**Files to check:**

- `CLAUDE.md`, `AGENTS.md` (root and subdirectories)
- `.claude/CLAUDE.md` (root and subdirectories)
- `.cursor/rules/*.mdc` or `.cursor/rules/*/` (root and subdirectories)
- `.cursorrules` (legacy)

**For each config file, check:**

| Check      | Criteria                                                            | Severity |
| ---------- | ------------------------------------------------------------------- | -------- |
| Size limit | CLAUDE.md/AGENTS.md: ~150-200 instructions; Cursor rules: 500 lines | warn     |
| Structure  | Has WHAT/WHY/HOW sections                                           | warn     |
| Dead refs  | All referenced files/paths exist (skip URLs starting with http)     | error    |
| Staleness  | Last modified 30+ days ago AND commits exist since                  | warn     |

**Best practices sources:**

- [Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Cursor Docs](https://cursor.com/docs/context/rules)

### 3. Test Quality Review

Review existing test files for quality issues. Sample test files from the project and check against the iron laws and anti-patterns in `.claude/skills/testing/SKILL.md`.

**Find test files:**

```bash
# Find test files (common patterns)
find . -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" | grep -v node_modules | grep -v dist | head -20
```

**For each sampled test file, check:**

| Check                        | Criteria                                                                                                | Severity |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| Meaningful assertions        | Every test has specific value/behavior assertions (not just `toBeTruthy`, `toBeDefined`, `not.toThrow`) | error    |
| Behavior over implementation | Tests assert observable outcomes, not internal state or mock call args                                  | warn     |
| Independence                 | No test depends on another test's side effects; fresh state per test                                    | error    |
| No arbitrary timeouts        | No `sleep()`, `waitForTimeout()`, or hardcoded delays                                                   | warn     |
| Edge case coverage           | Tests include error paths and boundary cases, not just happy path                                       | warn     |
| No duplicate tests           | Similar tests use parameterized/table-driven patterns (`it.each`)                                       | warn     |
| Test naming                  | Names describe behavior, not implementation ("returns 401 when..." not "works correctly")               | warn     |

**Report format:**

```text
Test Quality:
- Files reviewed: N
- Issues found: N (E errors, W warnings)
- [E/W] file.test.ts:42 — Weak assertion: `expect(result).toBeTruthy()` → assert specific value
- [E/W] file.test.ts:15 — Shared mutable state: `user` modified across tests
- [W] file.test.ts — Happy-path only: no error case tests for `processOrder()`
```

### 4. Project Documentation Checks

**ARCHITECTURE.md:**

- If missing → create from `.safeword/templates/architecture-template.md`
- If exists → check for drift and gaps:
  - **Drift (error):** Documented tech contradicts code (e.g., doc says "Redux", package.json has "zustand")
  - **Gap (warn):** Major dependencies not documented

**README.md:**

- Check staleness (last modified vs recent commits)

**Docs site (if exists):**

- Detect `docs/`, `documentation/` with Starlight/Docusaurus/etc config
- Check staleness of docs content

---

## Report Format

Report findings by severity with codes:

### Errors (must fix)

- [E001] Dead ref: `CLAUDE.md` references missing file `src/foo.ts`
- [E002] Drift: `ARCHITECTURE.md` documents Redux, code uses Zustand

### Warnings (should review)

- [W001] Size: `CLAUDE.md` has 245 instructions (recommended: 150-200)
- [W002] Structure: `AGENTS.md` missing recommended WHAT/WHY/HOW sections
- [W003] Staleness: `README.md` last modified 45 days ago (12 commits since)
- [W004] Gap: `@tanstack/query` not documented in ARCHITECTURE.md

### Code Quality

**Architecture:**

- Circular dependencies: [None / show cycle path]
- Layer violations: [None / show invalid import]

**Dead Code:**

- Fixed by knip: [list of auto-fixed items]

**Duplication:**

- Clone count: X (Y% of codebase)

**Outdated Packages:**

- [list or "all up to date"]

**Test Quality:**

- Files reviewed: N
- Issues: [None / list by severity]

---

### Summary

```
Errors: N | Warnings: N | Passed: N

[Audit passed | Audit passed with warnings | Audit failed]
```
