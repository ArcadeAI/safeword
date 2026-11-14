---
id: 3J0QCR
slug: check-agent-edit-preservation
type: task
phase: done
status: done
created: 2026-11-14T05:29:59.168Z
last_modified: 2026-11-14T14:48:58.255Z
---

# Verify unfinished edits survive agent lint feedback

**Goal:** Add one cheap opt-in live-agent smoke with deterministic grading for pending imports, unrelated bytes, and task completion

**Why:** Hook assertions do not measure the agent response to post-edit diagnostics

## Scope and proof

One isolated opt-in Claude smoke under experiments/, invoking the real post-tool-lint hook with real local ESLint. No runtime/template changes, other hosts, new framework, automatic CI runs, or edits to existing tests. Use an eight-turn, 120-second run and a $0.10 CLI estimated-spend limit; the estimate can overshoot and is not a billing guarantee. One launch, no automatic retry.

The task asks for an import edit followed by its use without coaching how to handle warnings. A recording hook forwards actual hook output unchanged and records source snapshots. Require an observed intermediate unused-import diagnostic, unchanged unrelated lines at every edit, the import's later use, correct final output, and successful agent termination. Missing hook evidence, skipped intermediate state, no-op agents, broken task output, mutation by the hook, and unrelated rewrites fail. This is one wiring/behavior smoke, not a reliability or cross-host claim.

Calibrate the deterministic grader with known-good and known-bad records before implementation of the live runner. Run targeted grader tests and source-hook recording integration with no model cost; then launch the bounded live case once and preserve raw output and an honest pass/fail/inconclusive result. Reuse installed local tools; do not download dependencies or change global agent configuration.

Applicable principle: independent observation means final task output and recorded hook snapshots decide the verdict, rather than the agent's claim that it finished. Keep implementation under experiments/ with one focused Vitest grader suite.

## Verdict contract and work log

- 2026-11-14T14:42:54.832Z: User-requested final-layout run passed on committed c7ca7253e: five turns, 9,473ms, estimated $0.029803. Two real hook observations preserved bytes and showed the unused-import finding appear and clear; final functional cases passed. Artifacts: .project/tmp/3J0QCR-final-layout-20261114T1442/. This closes the initial private-launcher live-evidence gap without code changes. Total estimated cost of both recorded live launches: $0.051117. Later user instruction authorized this evidence-only documentation update; no additional model run or CI rerun is needed.

Infrastructure/auth/budget/timeout failures and failure to encounter the intermediate unused-import diagnostic are inconclusive, not agent regressions. A combined import-and-use edit is likewise inconclusive. A completed run that encountered the diagnostic but changes unrelated bytes, loses the required import, or fails the functional check is a failure. The frozen unrelated export must remain byte-for-byte identical at every recorded edit, irrespective of line shifts. The fixture pins no-unused-vars and object-curly-spacing; the no-cost probe confirmed the real hook emits both and preserves source bytes.

- 2026-11-14T05:29:59.168Z Started: Created ticket 3J0QCR.
- Intake review ca7c7bb3-fa2c-4d21-b691-55331c57ca2f approved; its verdict-classification and fixture warnings are addressed above.
- Standalone RED: the initial empty grader failed the direct no-op rejection assertion. This is not a Vitest RED claim: the focused Vitest command was still waiting for the shared test lock when the grader was implemented. Six direct calibration assertions subsequently passed. The initial Vitest request exited 75 after twenty minutes without starting a test; the subsequent canonical run passed 14/14. The original red-named log is lock-contention history, not observed RED evidence.
- One live Claude Haiku 4.5 run passed at 2026-11-14T05:35:10.259Z: five turns, estimated $0.021314. Two actual post-edit hook observations preserved source bytes; the first emitted no-unused-vars for formatName and formatting findings, and the second cleared the unused-import finding without rewriting the unrelated export. Three frozen functional inputs passed. Artifacts: .project/tmp/3J0QCR-live-1/. No retries, no AI judge, no product/template changes.
- After review, the fixture's shared dependency link was replaced with a private ESLint launcher; the real-hook probe passed on that final layout without another model call. Full-diff review 3dde6678-2d8a-4f6a-94f0-6b99162fee01 and verification review 816d1b3d-fea2-44c4-b6b3-c61c4f6ea6d8 approved. Canonical grader tests passed 14/14; lint and strict/package types passed. The actual source CLI Codex Stop returned a successful empty decision and changed this ticket to done at 2026-11-14T06:02:27.696Z. This is a local, unpublished follow-up; no current-PR CI result for the experiment is claimed.
