---
name: audit
description: Run a diff-scoped code audit for architecture, dead code, and test
  quality. Uses the change from main to focus feature reviews; request a
  repository audit for whole-codebase discovery.
allowed-tools: '*'
---

# Audit

Run a diff-scoped code audit. Execute checks and report results by severity.

**Reviewer class:** _class-2 — independent observation_: every check confirms an observable fact, so no cross-model reviewer applies. Judging whether the architecture is _sound_ is not audit's job — that lives in the Architecture Review Gate (`ARCHITECTURE.md`) and `quality-review`.

## Invocation log

This skill is required before marking a feature ticket done. The line below appends a current-run entry to `skill-invocations.log` under the project namespace root (`.project/`, or legacy `.safeword-project/` where that exists) so the done-gate hook can verify /audit was actually invoked. Claude Code expands the `!` line automatically and passes `${CLAUDE_SESSION_ID}` when available. The helper also resolves Claude remote-container ids from the runtime environment, and on Cursor and Codex the pre-shell hook (beforeShellExecution / PreToolUse) bridges the session id to the helper — so on all three runtimes the fallback runs without hand-picking an id. Hand-writing audit results cannot produce this feature-gate proof.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}" || echo "[skill-invocation-log] FAILED - no current-run proof logged"`

If no `[skill-invocation-log] audit ✓` line appears above, run this fallback before continuing:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" audit "${CLAUDE_SESSION_ID:-}"
```

**If the automatic line or fallback prints `[skill-invocation-log] FAILED`, prints `no run identity`, or still does not print `audit ✓`**: a feature ticket can't be marked done without this proof — don't hand-write audit results as a substitute. Report the failure to the user (most likely cause: inline shell execution was denied, the runtime did not expose a usable run identity, or Bun could not run the installed helper) and ask them to resolve it before re-invoking /audit.

For task, patch, or no-ticket work, this proof isn't required — note it's missing and continue.

## Scope

Default to the current working tree's change from `origin/main`, falling back to
local `main`. The shared scope helper prints its exact merge-base SHA and changed
files. Treat that printed list as the audit boundary for every review below.

- Review changed source, tests, agent configuration, documentation, and learning
  files; follow direct references from them when a missing reference could make
  the change invalid.
- Deleted and type-changed paths are evidence for broken-reference review,
  never analyzer inputs. The helper prints them under `Reference review scope`.
- Whole-workspace Knip, repository clone totals, and dependency-freshness
  discovery are intentionally skipped in this mode because their pre-existing
  findings are noise for a feature diff.

Run a **repository audit** only when the user explicitly asks for a full,
repository-wide, or baseline audit, or when neither `origin/main` nor `main`
exists. In that mode retain the prior whole-project checks and report the mode
prominently. Do not silently widen a Git-aware diff audit.

For an explicit repository audit, set `AUDIT_SCOPE_REQUEST=repository` in the
environment of **every executable audit block** below. That is what widens code,
agent configuration, learnings, tests, documentation, and domain docs together.
Leave the variable unset for the default diff audit; do not edit the blocks'
commands.

## Instructions

### 1. Code Quality Checks

**Run the block below verbatim, as ONE bash invocation.** Do not extract or paraphrase individual commands — the manifest gates, package-manager routing, and tool-absence messages are load-bearing, and a hand-rolled subset silently skips whole check families.

```bash
# Ensure we're in the project root regardless of prior CWD state, then load the
# same scope contract every executable audit block uses.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
cd "$PROJECT_DIR" || exit 1
source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"
audit_scope_initialize "$PROJECT_DIR"
audit_scope_print

