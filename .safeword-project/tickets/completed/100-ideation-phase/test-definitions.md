# Propose-and-Converge — Scenarios

```gherkin
Rule: The agent converges on a shared understanding through proposals, not interrogation
```

## Scenario 1: First response contributes before it extracts

```gherkin
Given a user submits a request that has open questions
When the agent responds
Then it restates what it heard and contributes something (a perspective, a sketch, a reframe)
  And any questions are embedded in the contribution, not front-loaded before it
```

**Example — vague request:**

> User: "I want to build a focus assistant that scans my comms and tells me what to focus on"
> Agent: "So you want a personal triage layer across Gmail, Slack, and Docs. The core tension is whether this is a noise-reducer (filter what doesn't matter) or a spotter (surface what you'd miss). Those lead to very different designs. Which resonates more?"

**Example — specific request with hidden decisions:**

> User: "Bring up a webhook via ngrok that stops tool calls for cate" [+ doc links]
> Agent: "Nice — Arcade's contextual access hooks let you intercept at Access, Pre-Execution, or Post-Execution. I'd scaffold a Pre-Execution hook since you want to block calls, not hide tools. Open question: blocking all tools for Cate, or just destructive ones?"

## Scenario 2: Proposals narrow open questions each turn

```gherkin
Given the agent and user have exchanged 1 or more turns
When the agent responds to new input from the user
Then its proposal incorporates what the user confirmed or corrected
  And the number of remaining open questions is fewer than the previous turn
```

**Example convergence gradient:**

> Turn 1: "Triage tool vs. discovery tool?" (2 open questions: purpose + form factor)
> Turn 2: User picks triage → "Daily email digest vs. real-time alerts?" (1 open question: delivery)
> Turn 3: User picks daily digest → "Here's what I'd build: a morning digest that pulls unread Gmail threads and unanswered Slack mentions, ranked by sender importance and deadline keywords. Sound right?" (0 open questions — concrete proposal)

## Scenario 3: User acceptance transitions to execution

```gherkin
Given the agent has made a proposal
When the user accepts it — explicitly ("yes, build that") or implicitly (builds on it without revising)
Then the agent proceeds to technical implementation (writing code, proposing architecture, asking implementation-level questions)
  And does not ask further product-level questions about the idea itself
```

## Scenario 4: Depth scales with ambiguity

```gherkin
Scenario Outline: Propose-and-converge depth matches request clarity
  Given a user submits a <clarity> request like <example>
  When the agent responds
  Then it converges in <turns> turns

  Examples:
    | clarity                  | example                                                              | turns |
    | fully specified          | "rename getUserName to fetchUserProfile"                             | 0     |
    | specific with one open question | "bring up a webhook to stop tool calls for cate" [+ doc links] | 1     |
    | vague aspiration         | "I want something that helps me focus"                               | ≤3    |
```

## Scenario 5: User can accelerate convergence at any point

```gherkin
Given the agent is in a propose-and-converge exchange
When the user signals they're ready (e.g., "I know what I want, let's build it" or provides a detailed spec mid-conversation)
Then the agent accepts the user's framing and transitions immediately
  And does not continue proposing
```

## Scenario 6: Backstop prevents infinite exploration

```gherkin
Given the agent has contributed 3 turns without the user accepting a proposal
When it responds for the 4th time
Then it makes its best-guess proposal explicitly
  And states "Here's my best read — should I build this, or is something off?"
  And proceeds to execution if the user confirms
```

---

## Constraints (not scenarios)

- **Contribute more than you extract:** Each turn gives the user more signal (a sketch, reframe, recommendation) than it asks for
- **Questions inside contributions:** Never front-load questions before offering a perspective
- **No mode detection required:** The pattern works identically for vague ideas, clear specs, and everything between — depth scales naturally
