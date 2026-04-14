---
id: '121'
type: task
phase: intake
status: in_progress
created: 2026-04-14T17:26:00Z
last_modified: 2026-04-14T17:26:00Z
scope:
  - Replace current Phase 3 "draft scenarios" step with structured pipeline (derive dimensions, partition, generate, organize under rules, card-ratio check, adversarial pass, saturation exit)
  - Update SCENARIOS.md with the full pipeline — always visible, no depth-scaling
  - Add adversarial self-red-team pass to Phase 4 after AODI validation
  - Rationale shown as plain text per-rule in test-definitions files (HTML comment format deferred to #122)
out_of_scope:
  - Depth-scaling / hiding the pipeline for small features (ticket #122)
  - Changes to Phase 0-2 (intake) or Phase 5+ (decomposition, implement, done)
  - Tooling or automation — this is prompt/skill file changes plus hook enforcement additions
done_when:
  - SCENARIOS.md describes the full pipeline concisely (short structured steps + concrete examples, not verbose checklists)
  - SCENARIOS.md includes 1-2 concrete turn examples showing what the agent says at each stage
  - Phase 4 section includes adversarial pass after AODI
  - Pipeline always shows decomposition regardless of feature size
  - Template test-definitions format uses rule headers with plain-text rationale (blockquotes)
  - Two named saturation checks: scenario saturation (Phase 3) and coverage saturation (Phase 4)
  - Phase gate: pre-tool hook blocks test-definitions.md creation when ticket is still in intake phase
  - Dimension artifact gate: features require dimensions.md (behavioral dimensions + partitions) before test-definitions.md creation
  - Stop-quality hook enforces GFM checkbox format with hard-block on unrecognized formats
  - Integration tests cover phase gate, dimension gate, and GFM format guard
---

# Phase 3 Scenario Completeness Pipeline

**Goal:** Give the agent a structured, research-backed method for determining scenario completeness at Phase 3, replacing the current "draft happy/failure/edge" approach.

**Why:** Current Phase 3 has no completeness signal — the agent drafts scenarios from intuition and asks "anything missing?" There's no systematic way to derive what dimensions exist, partition them, or know when coverage is sufficient. This leads to missed scenarios on complex features and over/under-generation on simple ones.

## Design

The pipeline composes six research-backed techniques into a single flow:

| Step | Technique                                    | What it does                                                                                                                                       |
| ---- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Decomposition-as-proxy                       | Derive behavioral dimensions from intake artifacts (resolved questions, done-when, scope) + domain-knowledge dimensions not surfaced during intake |
| 2    | Equivalence partitioning                     | Partition each dimension into classes + boundaries                                                                                                 |
| 3    | Scenario generation                          | One scenario per partition + boundary cases                                                                                                        |
| 4    | Example Mapping structure                    | Organize scenarios under rule headers                                                                                                              |
| 5    | Card-ratio check + present to user (decider) | Self-check (too many rules? gaps? open questions?) then present. User accepts, tweaks, or adds                                                     |

Phase 4 additions:

- After AODI validation, agent runs adversarial pass ("what breaks that none of these catch?")
- Saturation check: did adversarial + user feedback produce new scenarios? No → done

### Propose-and-converge at Phase 3

The agent presents dimensions, partitions, and scenarios in a single turn. The user accepts, corrects dimensions, or adds scenarios. When a turn produces no new scenarios (scenario saturation), proceed to Phase 4. Phase 4 has a separate **coverage saturation** check: after the adversarial pass + user feedback, if no new scenarios surface → done.

### Concrete turn example

**Context:** User asked for a `--dry-run` flag on the init command. Intake produced scope (show what would be created without creating it), done-when (output matches real init, no side effects), and resolved questions (works with empty dirs and existing configs).

**Agent turn 1:**

> From intake I see 2 behavioral dimensions:
>
> | Dimension              | Partitions                                    |
> | ---------------------- | --------------------------------------------- |
> | Output correctness     | empty dir, existing config, conflicting files |
> | Side-effect prevention | filesystem writes, git operations             |
>
> Organized under 3 rules:
>
> **Rule: Dry-run output matches real init**
>
> - [ ] Shows expected files in empty directory
> - [ ] Shows warning when config already exists
> - [ ] Shows conflict notice for incompatible existing files
>
> **Rule: Dry-run creates no files**
>
> - [ ] No files created on disk
>
> **Rule: Dry-run skips git operations**
>
> - [ ] No git init or git add executed
>
> 3 rules, 5 scenarios, 0 open questions. The "conflicting files" partition came from domain knowledge — init currently overwrites without warning, so dry-run should surface that. Anything missing, or ready for the quality gate?

**User:** "Looks good, proceed."

**Result:** No new scenarios → scenario saturation → proceed to Phase 4.

### Test-definitions format

```markdown
## Rule: Description of business rule

- [ ] Scenario covering partition A
- [ ] Scenario covering partition B (boundary)

## Rule: Non-obvious rule

> Rationale: Why this rule exists and why these partitions matter

- [ ] Scenario covering partition C
- [ ] Scenario covering partition D
```

### Implementation notes

- **Short numbered list + concrete example (refactor/debug pattern):** SCENARIOS.md should use the same format as the best-performing safeword skills: short numbered steps (5 items, 1 sentence each) plus 1 concrete turn example showing the steps in action. This is the dominant strategy — highest ceiling (steps + example reinforce), lowest floor (worst case is ~40 lines of redundancy). Supported by: MLI Threshold (structured > prose for procedural tasks), Anthropic redundancy guidance (important rules at multiple levels), think-tool research (54% improvement with examples), and dogfooding data (refactor/debug pattern had best compliance).
- **Phase gate (self-report, lightweight):** Pre-tool hook blocks test-definitions.md creation when ticket is still in `intake` phase. Forces conscious phase transition. One `if` statement, reuses existing infrastructure. Already implemented in pre-tool-quality.ts.
- **Dimension artifact gate (true natural gate):** Features require `dimensions.md` in the ticket folder before `test-definitions.md` can be created. Mirrors the artifact prerequisite pattern (scope/out_of_scope/done_when → ticket.md). The file contains the behavioral dimension table and partitions — it's a real artifact the agent references during scenario writing, not a checkbox. Already implemented in pre-tool-quality.ts.
- **Why two gates:** Phase gate catches the coarse failure (writing scenarios during intake). Dimension gate catches the fine failure (writing scenarios without systematic dimension analysis). Phase gate is self-report; dimension gate is structural. Research (TDAD, AgentSpec) shows structural gates work for safety/correctness while procedural instructions degrade performance — so we gate structurally and teach via examples.
- Preserve the existing Phase 3 exit step: save test-definitions.md, update `phase: scenario-gate`, add work log entry. The pipeline changes what happens during Phase 3, not the exit mechanics.
- Stop-quality hook now enforces GFM `- [ ]` / `- [x]` format (changed in this branch). New test-definitions must use this format.

### Research basis

- Example Mapping (Matt Wynne/Cucumber) — rule/example card structure, card-ratio heuristics
- Equivalence partitioning + boundary analysis — systematic coverage from testing theory
- Saturation detection (qualitative research) — run-of-N zero-yield termination
- Decomposition-as-proxy (Claude Research architecture) — sub-question tracking as completeness
- Adversarial self-review — catches blind spots systematic approaches miss
- Budget/decider pattern (design sprints) — asymmetric roles converge faster

## Work Log

- 2026-04-14T20:23:00Z Implementation: Rewrote SCENARIOS.md (5-step pipeline + concrete dry-run example + adversarial pass + coverage saturation). Added 4 gate tests to quality-gates.test.ts (phase deny, dimension deny, dimension allow, task bypass). Fixed existing test 9.3 to include dimensions.md. Synced templates. 54/54 quality-gates tests pass.
- 2026-04-14T18:12:00Z Enforcement gates: Implemented two gates in pre-tool-quality.ts — (1) phase gate: blocks test-definitions.md creation when ticket still in intake, (2) dimension artifact gate: features require dimensions.md before test-definitions.md. Synced templates. Updated from single dimension-gate to two-tier approach after research showed structural gates > procedural gates (TDAD, AgentSpec). Dimension gate is true natural gate (file must exist); phase gate is lightweight self-report reusing existing infrastructure.
- 2026-04-14T17:59:00Z Compliance improvements: Added 3 research-backed changes — (1) prose format for SCENARIOS.md per Claude 4 prompting docs, (2) concrete turn example for compliance per think-tool research, (3) dimension-gate via pre-tool hook per safeword's natural-gate enforcement pattern. Updated scope and done-when.
- 2026-04-14T17:48:00Z Hook fix: Updated stop-quality.ts regex to GFM standard (- [x] / - [ ]), added hard-block on unrecognized format, synced template, updated 8 test fixtures (49/49 pass)
- 2026-04-14T17:35:00Z Quality review: Fixed 4 issues — (1) collapsed steps 5+6 into single step, (2) named two saturation checks (scenario vs coverage), (3) changed rationale format from HTML comments to plain-text blockquotes (HTML comment format deferred to #122), (4) added domain-knowledge dimensions to step 1 derivation
- 2026-04-14T17:26:00Z Created: Ticket from brainstorming session on Phase 3 completeness. Research covered deep research architectures (Claude, ChatGPT, Perplexity), Example Mapping, equivalence partitioning, saturation detection, design sprint convergence, and Specification by Example. Converged on composing all six techniques into a single always-visible pipeline.
