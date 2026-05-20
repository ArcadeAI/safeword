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

## Design notes from parallel session (branch `pedantic-hawking-65d53c`)

A separate session — same author — re-derived parts of this problem space from scratch before discovering 155 existed. The three design artifacts below are **input to this ticket's clarify phase**, not commitments. Each answers or refines one of 155's open questions/buckets.

### Input for open Q1 + bucket-A output structure (was local ticket "158 audit-scope-organization")

Once the categorization in this ticket settles which checks remain in /audit (bucket A), the output should partition into ticket-scope vs project-scope tiers — Option D below. Five mitigations ensure no current /audit capability is lost.

**Implementation invariant: "run wide, partition narrow."** Tools always run whole-repo. The change set is used only for post-hoc partitioning of results — NEVER for scoping tool execution (e.g., never `jscpd -f <changed-files>` or `depcruise --include-only` derived from change set). Doing so would miss span-scope findings — clones/cycles between changed and unchanged files would disappear because the unchanged side wasn't fed to the tool.

**Change-set derivation:** active ticket → `git diff <ticket-base>..HEAD`; no ticket → `git diff main...HEAD`; neither → all findings classified as project-scope (graceful degradation).

**Option D output structure:**

```
## Audit

**Summary:** N errors, M ticket warnings, K project notes — <verdict>

### Ticket scope (X files changed)
**Architecture:** <findings or "No new cycles introduced">
**Dead code:** <findings>
**Duplication:** <findings>
**Docs impact:** <findings>
**Test quality:** <findings>
**Agent config:** <if ticket touched config files>
**Learning files:** <if ticket touched learnings>

### Project scope (repo-wide context — review periodically)
**Outdated deps:** [STRUCTURED TABLE preserved — Package/Current/Latest/Type/Bump/Risk]
**Architecture:** <whole-repo findings>
**Dead code:** <pre-existing findings>
**Duplication:** <pre-existing findings + count summary>
**Stale tickets:** <if .safeword/ present>
**Agent config drift:** <if not touched by ticket>
```

**Five required mitigations to preserve every current /audit capability:**

1. **Per-check sub-headers within each tier.** Tiers are scope; sub-headers within are check type. Preserves coherent "show me all duplication" / "show me all dead code" grouping. No bullet soup.
2. **Preserve the outdated-dep triage TABLE** (Package / Current / Latest / Type / Bump / Risk) — keep as a table inside project-scope, not flatten to bullets.
3. **Span-scope findings include both filenames.** When a finding involves files from both ticket-scope AND non-ticket files (cycle, clone, doc reference), surface both paths: `[W001] Duplication: src/changed.ts ↔ src/long-standing.ts`. Anchor rule: ≥1 file in change set → ticket-scope, full file list shown.
4. **Project-scope framing as "context, not noise."** Section header reads `### Project scope (repo-wide context — review periodically)`, not just `### Project scope`. Guards against users training themselves to skip the section.
5. **Prose-level "always runs everything" guarantee.** Add one line to the skill's prose: "/audit always runs all checks across the whole repo; the report partitions findings by whether they touch your ticket's change set." Once in the skill, not per-run.

**Prior art validating the pattern:** scope-aware static analysis is industry standard. Semgrep `SEMGREP_BASELINE_REF` for diff-aware scans (https://semgrep.dev/docs/kb/semgrep-appsec-platform/missing-pr-comments). The community `dependency-cruiser-report-action` visualizes dep diagrams for changed files only in PRs (https://dev.to/mh4gf/visualize-typescript-dependencies-of-changed-files-in-a-pull-request-using-127j). SonarQube has PR Analysis mode. The novel piece is the _output partitioning_ (ticket-scope + project-scope in one report), not the change-set scoping.

### Input for bucket-B / bucket-C: docs-impact heuristic (was local ticket "157 audit-docs-impact-heuristic")

/audit currently _describes_ a documentation-impact check in prose but never executes it. The check has two complementary forms that align with bucket-B and bucket-C:

- **Edit-triggered form (bucket B):** PostToolUse hook fires when a doc is edited; verifies all file references in the doc still exist. Catches the doc→code direction (doc was edited; does it still point at real code?). Already mentioned in 155 bucket-B candidates.
- **Periodic form (bucket C or A):** for each file changed in the last N commits, grep all docs/guides/skills for references to changed file paths or exported symbol names. Flag any reference that points at code that has materially changed without a corresponding doc edit. Catches the code→doc direction.

The two directions are **not substitutes**. Edit-triggered misses the code-change-orphans-doc-reference case; periodic check is slow and reactive. Best to run both at different cadences.

### Input for open Q2: /test-audit sibling skill (was local ticket "160 test-audit-skill")

Recommendation for Q2: **yes, create a sibling skill `/test-audit`** for test quality. Spec:

- Test quality is currently described in /audit prose but not executed — would be one of bucket C's discovery candidates.
- Layered with existing skills: `/tdd-review` = per-test discipline during active cycle; **`/test-audit` = suite-wide quality sweep**; `/audit` (bucket A "test quality" entry) = smell signal in broader audit; `testing` knowledge skill = how-to reference.
- Checks to implement (AST-based via existing eslint plugins + targeted grep):
  - Weak assertions (toBeTruthy/toBeDefined/not.toThrow without specific value)
  - Test independence (shared mutable state across tests)
  - Arbitrary timeouts (sleep, waitForTimeout with hardcoded ms)
  - Happy-path only (no error case tests for exported functions)
  - Duplicate tests that should use it.each / parameterized
  - Test naming describing implementation vs behavior
  - Skipped/xfailed tests without rationale
- Implementation route: AST-based via `eslint-plugin-vitest` / `eslint-plugin-jest`, plus targeted grep for cross-cutting patterns. Register in SAFEWORD_SCHEMA.ownedFiles. Cursor rule + command for parity with other action skills.
- One-line differentiation to embed in the skill prose: **`/audit` answers "can I ship this?" — `/test-audit` answers "will my tests catch what I'd want them to?"**

---

## Work Log

- 2026-05-18T20:55Z Created from the audit-skill cleanup discussion. Triggered by recent /audit on ticket 154 producing 19 false-positive dep flags + 5 weak-assertion flags, while missing the real ARCHITECTURE.md drift on first pass. Spec is intentionally still in clarify phase — the categorization framework above is a proposal, not a decision.
- 2026-05-18T21:55Z Expanded inventory to the 5-section structure (matching the SKILL.md headings). Added "Recent change history" — confirmed via `git log` that the past week's commits (#94, #101, #104) only touched gate plumbing, not the checks themselves. The signal-to-noise problem predates v0.30.0.
- 2026-05-19T20:30Z Appended design notes from parallel session (branch `pedantic-hawking-65d53c`) — output structure for bucket-A (Option D + 5 mitigations + "run wide partition narrow" invariant), docs-impact spec for bucket-B/C, /test-audit sibling skill answering open Q2. Design notes are input to clarify phase, not commitments — categorization decisions in this ticket take precedence.
