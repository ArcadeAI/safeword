# Work Log: Generate compliant replies without correction loops

**Anchored to:** `.project/tickets/6QEA9Y-generate-compliant-replies-without-rewrites/ticket.md`

---

## Session: 2026-08-02

- [21:17] Investigated #1753 and duplicates #1766, #1782, #1783, and #1789; all five occurred on Claude with safeword v0.70.0.
- [21:20] Confirmed PR #1540's compact UserPromptSubmit reminder is included in v0.70.0, so the reports are evidence that the prior fix is insufficient rather than missing from the release.
- [21:22] Researched Claude lifecycle timing, persistent-instruction guidance, long-context position effects, and Safeword host/template parity.
- [21:23] Decision: source the exact contract from `quality.ts`, deliver it once through session context and after compaction, retain the compact per-prompt cue, and keep Stop enforcement as the fallback.
- [21:24] Created feature ticket 6QEA9Y anchored to GitHub issue #1753 and drafted the intake brief plus three persona jobs.
- [21:34] Quality review requested changes: startup instruction alone cannot remove the second turn because `stop-quality.ts` unconditionally continues eligible phase reviews; Cursor evidence was also out of scope.
- [21:36] Revised direction: add conditional terminal-brief validation using Claude's `last_assistant_message`, export a phase-neutral shared contract, narrow delivery to Claude/Claude Cloud, and leave Cursor/Codex parity with #1547.
- [21:43] Independent re-review approved the revised intake with no critical issues; user accepted the JTBD set and asked to apply all suggestions.
- [21:45] Linked all four consolidated occurrences, resolved BLOCKED grammar as Tried + terminal Need without a separate Next paragraph, and drafted seven Rules covering startup/compaction, TDD quiet mode, compliant pass-through, one correction, hard-gate precedence, shared ownership, and deterministic parsing.
- [21:50] User accepted all seven Rules. Drafted the engineering contract: Claude-only lifecycle delivery and structural Stop validation, with Cursor/Codex parity, semantic grading, contract redesign, and gate weakening explicitly excluded.
- [21:53] User approved the engineering boundary. Advanced to define-behavior and derived ten dimensions covering lifecycle boundaries, both verdict grammars, invalid boundaries, loop state, TDD quiet mode, gate precedence, contract composition, delivery wiring, and affected surfaces.
- [22:00] Authored 15 scenario groups across seven Rules, including startup/compaction, both valid grammars, malformed boundaries, bounded correction, TDD quiet mode, hard-gate precedence, real installed-hook wiring, parity drift, and deterministic parsing.
- [22:12] Quality review requested changes for false-positive parser boundaries, hard/advisory precedence, unproven Cloud coverage, missing persona-visible proof, and overlapping cases.
- [22:15] Defined a contiguous final-block grammar, quote/fence exclusion, exact ordering and terminality, CRLF and bounded large-input cases; split hard/advisory precedence across first and correction Stops; recorded Cloud's real-runtime limitation and required a live persona walkthrough or explicit verification limitation.
- [22:23] Fresh quality review found missing resume/clear lifecycle partitions, indented-code and HTML Markdown boundaries, and NTB1.R1's required rejection path. Added all three plus unambiguous competing-gate setup and in-process parser timing.
- [22:31] Current-doc re-review found Claude's newer distinct fork SessionStart source and list items as the remaining CommonMark container partition. Added both to the contract, behavior matrix, and done state.
- [22:38] Final independent quality review approved the revised behavior proposal with no critical issues or suggested improvements; Gherkin lint and scenario-ledger traceability are clean.
- [22:42] User accepted the revised scenarios. Advanced from define-behavior to scenario-gate for formal review-spec validation.
- [22:51] Formal review-spec found two must-fix and five should-strengthen items. Applied all seven: real hook subprocess wiring, linear-work measurement, RED/GREEN/REFACTOR partitioning, per-consumer parity, ignored-container non-poisoning, live-runtime failure evidence, and exact optional-Rejected placement.
- [22:58] Scenario re-gate found a vacuous typecheck-suppression precondition and under-specified malformed BLOCKED grammar. Added actionable typecheck advice to the correction fixture and four explicit BLOCKED rejection partitions.
- [23:04] Final independent review-spec passed with 0 must-fix and 0 should-strengthen. Recorded the scenario-gate review stamp; no build-only kill risk warranted a spike; advanced to plan-implementation.
- [23:19] Implementation-plan review requested proof corrections: configured exact-once compact delivery, additive standing context, distinct compact terminal cues, deterministic BLOCKED and duplicate-label cases, and real per-consumer validation boundaries. Revised the scenarios and plan inputs before re-gating.
- [23:27] Scenario re-gate corrected plugin drift proof to canonical generation plus worktree-diff detection, expanded duplicate-label rejection to all six paragraph labels, and separated deterministic linear-work evidence from a declared reference-runner timing benchmark.
- [23:36] Revised scenarios passed review-spec again with zero findings. The corrected implementation plan then passed independent review with no must-fix findings; recorded the plan review stamp and advanced to implement.
- [00:34] Final quality review exposed five proof and implementation gaps: Claude's per-hook context cap, duplicated grammar sources, CommonMark list/HTML false positives, vacuous linear-work instrumentation, and script-only distribution tests.
- [00:36] Remediated all five: split reply delivery into an under-cap SessionStart value, derived prompts and validation from one grammar object, covered nested list and HTML declaration/PI/CDATA blocks, counted actual parser passes, and executed both configured legacy and generated-plugin event groups.
- [01:02] Final quality review closed the remaining host-boundary and CommonMark gaps. The focused ticket lane passes 87/87 scenarios (3,299 steps); the full repository lane passes 910/913 scenarios with three skips (34,443 executed steps).
- [01:18] Full verification passes: 6,489 runnable Vitest tests, build, lint, typecheck, dependency audit, parity, and the diff-scoped Safeword audit. Live Claude proof remains explicitly unavailable because the local API rejected every available model before generation.
