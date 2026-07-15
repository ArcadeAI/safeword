---
id: A8NNZV
slug: prevent-retro-duplicate-issues
type: feature
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1032
phase_anchors:
  - "define-behavior: d18ed978234f4f67bb582a7c174faf78cbd391a5"
  - "scenario-gate: 34aa4cd07c80e70a7d9c9fd4a7d0c3924d731d2a"
  - "implement: 94969bf9d48f4259f3d3472a265a551ca4a96c11"
  - "verify: 53759c50a4049f27b50ffb106f04c7d5cb969edd"
  - "done: 6799f4abc5003dadfda660cc8bd9a156a40d1967"
scope: Add a deterministic canonical marker derived from normalized repro evidence; write it to new CLI-filed issue bodies; search exact legacy signature before the exact canonical marker; update the matched issue's occurrence ledger.
out_of_scope: Spool/agent-filer parity, fuzzy or related-issue matching, automatic issue closure, and changing dedupe for legacy issues that lack a canonical marker.
done_when: A recurrence whose title, category, and surface differ but whose canonical repro identity matches updates the existing issue ledger; legacy signature-only issues still dedupe; unmatched or only-fuzzy candidates create a new issue.
created: 2026-07-14T04:36:28.727Z
last_modified: 2026-07-14T04:36:28.727Z
---

# Prevent repeated retro findings from opening duplicate issues

**Goal:** Match recurring retro findings to their canonical GitHub issue despite model-derived metadata drift.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-14T04:36:28.727Z Started: Created ticket A8NNZV
- 2026-07-14T04:38:00Z Found: #1032 limits this slice to CLI triage; #1031 owns spooled filing and #1034 owns fuzzy related-link behavior.
- 2026-07-14T04:38:00Z Decided: Candidate canonical identity is code-owned normalization and hashing of the command-oriented repro field, excluding title/category/surface; exact markers remain the only merge authority.
- 2026-07-14T04:45:43Z Confirmed: User accepted exact normalized repro as the canonical identity source.
- 2026-07-14T04:46:30Z Started behavior definition: translating the approved canonical-marker contract into executable scenarios.
- 2026-07-14T04:48:00Z Defined: Six scenarios cover marker emission, canonical recurrence, legacy precedence, exact-match rejection, new-issue behavior, and same-session ledger idempotency.
- 2026-07-14T04:53:00Z Reviewed: Independent scenario review found no blocking issues; strengthened atomic assertions and documented #1035 as the wiring-test owner.
- 2026-07-14T04:53:00Z Planned: Draft construction, triage fallback, then REST exact filtering; implementation plan records decisions and follow-up triggers.
- 2026-07-14T10:04:00Z Implemented: Added deterministic canonical repro markers, legacy-first canonical fallback, exact REST filtering, and recurrence-ledger coverage.
- 2026-07-14T10:06:00Z Reviewed: Independent quality review found issue/PR search mixing and an optional fallback contract; both were fixed and a fresh review approved the result.
- 2026-07-14T10:10:00Z Verifying: focused tests, typecheck, lint, build, Gherkin, and audit pass; the full Vitest wrapper is queued behind concurrent repository tests.
- 2026-07-14T13:16:00Z Fixed during verification: Cucumber discovered the specification without step definitions; tagged the intentionally non-executable feature `@manual` and confirmed its integration and acceptance lanes pass.
- 2026-07-14T21:38:00Z Completed: User accepted closure with the documented local full-suite evidence limitation.
