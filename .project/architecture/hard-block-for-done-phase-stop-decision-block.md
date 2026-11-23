# Hard Block for Done Phase (Stop `decision: "block"`)

[Navigation after completion](hierarchy-navigation-on-ticket-completion.md).

**Status:** Accepted
**Date:** 2026-01-07 (updated 2026-10-02: records the structured-JSON block; the original exit-2 mechanism was replaced)

**What.** The Stop quality hook blocks completion in the done phase until the agent shows evidence. `hardBlockDone()` prints `{decision: "block", reason, systemMessage}` JSON and exits 0. The block also applies when `stop_hook_active` is set. The user sees the hint in `systemMessage`.

**Why.** The hook prevents premature "done" claims by requiring the output listed below.

**Trade-off.** Showing evidence adds a step at completion.

**Alternatives.** An agent could ignore a reminder or claim completion without evidence if there were no check.

**Implementation.** `packages/cli/templates/hooks/stop-quality.ts` - `hardBlockDone()` with evidence pattern matching; GFM checkbox predicate extracted to `.safeword/hooks/lib/scenario-format.ts` (`analyzeScenarioFormat`) for direct unit testability

**Evidence.** Features require: `✓ X/X tests pass` + `All N scenarios marked complete` + `Audit passed`. Tasks: test only.