AUDIT_HAS_JS_CHANGE=false
AUDIT_HAS_PYTHON_CHANGE=false
AUDIT_HAS_GO_CHANGE=false
AUDIT_HAS_RUST_CHANGE=false
if [ "$AUDIT_SCOPE_MODE" = "diff" ]; then
  audit_scope_has_path_matching '(^|/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|knip(\.config)?\.(json|jsonc|js|ts)|\.knip\.jsonc?|\.dependency-cruiser\.(cjs|js|mjs|json))$|\.(cjs|cts|js|jsx|mjs|mts|ts|tsx|vue|svelte)$' && AUDIT_HAS_JS_CHANGE=true
  audit_scope_has_path_matching '(^|/)(pyproject\.toml|requirements\.txt|setup\.py|setup\.cfg|Pipfile|uv\.lock|poetry\.lock)$|\.py$' && AUDIT_HAS_PYTHON_CHANGE=true
  audit_scope_has_path_matching '(^|/)(go\.mod|go\.sum)$|\.go$' && AUDIT_HAS_GO_CHANGE=true
  audit_scope_has_path_matching '(^|/)(Cargo\.toml|Cargo\.lock)$|\.rs$' && AUDIT_HAS_RUST_CHANGE=true
fi
AUDIT_HAS_CODE_OR_MANIFEST_CHANGE=false
if [ "$AUDIT_SCOPE_MODE" = "repository" ] || [ "$AUDIT_HAS_JS_CHANGE" = true ] || [ "$AUDIT_HAS_PYTHON_CHANGE" = true ] || [ "$AUDIT_HAS_GO_CHANGE" = true ] || [ "$AUDIT_HAS_RUST_CHANGE" = true ]; then
  AUDIT_HAS_CODE_OR_MANIFEST_CHANGE=true
fi

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

# Native manifests and Knip configs may belong to leaf applications rather than
# the repository root. Exclude dependency and virtual-environment trees: their
# files are not applications the audit owns and would make results noisy and slow.
find_audit_files() {
  find . \
    -type d \( -name .git -o -name node_modules -o -name .venv -o -name venv -o -name vendor -o -name target \) -prune -o \
    "$@"
}

find_manifest_dirs() {
  find_audit_files \
    -type f \( "$@" \) -print 2> /dev/null \
    | while IFS= read -r manifest; do dirname "$manifest"; done \
    | LC_ALL=C sort -u
}

PYTHON_PROJECT_DIRS="$(find_manifest_dirs -name pyproject.toml -o -name requirements.txt -o -name setup.py -o -name setup.cfg -o -name Pipfile)"
GO_MODULE_DIRS="$(find_manifest_dirs -name go.mod)"
RUST_CRATE_DIRS="$(find_manifest_dirs -name Cargo.toml)"

# Keep native tools inside the changed application(s). A language change at the
# repository root correctly selects the root project; a docs-only diff selects
# none. Repository-mode audits retain the complete discovered set.
if [ "$AUDIT_SCOPE_MODE" = "diff" ]; then
  if [ "$AUDIT_HAS_PYTHON_CHANGE" = true ]; then
    PYTHON_PROJECT_DIRS="$(printf '%s\n' "$PYTHON_PROJECT_DIRS" | filter_audit_dirs_to_diff)"
  else
    PYTHON_PROJECT_DIRS=""
  fi
  if [ "$AUDIT_HAS_GO_CHANGE" = true ]; then
    GO_MODULE_DIRS="$(printf '%s\n' "$GO_MODULE_DIRS" | filter_audit_dirs_to_diff)"
  else
    GO_MODULE_DIRS=""
  fi
  if [ "$AUDIT_HAS_RUST_CHANGE" = true ]; then
    RUST_CRATE_DIRS="$(printf '%s\n' "$RUST_CRATE_DIRS" | filter_audit_dirs_to_diff)"
  else
    RUST_CRATE_DIRS=""
  fi
fi

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
  find_audit_files \
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

if [ "$AUDIT_HAS_CODE_OR_MANIFEST_CHANGE" != true ]; then
  echo "Code quality scope: no changed source or manifest files"
