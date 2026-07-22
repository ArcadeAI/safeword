---
name: audit
description: Run comprehensive code audit for architecture, dead code, and test
  quality. Use when reviewing overall codebase health, checking for
  architectural violations, or before marking a feature complete.
---

# Audit

Run a comprehensive code audit. Execute checks and report results by severity.

**Reviewer class:** _class-2 — independent observation_: every check confirms an observable fact, so no cross-model reviewer applies. Judging whether the architecture is _sound_ is not audit's job — that lives in the Architecture Review Gate (`ARCHITECTURE.md`) and `quality-review`.

## Invocation log

This skill is required at the feature-ticket done-gate (ticket 147). The line below appends a current-run entry to `skill-invocations.log` under the project namespace root (`.project/`, or legacy `.safeword-project/` where that exists) so the done-gate hook can verify $safeword:audit was actually invoked. Claude Code expands the `!` line automatically and passes `${CLAUDE_SESSION_ID}` when available. The helper also resolves Claude remote-container ids from the runtime environment, and on Cursor and Codex the pre-shell hook (beforeShellExecution / PreToolUse) bridges the session id to the helper — so on all three runtimes the fallback runs without hand-picking an id. Hand-writing audit results cannot produce this feature-gate proof.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}" || echo "[skill-invocation-log] FAILED - no current-run proof logged"`

