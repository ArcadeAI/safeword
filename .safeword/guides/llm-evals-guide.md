# LLM Evals Guide

How to evaluate AI features: deterministic checks, datasets, rubrics,
LLM-as-judge, pairwise comparisons, cost, and failure triage.

---

## Core Idea

LLM evals test whether an AI system produces acceptable outputs for real tasks.
They are behavior tests for probabilistic systems.

Use evals when normal assertions cannot fully capture quality:

- Reasoning quality
- Factuality against provided context
- Extraction or classification quality
- Summarization quality
- Tool choice and tool-use discipline
- Retrieval quality
- Tone, style, or policy adherence
- Safety, refusal, or escalation behavior

Do not use evals for deterministic behavior that normal tests can prove faster.

```text
JSON parses and matches schema     → normal unit/integration assertion
API returns 401 without API key    → integration test
Button opens the dialog            → E2E test
Summary preserves key obligations  → eval
Agent chooses the right tool       → eval or trace eval
```

---

## Eval Decision Tree

The first matching row picks the approach (rows run cheapest/most-deterministic →
most model-graded, which is also the tie-break order):

| If…                                                                     | Approach                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| a normal deterministic test can fully prove the behavior                | Use unit, integration, E2E, or migration coverage |
| a deterministic eval assertion can prove part of the AI output contract | Add that assertion before any model-graded scorer |
| there's a known correct output, label, or fact set                      | Reference-based evals                             |
| comparing two outputs is easier than scoring one absolutely             | Pairwise evals                                    |
| the desired quality is subjective but describable                       | Rubric-based LLM-as-judge evals                   |
| the behavior involves multiple steps, tools, retrieval, or agents       | Trace or trajectory evals                         |

If none fit, write the missing acceptance criteria before creating the eval.
Model-graded evals are powerful but add cost, latency, and grader failure modes.

---

## Eval Types

| Type                    | Best For                                  | Avoid When                              |
| ----------------------- | ----------------------------------------- | --------------------------------------- |
| Deterministic assertion | Schema, required fields, exact labels     | Quality is semantic or subjective       |
| Reference-based eval    | Known answers, extraction, classification | Many valid answers exist                |
| Rubric judge            | Helpfulness, tone, reasoning, policy      | Criteria are vague or multi-dimensional |
| Pairwise comparison     | Prompt/model comparison                   | Absolute pass/fail is required          |
| Trace eval              | Agents, tool calls, retrieval paths       | Only final output matters               |
| Online eval             | Production monitoring                     | You need a release-blocking gate        |

---

## When to Use Evals

Use evals for AI behavior that can regress even when code still passes tests.

**Good eval candidates:**

- Customer-support answer uses supplied policy and does not invent terms
- Contract summary captures parties, renewal date, payment terms, and risk
- Classifier picks the correct intent from ambiguous user text
- Agent chooses search before answering time-sensitive questions
- Retrieval answer cites the provided source and refuses missing facts
- Style rewrite preserves meaning while matching voice guidelines
- Safety response refuses disallowed content and offers allowed alternatives

**Bad eval candidates:**

- Function returns an enum for a fixed input
- JSON schema validation
- HTTP status code behavior
- Button click opens a modal
- Database migration preserves a column

Those belong in unit, integration, E2E, or migration tests.

---

## Good Eval Or Token Waste

A good eval catches a plausible AI failure that users would notice, and it tells
the team what to do when it fails. A wasteful eval spends model calls without
raising confidence.

A new eval earns its place only if every one of these holds; the first that
fails tells you what to fix before writing it.

1. **What user-visible failure would this catch?**
   - Clear answer → Continue
   - No clear answer → Do not write the eval; define the risk first

2. **Could a deterministic test catch the same failure faster?**
   - YES → Write the deterministic test instead
   - NO → Continue

3. **Does the dataset include cases the model could plausibly get wrong?**
   - YES → Continue
   - NO → Add boundary, adversarial, historical, or production-inspired cases first

4. **Can the scorer catch known bad outputs?**
   - YES → Continue
   - NO → Calibrate the scorer before trusting the eval

5. **Is there a clear action when the eval fails?**
   - YES → Keep the eval
   - NO → Define the triage owner and likely fix path first

### Good Eval Signals

| Signal               | What It Means                                      |
| -------------------- | -------------------------------------------------- |
| Specific risk        | Names the bad user outcome it prevents             |
| Representative cases | Includes realistic, boundary, and historical cases |
| Sharp scorer         | Has pass/fail criteria and failure examples        |
| Calibrated judge     | Catches known bad outputs before blocking release  |
| Clear threshold      | Says what score or failure rate blocks progress    |
| Triage path          | Names what to inspect when it fails                |
| Right cadence        | Runs where the signal is worth the cost            |

