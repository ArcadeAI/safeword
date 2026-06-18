---
name: audit
description: Run comprehensive code audit for architecture, dead code, and test
  quality. Use when reviewing overall codebase health, checking for architectural
  violations, or before marking a feature complete.
allowed-tools: '*'
---

# Audit

Run a comprehensive code audit. Execute checks and report results by severity.

## Invocation log

This skill is required at the feature-ticket done-gate (ticket 147). The line below appends a session-scoped entry to `skill-invocations.log` under the project namespace root (`.project/`, or legacy `.safeword-project/` where that exists) so the done-gate hook can verify /audit was actually invoked. Claude Code expands the `!` line automatically and substitutes `${CLAUDE_SESSION_ID}` for session binding. Codex and Cursor docs do not document Claude-style `!` expansion or `${CLAUDE_SESSION_ID}` substitution, so the fallback below is explicit. Hand-writing audit results cannot produce this feature-gate proof.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID}" || echo "[skill-invocation-log] FAILED - no session-scoped proof logged"`

If no `[skill-invocation-log] audit ✓` line appears above, run this fallback before continuing:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}"
```

**If the automatic line or fallback prints `[skill-invocation-log] FAILED`, prints `no session id` (non-Claude runtime with no session binding), or still does not print `audit ✓`**: Feature tickets must fail closed if no real current-session proof can be logged. Do not mark a feature ticket done or hand-write audit results as a substitute for the feature-gate proof. Report the failure to the user (most likely cause: inline shell execution was denied, the client lacks a compatible session id, or Bun could not run the installed helper) and ask them to resolve it before re-invoking /audit.

Task, patch, and no-ticket audit work may continue after recording that session-scoped proof was unavailable and not required by the gate.

## Instructions

### 1. Code Quality Checks

```bash
# Ensure we're in the project root regardless of prior CWD state
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}" || exit 1

# =========================================================================
# DETECT CONFIG DRIFT (read-only — no writes)
# =========================================================================

# 0. Compare generated vs on-disk depcruise config. Non-zero exit = drift.
#    /audit must never mutate the working tree; surface stale config as W007.
bunx safeword@latest sync-config --check 2>&1 || echo "[W007] Stale .safeword/depcruise-config.cjs — run \`safeword sync-config\` to refresh and commit"

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

# 1d. Architecture - Rust
# Note: Rust's module system and compiler reject circular module dependencies at
# build time. If your crate builds, it has no circular module dependencies.

# =========================================================================
# DEAD CODE DETECTION
# =========================================================================

# 2a. Dead code - TypeScript/JS (knip — read-only, reports unused exports/deps/config hints)
[ -f package.json ] && {
  bunx knip 2>&1 || true
}

# 2b. Dead code - Python (deadcode)
([ -f pyproject.toml ] || [ -f requirements.txt ]) && {
  deadcode . 2>&1 || true
}

# 2c. Dead code - Go (golangci-lint unused)
[ -f go.mod ] && {
  golangci-lint run --enable unused --out-format colored-line-number 2>&1 || true
}

# 2d. Dead code - Rust (clippy flags dead_code / unused)
[ -f Cargo.toml ] && command -v cargo > /dev/null && {
  cargo clippy --quiet 2>&1 || true
}

# =========================================================================
# CODE DUPLICATION
# =========================================================================

# 3. Copy/paste detection (all languages)
bunx jscpd . --min-lines 10 --reporters console 2>&1 || true

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

