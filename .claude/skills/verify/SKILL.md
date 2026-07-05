---
name: verify
description: Verify ticket completion criteria — use when finishing a ticket,
  before marking work done, or checking acceptance criteria. Runs tests, build,
  lint, scenarios, and dependency drift checks.
allowed-tools: '*'
---

# Verify

Prove a ticket meets its criteria. Works with or without an active ticket.

**Reviewer class:** _class-2 — independent observation_ (PRINCIPLES.md §1): the test suite and parsers are the independent party, so no fresh-context or cross-model reviewer applies.

## Invocation log

This skill is required at the feature-ticket done-gate (ticket 147). The line below appends a current-run entry to `skill-invocations.log` under the project namespace root (`.project/`, or legacy `.safeword-project/` where that exists) so the done-gate hook can verify /verify was actually invoked. Claude Code expands the `!` line automatically and passes `${CLAUDE_SESSION_ID}` when available. The helper also resolves Claude remote-container ids from the runtime environment, and on Cursor and Codex the pre-shell hook (beforeShellExecution / PreToolUse) bridges the session id to the helper — so on all three runtimes the fallback runs without hand-picking an id. Hand-writing verify.md cannot produce this feature-gate proof.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" verify "${CLAUDE_SESSION_ID:-}" || echo "[skill-invocation-log] FAILED - no current-run proof logged"`