else
  [ -n "$PYTHON_PROJECT_DIRS" ] || echo "No Python projects found — Python architecture, dead-code, and outdated checks not applicable"
  [ -n "$GO_MODULE_DIRS" ] || echo "No Go modules found — Go architecture, dead-code, and outdated checks not applicable"
  [ -n "$RUST_CRATE_DIRS" ] || echo "No Rust crates found — Rust architecture, dead-code, and outdated checks not applicable"

  # =========================================================================
  # DETECT CONFIG DRIFT (read-only — no writes)
  # =========================================================================

  # 0. Compare generated vs on-disk depcruise config. Non-zero exit = drift.
  #    /audit must never mutate the working tree; surface stale config as W007.
  #    Resolve the locally installed safeword CLI first so the check reflects the
  #    repo's pinned version, not whatever the npm registry currently calls @latest.
  if [ "$AUDIT_SCOPE_MODE" = "repository" ] || [ "$AUDIT_HAS_JS_CHANGE" = true ]; then
    if [ -x node_modules/.bin/safeword ]; then
      SW="node_modules/.bin/safeword"
    elif [ -f packages/cli/src/cli.ts ]; then
      SW="bun packages/cli/src/cli.ts"
    else SW="bunx safeword"; fi
    $SW project sync-config --check 2>&1 || echo "[W007] Stale .safeword/depcruise-config.cjs — run \`safeword project sync-config\` to refresh and commit"

    # Config-drift coverage is JS/TS-only (W005 knip hints, W007 depcruise config).
    # Native stacks have no comparable drift check yet — say so instead of letting
    # silence read as "no drift" (#831).
    ([ -n "$PYTHON_PROJECT_DIRS" ] || [ -n "$GO_MODULE_DIRS" ] || [ -n "$RUST_CRATE_DIRS" ]) && echo "Coverage limitation: config-drift checks (W005/W007) cover JS/TS tooling only — native lint configs (ruff.toml, .golangci.yml, Cargo [lints]) are not drift-checked; review them manually."
  fi

  # =========================================================================
  # ARCHITECTURE CHECKS (circular deps, layer violations)
  # =========================================================================

  # 1a. Architecture - TypeScript/JS (depcruise)
  DEPCRUISE_CONFIG=""
  [ -f .dependency-cruiser.cjs ] && DEPCRUISE_CONFIG=".dependency-cruiser.cjs"
  [ -f .dependency-cruiser.js ] && DEPCRUISE_CONFIG=".dependency-cruiser.js"
  if [ -n "$DEPCRUISE_CONFIG" ] && { [ "$AUDIT_SCOPE_MODE" = "repository" ] || [ "$AUDIT_HAS_JS_CHANGE" = true ]; }; then
    if [ "$AUDIT_SCOPE_MODE" = "diff" ]; then
      bunx depcruise --output-type err --config "$DEPCRUISE_CONFIG" --affected "$AUDIT_BASE_SHA" . 2>&1 || true
    else
      bunx depcruise --output-type err --config "$DEPCRUISE_CONFIG" . 2>&1 || true
    fi
  fi

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
  # silently ignore their entry/project rules. Knip's CLI scopes by workspace, not
  # by changed source path, so a default diff audit must not emit its unrelated
  # whole-workspace baseline. Run the repository audit when that discovery is wanted.
  if [ "$AUDIT_SCOPE_MODE" = "repository" ]; then
    ([ -f package.json ] || [ -n "$KNIP_CONFIG_FILES" ]) && run_knip_check
  elif [ "$AUDIT_HAS_JS_CHANGE" = true ]; then
    echo "Knip: skipped in diff scope — run a repository audit for whole-workspace unused-code discovery"
  fi

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
  # stay comparable across audits. A changed-only input would miss a new clone
  # against an unchanged file, so keep this as explicit repository discovery.
  if [ "$AUDIT_SCOPE_MODE" = "repository" ]; then
    bunx jscpd . --min-lines 10 --reporters console --ignore "**/node_modules/**,**/dist/**,**/build/**,**/coverage/**,**/.safeword/**,**/.project/**,**/.safeword-project/**" 2>&1 || true
  elif [ "$AUDIT_HAS_CODE_OR_MANIFEST_CHANGE" = true ]; then
    echo "Duplication: skipped in diff scope — run a repository audit for cross-file clone discovery"
  fi

  # =========================================================================
  # OUTDATED DEPENDENCIES
  # =========================================================================

  # Dependency freshness is inherently repository-wide: every installed version
  # can be outdated regardless of this diff. Keep it in repository mode instead
  # of flooding a feature audit with unrelated upgrade work.
  if [ "$AUDIT_SCOPE_MODE" = "repository" ]; then
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
  elif [ "$AUDIT_HAS_CODE_OR_MANIFEST_CHANGE" = true ]; then
    echo "Dependency freshness: skipped in diff scope — run a repository audit for upgrade discovery"
  fi
