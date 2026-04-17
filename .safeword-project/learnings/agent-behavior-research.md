# AI Agent Behavior Research

Covers: TDD for agents, verification patterns, enforcement layers, context overload, instruction design, test scope, task decomposition, scenario validation.

Research-backed principles for how AI coding agents should be guided through multi-step processes. Applied in tickets #109 (enforcement redesign) and #113 (BDD phase updates).

## Core Principle: Control for Persistent Weaknesses, Lean into Improving Strengths

| Models improving at                      | Models NOT improving at (scaling-resistant) |
| ---------------------------------------- | ------------------------------------------- |
| Code generation, debugging, test writing | Multi-step process adherence                |
| Single-file edits, small refactors       | Self-evaluation ("am I done?")              |
| Understanding complex codebases          | Maintaining state over long sessions        |

**Source:** Anthropic "Sleeper Agents" (2024); METR task evaluations; ARC Evals on premature success declaration; Liu et al. "Lost in the Middle" (2024) — mid-context attention weakness persists at 200K+ tokens.

## Enforcement Layers

### Natural gates (strongest)

Artifact dependencies where the process enforces itself — physics, not policy. The agent can't bypass because the next step's input doesn't exist yet.

**Source:** Build system dependency theory (Make/Bazel); practitioner consensus that structural enforcement is more robust than permission enforcement (Claude Code community discussions).

### Reminders (moderate)

Prompt hook context injection for steps without natural gates. One compressed status line per turn, not accumulated context.

**Source:** Anthropic "Effective Context Engineering for AI Agents" (2025); ACE paper (arxiv 2510.04618) — naive repeated injection causes "context collapse." Use bounded state replacement, not raw accumulation.

### Anthropic's 4-layer safety model

Anthropic's "Trustworthy agents in practice" (Apr 9, 2026) defines four required safety layers: model, harness, tools, environment. Safeword operates at the **harness layer** — confirms our scope is correct and that we shouldn't try to be all four layers. The paper emphasizes no single defense mechanism suffices and that multi-layer structural enforcement beats relying on model compliance alone, directly validating the "physics not policy" principle.

**Source:** Anthropic "Trustworthy agents in practice" (2026-04-09), anthropic.com/research.

### Output validation (hard backstop)

Evidence requirements at done — tests must pass, scenarios marked complete, audit run.

**Source:** Anthropic's tiered oversight model (low-risk autonomous, medium-risk flagged, high-risk blocked). Done-gate evidence is "high-risk" enforcement — irreversible (shipping).

## The TDD Prompting Paradox

**Finding:** Verbose TDD workflow prompts INCREASED regressions from 6.08% to 9.94% — worse than no intervention. Agents don't need to be told HOW to do TDD; they need to be told WHICH tests to check.

**Implication:** Simplify procedural TDD instructions. Fewer steps = better outcomes. The agent's trained ability to write tests is degraded by over-specification.

**Source:** TDAD: Test-Driven Agentic Development (arxiv 2603.17973v2). Tested on Qwen3-Coder 30B (open-weight). Graph-based approach cut regressions to 1.82%.

## Context Overload

**Finding:** Model accuracy degrades as instruction context grows. Front-loading reference documents before each task causes context rot — validated facts lose salience as transcript length grows.

**Implication:** Don't instruct the agent to "load the testing skill and read the testing guide" before writing each test. Let skills auto-trigger. Consult guides for specific questions, not wholesale loading.

**Source:** Context rot research (Chroma 2025, arxiv 2510.05381). OpenAI guidance: "start with the smallest prompt that passes your evaluations."

## Scenario Validation Criteria (AODI)

| Criterion         | Check                          | Red flag                        |
| ----------------- | ------------------------------ | ------------------------------- |
| **Atomic**        | Tests ONE behavior             | Multiple When/Then pairs        |
| **Observable**    | Has externally visible outcome | Internal state only             |
| **Deterministic** | Same result on repeated runs   | Time/random/external dependency |
| **Independent**   | No ordering dependency         | "After Scenario 2 runs..."      |

Industry standard is BRIEF (Rose & Nagy, "Formulation" 2021). AODI is more structural and mechanically checkable — better for AI agents.

**Source:** Seb Rose & Gaspar Nagy, "BDD Books: Formulation" (2021); Cucumber community BRIEF guidelines.

## Test Scope Selection

**Principle:** Prefer the highest scope that covers the behavior with acceptable feedback speed.

Aligns with the Testing Trophy (Kent C. Dodds) and Google testing research favoring integration-level tests. The feedback-speed qualifier prevents E2E drift — agent won't use E2E to test a pure function.

**Source:** Kent C. Dodds, Testing Trophy (updated through 2025); Google Testing Blog (2024-2025).

## Task Decomposition

**Finding:** Decomposition improves parallel tasks (+81%) but degrades sequential ones (39-70%). Most feature implementation is sequential.

**Implication:** Make decomposition optional. Use principle-based ordering ("each task builds on what's working") rather than fixed ordering (data → logic → API → UI).

**Source:** Google DeepMind subtask evaluation (2024); SWE-bench evaluations showing top agents use iterative decomposition, not full upfront planning.

## Verification: Artifacts over Prose

**Finding:** SWE-bench found agents claim success ~40% more often than tests confirm. Text pattern matching in agent prose is fragile.

