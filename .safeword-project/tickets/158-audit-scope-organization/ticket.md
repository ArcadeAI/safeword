---
id: 158
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:41:00Z
last_modified: 2026-05-18T05:58:00Z
scope: |
  Reorganize /audit's output to clearly separate ticket-scoped findings from
  project-wide findings WITHOUT losing any capability the current /audit
  provides. The reshape is purely an output-structure change — every check
  the current /audit runs continues to run unchanged.

  Implementation invariant: tools always run whole-repo. The change set is
  used only for post-hoc partitioning of results into ticket-scope vs
  project-scope tiers — NEVER for scoping tool execution (e.g., never use
  `jscpd -f "<changed-files>"` or `depcruise --include-only` derived from
  the change set). Doing so would miss span-scope findings — a clone or
  cycle that involves both a changed file AND an unchanged file would
  disappear because the unchanged side wasn't fed to the tool. Run wide,
  partition narrow.

  Output structure (Option D from the design debate):

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

  Required mitigations to preserve everything useful from the current /audit:

  1. Per-check sub-headers within each tier — preserve coherent "show me all
     duplication" / "show me all dead code" grouping. Tiers are scope; sub-
     headers within are check type. No bullet soup.

  2. Preserve the outdated-dep triage TABLE (Package / Current / Latest /
     Type / Bump / Risk) — keep as a table inside project-scope, not bullets.

  3. Span-scope findings include both filenames — when a finding involves
     files from both ticket-scope AND non-ticket files (cycle, clone, doc
     reference), surface both paths so the user can judge fault:
     `[W001] Duplication: src/changed.ts ↔ src/long-standing.ts`.
     Anchor rule: a finding with >=1 file in the change set lives in
     ticket-scope, full file list shown.

  4. Project-scope framing as "context, not noise" — section header reads
     `### Project scope (repo-wide context — review periodically)`, not just
     `### Project scope`. Guards against users training themselves to skip.

  5. Prose-level "always runs everything" guarantee — add one line to the
     skill's prose stating "/audit always runs all checks across the whole
     repo; the report partitions findings by whether they touch your ticket's
     change set." Once in the skill, not per-run.

  Change-set derivation: active ticket -> `git diff <ticket-base>..HEAD` where
  ticket-base = commit before ticket creation OR first commit since ticket was
  marked in_progress. No active ticket -> `git diff main...HEAD` (branch
  divergence). Neither -> all files classified as project-scope (graceful
  degradation, audit still runs whole-repo as today).

  Findings with no file (outdated deps, stale tickets, broader agent config
  drift) are always project-scope by definition.
out_of_scope: |
  - Suppressing pre-existing findings (they appear in project-scope, not
    hidden — visibility preserved)
  - Adding new check types (only reorganizing existing output)
  - Baseline/delta tracking (the original 158 framing — ticket-scoping
    makes baseline-relative reporting unnecessary)
  - A `--full` or `--ticket` flag to switch modes (no modes: default is
    always the partitioned output since all checks run regardless)
  - Auto-fix of any finding (read-only restructuring of report)
done_when: |
  - /audit output matches the Option D structure above when run on a project
    with an active ticket
  - All five mitigations implemented (per-check sub-headers; dep table
    preserved; span-scope filenames; "context — review periodically" framing;
    prose always-runs guarantee)
  - No active ticket case degrades gracefully: everything in project-scope,
    ticket-scope absent or empty
  - On a project with a recent ticket touching 12 files: ticket-scope section
    has findings only from those files (+ span-scope cycles/clones with
    unchanged sides labeled); project-scope has the rest
  - All current /audit capabilities verified intact: per-check coherence,
    dep table structure, severity codes E001/W001..W006, "Audit passed"
    verdict patterns for done-gate hook
  - Skill prose documents the partitioning rule once (not per-run)
---

# /audit: ticket-scope vs project-scope output organization

**Goal:** Reorganize /audit's output so the user immediately sees what _this ticket_ introduced vs what's longstanding repo state — without losing any capability the current /audit has.

**Why:** /audit today dumps the whole repo's findings as one undifferentiated stream. 84 pre-existing duplicate clones drown out the 2 new ones the current ticket introduced. The user has to manually filter every run. The fix is structural: partition the report into ticket-scope and project-scope tiers. The hard constraint (and the reason the original 158 "delta-aware" framing was abandoned) is that the reshape must NOT cost any of the current capabilities — per-check coherence, structured dep triage, visibility of cumulative debt, the unambiguous "audit ran on everything" guarantee. The five mitigations in scope address each loss surfaced in the design debate.

**Prior art validating the pattern:** Scope-aware static analysis is industry standard. Semgrep exposes `SEMGREP_BASELINE_REF` for diff-aware scans (https://semgrep.dev/docs/kb/semgrep-appsec-platform/missing-pr-comments). The community `dependency-cruiser-report-action` visualizes dep diagrams for changed files only in PRs (https://dev.to/mh4gf/visualize-typescript-dependencies-of-changed-files-in-a-pull-request-using-127j). SonarQube has PR Analysis mode. The novel piece here is the _output partitioning_ (ticket-scope + project-scope in one report), not the change-set scoping itself.

**Supersedes:** the original 158 framing ("delta-aware reporting" / baseline-relative). Baselines are unnecessary once ticket-scoping is the primary axis.

## Work Log

- 2026-05-18T05:41:00Z Started: ticket created from 152 audit-skill improvement debate (original framing: delta-aware reporting)
- 2026-05-18T05:58:00Z Pivoted: reframed from baseline-relative to ticket-scope-vs-project-scope after architectural debate showed scope-partitioning is the better primitive. Five mitigations baked in to preserve every capability of current /audit.
- 2026-05-18T06:05:00Z Hardened: added "run wide, partition narrow" implementation invariant + prior-art citations (Semgrep, dependency-cruiser-report-action) after /quality-review flagged the span-scope correctness trap.