If no `[skill-invocation-log] audit ✓` line appears above, run this fallback before continuing:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}"
```

**If the automatic line or fallback prints `[skill-invocation-log] FAILED`, prints `no run identity`, or still does not print `audit ✓`**: Feature tickets must fail closed if no real current-session proof can be logged. Do not mark a feature ticket done or hand-write audit results as a substitute for the feature-gate proof. Report the failure to the user (most likely cause: inline shell execution was denied, the runtime did not expose a usable run identity, or Bun could not run the installed helper) and ask them to resolve it before re-invoking $safeword:audit.

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

# Native manifests may belong to leaf applications rather than the repository
# root. Exclude dependency and virtual-environment trees: their manifests are
# not applications the audit owns and would make the results both noisy and slow.
find_manifest_dirs() {
  find . \
    -type d \( -name .git -o -name node_modules -o -name .venv -o -name vendor \) -prune -o \
    -type f \( "$@" \) -print 2> /dev/null \
    | while IFS= read -r manifest; do dirname "$manifest"; done \
    | LC_ALL=C sort -u
}

PYTHON_PROJECT_DIRS="$(find_manifest_dirs -name pyproject.toml -o -name requirements.txt -o -name setup.py -o -name setup.cfg -o -name Pipfile)"
GO_MODULE_DIRS="$(find_manifest_dirs -name go.mod)"
RUST_CRATE_DIRS="$(find_manifest_dirs -name Cargo.toml)"

# Run Python dead-code checks once per application, not once per toolkit/package.
# Conventional apps/<app>/... manifests collapse to apps/<app>; jobs are one lane.
python_audit_roots() {
  while IFS= read -r project_dir; do
    [ -n "$project_dir" ] || continue
    case "$project_dir" in
      ./apps/*/*) printf '%s\n' "$(printf '%s' "$project_dir" | cut -d/ -f1-3)" ;;
      ./jobs/*) printf '%s\n' './jobs' ;;
      *) printf '%s\n' "$project_dir" ;;
    esac
  done | LC_ALL=C sort -u
}

PYTHON_AUDIT_DIRS="$(printf '%s\n' "$PYTHON_PROJECT_DIRS" | python_audit_roots)"

# Knip resolves a config relative to its current directory. In a monorepo a
# root invocation therefore does not automatically apply apps/*/knip.config.*.
# A root config owns the whole repository; without one, run each leaf config
# from its own directory so its entry/project patterns have their intended scope.
find_knip_configs() {
  find . \
    -type d \( -name .git -o -name node_modules -o -name .venv -o -name vendor \) -prune -o \
    -type f \( -name knip.json -o -name knip.jsonc -o -name .knip.json -o -name .knip.jsonc -o -name knip.ts -o -name knip.js -o -name knip.config.ts -o -name knip.config.js \) -print 2> /dev/null \
    | LC_ALL=C sort
}

root_knip_config() {
  for config in knip.json knip.jsonc .knip.json .knip.jsonc knip.ts knip.js knip.config.ts knip.config.js; do
    [ -f "$config" ] && {
      printf '%s\n' "$config"
      return
    }
  done
}

KNIP_CONFIG_FILES="$(find_knip_configs)"

run_knip_check() {
  root_config="$(root_knip_config)"
  if [ -n "$root_config" ]; then
    echo "Knip — repository root ($root_config)"
    bunx knip --config "$root_config" 2>&1 || true
  elif [ -n "$KNIP_CONFIG_FILES" ]; then
    while IFS= read -r config_path; do
      [ -n "$config_path" ] || continue
      config_dir="$(dirname "$config_path")"
      config_name="$(basename "$config_path")"
      echo "Knip — $config_dir ($config_name)"
      (cd "$config_dir" && bunx knip --config "$config_name" 2>&1 || true)
    done << EOF
$KNIP_CONFIG_FILES
EOF
  else
    echo "Knip — repository root (no workspace config found)"
    bunx knip 2>&1 || true
  fi
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
  project_dir="$1"
  (
    cd "$project_dir" || exit 0
    if [ -f uv.lock ]; then
      uv pip list --outdated 2>&1 || true
    elif [ -f poetry.lock ] || grep -q '^\[tool\.poetry\]' pyproject.toml 2> /dev/null; then
      poetry show --outdated 2>&1 || true
    elif [ -f Pipfile ]; then
      pipenv update --outdated 2>&1 || true
    else
      python -m pip list --outdated 2>&1 || pip list --outdated 2>&1 || true
    fi
  )
}

[ -n "$PYTHON_PROJECT_DIRS" ] || echo "No Python projects found — Python architecture, dead-code, and outdated checks not applicable"
[ -n "$GO_MODULE_DIRS" ] || echo "No Go modules found — Go architecture, dead-code, and outdated checks not applicable"
[ -n "$RUST_CRATE_DIRS" ] || echo "No Rust crates found — Rust architecture, dead-code, and outdated checks not applicable"

# =========================================================================
# DETECT CONFIG DRIFT (read-only — no writes)
# =========================================================================

# 0. Compare generated vs on-disk depcruise config. Non-zero exit = drift.
#    $safeword:audit must never mutate the working tree; surface stale config as W007.
#    Resolve the locally installed safeword CLI first so the check reflects the
#    repo's pinned version, not whatever the npm registry currently calls @latest.
if [ -x node_modules/.bin/safeword ]; then
  SW="node_modules/.bin/safeword"
elif [ -f packages/cli/src/cli.ts ]; then
  SW="bun packages/cli/src/cli.ts"
else SW="bunx safeword"; fi
$SW sync-config --check 2>&1 || echo "[W007] Stale .safeword/depcruise-config.cjs — run \`safeword sync-config\` to refresh and commit"

# Config-drift coverage is JS/TS-only (W005 knip hints, W007 depcruise config).
# Native stacks have no comparable drift check yet — say so instead of letting
# silence read as "no drift" (#831).
([ -n "$PYTHON_PROJECT_DIRS" ] || [ -n "$GO_MODULE_DIRS" ] || [ -n "$RUST_CRATE_DIRS" ]) && echo "Coverage limitation: config-drift checks (W005/W007) cover JS/TS tooling only — native lint configs (ruff.toml, .golangci.yml, Cargo [lints]) are not drift-checked; review them manually."

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

# 1b. Architecture - Python (import-linter). Python does NOT reliably catch cycles
# at runtime — an ImportError fires only when the import order happens to touch a
# not-yet-defined name, so a passing test run is NOT proof of an acyclic import
# graph. import-linter is the static gate, but it is config-driven (it enforces only
# declared contracts, nothing by default), so gate on its config and never force it.
if [ -n "$PYTHON_PROJECT_DIRS" ]; then
  while IFS= read -r project_dir; do
    [ -n "$project_dir" ] || continue
    (
      cd "$project_dir" || exit 0
      if [ -f .importlinter ] || grep -q '^\[importlinter\]' setup.cfg 2> /dev/null || grep -q '^\[tool\.importlinter\]' pyproject.toml 2> /dev/null; then
        if command -v lint-imports > /dev/null 2>&1; then
          lint-imports 2>&1 || true
        else
          echo "Manual evidence required: import-linter contracts found in $project_dir but 'lint-imports' not installed — Python architecture check skipped"
        fi
      else
        echo "Manual evidence required: no import-linter contracts for $project_dir (.importlinter / [tool.importlinter] / setup.cfg [importlinter]) — Python import cycles are NOT statically checked (runtime does not reliably catch them). Add import-linter, or run 'pylint --disable=all --enable=cyclic-import <pkg>' for a config-free heuristic."
      fi
    )
  done << EOF
$PYTHON_PROJECT_DIRS
EOF
fi

# 1c. Architecture - Go. The compiler REJECTS import cycles at build, so a green
# `go build ./...` / `go test ./...` already guarantees an acyclic package graph —
# no separate cycle check exists or is needed. Layer/boundary rules are enforced by
# depguard, which runs INSIDE the golangci-lint pass below when `.golangci.yml`
# configures it — do NOT force-enable it (an unconfigured depguard flags every
# non-stdlib import as a false positive).
if [ -n "$GO_MODULE_DIRS" ]; then
  while IFS= read -r module_dir; do
    [ -n "$module_dir" ] && echo "Go architecture — $module_dir: import cycles are compiler-guaranteed absent (a passing build proves it); boundary contracts run via depguard in the golangci-lint pass when .golangci.yml configures them."
  done << EOF
$GO_MODULE_DIRS
EOF
fi

# 1d. Architecture - Rust. Cargo rejects circular crate deps and rustc forbids
# mutually-recursive modules, so a compiling project cannot contain cycles — no
# check needed. No mature standard tool enforces directional layer boundaries in
# Rust (cargo-modules only visualizes); teams enforce boundaries structurally via
# separate crates + visibility. (cargo-deny covers dependency supply-chain —
# advisories/licenses/bans — a different axis, not architecture.)
if [ -n "$RUST_CRATE_DIRS" ]; then
  while IFS= read -r crate_dir; do
    [ -n "$crate_dir" ] && echo "Rust architecture — $crate_dir: crate/module cycles are compiler-guaranteed absent (a passing build proves it); no standard layer-boundary tool exists — enforce structurally via crates."
  done << EOF
$RUST_CRATE_DIRS
EOF
fi

# =========================================================================
# DEAD CODE DETECTION
# =========================================================================

# 2a. Dead code - TypeScript/JS (knip — read-only, reports unused exports/deps/config hints)
# Leaf Knip configs are executed from their workspace so monorepo audits do not
# silently ignore their entry/project rules.
([ -f package.json ] || [ -n "$KNIP_CONFIG_FILES" ]) && run_knip_check

# 2b. Dead code - Python (deadcode)
# A missing tool must be loud — `|| true` alone would make "not installed"
# read as "no findings".
if [ -n "$PYTHON_AUDIT_DIRS" ]; then
  if command -v deadcode > /dev/null 2>&1; then
    while IFS= read -r project_dir; do
      [ -n "$project_dir" ] || continue
      echo "Python dead-code — $project_dir"
      (cd "$project_dir" && deadcode . 2>&1 || true)
    done << EOF
$PYTHON_AUDIT_DIRS
EOF
  else
    echo "Manual evidence required: deadcode not installed — Python dead-code checks skipped for discovered Python projects"
  fi
fi

# 2c. Dead code - Go (golangci-lint unused)
if [ -n "$GO_MODULE_DIRS" ]; then
  if command -v golangci-lint > /dev/null 2>&1; then
    while IFS= read -r module_dir; do
      [ -n "$module_dir" ] || continue
      echo "Go dead-code — $module_dir"
      (cd "$module_dir" && golangci-lint run --enable unused 2>&1 || true)
    done << EOF
$GO_MODULE_DIRS
EOF
  else
    echo "Manual evidence required: golangci-lint not installed — Go dead-code checks skipped for discovered Go modules"
  fi
fi

# 2d. Rust-specific checks (Clippy catches unused code and quality issues)
# Gate on `cargo-clippy` (the binary `cargo clippy` runs), not `cargo`: clippy
# is a rustup component that can be absent while cargo is on PATH, and `|| true`
# would otherwise swallow its failure into a false "clean" result.
if [ -n "$RUST_CRATE_DIRS" ]; then
  if command -v cargo-clippy > /dev/null 2>&1; then
    while IFS= read -r crate_dir; do
      [ -n "$crate_dir" ] || continue
      echo "Rust clippy — $crate_dir"
      (cd "$crate_dir" && cargo clippy --all-targets --all-features -- -D warnings 2>&1 || true)
    done << EOF
$RUST_CRATE_DIRS
EOF
  else
    echo "Manual evidence required: cargo clippy not available — Rust clippy checks skipped for discovered Rust crates"
  fi
fi

# =========================================================================
# CODE DUPLICATION
# =========================================================================

# 3. Copy/paste detection (all languages). Generated/vendored trees are
# guaranteed clones, so exclude them — findings should be hand-written dupes.
# The ignore list IS the recorded scope (issue #825): `.safeword/**` is a
# parity-enforced byte-mirror of templates (clones by design) and the
# namespace root (`.project/**` / legacy `.safeword-project/**`) is the ticket
# archive — both drown real findings. Keep this list stable so clone counts
# stay comparable across audits.
bunx jscpd . --min-lines 10 --reporters console --ignore "**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/.safeword/**,**/.project/**,**/.safeword-project/**" 2>&1 || true

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
if [ -n "$PYTHON_AUDIT_DIRS" ]; then
  while IFS= read -r project_dir; do
    [ -n "$project_dir" ] || continue
    echo "Python outdated dependencies — $project_dir"
    run_python_outdated_check "$project_dir"
  done << EOF
$PYTHON_AUDIT_DIRS
EOF
fi

# 4c. Outdated - Go-specific checks
if [ -n "$GO_MODULE_DIRS" ]; then
  while IFS= read -r module_dir; do
    [ -n "$module_dir" ] || continue
    echo "Go outdated dependencies — $module_dir"
    (cd "$module_dir" && (go list -m -u all 2>&1 | grep '\[' || echo "All Go modules up to date"))
  done << EOF
$GO_MODULE_DIRS
EOF
fi

# 4d. Outdated - Rust-specific checks
if [ -n "$RUST_CRATE_DIRS" ]; then
  while IFS= read -r crate_dir; do
    [ -n "$crate_dir" ] || continue
    echo "Rust outdated dependencies — $crate_dir"
    (cd "$crate_dir" && cargo update --dry-run 2>&1 || true)
  done << EOF
$RUST_CRATE_DIRS
EOF
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
| Package | Current | Latest | Type | Bump  | Risk |
| ------- | ------- | ------ | ---- | ----- | ---- |
| knip    | 5.86.0  | 5.88.1 | dev  | patch | Low  |
| eslint  | 9.39.4  | 10.0.3 | dev  | major | High |
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
- **jscpd:** record the clone count in the audit summary **with its scope named next to the count** — e.g. `Clones: 416 (8.9%) [repo minus .safeword,.project]` — and compare against the previous audit's recorded count at the SAME scope (last verify.md/audit record, if any). A count whose scope differs from the prior record is a new baseline, not a delta (issue #825: unscoped counts spanning 84→594 proved incomparable). Deltas are the findings; a flat count is the baseline, not a finding. Never report a raw total as if it were new.

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

The criteria are language-neutral; the parenthetical idioms are examples — map them to the project's test framework (Jest/Vitest, pytest, Go `testing`, Rust `#[test]`, …).

| Check                        | Criteria                                                                                                                                                                  | Severity |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Meaningful assertions        | Every test asserts specific values/behavior — not bare existence/truthiness/no-error checks (`toBeTruthy`, bare `assert result`, only `err == nil`, `assert!(x.is_ok())`) | error    |
| Behavior over implementation | Tests assert observable outcomes, not internal state or mock call args                                                                                                    | error    |
| Independence                 | No test depends on another test's side effects; fresh state per test                                                                                                      | error    |
| No arbitrary timeouts        | No sleeps or hardcoded delays (`sleep`, `waitForTimeout`, `time.Sleep`, `thread::sleep`)                                                                                  | error    |
| Edge case coverage           | Tests include error paths and boundary cases, not just happy path                                                                                                         | error    |
| No duplicate tests           | Similar tests use parameterized/table-driven patterns (`it.each`, `pytest.mark.parametrize`, Go table-driven subtests, `rstest`)                                          | error    |
| Test naming                  | Names describe behavior, not implementation ("returns 401 when..." not "works correctly")                                                                                 | error    |

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

**ARCHITECTURE.md (the architecture narrative):**

- Resolve the narrative location first: the `paths.architecture` target in `.safeword/config.json` when set — a file is the narrative itself; a directory holds decision records, read them all — else the root `ARCHITECTURE.md`. A configured location wins outright: do not fall back to a root file the host deliberately moved away from. Every check below applies to the resolved narrative.
- If missing → create from `.safeword/templates/architecture-template.md` (at the configured location when `paths.architecture` is set, else root `ARCHITECTURE.md`)
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

### 6. Namespace Domain Docs

Reconcile the three namespace domain docs — `personas.md`, `surfaces.md`, `glossary.md` — against what the code actually references, and report empty scaffolds. These docs feed the BDD intake flow, so silent rot there degrades every downstream spec. This check is **read-only and class-2** (observable facts only): it reports and offers, it never rewrites a doc. **Run the block below verbatim, as ONE bash invocation.**

```bash
# domain-docs-check — read-only reconciliation of the namespace domain docs.
# Class-2: observable facts only. Emits W008 (empty). Never writes the tree.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}" || exit 1
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"

# Resolve the namespace root (honors config paths.projectRoot in real runs).
# Fall back on directory existence — robust when the resolver hook is absent.
NS_ROOT="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" 2> /dev/null)"
[ -d "$NS_ROOT" ] || {
  if [ -d "$PROJECT_DIR/.project" ]; then NS_ROOT="$PROJECT_DIR/.project"; else NS_ROOT="$PROJECT_DIR/.safeword-project"; fi
}

# Single-source the HTML-comment strip used by every check below. Strips
# same-line comments FIRST (`s/<!--.*-->//g`) then deletes multi-line comment
# blocks (`/<!--/,/-->/d`): a POSIX range alone would treat a lone `<!-- x -->`
# as an unclosed range and wipe every following line to EOF.
# Line-based limitation (accepted): a `## ` heading that shares its line with a
# multi-line comment OPENER (`## Foo <!-- note` … `-->`) is deleted with the
# comment — well-formed markdown keeps headings on their own line, so this never
# bites the real docs; pinned by a test so any change to it stays conscious.
strip_html_comments='s/<!--.*-->//g; /<!--/,/-->/d'

# Count `## ` entries OUTSIDE HTML comments — the scaffold's example headings
# live inside its comment, so a verbatim scaffold counts as zero. Reads the
# named var `dd_file`, NOT positional `$1`: skill/command argument substitution
# clobbers `$1` in the injected block body.
domain_docs_entry_count() {
  sed "$strip_html_comments" "$dd_file" | grep -cE '^## '
}

# --- Emptiness (W008): a domain doc with no uncommented entries ---
for doc in personas surfaces glossary; do
  dd_file="$NS_ROOT/$doc.md"
  [ -f "$dd_file" ] || continue
  if [ "$(domain_docs_entry_count)" -eq 0 ]; then
    echo "[W008] Empty domain doc: $doc.md — fill from packages/cli/templates/$doc-template.md (BDD intake references degrade until filled)"
  fi
done

# --- Surface drift (E008): @surface.<slug> tag referenced but undefined ---
# Suppressed when surfaces.md is empty/absent — W008 already says "fill it".
# Use the CLI's shared resolver: root, workspace, and configured feature lanes
# must stay aligned with executable Gherkin discovery. Match the pinned-CLI
# ladder used by the config-drift check above.
feature_directories() {
  if [ -x "$PROJECT_DIR/node_modules/.bin/safeword" ]; then
    "$PROJECT_DIR/node_modules/.bin/safeword" feature-directories
  elif [ -f "$PROJECT_DIR/packages/cli/src/cli.ts" ]; then
    bun "$PROJECT_DIR/packages/cli/src/cli.ts" feature-directories
  elif command -v bunx > /dev/null 2>&1; then
    bunx safeword feature-directories
  else
    return 127
  fi
}
if ! FEATURE_DIRECTORIES="$(feature_directories 2> /dev/null)"; then
  echo "[W009] Feature-directory resolver unavailable; E008 scanned root features/ only"
  FEATURE_DIRECTORIES="$PROJECT_DIR/features"
fi
surfaces_file="$NS_ROOT/surfaces.md"
dd_file="$surfaces_file"
if [ -f "$surfaces_file" ] && [ "$(domain_docs_entry_count)" -gt 0 ] && [ -n "$FEATURE_DIRECTORIES" ]; then
  # Defined slugs: slugify each uncommented `## ` heading. Portable casing via
  # `tr` — BSD/macOS sed lacks `\L`.
  defined_slugs="$(sed "$strip_html_comments" "$surfaces_file" | grep -E '^## ' | sed 's/^## //' \
    | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9][^a-z0-9]*/-/g; s/^-//; s/-$//')"
  # Referenced slugs: @surface.<slug> on Gherkin tag lines only (line starts
  # with @), so a slug mentioned in step prose is not a reference.
  referenced_slugs="$(printf '%s\n' "$FEATURE_DIRECTORIES" | while IFS= read -r features_directory; do
    [ -d "$features_directory" ] && grep -rhE '^[[:space:]]*@' "$features_directory" 2> /dev/null
  done | grep -oE '@surface\.[a-z0-9-]+' | sed 's/^@surface\.//' | sort -u)"
  for slug in $referenced_slugs; do
    if ! printf '%s\n' $defined_slugs | grep -qxF "$slug"; then
      echo "[E008] Surface drift: @surface.$slug referenced in features/ but no matching entry in surfaces.md"
    fi
  done