fi
```

#### Outdated Package Triage (repository audits only)

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

#### Knip Configuration Hints (W005, repository audits only)

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

In a diff audit, find and check changed agent configuration files (excluding
`.safeword/`) and direct references from them. In a repository audit, check
every matching configuration file.

**Files to check:**

- `CLAUDE.md`, `AGENTS.md` (root and subdirectories)
- `.claude/CLAUDE.md` (root and subdirectories)
- `.cursor/rules/*.mdc` or `.cursor/rules/*/` (root and subdirectories)
- `.cursorrules` (legacy)

For each changed config file, check:

| Check      | Criteria                                                                  | Severity |
| ---------- | ------------------------------------------------------------------------- | -------- |
| Size limit | CLAUDE.md/AGENTS.md: ~150-200 instructions; Cursor rules: 500 lines       | warn     |
| Structure  | Has WHAT/WHY/HOW sections                                                 | warn     |
| Dead refs  | All referenced files/paths exist (skip URLs starting with http)           | error    |
| Staleness  | Do not report date-only staleness in a diff audit; use a repository audit | n/a      |

### 3. Learning Files Check

Changed project learnings in the resolved namespace root's `learnings/*.md` must have a `Covers:` line on line 3 — the auto-generated `INDEX.md` is built from these lines, and files without them don't appear in the index. In a repository audit, check every learning as before.

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"
audit_scope_initialize "$PROJECT_DIR"
NS_ROOT="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR")"

learning_is_in_audit_scope() {
  [ "$AUDIT_SCOPE_MODE" = "repository" ] && return 0
  learning_path="${1#"$PROJECT_DIR"/}"
  audit_scope_path_changed "$learning_path"
}

if [ -d "$NS_ROOT/learnings" ]; then
  for f in "$NS_ROOT"/learnings/*.md; do
    [ -e "$f" ] || continue
    [ "$(basename "$f")" = "INDEX.md" ] && continue
    learning_is_in_audit_scope "$f" || continue
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

Review changed test files for quality issues, plus a changed source file's
co-located test when present. Check them against the iron laws and anti-patterns
in `.claude/skills/testing/SKILL.md`. A repository audit may use the former
project-wide sample.

**Find test files:**

```bash
# Start with test files named in the printed audit scope. For a changed
# `src/foo.ts`, also inspect `src/foo.test.ts` / `src/foo.spec.ts` when present.
# Repository audit fallback (common patterns):
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
- Always report docs coverage: configured vs fallback, sources checked, and sources skipped. In a diff audit, inspect sources directly affected by changed code or changed docs. In a repository audit, inspect the entire configured or fallback source inventory; date-only staleness and a last-20-commits sweep belong there too.

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
    - **Drifted layer→dir (error):** A "Layers & Boundaries" `directory` entry that matches no module path in the generated map.
    - **Inventory omissions are not findings:** The generated document owns the structural inventory. Never require the human narrative or decision records to mention every generated module/package; those documents own the architectural "why," not a duplicate package-by-package list.
    - **Report only — never auto-overwrite prose.** Cite the generated-doc evidence and propose narrative edits for the user to review; the human "why" is human-owned, and only a person can judge whether a paragraph is still true. The deterministic structural facts come from reading the generated doc; the narrative judgment stays with the human/agent.
  - A monorepo `## Coverage gaps` advisory in the generated doc (a present-but-unparseable workspace manager, #558) is itself a coverage limitation — note it so the structural reconciliation isn't mistaken for complete.

**README.md:**

- Check changed claims and impacted references. Check date-only staleness only in a repository audit.

**Docs site (if changed or directly impacted):**

- Detect `docs/`, `documentation/` with Starlight/Docusaurus/etc config
- Check staleness of docs content

**Documentation impact check:**

Review the changed area from the printed scope. For each significantly changed area, check if related docs, readmes, or guides need updating. Flag stale, missing, or contradictory impacted documentation as errors. Documentation drift is never a warning; date-only staleness with no changed-code contradiction is repository-audit context, not a diff finding.

### 6. Principle Trace Integrity

For the active ticket, when `impl-plan.md` declares project-principle alignment,
resolve the source using `paths.principles` (default
`<namespace-root>/principles.md`) and check the principle trace as **observable
facts only**:

- The named principle exists in the configured source.
- The trace contains a non-empty concrete consequence and proof.
- The proof reference resolves to recorded test, verification, or manual
  evidence; an intentional conflict is named in Known deviations.

Report a missing source entry, incomplete mapping, dead evidence reference, or
unrecorded conflict as `[E010] Broken principle trace`. Do not judge whether a
principle was applicable, whether the consequence was a wise interpretation,
or whether an experience was genuinely delightful—those are adversarial
`quality-review` judgments. A plan with no declared applicable principle is not
an audit finding.

Run the factual checker below verbatim. Its sentinel keeps the executable audit
contract testable without turning semantic review into shell heuristics.

```bash
# principle-trace-check — E010 objective trace integrity only.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/audit-principle-trace.ts" "$PROJECT_DIR"
```

### 7. Namespace Domain Docs

When a changed feature/spec or changed domain doc references them, reconcile the
three namespace domain docs — `personas.md`, `surfaces.md`, `glossary.md` —
against those changed references and report empty scaffolds. A repository audit
reconciles the whole corpus. This check is **read-only and class-2** (observable
facts only): it reports and offers, it never rewrites a doc. **Run the block
below verbatim, as ONE bash invocation.**

````bash
# domain-docs-check — read-only reconciliation of the namespace domain docs.
# Class-2: observable facts only. Emits W008 (empty). Never writes the tree.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}" || exit 1
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
source "$PROJECT_DIR/.safeword/hooks/lib/audit-scope.sh"
audit_scope_initialize "$PROJECT_DIR"

# Resolve the namespace root (honors config paths.projectRoot in real runs).
# Fall back on directory existence — robust when the resolver hook is absent.
NS_ROOT="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" 2> /dev/null)"
[ -d "$NS_ROOT" ] || {
  if [ -d "$PROJECT_DIR/.project" ]; then NS_ROOT="$PROJECT_DIR/.project"; else NS_ROOT="$PROJECT_DIR/.safeword-project"; fi
}
PERSONAS_FILE="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" personas personas.md 2> /dev/null)"
SURFACES_FILE="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" surfaces surfaces.md 2> /dev/null)"
GLOSSARY_FILE="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR" glossary glossary.md 2> /dev/null)"
[ -n "$PERSONAS_FILE" ] || PERSONAS_FILE="$NS_ROOT/personas.md"
[ -n "$SURFACES_FILE" ] || SURFACES_FILE="$NS_ROOT/surfaces.md"
[ -n "$GLOSSARY_FILE" ] || GLOSSARY_FILE="$NS_ROOT/glossary.md"

# A branch audit skips unrelated domain-doc corpus drift. Include configured
# domain paths, whose basenames need not be personas.md/surfaces.md/glossary.md.
if [ "$AUDIT_SCOPE_MODE" = "diff" ] && ! audit_scope_has_review_path_matching '(^|/)(personas|surfaces|glossary)\.md$|\.feature$|(^|/)spec\.md$'; then
  domain_path_changed=false
  for configured_domain_file in "$PERSONAS_FILE" "$SURFACES_FILE" "$GLOSSARY_FILE"; do
    configured_domain_path="${configured_domain_file#"$PROJECT_DIR"/}"
    audit_scope_path_changed "$configured_domain_path" && domain_path_changed=true
  done
  [ "$domain_path_changed" = true ] || exit 0
fi

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
# In a diff audit, report only a changed domain doc. An unchanged empty scaffold
# is existing debt, not a finding caused by an unrelated feature or spec change.
for doc in personas surfaces glossary; do
  case "$doc" in
    personas) dd_file="$PERSONAS_FILE" ;;
    surfaces) dd_file="$SURFACES_FILE" ;;
    glossary) dd_file="$GLOSSARY_FILE" ;;
  esac
  [ -f "$dd_file" ] || continue
  domain_doc_path="${dd_file#"$PROJECT_DIR"/}"
  [ "$AUDIT_SCOPE_MODE" = "repository" ] || audit_scope_path_changed "$domain_doc_path" || continue
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
surfaces_file="$SURFACES_FILE"
dd_file="$surfaces_file"
surfaces_path="${surfaces_file#"$PROJECT_DIR"/}"
if [ "$AUDIT_SCOPE_MODE" = "repository" ] || audit_scope_path_changed "$surfaces_path"; then
  if ! FEATURE_DIRECTORIES="$(feature_directories 2> /dev/null)"; then
    echo "[W009] Feature-directory resolver unavailable; E008 scanned root features/ only"
    FEATURE_DIRECTORIES="$PROJECT_DIR/features"
  fi
  SURFACE_FEATURE_FILES="$(printf '%s\n' "$FEATURE_DIRECTORIES" | while IFS= read -r features_directory; do
    [ -d "$features_directory" ] && find "$features_directory" -type f -name '*.feature' -print
  done)"
else
  SURFACE_FEATURE_FILES="$(audit_scope_files_matching '\.feature$' | while IFS= read -r feature_path; do
    printf '%s/%s\n' "$PROJECT_DIR" "$feature_path"
  done)"
fi
if [ -f "$surfaces_file" ] && [ "$(domain_docs_entry_count)" -gt 0 ] && [ -n "$SURFACE_FEATURE_FILES" ]; then
  # Defined slugs: slugify each uncommented `## ` heading. Portable casing via
  # `tr` — BSD/macOS sed lacks `\L`.
  defined_slugs="$(sed "$strip_html_comments" "$surfaces_file" | grep -E '^## ' | sed 's/^## //' \
    | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9][^a-z0-9]*/-/g; s/^-//; s/-$//')"
  # Referenced slugs: @surface.<slug> on Gherkin tag lines only (line starts
  # with @), so a slug mentioned in step prose is not a reference.
  referenced_slugs="$(printf '%s\n' "$SURFACE_FEATURE_FILES" | while IFS= read -r feature_file; do
    [ -f "$feature_file" ] && grep -hE '^[[:space:]]*@' "$feature_file" 2> /dev/null
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
personas_file="$PERSONAS_FILE"
tickets_dir="$NS_ROOT/tickets"
dd_file="$personas_file"
personas_path="${personas_file#"$PROJECT_DIR"/}"
if [ "$AUDIT_SCOPE_MODE" = "repository" ] || audit_scope_path_changed "$personas_path"; then
  PERSONA_SPEC_FILES="$(find "$tickets_dir" -type f -name spec.md -print 2> /dev/null)"
