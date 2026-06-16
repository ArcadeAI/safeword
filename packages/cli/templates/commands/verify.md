---
description: Verify ticket criteria — tests, build, lint, scenarios, dep drift (project)
---

# Verify

Prove a ticket meets its criteria. Works with or without an active ticket.

## Invocation log

This skill is required at the feature-ticket done-gate (ticket 147). The line below appends a session-scoped entry to `skill-invocations.log` under the project namespace root (`.project/`, or legacy `.safeword-project/` where that exists) so the done-gate hook can verify /verify was actually invoked. Claude Code expands the `!` line automatically and substitutes `${CLAUDE_SESSION_ID}` for session binding. Codex and Cursor docs do not document Claude-style `!` expansion or `${CLAUDE_SESSION_ID}` substitution, so the fallback below is explicit. Hand-writing verify.md cannot produce this feature-gate proof.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" verify "${CLAUDE_SESSION_ID}" || echo "[skill-invocation-log] FAILED - no session-scoped proof logged"`

If no `[skill-invocation-log] verify ✓` line appears above, run this fallback before continuing:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
bun "$PROJECT_DIR/.safeword/hooks/record-skill-invocation.ts" "$PROJECT_DIR" verify "${CLAUDE_SESSION_ID:-}"
```

**If the automatic line or fallback prints `[skill-invocation-log] FAILED`, reports `Missing session id for skill invocation log`, or still does not print `verify ✓`**: Feature tickets must fail closed if no real current-session proof can be logged. Do not mark a feature ticket done or hand-write verify.md as a substitute for the feature-gate proof. Report the failure to the user (most likely cause: inline shell execution was denied, the client lacks a compatible session id, or Bun could not run the installed helper) and ask them to resolve it before re-invoking /verify.

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
2. Then run verification:

Per-language test/build commands come from `safeword test-plan` — one source of
truth (the same plan the stop-hook gate runs). Eval its shell plan in a child
shell: an absent toolchain prints a visible skip, and a failing suite exits
non-zero so the gate blocks. The Gherkin acceptance lane runs separately (it is
not a `test-plan` suite).

```bash
# Resolve a test-plan-capable safeword CLI — prefer the locally installed one
# (a bare `bunx safeword` can resolve the published CLI, which may predate test-plan).
if [ -x node_modules/.bin/safeword ]; then
  SW="node_modules/.bin/safeword"
elif [ -f packages/cli/src/cli.ts ]; then
  SW="bun packages/cli/src/cli.ts"
else SW="bunx safeword"; fi

# --- Test suite (resolved by safeword test-plan — one source of truth) ---
bash -c "$($SW test-plan --kind test --format sh)"

# Gherkin acceptance lane (when available)
if node -e 'const fs=require("fs");const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));process.exit(pkg.scripts&&pkg.scripts["test:bdd"]?0:1)' 2> /dev/null; then
  bun run test:bdd 2>&1
else
  echo "Gherkin acceptance lane skipped: Skipped — no test:bdd script"
fi

# --- Build check (resolved by safeword test-plan) ---
bash -c "$($SW test-plan --kind build --format sh)"
```

The `/lint` command handles linting with auto-fix. Report any remaining unfixable errors.

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

### 6. Report Results

Structure the report in three sections, in this order. **Empty sections are hidden entirely** — no "None" placeholders, no empty headers.

#### Status (the existing Verify Checklist — facts only)

The Status section uses the existing Verify Checklist format. Format with these EXACT patterns (the done-gate hook validates them):

```
## Verify Checklist

**Test Suite:** ✓ X/X tests pass (or ❌ N failures, or ⏭️ Skipped — no test suite)
**Gherkin:** ✅ Acceptance lane passes (or ❌ Failed, or ⏭️ Skipped — no test:bdd script)
**Build:** ✅ Success (or ❌ Failed, or ⏭️ Skipped — no build step)
**Lint:** ✅ Clean (or ❌ N errors)
**Scenarios:** All N scenarios marked complete (or ❌ X/Y complete, or ⏭️ Skipped — no ticket)
**Dep Drift:** ✅ Clean (or ⚠️ N undocumented deps, or ⏭️ Skipped — no ARCHITECTURE.md)
**Parent Epic:** {id} (siblings: X/Y done) or N/A
**Reconcile:** ✅ No pattern deviation (or ⚠️ N deviations, M missing uplevel ticket — soft, never blocks)
```

**Reconcile** is soft — it never blocks the done gate. If the work introduced a pattern that diverges from existing siblings (see `.safeword/guides/architecture-guide.md` → Survey & Reconcile), confirm the ticket carries a reconcile record and every deviation has an uplevel follow-up ticket; flag any that don't. Use `N/A` when the work conformed or introduced no new pattern.

**Done-gate evidence patterns** (the stop hook validates these literal phrases — do not move or rename):

- `✓ X/X tests pass` — proves test suite ran
- `**Gherkin:**` — proves the acceptance lane ran or was explicitly skipped
- `All N scenarios marked complete` — proves scenarios checked
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

When **all Status checks pass AND zero decisions AND zero actions**, collapse the entire report to a single-line verdict:

> Ready to mark done.

No sections, no ceremony. Single line.

## Summary

This command verifies ticket criteria (the done gate). Use it before marking any feature ticket complete. It also works without a ticket for quick project health checks (tests + build + lint + dep drift).
