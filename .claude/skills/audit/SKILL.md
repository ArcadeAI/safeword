---
name: audit
description: Run comprehensive code audit for architecture, dead code, and test
  quality. Use when reviewing overall codebase health, checking for architectural
  violations, or before marking a feature complete.
allowed-tools: '*'
---

# Audit

Run a comprehensive code audit. Execute checks and report results by severity.

**Reviewer class:** _class-2 — independent observation_ (PRINCIPLES.md §1): every check confirms an observable fact, so no cross-model reviewer applies. Judging whether the architecture is _sound_ is not audit's job — that lives in the Architecture Review Gate (`ARCHITECTURE.md`) and `quality-review`.

## Invocation log

This skill is required at the feature-ticket done-gate (ticket 147). The line below appends a current-run entry to `skill-invocations.log` under the project namespace root (`.project/`, or legacy `.safeword-project/` where that exists) so the done-gate hook can verify /audit was actually invoked. Claude Code expands the `!` line automatically and passes `${CLAUDE_SESSION_ID}` when available. The helper also resolves Claude remote-container ids from the runtime environment, and on Cursor and Codex the pre-shell hook (beforeShellExecution / PreToolUse) bridges the session id to the helper — so on all three runtimes the fallback runs without hand-picking an id. Hand-writing audit results cannot produce this feature-gate proof.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}" || echo "[skill-invocation-log] FAILED - no current-run proof logged"`

If no `[skill-invocation-log] audit ✓` line appears above, run this fallback before continuing:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}"
```

**If the automatic line or fallback prints `[skill-invocation-log] FAILED`, prints `no run identity`, or still does not print `audit ✓`**: Feature tickets must fail closed if no real current-session proof can be logged. Do not mark a feature ticket done or hand-write audit results as a substitute for the feature-gate proof. Report the failure to the user (most likely cause: inline shell execution was denied, the runtime did not expose a usable run identity, or Bun could not run the installed helper) and ask them to resolve it before re-invoking /audit.

Task, patch, and no-ticket audit work may continue after recording that session-scoped proof was unavailable and not required by the gate.

## Instructions

### 1. Code Quality Checks

**Run the block below verbatim, as ONE bash invocation.** Do not extract or paraphrase individual commands — the manifest gates, package-manager routing, and tool-absence messages are load-bearing, and a hand-rolled subset silently skips whole check families.

```bash
# Ensure we're in the project root regardless of prior CWD state
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}" || exit 1

# Stack-specific checks are gated by project manifests. A package.json may be a
# safeword lane host in Python, Rust, or Go installs, so JavaScript checks run
# from package.json evidence while native stack checks run independently.
# JavaScript-specific checks still run only when package.json exists; skip
# JavaScript checks for projects without package.json evidence.

# Detect package manager from lockfiles/packageManager for JavaScript package commands.
detect_package_manager() {
  if [ -f bun.lock ] || [ -f bun.lockb ]; then
    echo bun
    return
  fi
  if [ -f pnpm-lock.yaml ]; then
    echo pnpm
    return
  fi
  if [ -f yarn.lock ]; then
    echo yarn
    return
  fi
  if [ -f package-lock.json ]; then
    echo npm
    return
  fi
  node -e 'try { const pm = JSON.parse(require("fs").readFileSync("package.json", "utf8")).packageManager || ""; console.log(pm.split("@")[0] || "npm"); } catch { console.log("npm"); }'
}

has_python_project() {
  [ -f pyproject.toml ] || [ -f requirements.txt ] || [ -f setup.py ] || [ -f setup.cfg ] || [ -f Pipfile ]
}

has_go_project() {
  [ -f go.mod ]
}

has_rust_project() {
  [ -f Cargo.toml ]
}

run_yarn_outdated_check() {
  YARN_VERSION="$(yarn --version 2> /dev/null || true)"
  case "$YARN_VERSION" in
    0.* | 1.*)
      echo "Yarn Classic outdated check: running yarn outdated"
      yarn outdated 2>&1 || true
      ;;
    "")
      echo "Manual evidence required: yarn.lock found but yarn is unavailable; cannot check outdated JavaScript dependencies."
      ;;
    *)
      echo "Yarn modern detected. Manual evidence required: modern Yarn does not provide the Yarn Classic noninteractive 'yarn outdated' command; review dependency freshness with 'yarn upgrade-interactive' or project CI evidence."
      ;;
  esac
}

run_python_outdated_check() {
  if [ -f uv.lock ]; then
    uv pip list --outdated 2>&1 || true
  elif [ -f poetry.lock ] || grep -q '^\[tool\.poetry\]' pyproject.toml 2> /dev/null; then
    poetry show --outdated 2>&1 || true
  elif [ -f Pipfile ]; then
    pipenv update --outdated 2>&1 || true
  else
    python -m pip list --outdated 2>&1 || pip list --outdated 2>&1 || true
  fi
}

