---
id: ZA6DGD
slug: give-automatic-pr-reviews-enough-context
type: task
phase: verify
status: in_progress
scope:
  - keep each changed patch as the artifact under review
  - add the same changed text file's full content from the exact reviewed head as bounded supporting context
  - preserve the existing no-checkout, no-customer-code-execution, split inspection/publication boundary
out_of_scope:
  - repository-wide context discovery or model-directed file fetching
  - unchanged neighboring files, freshness reuse, inline finding lifecycle, or controlled execution
  - changing provider selection, routing policy, or rollout defaults
done_when:
  - the automatic reviewer receives changed patches and exact-head full-file context as distinct evidence roles
  - unavailable, stale, binary, or over-budget context cannot produce a falsely complete clean review
  - workflow, command, provider, and receipt tests prove the boundary without broadening permissions
parent: P0D6S2
created: 2026-08-20T16:09:57.369Z
last_modified: 2026-08-20T16:09:57.369Z
---

# Give automatic PR reviews enough context

**Goal:** Reduce patch-only false findings by reviewing each changed patch with bounded full-file context from the exact PR head

## Tests

- [x] A changed text patch is reviewed with full content fetched from the same head SHA.
- [x] Supporting context cannot become a finding target or reviewer instruction.
- [x] Missing, mismatched, unreadable, or over-budget context makes the review incomplete and routes it to a human.
- [x] Fork inspection still performs no checkout or customer-code execution and publication receives only serialized advisory evidence.

## Work Log

- 2026-08-20T16:09:57.369Z Started: Created ticket ZA6DGD
- 2026-08-20T16:14:00Z Rescoped as a task-sized improvement to the existing
  automatic-review feature. Chose exact-head full content for changed text
  files over repository discovery or a second model round.
- 2026-08-20T16:18:00Z TDD: Added public command, provider prompt, evidence
  budget, unavailable-context, workflow, and smoke-boundary coverage. The
  focused lane passes 22/22; workflow actionlint, ESLint, Gherkin lint, and
  TypeScript checks pass.
- 2026-08-20T16:42:00Z Review: Independent Claude found pagination and unsafe
  context-degradation gaps. Flattened all paginated GitHub evidence, selected
  the latest retained receipt, skipped removed-file blobs, degraded missing,
  empty, malformed, and unreadable context to an incomplete human route, and
  made the disposable GitHub canary verify the exact `.flux` blob bytes.
  Focused coverage passes 25/25; actionlint, plugin sealing, and static checks
  pass.
- 2026-08-20T17:18:00Z Verify: Rechecked against the unchanged current main,
  pinned retained receipts to GitHub Actions rather than any bot account, and
  passed the 25-test focused lane, workflow actionlint, generated-plugin
  release contract, ESLint, Gherkin lint, TypeScript, and diff checks.
- 2026-08-20T17:29:00Z Review: Made the disposable canary configuration
  runnable by the production command and made fixture environment mutation
  tolerate canonical steps without a predeclared env map. Rejected the claim
  that `environment.deployment` is invalid because the project design records
  GitHub's documented contract and actionlint accepts every generated workflow.
- 2026-08-20T17:38:00Z Review: Moved the retained-receipt short circuit ahead
  of changed-file and blob collection so unchanged scheduled reviews stay
  cheap. Distinguished a valid empty exact-head file from malformed context so
  truncating a file to empty remains reviewable. Focused coverage passes 26/26.