fi

# --- Persona drift (E009): spec **Persona:** code referenced but undefined ---
# Spec lines only, comment-stripped (feature lineage tags carry ticket-ids, not
# personas). Suppressed when personas.md is empty/absent.
personas_file="$NS_ROOT/personas.md"
tickets_dir="$NS_ROOT/tickets"
dd_file="$personas_file"
if [ -f "$personas_file" ] && [ "$(domain_docs_entry_count)" -gt 0 ] && [ -d "$tickets_dir" ]; then
  # Defined codes: explicit trailing `## Name (CODE)` wins; else derived
  # best-effort (multi-word -> initials, single -> first two chars, uppercased).
  # Derivation is naive (particles/hyphens mis-derive, e.g. Site-Reliability
  # Engineer -> SE not SRE), and codes are the project's `[A-Z][A-Z0-9]{1,5}`
  # (>=2 chars) — prefer the explicit `(CODE)` heading, which `safeword check`
  # writes, to avoid a spurious E009.
  defined_codes="$(sed "$strip_html_comments" "$personas_file" | grep -E '^## ' | while IFS= read -r heading; do
    name="${heading#\#\# }"
    # Trailing-whitespace-tolerant so `## Name (CODE)` still reads explicitly
    # after a stripped inline comment left a trailing space; capture only the code.
    explicit="$(printf '%s' "$name" | sed -nE 's/.*\(([A-Z][A-Z0-9]{1,5})\)[[:space:]]*$/\1/p')"
    if [ -n "$explicit" ]; then
      printf '%s\n' "$explicit"
      continue
    fi
    base="${name%% (*}"
    if [ "$(printf '%s' "$base" | wc -w | tr -d ' ')" -ge 2 ]; then
      printf '%s' "$base" | awk '{s="";for(i=1;i<=NF;i++)s=s toupper(substr($i,1,1));print s}'
    else
      printf '%s' "$base" | cut -c1-2 | tr '[:lower:]' '[:upper:]'
    fi
  done)"
  # Referenced codes: (CODE) from spec **Persona:** lines, comments stripped.
  referenced_codes="$(for spec in "$tickets_dir"/*/spec.md; do
    [ -f "$spec" ] && sed "$strip_html_comments" "$spec"
  done 2> /dev/null | grep -E '^\*\*Persona:\*\*' | grep -oE '\([A-Z][A-Z0-9]{1,5}\)' | tr -d '()' | sort -u)"
  for code in $referenced_codes; do
    if ! printf '%s\n' $defined_codes | grep -qxF "$code"; then
      echo "[E009] Persona drift: code $code referenced in a spec but no matching entry in personas.md"
    fi
  done