# =========================================================================
# DETECT CONFIG DRIFT (read-only — no writes)
# =========================================================================

# 0. Compare generated vs on-disk depcruise config. Non-zero exit = drift.
#    /audit must never mutate the working tree; surface stale config as W007.
#    Resolve the locally installed safeword CLI first so the check reflects the
#    repo's pinned version, not whatever the npm registry currently calls @latest.
if [ -x node_modules/.bin/safeword ]; then
  SW="node_modules/.bin/safeword"
elif [ -f packages/cli/src/cli.ts ]; then
  SW="bun packages/cli/src/cli.ts"
else SW="bunx safeword"; fi
$SW sync-config --check 2>&1 || echo "[W007] Stale .safeword/depcruise-config.cjs — run \`safeword sync-config\` to refresh and commit"

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
# Note: Cargo validates Rust module/package structure during build and test.
# Clippy runs below as Rust-specific static analysis when available.

# =========================================================================
# DEAD CODE DETECTION
# =========================================================================

# 2a. Dead code - TypeScript/JS (knip — read-only, reports unused exports/deps/config hints)
[ -f package.json ] && {
  bunx knip 2>&1 || true
}

# 2b. Dead code - Python (deadcode)
# A missing tool must be loud — `|| true` alone would make "not installed"
# read as "no findings".
([ -f pyproject.toml ] || [ -f requirements.txt ]) && {
  if command -v deadcode > /dev/null 2>&1; then
    deadcode . 2>&1 || true
  else
    echo "Manual evidence required: deadcode not installed — Python dead-code check skipped"
  fi
}

# 2c. Dead code - Go (golangci-lint unused)
[ -f go.mod ] && {
  if command -v golangci-lint > /dev/null 2>&1; then
    golangci-lint run --enable unused --out-format colored-line-number 2>&1 || true
  else
    echo "Manual evidence required: golangci-lint not installed — Go dead-code check skipped"
  fi
}

# 2d. Rust-specific checks (Clippy catches unused code and quality issues)
[ -f Cargo.toml ] && {
  if command -v cargo > /dev/null 2>&1; then
    cargo clippy --all-targets --all-features -- -D warnings 2>&1 || true
  else
    echo "Manual evidence required: cargo not installed — Rust clippy check skipped"
  fi
}

# =========================================================================
# CODE DUPLICATION
# =========================================================================

# 3. Copy/paste detection (all languages). Generated/vendored trees are
# guaranteed clones, so exclude them — findings should be hand-written dupes.
bunx jscpd . --min-lines 10 --reporters console --ignore "**/node_modules/**,**/dist/**,**/build/**,**/coverage/**" 2>&1 || true

# =========================================================================
# OUTDATED DEPENDENCIES
# =========================================================================

# 4a. Outdated - TypeScript/JS
[ -f package.json ] && {
  case "$(detect_package_manager)" in
    bun) bun outdated 2>&1 || true ;;
    npm) npm outdated 2>&1 || true ;;
    pnpm) pnpm outdated 2>&1 || true ;;
    yarn) run_yarn_outdated_check ;;
    *) echo "Skipping outdated JavaScript dependencies: unsupported package manager" ;;
  esac
} || echo "Skipping outdated JavaScript dependencies: no package.json; skip JavaScript package checks"

# 4b. Outdated - Python-specific checks (uv > poetry > pipenv > pip)
if has_python_project; then
  run_python_outdated_check
fi

# 4c. Outdated - Go-specific checks
if has_go_project; then
  go list -m -u all 2>&1 | grep '\[' || echo "All Go modules up to date"
fi

# 4d. Outdated - Rust-specific checks
if has_rust_project; then
  cargo update --dry-run 2>&1 || true
fi
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

#### Findings triage — baselines, not re-litigation

- **Knip:** `knip.json`'s ignore lists ARE the accepted-false-positive baseline — persist confirmed FPs there instead of re-triaging them every run (W005 flags any entry that goes stale, so the baseline self-cleans). Report only findings not already covered by the ignore lists.
- **jscpd:** record the clone count in the audit summary and compare against the previous audit's recorded count (last verify.md/audit record, if any). Deltas are the findings; a flat count is the baseline, not a finding. Never report a raw total as if it were new.

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
| Behavior over implementation | Tests assert observable outcomes, not internal state or mock call args                                  | error    |
| Independence                 | No test depends on another test's side effects; fresh state per test                                    | error    |
| No arbitrary timeouts        | No `sleep()`, `waitForTimeout()`, or hardcoded delays                                                   | error    |
| Edge case coverage           | Tests include error paths and boundary cases, not just happy path                                       | error    |
| No duplicate tests           | Similar tests use parameterized/table-driven patterns (`it.each`)                                       | error    |
| Test naming                  | Names describe behavior, not implementation ("returns 401 when..." not "works correctly")               | error    |