### Token-Waste Smells

| Smell                   | Why It Wastes Tokens                            | Better Move                                 |
| ----------------------- | ----------------------------------------------- | ------------------------------------------- |
| Deterministic behavior  | Model judgment adds cost and nondeterminism     | Unit, integration, E2E, or schema test      |
| Vibe rubric             | "Good quality" cannot fail reliably             | Define pass/fail examples                   |
| Happy-path-only dataset | It will pass even when risky behavior regresses | Add edge, adversarial, and historical cases |
| Uncalibrated judge      | The scorer may agree with bad outputs           | Test against human-labeled examples         |
| No owner                | Failures do not lead to action                  | Assign triage ownership                     |
| Always-on expensive run | Cost grows without matching signal              | Split smoke eval from full eval             |
| Duplicate scorer        | Two scorers measure the same thing              | Keep the sharper scorer                     |

### Examples

Good eval:

```text
Risk: Support answer invents refund exceptions.
Dataset: refund-window happy path, late refund, ambiguous goodwill request,
historical bug where the model offered an unsupported exception.
Scorer: PASS only if the answer states the policy limit, refuses unsupported
exceptions, and gives the approved next step.
Action on fail: inspect prompt policy section and retrieved policy document.
```

Token waste:

```text
Risk: "Answer should be good."
Dataset: three easy happy-path questions.
Scorer: "Rate from 1 to 5."
Action on fail: unclear.
```

If an eval fails this gate, do not delete the idea. Convert it into one of:

- A deterministic test
- A better acceptance criterion
- A production-log mining task
- A scorer-calibration task
- A future eval idea with the missing risk named

---

## Eval Anatomy

Every eval should define these fields before implementation.

| Field             | Required Question                                    |
| ----------------- | ---------------------------------------------------- |
| Objective         | What user-visible AI behavior must be protected?     |
| Inputs            | What prompts, documents, context, or tools are used? |
| Expected evidence | What makes an output pass?                           |
| Scorer            | How is pass/fail computed?                           |
| Dataset           | Which examples represent real risk?                  |
| Cadence           | When does it run?                                    |
| Threshold         | What result blocks release?                          |
| Triage owner      | Who decides prompt vs model vs scorer vs data?       |

Minimal pseudo-YAML example:

```yaml
description: 'Support answer follows refund policy'
input:
  question: 'Can I get a refund after 45 days?'
  policy: 'Refunds are available within 30 days of purchase.'
checks:
  - kind: json_schema
    rule: '{ answer: string, cites_policy: boolean }'
  - kind: required_text
    rule: '30 days'
  - kind: judge_rubric
    rule: |
      PASS if the answer states that refunds are only available within 30 days,
      does not invent an exception, and remains polite.
      FAIL if it offers a refund after 45 days, omits the policy limit, or invents policy.
```

Use the syntax of the project's chosen eval tool. The structure above is a
portable pattern, not a required framework.

---

## Scorer Design

Scorers are tests. Treat them with the same rigor as code.

### Prefer Binary Outcomes

Use pass/fail when the eval gates a release.

```text
PASS: Includes the 30-day limit and refuses the 45-day refund.
FAIL: Offers a refund, omits the limit, or invents an escalation path.
```

Avoid vague scales unless the team has calibration examples.

```text
Bad: Score quality from 1 to 5.
Good: PASS only if all required facts are present and no unsupported facts appear.
```

### One Dimension Per Scorer

Split factuality, completeness, tone, and safety into separate scorers.

```yaml
scorers:
  - name: factuality
    rubric: 'PASS if every factual claim is supported by the provided policy.'
  - name: completeness
    rubric: 'PASS if the answer covers eligibility, deadline, and next step.'
  - name: tone
    rubric: 'PASS if the answer is direct and respectful.'
```

Do not bundle unrelated dimensions into one vague judgment.

### Include Failure Examples

Rubrics should say what fails.

```text
PASS: Mentions the renewal date and cancellation window.
FAIL: Gives only a generic summary, misses the cancellation window, or invents a date.
```

### Calibrate Judge Evals

Before trusting an LLM-as-judge scorer:

1. Run it on examples humans already labeled
2. Inspect disagreements
3. Tighten the rubric
4. Add few-shot grading examples when useful
5. Re-run until the scorer catches known bad outputs

If the scorer cannot reliably catch known failures, it cannot block release.

---

## Dataset Design

An eval is only as good as its dataset.

### Dataset Mix

Include:

- Happy-path examples
- Boundary cases
- Adversarial prompts
- Ambiguous user requests
- Production-inspired cases with private data removed
- Historical bugs
- Examples from domain experts
- Holdout cases not used during prompt tuning

### Dataset Size

Start small and useful:

