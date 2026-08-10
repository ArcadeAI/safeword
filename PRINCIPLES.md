# Safeword Design Principles

Safeword makes the right process easy to follow and the wrong process hard to reach. It does not lock the agent out — it shapes the environment so skipping steps has consequences and following them has momentum.

Four enforcement tiers, in order of strength: natural gates (prerequisites and hard output-validation boundaries), independent observation (tests, parsers, and separate review), reminders (current phase and step injected when relevant), and self-report. Gate the irreversible. Nudge the qualitative.

When evaluating a new feature, ticket approach, or design trade-off, check it against these principles. If a decision conflicts with one, either the decision is wrong or the principle needs updating.

---

## Optimize for the NTB without constraining the TBU

**Intent:** Make safe, high-quality delivery understandable and automatic for
the NTB without limiting the TBU's agency, evidence, or control.

Safeword's default experience is designed for the Non-Technical Builder (NTB),
who cannot audit the code and should not need to learn Safeword to get safe,
high-quality work. Prefer invisible guardrails, plain-language outcomes, and a
concrete next action over framework jargon or process the user must operate.

That simplicity must not reduce the Technical Builder's (TBU) agency or
capability. Keep technical evidence, direct controls, and explicit escape
hatches available through progressive disclosure. Automate ceremony, not
authority: make the safe path effortless for the NTB while keeping Safeword out
of the TBU's way.

**Prefer:** Safe defaults, plain-language decisions, concrete next actions,
progressively disclosed technical detail, and explicit power-user controls.

**Avoid:** Requiring the NTB to understand implementation mechanics, or forcing
the TBU through simplified workflows that hide evidence, remove control, or add
steps.

**Evidence:** Walk an NTB through the outcome and recovery path without asking
them to read code; walk a TBU through the same path and confirm no capability is
lost and no unnecessary step is added.

## 1. Structure enforces; instructions suggest