# 4d. Outdated - Rust (requires cargo-outdated)
[ -f Cargo.toml ] && {
  if command -v cargo-outdated > /dev/null; then
    cargo outdated 2>&1 || true
  else echo "Rust outdated check skipped — install with: cargo install cargo-outdated"; fi
}
```

#### Outdated Package Triage

After running the outdated checks above, **classify each outdated package** using this matrix:

| Dep Type | Bump      | Risk   | Action                                                 |
| -------- | --------- | ------ | ------------------------------------------------------ |
| dev      | patch     | Low    | Safe to update now                                     |
| dev      | minor     | Low    | Safe to update now                                     |
| prod     | patch     | Low    | Safe to update — run tests after                       |
| prod     | minor     | Medium | Review changelog, then update                          |
| dev      | major     | Medium | Research breaking changes, may need config updates     |
| prod     | major     | High   | Defer to dedicated task — investigate migration path   |
| any      | 0.x minor | Medium | Treat as major (semver allows breaking changes in 0.x) |

Present results as a structured table:

```text
| Package | Current | Latest | Type | Bump | Risk |
|---------|---------|--------|------|------|------|
| knip | 5.86.0 | 5.88.1 | dev | patch | Low |
| eslint | 9.39.4 | 10.0.3 | dev | major | High |
```

Then give a **verdict per risk tier**:

- **Low risk:** "Safe to update now — dev-only tools, patch/minor bumps"
- **Medium risk:** "Review changelogs before updating" (list specific packages)
- **High risk:** "Defer to dedicated task — major version bumps need migration research" (list specific packages)

If all packages are up to date, report: `✅ All packages up to date`

#### Knip Configuration Hints (W005)

Check the knip output above for "Configuration hints" lines. If knip reports **configuration hints** (unused entries in `ignoreDependencies`, `ignoreBinaries`, `ignoreUnresolved`, or `ignoreWorkspaces`), flag each as:

```text
- [W005] Stale config: `knip.json` — `{entry}` can be removed from {list}
```

These mean the ignore override no longer matches anything knip would flag — the suppression is dead config. Cleaning them up reduces noise for future readers.

If no configuration hints are found, skip this section.

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

**Research sources:**

- [Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Cursor Docs](https://cursor.com/docs/context/rules)

### 3. Learning Files Check

Project learnings in the resolved namespace root's `learnings/*.md` must have a `Covers:` line on line 3 — the auto-generated `INDEX.md` is built from these lines, and files without them don't appear in the index.

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
NS_ROOT="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR")"
if [ -d "$NS_ROOT/learnings" ]; then
  for f in "$NS_ROOT"/learnings/*.md; do
    [ -e "$f" ] || continue
    [ "$(basename "$f")" = "INDEX.md" ] && continue
    line3=$(sed -n '3p' "$f")
    case "$line3" in
      Covers:*) ;;
      *) echo "[W006] Missing Covers: line on line 3 — $f" ;;
    esac
  done
fi
```

Flag each non-conforming file as:

```text
- [W006] Learning file missing Covers: — `{path}` (absent from INDEX.md)
```

If all files conform, skip this section.

### 4. Test Quality Review

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

### 5. Project Documentation Checks

**Docs source inventory:**

- Read `.safeword/config.json` first. If top-level `docs.sources` exists, treat it as the authoritative documentation inventory:
  - `{ "type": "local", "path": "..." }` — inspect that file or directory. Relative paths resolve from the project root.
  - `{ "type": "url", "url": "..." }` — fetch the page/site when browsing or network access is available. If unavailable, report it under coverage limitations.
  - `{ "type": "git", "repo": "...", "path": "..." }` — inspect the repo/path when it is already available or can be fetched without credentials. If unavailable, report it under coverage limitations.
- If `docs.sources` is absent, prompt the user: "Where should audit look for project documentation? I can add local paths, URLs, git repos, or set `docs.sources: []` to keep fallback discovery and stop asking." Wait for the answer before continuing unless the run is explicitly autonomous; in autonomous runs, use fallback discovery and report that no decision was recorded.
- If the user chooses not to configure documentation sources, write `docs.sources: []` in `.safeword/config.json`. Treat that explicit empty list as a durable no-prompt decision in future audits.
- If `docs.sources: []` is configured, do not prompt. Fall back to local discovery: `README.md`, `docs/`, `documentation/`, package docs folders, and known docs-site configs.
- Always report docs coverage: configured vs fallback, sources checked, and sources skipped.

**ARCHITECTURE.md:**

- If missing → create from `.safeword/templates/architecture-template.md`
- If exists → check for drift and gaps:
  - **Drift (error):** Documented tech contradicts the code's actual dependencies (e.g., doc says "Redux" but `package.json` has "zustand"; doc says "Flask" but `pyproject.toml` has "fastapi")
  - **Gap (warn):** Major dependencies not documented

**README.md:**

- Check staleness (last modified vs recent commits)

**Docs site (if exists):**

- Detect `docs/`, `documentation/` with Starlight/Docusaurus/etc config
- Check staleness of docs content

**Documentation impact check:**

Review recent commits (since last tag or last 20 commits). For each significantly changed area, check if related docs, readmes, or guides across the project need updating. Flag any documentation that references changed code but hasn't been updated.

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
- [W005] Stale config: `knip.json` — `lodash` can be removed from ignoreDependencies
- [W006] Learning file missing Covers: — `<namespace-root>/learnings/foo.md` (absent from INDEX.md)
- [W007] Stale .safeword/depcruise-config.cjs — run `safeword sync-config` to refresh and commit

### Code Quality

**Architecture:**

- Circular dependencies: [None / show cycle path]
- Layer violations: [None / show invalid import]

**Dead Code:**

- Knip findings: [list unused items to review — verify before removing, knip cannot see packages consumed via Astro/Vite/Wrangler config]

**Duplication:**

- Clone count: X (Y% of codebase)

**Outdated Packages:**

| Package | Current | Latest | Type | Bump | Risk |
| ------- | ------- | ------ | ---- | ---- | ---- |
| ...     | ...     | ...    | ...  | ...  | ...  |

(or `✅ All packages up to date` if none outdated)

**Verdict:**

- ✅ **Low risk (N):** Safe to update now — [summary]
- ⚠️ **Medium risk (N):** Review changelogs — [list packages]
- 🔴 **High risk (N):** Defer to dedicated task — [list packages]

**Test Quality:**

- Files reviewed: N
- Issues: [None / list by severity]

---

### Summary

```
Errors: N | Warnings: N | Passed: N

[Audit passed | Audit passed with warnings | Audit failed]

**Next:** [imperative — which fix to start, which package to upgrade, which file to update].
```

The `**Next:**` line is required, even on a clean pass. Name the immediate move (commit, mark ticket done, open a follow-up ticket for the warnings). A verdict without a concrete next action is incomplete — don't leave the user to guess which finding to address first.

**Voice:** plainspoken and concise — write to be scanned.