```text
5-10 cases    → smoke eval while designing a prompt
20-50 cases   → PR or feature gate
100+ cases    → release, scheduled, or model migration gate
```

The numbers are starting points. Increase size when behavior is high-risk,
inputs are diverse, or the model/provider is changing.

### Privacy Rules

Before adding production data:

- Remove personal data not needed for the eval
- Replace secrets, tokens, emails, addresses, and account IDs
- Preserve the structure that made the case hard
- Record the source and scrub date if policy allows

Never copy sensitive production data into a prompt, fixture, or third-party eval
system without approval.

---

## Eval Cadence

| Event                 | Recommended Eval Set                      |
| --------------------- | ----------------------------------------- |
| Prompt editing        | 5-10 smoke cases                          |
| Code change           | Deterministic assertions + affected cases |
| Pull request          | Smoke eval + known regression cases       |
| Prompt/model change   | Full task eval                            |
| Retrieval data change | Retrieval/factuality eval                 |
| Release               | Full eval for critical AI workflows       |
| Scheduled monitoring  | Drift and production-inspired evals       |
| Production monitoring | Sampled online evals with cost controls   |

**Tie-breaker:** run the cheapest eval that can catch the likely regression at
the point where it is cheapest to fix.

---

## Cost and Runtime Controls

Evals can become expensive because they multiply:

```text
cases × prompts × models × scorers × repetitions
```

Control cost with:

- A smoke eval suite
- Deterministic assertions before model-graded assertions
- Sampling for online evals
- Caching where the tool supports it
- Smaller judge models for low-risk rubrics
- Full evals only on prompt, model, retrieval, or release changes
- Repetitions only for nondeterminism-sensitive tasks

Do not hide expensive evals inside default unit test commands.

---

## Trace and Agent Evals

Use trace evals when the path matters, not just the final answer.

**Use for:**

- Tool choice
- Tool arguments
- Retrieval query quality
- Whether the agent asked for clarification
- Whether the agent stopped after enough evidence
- Whether the agent avoided disallowed tools

**Good trace assertions:**

```text
PASS if the agent searches the knowledge base before answering a policy question.
PASS if the agent calls the refund tool with the user_id from context, not from user text.
FAIL if the agent sends an email before explicit confirmation.
```

**Bad trace assertion:**

```text
PASS if the agent thinks carefully.
```

That is not observable.

Avoid over-constraining harmless internal reasoning. Grade path only when the
path affects correctness, cost, safety, privacy, or user-visible behavior.

---

## Failure Triage

When an eval fails, classify the failure before changing prompts or tests.

| Failure Source      | Symptom                                       | First Action                                  |
| ------------------- | --------------------------------------------- | --------------------------------------------- |
| Prompt              | Same model misses instruction consistently    | Clarify prompt or examples                    |
| Model               | Regression appears after model change         | Compare old/new model on same dataset         |
| Retrieval           | Answer lacks facts that context should supply | Inspect retrieved documents and query         |
| Tool use            | Wrong tool or wrong arguments                 | Add trace eval and tool contract tests        |
| Dataset             | Case no longer represents desired behavior    | Update with approval and preserve history     |
| Scorer              | Human disagrees with judge                    | Calibrate rubric and add examples             |
| Product requirement | Desired behavior changed                      | Update acceptance criteria before eval update |

Do not weaken a scorer because the model failed. First prove the scorer is wrong
or the requirement changed.

---

## Regression Workflow

When a user reports a bad AI output:

1. Save the input, retrieved context, tool trace, and output if privacy allows
2. Scrub sensitive data
3. Add a failing eval case
4. Confirm the eval fails for the reported behavior
5. Fix prompt, retrieval, tools, model choice, or product logic
6. Confirm the eval passes
7. Keep the case to prevent regression

If the reported issue depends on current facts, use a fixture with frozen facts
or a search-capable scorer with clear source requirements.

---

## Project Documentation

Each AI-enabled project should document eval conventions in `evals/README.md`,
`tests/SAFEWORD.md`, `tests/AGENTS.md`, or the nearest existing testing docs.

Include:

- Eval command names
- Eval tool or framework
- Dataset locations
- Scorer types
- Required API keys or local models
- Cost expectations
- Which evals block PRs or releases
- Human review process for scorer changes
- Privacy rules for production examples
- Ownership for failures

Minimal template:

```markdown
# Eval Lanes

| Eval          | Command              | Runs    | Blocks         | Dataset           | Owner   |
| ------------- | -------------------- | ------- | -------------- | ----------------- | ------- |
| AI smoke      | `npm run eval:smoke` | PR      | yes            | `evals/smoke.yml` | AI team |
| Full AI eval  | `npm run eval:full`  | release | yes            | `evals/full.yml`  | AI team |
| Drift monitor | scheduled            | no      | sampled traces | platform          |
```
