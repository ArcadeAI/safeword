---
id: 155
status: in_progress
phase: clarify
type: feature
scope:
  - Inventory every check currently performed by the /audit skill.
  - Categorize each check by its right trigger mechanism (gate / edit-triggered / on-demand discovery / drop).
  - Move or redesign each check to live in the mechanism that fits it. Examples — deterministic gates stay in /audit; edit-triggered drift moves to PostToolUse hooks; discovery checks move to a separate skill or stay opt-in.
  - Update `packages/cli/templates/skills/audit/SKILL.md` (source of truth shipped to every customer) AND `.claude/skills/audit/SKILL.md` (dogfood). Keep them byte-identical.
  - Add or update any hook files in `packages/cli/templates/hooks/` and `.safeword/hooks/` for checks that move to triggers.
  - Document the new shape in a short migration note so customers understand what moved where.
out_of_scope:
  - Adding entirely new audit checks not currently performed.
  - Redesigning the underlying tools (depcruise rules, knip config, lint rules, etc.).
  - Building new validators that don't currently exist (e.g., JSON-shape drift via TS-interface validation) — that's a follow-up if needed.
  - Changing the skill invocation-log gate (the bash injection that proves /audit ran).
  - Touching unrelated skills (/verify, /lint, etc.) beyond reading current behavior for context.
