---
id: J7VBGJ
slug: tdd-sha-checkbox-ledger
type: feature
phase: implement
status: in_progress
created: 2026-05-20T14:45:51.962Z
last_modified: 2026-05-20T14:45:51.962Z
scope:
  - Extend the existing per-scenario `- [ ] RED / GREEN / REFACTOR` checkboxes in test-definitions.md so that the transition to `[x]` carries either a commit SHA (`- [x] RED <sha>`) or `skip: <non-empty reason>` to deliberately omit a step.
  - Annotation lives on the existing per-scenario checkboxes — no new ledger structure, no new file. Matches safeword's per-scenario TDD discipline in .claude/skills/bdd/TDD.md ("Pick first unchecked scenario from test-definitions. Cycle through RED → GREEN → REFACTOR. Mark ONE checkbox per edit, commit after each step.").
  - Add a single feature-level row at the bottom of test-definitions.md for the cross-scenario refactor pass (same SHA-or-skip format).
  - PreToolUse hook on Edit/Write of test-definitions.md blocks any `[ ] → [x]` transition that lacks a SHA or `skip: <reason>`.
  - PreToolUse hook on Bash(git commit *) during `phase: implement` reads the current step from checkbox state and inspects `git diff --cached --name-only`. Block REFACTOR commits that touch test files (prevents test-behavior drift during cleanup). RED and GREEN commits are unrestricted. Applies to all `git commit *` forms including `--amend`.
  - Done gate (stop-quality.ts) enforces, per scenario and per feature row: SHAs on non-skipped steps are distinct and reachable from HEAD; skip reasons are non-empty.
  - At least one real SHA per scenario (a scenario with three skips is rejected — represents work that produced no commits).
  - Update bdd skill (TDD.md and VERIFY.md) to teach the new format in the smallest possible diff.
  - Tests cover: skip-accept, empty-reason-reject, SHA collision detection, REFACTOR-touches-tests block, cross-scenario row enforcement.
out_of_scope:
  - Grandfathering / migration of pre-existing in-flight tickets. Pre-existing checkboxes without SHAs are silently ignored by the new validation (forward-looking rule only).
  - Categorized skip reasons / allowlists — free-form non-empty string is the rule.
  - Explicit `RED:` / `GREEN:` / `REFACTOR:` commit message prefixes — file-path heuristic only.
  - AST-level or semantic refactor detection beyond file paths.
  - Per-task aggregation (per-scenario is the chosen unit — matches existing TDD.md discipline).
  - Auto-filling SHAs for the agent — the agent writes them, the hook validates.
  - Tightening bdd decomposition guidance to steer non-TDD tasks out of test-definitions.md.
  - Applying the skip-with-reason pattern to other phase artifacts (decomposition section in ticket.md, dimensions.md) — that's ticket MKVNFB, blocked on this one.
  - RED-step commit file-path restriction ("RED commits may only touch test files"). Originally in scope; dropped 2026-05-21 after revisiting `.safeword-project/learnings/procedural-gates-generalize-beyond-tdd.md` (TDAD finding: rigid procedural rules degraded agent performance from 6.08% to 9.94% regressions). The rule is not load-bearing — bundling is already caught by SHA-on-checkbox + SHA-distinctness at done; the REFACTOR file-path rule is the only one that catches something the SHA mechanism cannot (test-behavior drift during cleanup). Also avoids the new-module-stub friction noted during Task 1.
done_when:
  - Writing `- [x] GREEN` without a SHA or `skip:` is blocked at the Edit/Write hook with a clear message.
  - Committing test files during a REFACTOR step is blocked at the Bash hook with a clear message.
  - A scenario whose RED and GREEN bear the same SHA fails the done gate, naming the scenario.
  - A `skip:` line with an empty or whitespace-only reason fails the done gate.
  - A `skip: trivial — no structural change` line passes.
  - A scenario with `skip:` on all three steps fails the done gate ("represents work that produced no commits").
  - The cross-scenario refactor row is validated at done with the same rules.
  - bdd/TDD.md and bdd/VERIFY.md describe the new format.
  - Existing safeword test suite stays green.
  - New tests cover every done_when path above.
---

# TDD ledger: SHA-or-skip on RED/GREEN/REFACTOR checkboxes (incl. cross-scenario refactor)

**Goal:** Close the silent-skip gap in safeword's TDD enforcement by anchoring every per-scenario TDD step (and the feature-level cross-scenario refactor pass) to either a real git commit SHA or a deliberate `skip: <reason>` line. Done gate verifies the anchors.

**Why:** A 2026-05-20 transcript from arcade-deepresearch showed an agent collapse RED+GREEN into one commit, roll a structural lint-fix into GREEN, and mark the task done — REFACTOR was silently skipped. Safeword had no signal at the commit boundary to catch it; only the human caught it. Current infrastructure tracks TDD step state via checkbox positions but doesn't validate that each step corresponds to a distinct commit. The same gap exists one scope up: cross-scenario refactor is mentioned in [.claude/skills/bdd/VERIFY.md:7](.claude/skills/bdd/VERIFY.md:7) and surfaced as a verify-phase reminder ([packages/cli/templates/hooks/prompt-questions.ts:73](packages/cli/templates/hooks/prompt-questions.ts:73)) but is never validated.