fi
```

**Content is human-owned — advisory only, never an error.** This check judges _references_ (a slug/code that is or isn't defined) and _emptiness_ — observable facts. Whether a glossary term's meaning, or a persona/surface _description_, is still accurate is a human judgment: raise it as an advisory note at most, never as an error code. Only the three codes above (E008, E009, W008) are emitted here.

**Empty-doc offer (W008):** report the empty doc and point the user to its template — do **not** draft entries or write the file during the audit pass (read-only). Filling it is a follow-up the user approves.

**Coverage limitation:** the block reads the default namespace-root locations; per-file `paths.personas` / `paths.surfaces` / `paths.glossary` overrides are validated by `safeword check` (structure), not here. If the safeword feature-directory resolver is unavailable, W009 says E008 fell back to root `features/` only. Persona drift reads spec `**Persona:**` lines only — feature lineage tags are not a reliable persona source.

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
- [E008] Surface drift: `@surface.safeword-cli` is referenced in `features/` but has no matching entry in `surfaces.md`
- [E009] Persona drift: persona code `DEV` is named in a spec `**Persona:**` line but has no matching entry in `personas.md`

### Warnings (should review)

- [W001] Size: `CLAUDE.md` has 245 instructions (recommended: 150-200)
- [W002] Structure: `AGENTS.md` missing recommended WHAT/WHY/HOW sections
- [W003] Staleness: `README.md` last modified 45 days ago (12 commits since)
- [W005] Stale config: `knip.json` — `lodash` can be removed from ignoreDependencies
- [W006] Learning file missing Covers: — `<namespace-root>/learnings/foo.md` (absent from INDEX.md)
- [W007] Stale .safeword/depcruise-config.cjs — run `safeword sync-config` to refresh and commit
- [W008] Empty domain doc: `surfaces.md` has no uncommented entries — fill from its template (BDD intake references degrade until filled)
- [W009] Feature-directory resolver unavailable — E008 scanned root `features/` only

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
