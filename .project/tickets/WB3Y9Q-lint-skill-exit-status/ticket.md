---
id: WB3Y9Q
slug: lint-skill-exit-status
type: task
phase: verify
status: in_progress
created: 2026-07-31T16:12:59.734Z
last_modified: 2026-07-31T16:32:31Z
scope: "Correct the optional Go lint section's shell control flow across the shipped lint guidance surfaces."
out_of_scope: "Changing the lint commands, their best-effort error-reporting policy, or other language sections."
done_when: "A JavaScript-only project runs the shipped lint instructions to completion without an absent go.mod determining the exit status."
external_issue: "https://github.com/ArcadeAI/safeword/issues/1701"
---

# Keep optional lint sections from failing nonmatching projects

**Goal:** Make the lint workflow complete successfully after all applicable language sections run.

**Why:** JavaScript-only projects currently receive a false failure because an absent optional Go manifest becomes the script exit status.

## User Story

As a JavaScript-only project maintainer, I want the lint instructions to skip the optional Go section successfully so that a completed applicable lint run is not reported as failed.

### Acceptance Criteria

- A project with `package.json` and no `go.mod` receives a zero exit status after the documented lint block runs.
- A project with `go.mod` still executes the existing Go lint commands.
- The canonical templates, dogfood files, and packaged Codex plugin keep the same behavior.

## Figure-it-out Decision

**Decision:** How should an optional language section skip cleanly without masking the behavior of a present section?

**Investigation plan:** confirm shell exit semantics, compare a conditional block with catch-all alternatives, and verify every shipped lint surface derives from the canonical template.

**Domains researched:** shell control-flow semantics; error-reporting behavior of the existing lint instructions; template, dogfood, and Codex-plugin distribution.

**Options considered:**

1. Keep `[ -f go.mod ] && { ...; }` and append `|| true`. Small, but a catch-all makes the optionality and any future command failure harder to reason about.
2. End the document with an unconditional `true`. Fixes this report but couples the whole document's status to a trailing workaround.
3. Use `if [ -f go.mod ]; then ... fi`. The skipped branch returns success while the existing inner reporting behavior is unchanged.

**Decision:** Choose option 3. Bash documents that an AND list returns the status of its last executed command, which makes a false manifest check return non-zero; it also documents that an `if` with no true condition returns zero. The explicit conditional is the smallest portable expression of an optional language section. (verified: [GNU Bash lists](https://www.gnu.org/software/bash/manual/html_node/Lists.html), [GNU Bash conditional constructs](https://www.gnu.org/software/bash/manual/bash.html))

**Premortem:** A future copy of the lint instructions could retain the old guard; the regression test will execute every shipped surface in a JavaScript-only fixture.

**Next:** Add the failing multi-surface lint-instruction contract test before changing the templates.

## Test Definitions

**Test scope:** A focused integration-style documentation contract test runs each shipped lint block in a temporary JavaScript-only project, stubbing only the process commands at the boundary.

### Scenario: JavaScript-only lint instructions complete successfully

Given a project with `package.json` and no `go.mod`
When the shipped lint instructions run with successful JavaScript command stubs
Then every shipped surface exits with status zero

- [x] RED skip: `bun run test tests/skills/lint-skill-exit-status.test.ts` failed the five JavaScript-only surfaces with exit status 1 while the five Go-manifest controls passed.
- [x] GREEN d07030c36
- [x] REFACTOR skip: each shipped surface is intentionally covered by one process-level contract; extracting source-specific assertions would hide distribution drift.

### Scenario: Go lint instructions remain conditional on a Go manifest

Given a project containing `go.mod`
When the shipped lint instructions run with a Go lint command stub
Then the existing Go lint commands execute

- [x] RED skip: this control behavior already passed before the fix; the JavaScript-only scenario supplied the regression failure.
- [x] GREEN d07030c36
- [x] REFACTOR skip: the Go-manifest control shares only the fixture and remains a distinct observable behavior.

## Work Log

- 2026-07-31T16:13:28Z Revalidated: Selected #1661 after duplicate aggregation, but closed it as completed because current main contains the fingerprint-marker fix and its no-op install regression; selected #1701 on the next low-risk/high-impact/frequency tie and reproduced its JavaScript-only exit status of 1.
- 2026-07-31T16:13:28Z Figure-it-out: Chose explicit `if [ -f go.mod ]; then ... fi` over `|| true` or a trailing success command after verifying current Bash list and conditional semantics; source distribution requires template parity plus Codex-plugin generation.
- 2026-07-31T16:15:32Z RED: Added the real-process lint-instruction contract; the JavaScript-only case fails on all five shipped surfaces with status 1, while the `go.mod` control cases pass.
- 2026-07-31T16:18:06Z GREEN: Replaced the optional Go `&&` list with an explicit `if` block, regenerated dogfood and Codex plugin copies, and passed the focused 10-case contract, parity, and repository lint/typecheck. (refs: d07030c36)
- 2026-07-31T16:22:02Z REFACTOR: No structural extraction was warranted; the test intentionally executes each shipped surface so template, dogfood, and plugin drift remains observable.
- 2026-07-31T16:22:02Z Audit: Passed the Safeword diff-scope audit against `origin/main`, including sync and dependency checks; no domain-document or code-quality findings.
- 2026-07-31T16:22:02Z Quality review: Approved the explicit optional-section control flow, five-surface distribution contract, and real-process test boundary; no critical or suggested changes.
- 2026-07-31T16:32:31Z Verify: Full Safeword verify gate passed: 377 test files / 5,649 tests passed with 5 expected skips; 499 Gherkin scenarios passed with 3 expected skips; build, typecheck, and dependency-plan stages exited successfully.
- 2026-07-31T16:12:59.734Z Started: Created ticket WB3Y9Q