else
  PERSONA_SPEC_FILES="$(audit_scope_files_matching '(^|/)spec\.md$' | while IFS= read -r spec_path; do
    printf '%s/%s\n' "$PROJECT_DIR" "$spec_path"
  done)"
fi
if [ -f "$personas_file" ] && [ "$(domain_docs_entry_count)" -gt 0 ] && [ -n "$PERSONA_SPEC_FILES" ]; then
  # Defined codes mirror safeword's resolver, including canonical derivation,
  # collision allocation, and historical aliases. A simpler initials-only
  # derivation would falsely flag existing TB/SM lineage after those personas
  # adopted their canonical TBU/SWM codes.
  defined_codes="$(PERSONAS_FILE="$personas_file" bun -e '
const fs = require("node:fs");

const lines = fs.readFileSync(process.env.PERSONAS_FILE, "utf8").split("\n");
const validCode = code => /^[A-Z][A-Z0-9]{1,5}$/.test(code);
const canonicalCode = code => /^[A-Z][A-Z0-9]{2,3}$/.test(code);

const skip = [];
let isInsideCodeFence = false;
let isInsideComment = false;
for (const line of lines) {
  if (line.trimStart().startsWith("```")) {
    skip.push(true);
    isInsideCodeFence = !isInsideCodeFence;
    continue;
  }
  if (isInsideCodeFence) {
    skip.push(true);
    continue;
  }
  if (!isInsideComment && line.trimStart().startsWith("<!--")) isInsideComment = true;
  if (isInsideComment) {
    skip.push(true);
    if (line.includes("-->")) isInsideComment = false;
    continue;
  }
  skip.push(false);
}