**Report format:**

```text
Test Quality:
- Files reviewed: N
- Issues found: N (E errors)
- [E] file.test.ts:42 — Weak assertion: `expect(result).toBeTruthy()` → assert specific value
- [E] file.test.ts:15 — Shared mutable state: `user` modified across tests
- [E] file.test.ts — Happy-path only: no error case tests for `processOrder()`
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
- If exists → check for drift and gaps along TWO axes — dependency drift (what tech) and structural drift (what modules/layers):
  - **Dependency drift:**
    - **Drift (error):** Documented tech contradicts the code's actual dependencies (e.g., doc says "Redux" but `package.json` has "zustand"; doc says "Flask" but `pyproject.toml` has "fastapi")
    - **Gap (error):** Major dependencies not documented
  - **Structural drift** — reconcile ARCHITECTURE.md's STRUCTURAL claims against `architecture.generated.md`, the deterministic, always-fresh module/package map (kept current by the architecture hooks). Read the generated doc as ground truth — NOT `package.json`:
    - Read the namespace-root `architecture.generated.md` (resolve the namespace root the same way as other audit checks; default `.project/`). Its `### <name>` headings under `## Modules` (single-repo) or `## Packages` (monorepo) ARE the project's real top-level units. This machine list is the source of structural truth, so the verdict is deterministic-by-reading, not guessed.
    - **Orphaned (error):** ARCHITECTURE.md documents a module/layer — including a layer→directory mapping in its "Layers & Boundaries" table — that no longer appears in the generated map (renamed or removed).
    - **Missing (error):** A real top-level module/package in the generated map that ARCHITECTURE.md never mentions.
    - **Drifted layer→dir (error):** A "Layers & Boundaries" `directory` entry that matches no module path in the generated map.
    - **Report only — never auto-overwrite prose.** Cite the generated-doc evidence and propose narrative edits for the user to review; the human "why" is human-owned, and only a person can judge whether a paragraph is still true. The deterministic structural facts come from reading the generated doc; the narrative judgment stays with the human/agent.
  - A monorepo `## Coverage gaps` advisory in the generated doc (a present-but-unparseable workspace manager, #558) is itself a coverage limitation — note it so the structural reconciliation isn't mistaken for complete.

**README.md:**

- Check staleness (last modified vs recent commits)

**Docs site (if exists):**

- Detect `docs/`, `documentation/` with Starlight/Docusaurus/etc config
- Check staleness of docs content

**Documentation impact check:**

Review recent commits (since last tag or last 20 commits). For each significantly changed area, check if related docs, readmes, or guides across the project need updating. Flag stale, missing, or contradictory impacted documentation as errors. Documentation drift is never a warning; only date-based staleness with no changed-code contradiction stays a warning.

---

## Report Format

Report findings by severity with codes:

### Errors (must fix)

- [E001] Dead ref: `CLAUDE.md` references missing file `src/foo.ts`
- [E002] Drift: `ARCHITECTURE.md` documents Redux, code uses Zustand
- [E003] Structural drift: `ARCHITECTURE.md` documents module `legacy-sync` — absent from `architecture.generated.md` (orphaned; renamed or removed)
- [E004] Documentation drift: Codex Stop hook behavior changed, but `README.md` or docs still describe only PreToolUse coverage
- [E005] Dependency gap: `@tanstack/query` is a major dependency but is not documented in ARCHITECTURE.md
- [E006] Structural gap: module `billing` in `architecture.generated.md` is not documented in `ARCHITECTURE.md` (missing)
- [E007] Drifted layer→dir: `ARCHITECTURE.md` maps `domain` → `src/core/` but no such module path is in `architecture.generated.md`

### Warnings (should review)

- [W001] Size: `CLAUDE.md` has 245 instructions (recommended: 150-200)
- [W002] Structure: `AGENTS.md` missing recommended WHAT/WHY/HOW sections
- [W003] Staleness: `README.md` last modified 45 days ago (12 commits since)
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

- Clone count: X (Y% of codebase; delta vs previous audit: +N/-N/flat)

**Outdated Packages:** the table + per-tier verdict from "Outdated Package Triage" above (or `✅ All packages up to date`).

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

Close with the `**Next:**` line even on a clean pass — name the immediate move (commit, mark ticket done, open a follow-up for warnings) so the reader isn't left guessing which finding to start with (the stop hook reads it for the re-entry brief).

**Voice:** plainspoken and concise — write to be scanned.
