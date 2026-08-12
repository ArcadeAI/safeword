---
id: 05Z2TJ
slug: make-large-behavior-specifications-navigable
type: task
phase: done
status: done
created: 2026-08-11T23:26:44.983Z
last_modified: 2026-08-12T03:30:59Z
external_issue: https://github.com/ArcadeAI/safeword/issues/2583
external_prs: [https://github.com/ArcadeAI/safeword/pull/2596]
---

# Make large behavior specifications navigable for maintainers

**Goal:** Split the offload-tests specification into cohesive Rule-aligned files without changing its behavior contract

**Why:** Reviewers need smaller navigable specifications while retaining exact traceability and proof

**Type:** Refactor

**Scope:** Split the existing offload-tests Gherkin corpus along intact Rule boundaries, preserve its semantic inventory exactly, and add a high-water guard against future monolithic feature growth.

**Out of Scope:** Product behavior, scenario wording, step definitions, runtime code, Cucumber configuration, proof policy changes, and the broader BDD semantic review in PR #2584.

**Done When:**

- [x] Cohesive feature files have unique names, retain `@wip`, and preserve all 16 Rule IDs.
- [x] Automated inventory proves no scenarios, outlines, Examples rows, tags, or proof references were lost or duplicated.
- [x] A reviewed high-water guard catches future extreme feature-file growth without imposing routine arbitrary splits.
- [x] Gherkin lint, applicable BDD/test lanes, audit, refactor review, and quality review pass.

**Tests:**

- [x] RED: the current 1,646-line/16-Rule file violates the high-water policy.
- [x] GREEN: the split corpus passes the high-water policy and semantic-inventory contract.
- [x] Existing executable proof remains green; the full repository verification plan completed with unrelated environment/concurrency failures recorded in `verify.md`.

## Work Log

- 2026-08-12T03:30:59Z Complete: User confirmed completion; draft CI passed every gate on Node 22 and Node 24, and the ready-PR closure check required this verified ticket to ship as `status: done`.
- 2026-08-12T02:21:38Z Verified: Merged three intervening `main` commits with no overlap, reran the preservation suite (8/8), Gherkin lint, ESLint, typecheck, and dependency audit successfully; recorded broad-suite environment/concurrency limits in `verify.md`.
- 2026-08-12T00:11:47Z Improved: Refactor and quality-review findings aligned feature discovery with the shared resolver and made preservation independently reproducible from immutable pre-split commit `1f8056ed8`; 8/8 focused tests pass.
- 2026-08-11T23:36:00Z Green: Gherkin lint, the two-test preservation/maintainability contract, focused ESLint, and TypeScript typecheck pass.
- 2026-08-11T23:33:00Z Implemented: Split the monolith into 16 intact Rule-aligned feature files and encoded the unchanged semantic inventory in an automated regression contract.
- 2026-08-11T23:27:21Z Planned: Amended GitHub #2583 with exact counts and preservation safeguards; isolated work on `codex/2583-navigable-bdd-specs` from current `origin/main`.
- 2026-08-11T23:26:44.983Z Started: Created ticket 05Z2TJ