function stripInlineComments(line) {
  let result = "";
  let position = 0;
  while (position < line.length) {
    const open = line.indexOf("<!--", position);
    if (open === -1) return result + line.slice(position);
    result += line.slice(position, open);
    const close = line.indexOf("-->", open + 4);
    if (close === -1) return result + line.slice(open);
    position = close + 3;
  }
  return result;
}

function parseHeading(line) {
  const body = stripInlineComments(line.slice(3)).trimEnd();
  if (body.endsWith(")")) {
    const openParen = body.lastIndexOf("(");
    if (openParen !== -1) {
      return { name: body.slice(0, openParen).trim(), rawCode: body.slice(openParen + 1, -1).trim(), explicit: true };
    }
  }
  return { name: body.trim(), rawCode: "", explicit: false };
}

function deriveCanonical(name) {
  const words = name.trim().replace(/[\x27\u2019]/g, "").replace(/[^A-Z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  let code;
  if (words.length === 1) code = words[0].slice(0, 3);
  else if (words.length === 2) code = `${words[0].slice(0, 2)}${words[1].charAt(0)}`;
  else code = words.map(word => word.charAt(0)).join("");
  return code.toUpperCase().slice(0, 4);
}

function deriveLegacy(name) {
  const words = name.trim().replace(/[^A-Z0-9\s]/gi, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const code = words.length === 1 ? words[0].slice(0, 2) : words.map(word => word.charAt(0)).join("");
  return code.toUpperCase().slice(0, 6);
}

function allocateCanonical(base, claimed) {
  if (!claimed.has(base)) return { code: base, exhausted: false };
  for (let suffix = 2; ; suffix += 1) {
    const suffixText = String(suffix);
    const prefixLength = 4 - suffixText.length;
    if (prefixLength < 1) return { code: base, exhausted: true };
    const candidate = `${base.slice(0, prefixLength)}${suffixText}`;
    if (!claimed.has(candidate)) return { code: candidate, exhausted: false };
  }
}

const parsed = lines.filter((line, index) => !skip[index] && line.startsWith("## ")).map(parseHeading);
const claimed = new Set(parsed.filter(persona => persona.explicit && persona.rawCode.length > 0).map(persona => persona.rawCode));
const resolved = parsed.map(persona => {
  if (persona.explicit) return { ...persona, code: persona.rawCode, codeError: false };
  const allocation = allocateCanonical(deriveCanonical(persona.name), claimed);
  if (!allocation.exhausted) claimed.add(allocation.code);
  return { ...persona, code: allocation.code, codeError: allocation.exhausted || !canonicalCode(allocation.code) };
});

const aliases = [];
for (const persona of resolved) {
  if (persona.codeError) continue;
  const base = deriveLegacy(persona.name);
  if (base === "" || base === persona.code) continue;
  let candidate = base;
  for (let suffix = 2; claimed.has(candidate); suffix += 1) candidate = `${base}${suffix}`;
  if (!validCode(candidate)) continue;
  claimed.add(candidate);
  aliases.push(candidate);
}

for (const persona of resolved) if (!persona.codeError) console.log(persona.code);
for (const alias of aliases) console.log(alias);
')"
  # Referenced codes: (CODE) from spec **Persona:** lines, comments stripped.
  referenced_codes="$(printf '%s\n' "$PERSONA_SPEC_FILES" | while IFS= read -r spec_file; do
    [ -f "$spec_file" ] && sed "$strip_html_comments" "$spec_file"
  done 2> /dev/null | grep -E '^\*\*Persona:\*\*' | grep -oE '\([A-Z][A-Z0-9]{1,5}\)' | tr -d '()' | sort -u)"
  for code in $referenced_codes; do
    if ! printf '%s\n' $defined_codes | grep -qxF "$code"; then
      echo "[E009] Persona drift: code $code referenced in a spec but no matching entry in personas.md"
    fi
  done
fi
````

**Content is human-owned — advisory only, never an error.** This check judges _references_ (a slug/code that is or isn't defined) and _emptiness_ — observable facts. Whether a glossary term's meaning, or a persona/surface _description_, is still accurate is a human judgment: raise it as an advisory note at most, never as an error code. Only the three codes above (E008, E009, W008) are emitted here.

**Empty-doc offer (W008):** report the empty doc and point the user to its template — do **not** draft entries or write the file during the audit pass (read-only). Filling it is a follow-up the user approves.

**Coverage limitation:** configured `paths.personas`, `paths.surfaces`, and `paths.glossary` are resolved before reconciliation. `safeword doctor` separately reports missing configured files and orphaned defaults. If the safeword feature-directory resolver is unavailable, W009 says E008 fell back to root `features/` only. Persona drift reads spec `**Persona:**` lines only — feature lineage tags are not a reliable persona source.

---

## Report Format

Report findings by severity with codes:

### Errors (must fix)

- [E001] Dead ref: `CLAUDE.md` references missing file `src/foo.ts`
- [E002] Drift: `ARCHITECTURE.md` documents Redux, code uses Zustand
- [E003] Structural drift: `ARCHITECTURE.md` documents module `legacy-sync` — absent from `architecture.generated.md` (orphaned; renamed or removed)
- [E004] Documentation drift: Codex Stop hook behavior changed, but `README.md` or docs still describe only PreToolUse coverage
- [E005] Dependency gap: `@tanstack/query` is a major dependency but is not documented in ARCHITECTURE.md
- [E007] Drifted layer→dir: `ARCHITECTURE.md` maps `domain` → `src/core/` but no such module path is in `architecture.generated.md`
- [E008] Surface drift: `@surface.safeword-cli` is referenced in `features/` but has no matching entry in `surfaces.md`
- [E009] Persona drift: persona code `DEV` is named in a spec `**Persona:**` line but has no matching entry in `personas.md`
- [E010] Broken principle trace: `Delight the user` points to `verify.md#persona-walkthrough`, but that evidence record does not exist

### Warnings (should review)

- [W001] Size: `CLAUDE.md` has 245 instructions (recommended: 150-200)
- [W002] Structure: `AGENTS.md` missing recommended WHAT/WHY/HOW sections
- [W003] Staleness: `README.md` last modified 45 days ago (12 commits since)
- [W005] Stale config: `knip.json` — `lodash` can be removed from ignoreDependencies
- [W006] Learning file missing Covers: — `<namespace-root>/learnings/foo.md` (absent from INDEX.md)
- [W007] Stale .safeword/depcruise-config.cjs — run `safeword project sync-config` to refresh and commit
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