If no `[skill-invocation-log] verify ✓` line appears above, run this fallback before continuing:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" verify "${CLAUDE_SESSION_ID:-}"
```

**If the automatic line or fallback prints `[skill-invocation-log] FAILED`, prints `no run identity`, or still does not print `verify ✓`**: Feature tickets must fail closed if no real current-session proof can be logged. Do not mark a feature ticket done or hand-write verify.md as a substitute for the feature-gate proof. Report the failure to the user (most likely cause: inline shell execution was denied, the runtime did not expose a usable run identity, or Bun could not run the installed helper) and ask them to resolve it before re-invoking /verify.

Task, patch, and no-ticket verify work may continue after recording that session-scoped proof was unavailable and not required by the gate.

## Instructions

### 1. Find Current Ticket (if any)

```bash
# Find in_progress tickets, excluding epics
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
NS_ROOT="$(bun "$PROJECT_DIR/.safeword/hooks/resolve-namespace-root.ts" "$PROJECT_DIR")"
for f in "$NS_ROOT"/tickets/*/ticket.md; do
  [ -f "$f" ] || continue
  grep -q "^status: in_progress" "$f" && ! grep -q "^type: epic" "$f" && echo "$f"
done | head -1
```

If a ticket is found, read it to get:

- `parent:` field (if any)
- Ticket ID/slug for test-definitions lookup

If no ticket is found, skip scenario validation (step 3) and parent check (step 4).

### 2. Run Automated Checks

Run these in sequence, reporting each result:

1. **Run `/lint`** to auto-fix style issues first
2. Then run target-project verification checks from project evidence.

**Safeword runtime vs target project:** Safeword may use Bun for installed helpers such as `.safeword/hooks/*.ts`; that does not mean the target project uses Bun. Use Bun for installed helpers, then choose target project verification commands from stack manifests, lockfiles, and available scripts. A `package.json` may be safeword lane-host evidence in pure Python, Rust, and Go installs, so do not treat `package.json` as proof the target project is only JavaScript.

Per-language test/build commands come from `safeword test-plan` — one source of
truth (the same plan the stop-hook gate runs). Eval its shell plan in a child
shell: an absent toolchain prints a visible skip, and a failing suite exits
non-zero so the gate blocks. The Gherkin acceptance lane runs separately (it is
not a `test-plan` suite).

**Run the block below verbatim, as ONE bash invocation.** Do not extract or paraphrase individual commands — the CLI resolver, the generator exit-code check inside `run_plan`, and the git preflight are load-bearing (regressions 487, 375, and 469 each came from a hand-rolled variant of this block).

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
cd "$PROJECT_DIR" || exit 1

# Local evidence preflight: many repo tests create throwaway git repos. Some
# agent sandboxes cannot initialize repos in temp dirs, which makes those tests
# fail for environment reasons instead of product reasons.
LOCAL_EVIDENCE_LIMITS=""
if GIT_PROBE_DIR="$(mktemp -d 2> /dev/null)" && git init "$GIT_PROBE_DIR" > /dev/null 2>&1; then
  rm -rf "$GIT_PROBE_DIR"
else
  LOCAL_EVIDENCE_LIMITS="${LOCAL_EVIDENCE_LIMITS}
- Temporary git repos: local environment cannot run git init in temp dirs. Treat git-backed test failures as local environment limitations until reproduced outside the sandbox or in CI."
  [ -n "${GIT_PROBE_DIR:-}" ] && rm -rf "$GIT_PROBE_DIR"
fi
if [ -n "$LOCAL_EVIDENCE_LIMITS" ]; then
  printf '%s\n' "Local evidence limits detected:${LOCAL_EVIDENCE_LIMITS}"
fi

# Resolve a test-plan-capable safeword CLI — prefer the locally installed one
# only if it actually supports test-plan.
supports_test_plan() {
  case "$CANDIDATE" in
    node_modules/.bin/safeword) node_modules/.bin/safeword test-plan --help > /dev/null 2>&1 ;;
    "bun packages/cli/src/cli.ts") bun packages/cli/src/cli.ts test-plan --help > /dev/null 2>&1 ;;
    "bunx safeword") bunx safeword test-plan --help > /dev/null 2>&1 ;;
  esac
}

run_safeword() {
  case "$SW" in
    node_modules/.bin/safeword) node_modules/.bin/safeword "$@" ;;
    "bun packages/cli/src/cli.ts") bun packages/cli/src/cli.ts "$@" ;;
    "bunx safeword") bunx safeword "$@" ;;
  esac
}

# >>> run_plan (behavior covered by verify-skill.test.ts #487)
# Capture the plan, then check the generator's exit status BEFORE running it.
# `bash -c "$(...)"` discards the substitution's exit code, so a failed
# generator that prints nothing would leave `bash -c ""` — a false green (#487).
# Reads $plan_kind from the caller, not a bash positional parameter: in a
# command file Claude Code rewrites slash-command argument tokens before bash
# runs, so a positional would be clobbered. Plain assignment (never
# `local x=$(...)`, which masks `$?`); this block runs without `set -e`, so the
# explicit check is load-bearing. A successful empty plan stays a clean no-op
# (`bash -c ""` → exit 0).
run_plan() {
  plan="$(run_safeword test-plan --kind "$plan_kind" --format sh)"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "❌ Evidence generation failed: safeword test-plan --kind $plan_kind exited $rc (red, not a passed check)" >&2
    return "$rc"
  fi
  bash -c "$plan"
}
# <<< run_plan

CANDIDATE="node_modules/.bin/safeword"
if [ -x node_modules/.bin/safeword ] && supports_test_plan; then
  SW="node_modules/.bin/safeword"
elif CANDIDATE="bun packages/cli/src/cli.ts" && [ -f packages/cli/src/cli.ts ] && supports_test_plan; then
  SW="bun packages/cli/src/cli.ts"
elif CANDIDATE="bunx safeword" && supports_test_plan; then
  SW="bunx safeword"
else
  echo "No test-plan-capable safeword CLI found. Tried node_modules/.bin/safeword, packages/cli/src/cli.ts, and bunx safeword." >&2
  exit 1
fi

# --- Test suite (resolved by safeword test-plan — one source of truth) ---
plan_kind=verify
run_plan

# Gherkin acceptance lane (when available)
if node -e 'const fs=require("fs");const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));process.exit(pkg.scripts&&pkg.scripts["test:bdd"]?0:1)' 2> /dev/null; then
  bun run test:bdd 2>&1
else
  echo "Gherkin acceptance lane skipped: Skipped — no test:bdd script"
fi

# --- Build check (resolved by safeword test-plan) ---
plan_kind=build
run_plan

# --- Typecheck: the same `tsc --noEmit` signal CI's lint job runs (#436). A
#     green targeted-test run is NOT readiness if types are broken. An empty
#     plan (no `typecheck` script / non-TS project) is a silent no-op — when the
#     ticket touched TypeScript, run `/lint` (which runs tsc) so it isn't a gap. ---
plan_kind=typecheck
run_plan

# --- Dependency policy: `cargo deny check` (advisories, licenses, bans,
#     sources) for Rust. Empty for non-Rust or when cargo-deny is absent
#     (a visible skip, never a false green). ---
plan_kind=deps
run_plan
```

The `/lint` command handles linting with auto-fix. Report any remaining unfixable errors. Aggregate every attempted stack test into the final `**Test Suite:**` status, and every attempted stack build into the final `**Build:**` status. **Typecheck is part of the gate, not optional:** when the ticket changed TypeScript, a passing targeted-test run is not "ready" until `test-plan --kind typecheck` (or `/lint`, which runs `tsc --noEmit`) is green — CI's lint job runs it and will go red otherwise. A skipped or empty test-plan is not a failure when the project lacks a matching automated check; it is an explicit evidence gap to mention when the ticket touched that stack.

If `LOCAL_EVIDENCE_LIMITS` is non-empty, keep running checks that can run, but classify affected failures as `⚠️ Local environment limitation: <reason>`. The common Cursor sandbox symptom is `.git/hooks/: Operation not permitted` during `git init`. A failure caused only by that preflight is not proof of product failure; confirm outside the sandbox or in CI before calling it real.

If a full Vitest suite fails only because `packages/cli/tests/integration/cucumber-bdd.test.ts` times out while `bun run --cwd packages/cli test:bdd` passes directly, classify it as `⚠️ Local environment limitation: Cucumber wrapper timed out under full-suite load`. Report the isolated Cucumber lane as the Gherkin evidence and rerun that direct lane once. Treat it as a real product failure only when the direct Cucumber lane fails or CI reproduces it.

Regression fixtures covered by `safeword test-plan` and its tests:

- **no-build JavaScript:** a `test` script with no `build` script runs tests and has no JavaScript build entry.
- **non-Bun JavaScript:** lockfiles and `packageManager` select the matching package manager instead of assuming Bun.
- **non-JavaScript installs:** Python, Rust, and Go manifests are resolved independently of any safeword lane-host `package.json`.

### 3. Validate Test Definitions (skip if no ticket)

1. Find matching file: `$NS_ROOT/tickets/{ID}-{slug}/test-definitions.md`
2. Count scenarios: total `- [` lines
3. Count completed: `- [x]` lines
4. Report: "Scenarios: X/Y complete"

If any unchecked `[ ]` remain, list them.

### 4. Check Parent Epic (skip if no ticket)

If ticket has `parent:` field:

1. Read parent ticket
2. Get `children:` array
3. Check each child's `status:`
4. Report: "Siblings: X/Y done"

### 5. Check Dependency Drift

Compare the project's declared dependencies against `ARCHITECTURE.md`:

1. If `ARCHITECTURE.md` does not exist, skip this check
2. Read `ARCHITECTURE.md` content
3. Read the project's dependency manifest(s) — whichever exist:
   - **JS/TS:** `package.json` `dependencies` and `devDependencies`
   - **Python:** `pyproject.toml` (`[project]` `dependencies`, `[tool.poetry.dependencies]`) or `requirements.txt`
   - **Go:** the `require` block in `go.mod`
   - **Rust:** `[dependencies]` (and `[dev-dependencies]`) in `Cargo.toml`
4. For each dependency name:
   - Extract the bare name (drop the `@scope/` prefix for JS, version/path specifiers for the others); check both full and short forms
   - Check if `ARCHITECTURE.md` mentions it (case-insensitive)
5. Flag any runtime/architectural dependency NOT mentioned: `"Dependency \`{name}\` not documented in ARCHITECTURE.md"`

Do NOT flag:

- Type-only packages (`@types/*`) and standard-library imports
- Tooling/dev dependencies (linters, formatters, test utils — across any language) — only flag deps that represent architectural choices

### 6. Check PR Scope (skip if no ticket)

Compare the final change set against the ticket's `scope`, `out_of_scope`, and `done_when`.

Use the best available diff:

- Active PR diff, when the user gave one.
- Otherwise branch diff against the upstream/default branch, plus uncommitted changes.
- If no base is knowable, inspect `git status --short` and the commits/files touched this session.

Flag any changed file or behavior that only serves a different outcome than the ticket. Required supporting cleanup is fine. Nice-to-have refactors, opportunistic fixes, drive-by docs edits, and follow-up discoveries are separate tickets/PRs.

If PR scope fails, do not collapse to "Ready to mark done." Put the concrete split/revert/follow-up action in **Agent's next actions**, or put the scope decision in **Decisions needed** when the user must decide whether to expand the ticket.

### 7. Write verify.md (skip if no ticket)

The done gate blocks on this **artifact**, not on your chat report: `<ticket folder>/verify.md` must exist and contain a `**PR Scope:**` line whose status is passing (`done-gate.ts` rejects `❌`/piggybacked). Write the full Status checklist (step 8's Verify Checklist block, every line) to `$NS_ROOT/tickets/{ID}-{slug}/verify.md`, and once /audit has run, include its one-line result (`Audit passed …`) there too.

The all-green collapse in step 8 applies to the **chat report only** — verify.md always carries the full checklist, even when everything is green.

### 8. Report Results

Structure the report in three sections, in this order. **Empty sections are hidden entirely** — no "None" placeholders, no empty headers.

#### Status (the existing Verify Checklist — facts only)

The Status section uses the existing Verify Checklist format. Format with these EXACT patterns (the done-gate hook validates them):

```
## Verify Checklist

**Test Suite:** ✓ X/X tests pass (or ❌ N failures, or ⚠️ Local environment limitation: <reason>, or ⏭️ Skipped — no test suite)
**Gherkin:** ✅ Acceptance lane passes (or ❌ Failed, or ⚠️ Local environment limitation: <reason>, or ⏭️ Skipped — no test:bdd script)
**Build:** ✅ Success (or ❌ Failed, or ⏭️ Skipped — no build step)
**Lint:** ✅ Clean (or ❌ N errors)
**Scenarios:** All N scenarios marked complete (or ❌ X/Y complete, or ⏭️ Skipped — no ticket)
**PR Scope:** ✅ Diff matches ticket scope (or ❌ Piggybacked changes: <paths/behaviors>, or ⏭️ Skipped — no ticket/diff)
**Dep Drift:** ✅ Clean (or ⚠️ N undocumented deps, or ⏭️ Skipped — no ARCHITECTURE.md/package.json)
**Parent Epic:** {id} (siblings: X/Y done) or N/A
**Reconcile:** ✅ No pattern deviation (or ⚠️ N deviations, M missing uplevel ticket — soft, never blocks)
**Experience:** ✅ No new friction (or ⚠️ N friction points / dulled peak, or ⏭️ N/A — not persona-facing) — soft, never blocks
**Evidence limits:** ✅ None (or ⚠️ <local limitation>; affected failures are not product evidence until reproduced outside the limit)
```

**PR Scope** is the final "one purpose" guard. It blocks the all-green collapse: if it is ❌, the ticket is not ready to mark done until the unrelated work is reverted, split into another ticket/PR, or explicitly accepted as a scope change and reflected in the ticket artifacts.

**Reconcile** is soft — it never blocks the done gate. If the work introduced a pattern that diverges from existing siblings (see `.safeword/guides/architecture-guide.md` → Survey & Reconcile), confirm the ticket carries a reconcile record and every deviation has an uplevel follow-up ticket; flag any that don't. Use `N/A` when the work conformed or introduced no new pattern.

**Experience** is soft — it never blocks the done gate (no done-gate evidence pattern; a ⚠️ never hard-blocks `done`). Run it for persona-facing work; use `N/A` for internal/plumbing. You are grading your own work here, so the walk-artifact below is mandatory — a bare `✅` or "feels clean" is exactly the self-rating it exists to defeat. Two lenses:

- **Friction (every persona-facing feature):** did this add a step, a wait, a re-entry, or a dead-end the persona didn't have before? Walk the changed flow as the persona, inspect its _ending_ specifically, and **record the walk as evidence, not a verdict:** `Walked <persona> through <flow>; worst step = <the one most likely to make them bounce>; new steps vs before = <n>`. Name the _worst_ step, not a tidy summary.
- **Peak (only when the ticket or its parent declared a `## Rave Moment` in `spec.md`):** walk that moment as the persona — does it still land, and did this work advance or endanger it? A peak that quietly degraded is a finding even when every test is green.

A ⚠️ Experience finding routes to **Agent's next actions** if you'll fix it now, or to **Decisions needed** if it's a scope/value call for the user. It is never a reason to hold `done` on its own.

**Done-gate evidence patterns** (the stop hook validates these literal phrases — do not move or rename):

- `✓ X/X tests pass` — proves test suite ran
- `**Gherkin:**` — proves the acceptance lane ran or was explicitly skipped
- `All N scenarios marked complete` — proves scenarios checked
- `**PR Scope:**` — proves the final diff was checked against ticket scope
- `Audit passed` — proves /audit ran (run /audit separately)

Without the required patterns in Status, the done phase will hard block.

#### Decisions needed (spec / scope / value)

Only include this section when there are spec, scope, or value questions the USER must answer.

**Implementation-path questions (which approach, which pattern, which library) do NOT go here — they belong in "Agent's next actions" because the agent owns implementation choices.**

Borderline classification examples:

- "Should we use NextAuth or Lucia for auth?" → implementation-path → goes in **Actions** (agent picks one with reasoning, user can override).
- "Should this endpoint be at /v1/projects or /v2/projects?" → value decision (API contract) → goes in **Decisions**.
- "Is R5.x in scope for this slice or punt to slice 4?" → scope decision → goes in **Decisions**.
- "Should we extract this helper or inline it?" → implementation-path → goes in **Actions**.
- "Is 4xx the right HTTP status for this error?" → spec decision (if the spec exists, look it up; otherwise it's a value call) → goes in **Decisions**.

**Hard cap of 5 items** per section. If more exist, list the top 5 (most load-bearing) and add:

> - N others, see test-definitions.md

**Decisions section is hidden when empty** — no "None" placeholder. Do not surface the section at all if zero decisions exist.

#### Agent's next actions

Only include this section when there are concrete forward actions the agent will take. Each action must be **concrete and falsifiable** — not vague exploration ("look into X"), but a specific verb + object the agent will execute ("add integration test for R7.3 covering 404-on-uncovered-PATCH").

**Hard cap of 5 items** per section. If more exist, list the top 5 and add:

> - N others, see test-definitions.md

**Actions section is hidden when empty** — no "None" placeholder.

#### All-green collapse

When **all Status checks pass, PR Scope is ✅/skipped for a valid reason, Evidence limits is ✅ None, AND zero decisions AND zero actions**, collapse the entire report to a single-line verdict:

> Ready to mark done.

No sections, no ceremony. Single line.

## Summary

This command verifies ticket criteria (the done gate). Use it before marking any feature ticket complete. It also works without a ticket for quick project health checks (tests + build + lint + dep drift).
