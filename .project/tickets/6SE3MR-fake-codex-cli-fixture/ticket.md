---
id: 6SE3MR
slug: fake-codex-cli-fixture
type: task
phase: done
status: done
parent: S3T6JA
epic: agent-surface-refactor
scope:
  - Assess duplicated fake Codex CLI setup in Cucumber and Vitest tests.
  - Extract only the fake binary writer if it reduces duplication without coupling test harnesses.
  - Leave Cucumber world setup and Vitest helpers separate unless a concrete repeated behavior emerges.
out_of_scope:
  - Merging Cucumber and Vitest test harness setup.
  - Reworking Codex feature steps unrelated to fake CLI creation.
done_when:
  - Either a small shared fake Codex binary fixture exists, or the ticket records why the duplication should stay.
  - The ticket does not introduce a dependency from Cucumber steps onto Vitest-only helpers.
  - Existing Cucumber and Vitest Codex tests still pass.
created: 2026-06-14T01:39:37.303Z
last_modified: 2026-06-25T06:35:00Z
---

# Share fake Codex CLI fixtures where it pays off

**Goal:** Remove only the fake Codex CLI duplication that is worth sharing.

**Why:** `packages/cli/features/steps/codex.steps.ts` and `packages/cli/tests/helpers.ts` both write a small fake `codex` executable, but the surrounding test setup belongs to different harnesses.

## Figure-it-out pass

**Frame:** Decide whether duplicated fake Codex CLI setup should be shared across Cucumber and Vitest.

**Research domains:** Cucumber step runtime; Vitest helper coupling; test fixture boundaries; maintenance payoff.

**Options considered:** Leave duplication; extract only fake binary creation; merge all Codex project setup helpers.

**Recommend:** Extract only fake binary creation if another use appears during implementation. The two test harnesses have different responsibilities, so broad fixture sharing would add coupling for a tiny payoff.

**Next:** Try the smallest shared helper; keep the ticket open as a no-op if the extraction makes call sites less clear.

## Notes

- This is intentionally low priority.
- A no-code decision is acceptable if the attempted extraction increases indirection.
- Quality-review guardrail: favor clarity at the call sites over deleting two tiny repeated lines.

## Work Log

- 2026-06-25T06:35:00Z Revalidated actual duplication: Cucumber and Vitest each write the same two-line fake `codex` executable, but sharing it would couple harnesses for negligible payoff. Closed as a no-code decision; focused Cucumber and Vitest Codex checks pass.
- 2026-06-14T02:05:00Z Reviewed: Added harness-boundary guardrail.
- 2026-06-14T01:46:00Z Scoped: Figure-it-out selected narrow fixture extraction only.
- 2026-06-14T01:39:37.303Z Started: Created ticket 6SE3MR.
