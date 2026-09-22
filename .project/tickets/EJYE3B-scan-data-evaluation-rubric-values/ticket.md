---
id: EJYE3B
slug: scan-data-evaluation-rubric-values
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/4767
created: 2026-09-22T17:21:42.280Z
last_modified: 2026-09-22T22:21:00.000Z
---

# Reject sensitive values anywhere in data evaluation rubrics

**Goal:** Reject sensitive-looking values in every authored evaluation rubric identifier.

**Why:** Rubric IDs can reach checked-in responses but currently bypass the corpus safety scan.

**Type:** Improvement

**Scope:** Extend corpus safety verification across every expected and forbidden decision/proof identifier with the same credential, email, and entropy rules used for other authored corpus strings.

**Out of Scope:** Changing rubric semantics, identifier vocabulary, model responses, or the synthetic-placeholder convention.

**Done When:**

- [x] All four rubric identifier arrays are scanned with field-specific paths.
- [x] Credential-prefix, email-shaped, and non-placeholder high-entropy rubric IDs fail verification.
- [x] Synthetic placeholders and the current checked-in corpus remain accepted.
- [x] Focused evaluator tests and deterministic corpus verification pass.

**Tests:**

- [x] RED: an email-shaped expected decision ID is accepted by the current safety verifier.
- [x] GREEN: every rubric array rejects each sensitive-value class with a focused diagnostic.
- [x] REFACTOR: authored corpus strings use one recursive safety traversal without duplicating field lists.

## Work Log

- 2026-09-22T17:21:42.280Z Started: Created ticket EJYE3B
- 2026-09-22T17:22:30.000Z Validated: A focused probe set an expected decision ID to customer@example.com and observed accepted=true with no diagnostics.
- 2026-09-22T17:52:32.000Z RED: Added 12 focused cases covering all four rubric arrays and all three sensitive-value classes; all failed with empty diagnostics while the existing 81 evaluator tests passed.
- 2026-09-22T17:52:32.000Z GREEN: Reused the recursive authored-value safety traversal for each case rubric; all 93 focused evaluator tests passed.
- 2026-09-22T17:52:32.000Z Verified: Changed-file ESLint and Prettier passed unchanged, package type-check passed, and deterministic verification accepted 9 evaluation records plus 1 ablation record.
- 2026-09-22T20:34:04.000Z Full verification: The first authoritative run passed 10,288 tests; BDD passed 1,503 scenarios and 68,909 steps; builds and type-checks passed. A later duplicate run and the proof-tag/dependency lanes were limited by unrelated timeouts, a shared test lock held by another worktree, and registry/OSV connection failures.
- 2026-09-22T20:34:04.000Z Audit: Diff-scoped architecture, dependency-boundary, dead-code, documentation, and test-quality review found no issue in #4767.
- 2026-09-22T22:21:00.000Z Done: Independent ticket-artifact review approved with nonblocking evidence warnings; added explicit synthetic-placeholder acceptance coverage for each rubric array, and confirmed the record/verify CLI callers invoke the safety verifier.