**Implication:** Verify by reading artifacts directly (parse test-definitions.md checkboxes, run the test suite) rather than matching text in the agent's output ("All 5 scenarios marked complete"). Same principle as running tests — structural verification, not self-reported prose.

**Source:** SWE-bench (Princeton, 2024); SWE-agent, Devin, OpenHands all verify by reading artifacts; Anthropic tool-use guidance (2024-2025) recommends verifying state by reading files/APIs, not parsing agent prose.

## Cross-Scenario Refactoring Risk

**Finding:** Final refactoring passes after all tests pass risk ~15-20% higher regression rates than incremental refactoring.

**Implication:** Always run full test suite after cross-scenario refactoring. The `/refactor` skill has a revert protocol, but the explicit regression check should be in the done phase instructions.

**Source:** Microsoft AutoDev (arxiv 2403.08299, 2024); SWE-bench evaluations.

## Positional Bias (Recency Bias is Outdated)

**Finding:** "Put critical rules at the END of documents" was based on Liu et al. "Lost in the Middle" (2024) showing mid-context degradation. Claude 4 models (Opus 4.5/4.6) show reduced positional bias. Anthropic's long-context tips now recommend placing large documents at TOP with queries/instructions below — for data-heavy prompts, not for exploiting recency bias in CLAUDE.md.

**Implication:** Don't advise "put critical rules at END." Instead, focus on document placement for comprehension: large reference docs at top, instructions below. For CLAUDE.md-style files, position matters less with current models — focus on clarity over position tricks.

**Source:** Anthropic long-context tips (docs.anthropic.com); Claude 4 best practices — "more precise instruction following" reduces need for positional hacks. Liu et al. "Lost in the Middle" (2024) findings still apply to mid-context data retrieval but not to instruction-following in short config files.

## Instruction Ordering

**Finding:** LLMs treat unordered lists as unordered — sequencing within a flat list is unreliable.

**Implication:** Use numbered/ordered lists when step order matters. For multi-step phases (like DONE), use ordered sub-steps within conceptual sections, not flat prose.

**Source:** Wang et al., "Self-Consistency Improves Chain of Thought Reasoning" (2023).

## Idempotent Operations Don't Need Checkpoints

**Finding:** From distributed systems (saga pattern) — if operations are idempotent and retriable, checkpoint boundaries before them are unnecessary overhead.

**Implication:** Safeword's "Close" steps (update ticket status, cascade epic, commit) are all idempotent. No phase gate needed between "Finish" (quality checks) and "Close" (bookkeeping).

**Source:** Saga pattern (Garcia-Molina & Salem, 1987); standard distributed systems transaction theory.

## Spec-Driven Development

**Finding:** SDD (ThoughtWorks Radar "Assess" ring, 2025) gates implementation on a finalized spec artifact. Anthropic's own best practices recommend "interview me, then write a complete spec to SPEC.md."

**Implication:** Artifact-gating transitions (can't create test-definitions.md without a complete ticket spec) aligns with both SDD and Anthropic's recommended workflow.

**Source:** ThoughtWorks Technology Radar Vol 31 (2025); Anthropic Claude Code best practices; Addy Osmani "My LLM Coding Workflow" (2026).

## Anti-Patterns

| Anti-pattern                                       | Why it fails                                                                      | What to do instead                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Hard-blocking edits during planning phases         | Creates gridlock, robs agent of intelligence, fights model improvement trajectory | Natural gates + reminders + output validation                     |
| Front-loading reference documents before each task | Context overload degrades accuracy                                                | Let skills auto-trigger; consult guides for specific questions    |
| Verbose procedural TDD instructions (6+ steps)     | Increases regressions (TDAD paradox)                                              | 3 steps: pick scenario, write failing test, commit                |
| Fixed task ordering (data → logic → API → UI)      | Assumes greenfield; removes agent judgment                                        | Principle: "build on what's working"                              |
| Self-review for correctness judgments              | LLMs unreliable at self-evaluation (Huang et al. 2023)                            | Structural gates + evidence requirements                          |
| BDD compliance self-check                          | Self-reporting of process adherence; performative                                 | Evidence requirements (tests pass, scenarios complete, audit run) |
| Tautological tests                                 | Assertions mirror implementation, catch no bugs                                   | Assert on behavior, not implementation mirror                     |

## Key Sources

- TDAD: Test-Driven Agentic Development (arxiv 2603.17973v2, 2025)
- TDFlow: Agentic Workflows for Test Driven SE (arxiv 2510.23761v1)
- Anthropic, "Effective Context Engineering for AI Agents" (2025)
- Anthropic, "Measuring AI Agent Autonomy" (2025)
- Anthropic, "Trustworthy Agents in Practice" (2025)
- Anthropic, "Building Effective Agents" (2024)
- Huang et al., "LLMs Cannot Self-Correct Reasoning Yet" (2023)
- Liu et al., "Lost in the Middle" (2024)
- Google DeepMind, subtask decomposition evaluation (2024)
- SWE-bench evaluations (Princeton, 2024-2025)
- Kent C. Dodds, Testing Trophy
- Rose & Nagy, "BDD Books: Formulation" (2021)
- ACE paper (arxiv 2510.04618)
