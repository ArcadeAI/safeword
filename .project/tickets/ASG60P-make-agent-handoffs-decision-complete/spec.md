# Product Plan: Make agent handoffs decision-complete in real replies

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** Real Claude Code and Codex sessions produced structurally valid terminal handoffs whose final `Next` or `Need` paragraph could not be understood without scrolling. The prior prompt-only contract proved distribution and Markdown shape, not usable semantics.
- **Expected outcome:** A person can read only the terminal handoff and know the choice or action, Safeword's recommendation, the controlling reason, the material tradeoff or consequence, and the exact reply when a decision is required.
- **Success threshold:** The two observed failures fail the proof, their self-contained rewrites pass, and representative long-form decision, blocked, and no-decision transcripts pass through Claude Code, OpenAI Codex, and Cursor delivery boundaries.
- **Project non-goals:** Lifecycle propulsion after GREEN; general response-length or tone work; continuous per-turn enforcement; verbose templates for short conversational replies.

## Jobs To Be Done

### make-agent-handoffs-decision-complete.NTB1 — Decide without reconstructing the conversation

**Persona:** Non-Technical Builder (NTB)

> When an agent stops for my decision, I want the terminal handoff to carry the whole decision in plain language, so I can understand the recommendation and answer without scrolling or knowing Safeword jargon.

#### make-agent-handoffs-decision-complete.NTB1.R1 — Every substantive `Next` or `Need` decision paragraph stands alone with a concrete choice, recommendation, controlling reason, material tradeoff or consequences, and exact reply whose values contain usable content rather than placeholders or references to earlier prose, plus any necessary term explained in familiar language; deterministic correction names marked terms whose meaning is missing.

### make-agent-handoffs-decision-complete.TBU1 — Keep routine momentum concise

**Persona:** Technical Builder (TBU)

> When no human decision is needed, I want the terminal handoff to stay short and concrete, so I can see the next action without ceremony or duplicated context.

#### make-agent-handoffs-decision-complete.TBU1.R1 — A reply with a structured verdict or observable current-turn work uses the terminal contract; a declared human-owned choice uses the decision form, a declared no-decision handoff contains one imperative action with a specific object and only one `Required because` reason clause, and replies with neither signal remain outside the contract.

### make-agent-handoffs-decision-complete.SWM1 — Trust the contract across hosts

**Persona:** Safeword Maintainer (SWM)

> When Safeword ships terminal-handoff guidance to multiple agent hosts, I want one versioned contract with boundary-level proof, so I can detect semantic regressions and delivery gaps instead of mistaking prompt presence for behavior.

#### make-agent-handoffs-decision-complete.SWM1.R1 — One canonical versioned contract defines decision, blocked, and no-decision terminal handoffs for every supported host.

#### make-agent-handoffs-decision-complete.SWM1.R2 — The observed failures and a representative long-form transcript corpus prove decision, blocked, and no-decision semantics across Claude Code, OpenAI Codex, and Cursor.

#### make-agent-handoffs-decision-complete.SWM1.R3 — Each supported host observes or corrects an incomplete substantive handoff once at its native terminal boundary and leaves a compliant handoff alone.

#### make-agent-handoffs-decision-complete.SWM1.R4 — Canonical, generated, installed, and dogfood copies expose the same contract version and behavior.

## Shape

### M1 — Trustworthy terminal handoffs

- **Outcome:** Decision, blocked, and no-decision replies are concise, self-contained, and proven through every supported local host surface.
- **Non-goals:** Adding a general-purpose prose grader or changing how workflows continue after implementation becomes green.

## Killer Demo

> For a builder starting with a long agent response whose last paragraph says only “Choose the intended target,” running the shared terminal-handoff proof rejects that reply and accepts a rewrite that names the choice, recommendation, reason, consequences, and exact answer, with the same contract demonstrably delivered through Claude Code, OpenAI Codex, and Cursor.

## Surfaces

Affected:
- Claude Code
- OpenAI Codex
- Cursor
- Safeword CLI

Unaffected:
- Claude Code Cloud — local terminal-boundary mechanics are not separately exercised unless they share the Claude Code contract path.
- OpenAI Codex Cloud — repository instructions still receive the contract, but local packaged-plugin boundary proof does not imply cloud lifecycle proof.
- Cursor Cloud Agents — project rules may carry the contract, but IDE-only terminal hooks do not apply.