done_when:
  - Every check the current /audit performs has a documented home (in /audit, in a hook, in a new skill, or explicitly removed with rationale).
  - /audit run on this repo (clean state) produces zero false positives.
  - /audit run on a repo with a known real drift catches it (regression test against today's known-good cases: depcruise violation, knip-detected dead export, broken file ref in CLAUDE.md).
  - Customer migration documented — when they upgrade safeword, they should learn what moved where, ideally via release notes.
  - All tests pass; build clean; lint clean.
---

# Feature: Reorganize the /audit skill

## Why now

The current /audit does sixteen-ish distinct checks bundled into one skill. Recent runs on this repo demonstrate the failure modes:

- **19 false-positive "undocumented dep" flags** — every single one was an ESLint plugin or test tool. The check used prose-only judgment ("skip tooling") which the LLM can't apply consistently across invocations.
- **5 weak-assertion flags** for defensible patterns (`toBeDefined()` as a guard before specific assertions). Heuristic, low-signal.
- **A real ARCHITECTURE.md drift** (the `config.json` example field) was caught only on second pass — first pass cut corners precisely because the noisy checks made the audit feel like ceremony.

The mixed signal-to-noise erodes trust. An /audit that produces "Audit passed with 24 things to look at" is functionally equivalent to no audit at all — both get ignored.

## Goal

/audit gives a confident go/no-go signal that humans and agents both trust. Every line of output should change a decision; silence should also change a decision (silence = move on).

## Current inventory

Sixteen checks across five sections of the SKILL.md.

**1. Code Quality (`### 1. Code Quality Checks`)**

1. Architecture — `bunx depcruise` for TS/JS circular deps and layer violations.
2. Architecture for Python — noted in comments only, no command actually runs.
3. Architecture for Go — same, noted only.
4. Dead code — `bunx knip --fix` for TS/JS plus a JSON-reporter pass for config hints.
5. Dead code — `deadcode .` for Python (when `pyproject.toml` / `requirements.txt` present).
6. Dead code — `golangci-lint run --enable unused` for Go (when `go.mod` present).
7. Copy/paste — `bunx jscpd` across all languages.
8. Outdated deps — `bun outdated` (or npm / uv / poetry / pip / `go list`) with a manual triage matrix the agent fills in (dev/prod × patch/minor/major → risk).
9. Knip configuration hints (W005) — flag entries in `ignoreDependencies` / `ignoreBinaries` that no longer match anything.

**2. Agent Config Checks (`### 2. Agent Config Checks`)**

10. Size limit on `CLAUDE.md` / `AGENTS.md` / `.cursor/rules/*.mdc` (~150–500 lines).
11. Structure check — looks for WHAT/WHY/HOW sections.
12. Dead-ref check — verifies file paths mentioned in agent configs exist.
13. Staleness — flag if last modified 30+ days ago AND commits exist since.

**3. Learning Files Check (`### 3. Learning Files Check`)**

14. `.safeword-project/learnings/*.md` must carry a `Covers:` line on row 3 (drives `INDEX.md` generation).

**4. Test Quality Review (`### 4. Test Quality Review`)**

15. Sample test files and check against 7 criteria — weak assertions, behavior-vs-implementation, independence, no arbitrary timeouts, edge cases, no duplicates, naming quality.

**5. Project Documentation Checks (`### 5. Project Documentation Checks`)**

16. `ARCHITECTURE.md` drift / gap analysis (compare deps to documented tech) + `README.md` staleness + docs-site staleness + documentation-impact review of recent commits.

### Cross-cut decisioning view

| #   | Check                                            | Deterministic?            | Current trigger | Last seen produce signal?                                       |
| --- | ------------------------------------------------ | ------------------------- | --------------- | --------------------------------------------------------------- |
| 1   | Architecture — depcruise                         | Yes                       | /audit          | Yes (caught real violations historically)                       |
| 2   | Architecture — Python/Go                         | Noted, not run            | /audit          | N/A                                                             |
| 3   | Dead code — knip (TS/JS)                         | Yes                       | /audit          | Yes                                                             |
| 4   | Dead code — deadcode (Python)                    | Yes                       | /audit          | Yes                                                             |
| 5   | Dead code — golangci-lint unused (Go)            | Yes                       | /audit          | Yes                                                             |
| 6   | Copy/paste — jscpd                               | Yes (counts)              | /audit          | Informational, no actionable signal observed                    |
| 7   | Outdated deps (per package manager)              | Yes                       | /audit          | Yes                                                             |
| 8   | Outdated triage (risk matrix)                    | Heuristic                 | /audit          | Mixed — risk class is fuzzy for 0.x deps                        |
| 9   | Knip config hints (W005)                         | Yes                       | /audit          | Yes                                                             |
| 10  | Agent config size/structure                      | Semi-heuristic            | /audit          | Rarely actionable; size limits are arbitrary                    |
| 11  | Agent config dead refs                           | Yes (file existence)      | /audit          | Yes                                                             |
| 12  | Agent config staleness                           | Heuristic (30d threshold) | /audit          | Rarely actionable on active repos                               |
| 13  | Learning files Covers: check                     | Yes                       | /audit          | Yes                                                             |
| 14  | Test quality sample (7 criteria)                 | Heuristic (prose)         | /audit          | High false-positive rate today                                  |
| 15  | ARCHITECTURE.md drift / gaps                     | Heuristic (prose)         | /audit          | High false-positive rate today; missed real drift on first pass |
| 16  | README / docs-site staleness + doc-impact review | Heuristic (prose)         | /audit          | Rarely actionable; subjective                                   |

### Recent change history (past week)

**Functionally unchanged.** Every check above was present a week ago. Between `0cff28d` (2026-05-03, v0.30.0) and HEAD (2026-05-18), the SKILL.md saw 9 added lines / 1 changed line — all on gate plumbing, not on checks.

Substantive changes in the window:

- **2026-05-15 — PR [#94](https://github.com/ArcadeAI/safeword/pull/94) (`92e4911`):** added the "Invocation log" section at the top. Bash injection at render time appends `[skill-invocation-log] audit ✓` to `.safeword-project/skill-invocations.log`. The done-gate hook (ticket 147) checks for this line — prevents agents from hand-writing fake audit results to satisfy the gate.
- **2026-05-17 — PR [#101](https://github.com/ArcadeAI/safeword/pull/101) (`4c90aed`):** added the failure-mode block under the injection. When bash permission is denied, the injection emits `FAILED` and the skill instructs the agent to stop and report rather than improvise.
- **2026-05-17 — PR [#104](https://github.com/ArcadeAI/safeword/pull/104) (`9372efc`):** `cd "$CLAUDE_PROJECT_DIR"` → `cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"`. Defensive fallback for contexts where the env var isn't set.

The signal-to-noise problem this ticket addresses has existed since at least v0.30.0 — it's not regression, just newly noticed.

## Proposed categorization (open for debate)

- **A. Hard gate — stays in /audit.** Deterministic, fast, every check fires every run, every output line is real. Candidates: #1, #3, #4, #5, #9, #11, #13. Plus a passthrough of build / test / lint (currently in /verify, possibly should be in /audit too).
- **B. Edit-triggered drift — moves to PostToolUse hooks.** Cheap, targeted, fires only when the relevant file gets edited. Candidates: dead-ref check on docs that were just touched (subset of #11); ARCHITECTURE.md cross-reference check when `schema.ts` or similar gets edited (subset of #15).
- **C. On-demand discovery — separate skill (`/scan` or `/health`?) OR opt-in flag on /audit.** Heuristic, slow, noisy, only valuable when the user is actively looking. Candidates: #6 (jscpd), #7+#8 (outdated triage), #10 (config size), #12 (staleness), #14 (test quality), #16 (doc staleness + impact review).
- **D. Drop or redesign.** Candidates: #15's dep-list comparison (we already established the prefix-list approach doesn't generalize — would replace with edit-triggered file-ref check in bucket B); #2 (delete the dead Python/Go architecture notes that don't actually run anything).

## Scenarios (lightweight — refactor, not new product behavior)

1. **Given** a safeword project with all gate checks passing, **when** /audit runs, **then** output is "Audit passed" with zero false positives and no informational noise.
2. **Given** a check that has moved to a hook, **when** the triggering edit occurs, **then** the check runs automatically and surfaces its finding inline.
3. **Given** a customer used to seeing a check in /audit that has moved elsewhere, **when** they upgrade safeword and run /audit, **then** they don't lose coverage silently — release notes / migration documentation tells them where the check now lives.
4. **Given** a known real drift exists (broken file ref in a doc; circular dep; dead export), **when** /audit runs, **then** it surfaces the finding with clear `[E001]`-style code and actionable next step.

## Open questions

1. **Is the four-bucket categorization (A gate / B edit-triggered / C discovery / D drop) the right frame**, or do we want a different shape (e.g., flatten to just /audit + everything-else)?
2. **For each check in bucket C (discovery)** — do we want one new skill (`/scan`) that owns all of them, or do we keep them invokable on /audit with an explicit flag like `/audit --include-discovery`?
3. **For bucket B (edit-triggered)** — does safeword have appetite for adding more PostToolUse hook latency? Each hook adds milliseconds; cumulative cost matters.
4. **Should /verify and /audit share more substrate?** Today /verify runs build/test/lint and /audit re-runs lint. Some redundancy. Could be unified — but unification is a bigger scope decision.
5. **Migration cadence.** Customers will see a change in /audit output shape. Should this go out as a minor version (0.33) with a release note, or a major signal? Per `versioning` skill the answer probably depends on whether the gate-evidence patterns (`✓ X/X tests pass`, `Audit passed`, etc.) change.

## Work Log

- 2026-05-18T20:55Z Created from the audit-skill cleanup discussion. Triggered by recent /audit on ticket 154 producing 19 false-positive dep flags + 5 weak-assertion flags, while missing the real ARCHITECTURE.md drift on first pass. Spec is intentionally still in clarify phase — the categorization framework above is a proposal, not a decision.
- 2026-05-18T21:55Z Expanded inventory to the 5-section structure (matching the SKILL.md headings). Added "Recent change history" — confirmed via `git log` that the past week's commits (#94, #101, #104) only touched gate plumbing, not the checks themselves. The signal-to-noise problem predates v0.30.0.
