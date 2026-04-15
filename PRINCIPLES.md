# Safeword Design Principles

Safeword makes the right process easy to follow and the wrong process hard to reach. It does not lock the agent out — it shapes the environment so skipping steps has consequences and following them has momentum.

Three enforcement layers, in order of strength: natural gates (prerequisites that physically must exist before the next step can start), reminders (current phase and step injected each turn), and output validation (hard block at done until tests pass and evidence exists). Gate the irreversible. Nudge the qualitative.

When evaluating a new feature, ticket approach, or design trade-off, check it against these principles. If a decision conflicts with one, either the decision is wrong or the principle needs updating.

---

## 1. Structure enforces; instructions suggest

_"A well-trained model can still be exploited through a poorly configured harness." — [Trustworthy Agents in Practice](https://www.anthropic.com/research/trustworthy-agents)_

The strongest enforcement is making the wrong path physically impossible. Natural gates — where the next step's input doesn't exist until the prior step produces it — are un-bypassable. Instructions, no matter how emphatic, are suggestions the agent can rationalize around.

**The enforcement hierarchy:**

1. **Natural gates** — artifact must exist to proceed (can't create test-definitions.md without ticket scope fields)
2. **Independent observation** — a separate process verifies (Haiku judge, test suite, artifact parsing)
3. **Reminders** — prompt injection of current state (one compressed line per turn)
4. **Self-report** — agent says it did the thing (~40% false positive rate per SWE-bench)

Design enforcement at the highest tier that's practical. When you reach for a self-report flag, ask: is there an artifact I could require instead?

This extends to testing: specify WHAT the system does (behavior), not HOW it does it (implementation). Behavior-biased tests are natural gates against regressions — they fail when the system breaks, not when internals change.

---

## 2. Fire at boundaries, not every turn

_"Find the smallest set of high-signal tokens that maximize the desired outcome." — [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)_

High-frequency enforcement destroys its own signal. A real dogfooding session produced 304 quality review fires with 5 useful catches — 97% noise. The hooks that added the most value ran once at the right moment. The hooks that added the least ran on every turn.

**Gate at transitions:**

- Phase boundaries (scenario-gate to implement, implement to done)
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

## 5. Clarity before correctness

_"The most successful implementations weren't using complex frameworks. They were building with simple, composable patterns." — [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)_

Code that is correct but unclear will be misunderstood and broken by the next change. Code that is simple but unclear will be "improved" into complexity. Clarity is the foundation that preserves simplicity and correctness over time.

**Clarity > Simplicity > Correctness** — in that order.

This applies beyond code. Skill files should be concise (3 steps, not 9). Enforcement should be legible (a developer reading the hook should understand what it checks and why). Principles should be few (5, not 15). Documentation should be precise enough that an agent with no prior context can follow it without ambiguity.

Delete what isn't needed. Don't abstract for hypothetical reuse. Don't comment what the code already says. Name things so the name is the documentation. When in doubt, choose the simpler solution that works today.

---

## Further reading

The deeper research backing these principles lives in `.safeword-project/learnings/`:

- `agent-behavior-research.md` — enforcement layers, TDD paradox, verification patterns
- `natural-vs-self-report-gates.md` — the natural/self-report gate distinction
- `procedural-gates-generalize-beyond-tdd.md` — why verbose procedures hurt quality
- `dogfooding-enforcement-session.md` — real hook fire counts, 97% noise finding
- `propose-and-converge-research.md` — HCI and grounding theory behind principle 4
- `instruction-attention-hierarchy.md` — where instructions live determines compliance (prompt hook > skill file > cross-file)
- `anthropic-research-feb-apr-2026.md` — three-agent architecture, self-evaluation unreliability