_"A well-trained model can still be exploited through a poorly configured harness." — [Trustworthy Agents in Practice](https://www.anthropic.com/research/trustworthy-agents)_

The strongest enforcement is making the wrong path physically impossible. Natural gates — where the next step's input doesn't exist until the prior step produces it — are un-bypassable. Instructions, no matter how emphatic, are suggestions the agent can rationalize around.

**The enforcement hierarchy:**

1. **Natural gates** — artifact must exist to proceed (can't create test-definitions.md without ticket scope fields)
2. **Independent observation** — a separate process verifies (Haiku judge, test suite, artifact parsing)
3. **Reminders** — prompt injection of current state at a relevant boundary (one compressed line)
4. **Self-report** — agent says it did the thing (~40% false positive rate per SWE-bench)

Design enforcement at the highest tier that's practical. When you reach for a self-report flag, ask: is there an artifact I could require instead?

This extends to testing: specify WHAT the system does (behavior), not HOW it does it (implementation). Behavior-biased tests are natural gates against regressions — they fail when the system breaks, not when internals change.

**Match the reviewer to the threat.** Tier-2 verification above is not one mechanism — what a check should be depends on what it defends against:

| The check is…                                                       | Threat                 | Reviewer                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Your own _judgment/work_ (spec, scenarios, code, design)            | correlated blind spots | independent **review** — a different agent in a separate process, **never weaker** than the author, and a _different model_ when stakes warrant                                                                                                       |
| Work after every independent process route is unavailable           | missing feedback       | standard best-available **review** — same-agent headless, then host-reported fresh context, then bounded self-review; retain exact non-independent provenance and live-source limits without presenting permitted completion as a service degradation |
| An _observable fact_ (tests pass, types check, citation present)    | self-report bias       | cheap **observation** — test suite, parser, or a small judge; a weaker model is fine, even preferred                                                                                                                                                  |
| _New candidates_ (design options, refactor smells, research angles) | narrow framing         | **producer** fan-out — varied or cheaper models on purpose; the no-weaker rule does **not** apply                                                                                                                                                     |

One question routes it: _is the check a judgment about work a model produced, an observable fact, or the generation of new candidates?_ Judgment on produced work → review. Observable fact → observation. New candidates → producer. Only the review class earns the no-weaker / cross-model rule; applying it to the other two wastes tokens (cross-modeling a test run buys nothing) or collapses the angle diversity that is the whole point of fan-out.

---

## 2. Fire at boundaries, not every turn

_"Find the smallest set of high-signal tokens that maximize the desired outcome." — [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)_

High-frequency enforcement destroys its own signal. A real dogfooding session produced 304 quality review fires with 5 useful catches — 97% noise. The hooks that added the most value ran once at the right moment. The hooks that added the least ran on every turn.

**Gate at transitions:**

- Phase boundaries (scenario-gate to plan-implementation, plan-implementation to implement, implement to done)
- Artifact creation (test-definitions.md, dimensions.md)
- Commit thresholds (~400 LOC of project code)
- Session boundaries (start, stop, handoff)

**Not at:**

- Every tool use
- Every response
- Every file edit

One-shot flag-and-clear reminders over continuous injection. Context is a finite resource — every token of enforcement noise displaces a token of useful work.

---

## 3. Add, never replace

Safeword layers constraints onto what already exists. It never overwrites customer choices. A team's ESLint config, ruff settings, or golangci-lint rules reflect hard-won decisions about their codebase — replacing them is hostile.

**Per-language mechanism:**

- **TypeScript (ESLint):** flat config array, safeword rules appended (last-in-array wins on conflict)
- **Python (ruff):** `extend-select` preserves customer `select`/`ignore`
- **Go (golangci-lint):** `unionArrays` for enable/disable; customer wins on conflict
- **Rust (clippy):** fill-gap merge — only add thresholds the customer didn't set
- **SQL (sqlfluff):** omit dialect/templater if customer config exists

The same principle applies beyond linting: CLAUDE.md content is appended, never overwritten. Architecture docs are linked from customer-owned files, not injected into them. Setup detects what exists and layers on top.

---

## 4. Contribute, then converge

Questions feel collaborative when they follow a contribution, adversarial when they precede one. The agent restates what it heard, offers a perspective or sketch, and embeds open questions inside that contribution. Reviewing a concrete proposal costs less cognitive effort than answering an abstract question.

**Depth scales with ambiguity — no mode detection needed:**

- Clear request, zero open questions: execute immediately (0 turns)
- One open question: contribute context, surface it, resolve in 1 turn
- Vague idea: converge over 2-3 turns of increasingly specific proposals

Authority is earned through progressive specificity. Each proposal should be cheaper to accept than to restate. When the proposal requires no correction, the agent has demonstrated enough understanding to proceed. This requires research — reading code, checking docs, identifying options — before proposing. Stale training data doesn't earn authority; demonstrated investigation does.

---

## 5. Correct and safe; then clear; then simple

_"The most successful implementations weren't using complex frameworks. They were building with simple, composable patterns." — [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)_

Correctness and safety are gates, not trade-offs. Among designs that pass them, prefer clarity over simplicity, then choose the simplest complete solution. Code that is correct but unclear will be misunderstood and broken by the next change. Simple work reduces the number of things that can fail. We need both, in that order.

Accept complexity required by current behavior or a credible material risk. Reject complexity introduced by our solution: speculative flexibility, premature abstractions, parallel mechanisms, unnecessary dependencies, and "just in case" features. Do not confuse fewer components with a simpler system when the cut moves complexity to users, hides it in coupling, weakens verification, or removes protection against a credible failure.

This applies beyond code. Keep skills focused, hooks legible, code unsurprising, documentation precise, and principles few and load-bearing. Don't comment what the code already says. Name things so the name is the documentation.

A mechanism earns its place through evidence: a behavioral test, eval comparison, trace, dogfooding result, or risk analysis. Simplify agent scaffolding incrementally and retain the before-and-after evidence. Judge tests, observability, recovery paths, and defense in depth by the failures they detect or contain, not only by whether the happy path still works. This measured approach follows current [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model) and [Anthropic harness research](https://www.anthropic.com/engineering/harness-design-long-running-apps).

---

## Further reading

The deeper research backing these principles lives in `<namespace-root>/learnings/`:

- `agent-behavior-research.md` — enforcement layers, TDD paradox, verification patterns
- `natural-vs-self-report-gates.md` — the natural/self-report gate distinction
- `procedural-gates-generalize-beyond-tdd.md` — why verbose procedures hurt quality
- `dogfooding-enforcement-session.md` — real hook fire counts, 97% noise finding
- `propose-and-converge-research.md` — HCI and grounding theory behind principle 4
- `instruction-attention-hierarchy.md` — where instructions live determines compliance (prompt hook > skill file > cross-file)
- `anthropic-research-feb-apr-2026.md` — three-agent architecture, self-evaluation unreliability