## Why the skip-with-reason mechanic

`skip: <reason>` is the escape valve. Anthropic's May 2026 agent design guidance (Building Effective AI Agents) favors verification by environmental fact over agent-maintained ledgers. The checkbox + SHA is the environmental fact (git history). The `skip:` line is the agent's accountability — safeword cannot prevent a determined agent from lying ("skip: trivial") but can prevent thoughtless omission. Writing a reason forces a deliberate choice; the transcript's failure was forgetting, not gaming.

## Design choices already locked from intake conversation

- Per-scenario annotation (extends the existing R/G/R checkboxes; matches safeword's per-scenario TDD discipline in TDD.md).
- Skip allowed on any of RED/GREEN/REFACTOR with non-empty reason; cross-scenario row uses same format.
- At least one real SHA per scenario (three skips ⇒ rejection).
- File-path heuristic on commits (implicit), no message prefix requirement.
- No migration / grandfathering code; pre-existing checkboxes without SHAs are silently allowed.

## Context anchor

Audit findings driving scope:

- TDD step tracking is read-only today: [packages/cli/templates/hooks/lib/active-ticket.ts](packages/cli/templates/hooks/lib/active-ticket.ts) `parseTddStep` derives current step from per-scenario checkbox positions; no enforcement at commit boundary, no concept of tasks.
- TDD.md guidance is per-scenario, per-step: ".claude/skills/bdd/TDD.md line 20" — `Pick first unchecked scenario from test-definitions. Cycle through RED → GREEN → REFACTOR.` and line 24 — `Mark ONE checkbox per edit, commit after each step.`
- TDD reminders are soft only: [packages/cli/templates/hooks/prompt-questions.ts:70-71](packages/cli/templates/hooks/prompt-questions.ts:70-71).
- Done gate validates checkbox-marked state ([packages/cli/templates/hooks/stop-quality.ts:390](packages/cli/templates/hooks/stop-quality.ts:390)) but not commit distinctness.
- Cross-scenario refactor reminder: [packages/cli/templates/hooks/prompt-questions.ts:73](packages/cli/templates/hooks/prompt-questions.ts:73) — no validation.
- Macro-phase boundaries (scope → test-defs → app code → verify.md) are already correctly gated by artifact existence — out of scope here.

## Decomposition

5 tasks. Ordered so each builds on what's already working. Tasks 2–4 are independent after Task 1 but ordered chronologically (write → commit → finalize) so a TDD reader follows the agent's encounter sequence.

| #   | Task                                                                                                                                                           | Scenarios covered                                                     | Test type   | Depends on |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------- | ---------- |
| 1   | Annotation parser + validators in `packages/cli/templates/hooks/lib/` (parseAnnotation, validateSkipReason, isReachableSHA)                                    | — (foundation; tested via unit tests, not test-definitions scenarios) | unit        | nothing    |
| 2   | Write-time gate — extend `pre-tool-quality.ts` to block `[ ] → [x]` transitions on `test-definitions.md` lacking SHA or `skip:`                                | Rule 1 (scenarios 1–6)                                                | integration | Task 1     |
| 3   | Commit-time gate — extend `pre-tool-quality.ts` on `Bash(git commit *)` to block REFACTOR commits that touch test files (only load-bearing file-path rule)     | Rule 2 (scenarios 7–8 after scope reduction)                          | integration | Task 1     |
| 4   | Done-gate — extend `stop-quality.ts` to validate per-scenario SHA distinctness/reachability AND the feature-level cross-scenario row                           | Rule 3 (9–13) + Rule 4 (14–17) after renumbering                      | integration | Task 1     |
| 5   | Propagation — update `.claude/skills/bdd/TDD.md` + `VERIFY.md`, sync `packages/cli/templates/skills/bdd/`, add cross-scenario row to test-definitions template | — (docs/template)                                                     | manual      | Tasks 1–4  |

Within each task, TDD operates per-scenario (matching safeword discipline): pick first unchecked scenario from test-definitions.md, RED → GREEN → REFACTOR with SHA-or-skip annotation on each step's checkbox.

## Work Log

- 2026-05-20T14:45:51.962Z Started: Created ticket J7VBGJ
- 2026-05-20T14:46:00Z Scoped: scope / out_of_scope / done_when populated from the 2026-05-20 design session; cross-scenario refactor row folded in per user decision to bundle (rather than route to MKVNFB or split a third ticket).
- 2026-05-20T14:51:00Z Complete: Phase 3 - 20 scenarios defined across 4 rules, dimensions.md and test-definitions.md saved.
- 2026-05-21T00:50:00Z Loop-back to Phase 3 - adversarial pass + investigation revealed scope-unit conflict: original "per-task" framing contradicts safeword's per-scenario TDD discipline (TDD.md line 20). User confirmed pivot to per-scenario. Rewriting scope wording and test-definitions.md scenario framing accordingly.
- 2026-05-21T00:53:00Z Complete: Phase 3 (re-run) - 20 scenarios rewritten in per-scenario framing across the same 4 rules; dimensions.md and ticket.md scope updated to match; cross-scenario refactor row unchanged (still feature-level).
- 2026-05-21T00:54:00Z Complete: Phase 4 - All 20 scenarios pass AODI (Atomic/Observable/Deterministic/Independent). Adversarial pass v2 confirmed clean: noted that "three-skip-per-scenario rejection" is more aggressive in per-scenario framing but matches the intent; edits to existing annotations (not [ ]→[x]) remain allowed at write-time, done-gate is the collision arbiter — both already covered by existing scenarios + scope.
- 2026-05-21T00:55:00Z Complete: Phase 5 - Decomposed into 5 tasks. Task 1 is foundational (parser/validators, unit-tested); Tasks 2-4 each cover one rule's scenarios via integration tests; Task 5 propagates docs + template. Owning the two split questions surfaced in proposal: kept Task 4 merged (cross-scenario row uses same validation as per-scenario) and kept Task 5 merged (docs + template are both ~30 lines about "future tickets see new world").
- 2026-05-21T01:38:00Z Task 1 RED: commit 383587d - 24 failing tests for parseCheckboxAnnotation/classifyAnnotation/isValidSkipReason. Stub module added to satisfy lint's import-x/no-unresolved (noted as adversarial finding for Task 3 design: file-path RED rule must allow new-module stubs).
- 2026-05-21T01:38:00Z Task 1 GREEN: commit 425a354 - 24/24 pass, full hooks suite 81/81. Pure functions, ~50 LOC.
- 2026-05-21T01:39:00Z Task 1 REFACTOR: skip: no structural improvement needed — three pure functions under 10 lines each, no duplication or smells. Canonical skip-with-reason case the new feature is designed to handle.
- 2026-05-21T04:07:00Z Scope reduction (mid-implement, between Task 1 and Task 2): dropped the "RED commits may only touch test files" rule from scope. Triggered by re-reading `.safeword-project/learnings/procedural-gates-generalize-beyond-tdd.md` — the project's own captured TDAD principle says generic procedural rules degrade agent performance. The RED file-path rule turned out non-load-bearing (bundling is caught by SHA-distinctness; REFACTOR-touches-tests is the only file-path rule that catches something SHA cannot). Removed 3 scenarios from test-definitions.md Rule 2 (scenarios 7-9: RED+tests allow, RED+app block, GREEN+anything pass — now vacuously true). Total scenario count 20 → 17. Task 3 shrinks. Also resolves the new-module-stub friction surfaced in Task 1 RED commit (`383587d` notes).
- 2026-05-21T04:20:00Z Task 2 RED: commit 149fe3e - 6 integration tests for Rule 1 (write-time annotation gate). 3 fail (deny cases), 3 pass trivially (allow cases — hook defaults to allow without impl).
- 2026-05-21T04:21:00Z Task 2 GREEN: commit ee1f54c - extended pre-tool-quality.ts with collectNewTransitions + the gate block; synced parse-annotation.ts to .safeword/. 6/6 Rule 1 pass; full hooks+integration subset 153/153.
- 2026-05-21T04:22:00Z Task 2 REFACTOR: skip: no structural improvement needed — ~60 LOC of new code across 3 small functions with parallel dispatcher branches, no duplication.
- 2026-05-21T04:22:00Z Task 2 dogfooded: marked all 6 Rule 1 scenarios in test-definitions.md with [x] RED 149fe3e / [x] GREEN ee1f54c / [x] REFACTOR skip:reason. Hook is live in .safeword/ and accepted every annotated transition. End-to-end loop closed for Rule 1.
- 2026-05-21T06:25:00Z Task 3 RED: commit 2939941 - 2 integration tests for Rule 2 (commit-time REFACTOR gate). 1 fails (deny case), 1 passes trivially.
- 2026-05-21T06:26:00Z Task 3 GREEN: commit ba86f2b - Bash gate in pre-tool-quality.ts + parseTddStep regex fix to handle annotated checkboxes. Discovered the regex defect during integration testing: parseTddStep's `\s*$` anchor rejected the new annotated form, breaking step derivation everywhere. Fixed inline. 174/174 across hooks + 4 integration suites.
- 2026-05-21T06:26:30Z Task 3 REFACTOR: skip: no structural improvement needed — single function (~40 LOC) with a clear comment explaining the parseTddStep semantic mapping (returns last checked step; agent doing REFACTOR = parseTddStep returns 'green').
- 2026-05-21T06:26:30Z Task 3 dogfooded: marked both Rule 2 scenarios with [x] RED 2939941 / [x] GREEN ba86f2b / [x] REFACTOR skip:reason. End-to-end loop closed for Rule 2.
