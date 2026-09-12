Feature: Decision-complete terminal handoffs

  @make-agent-handoffs-decision-complete.NTB1.R1
  # skip: pure evaluator behavior is host-independent; native host delivery is covered by SWM1.R3
  Rule: make-agent-handoffs-decision-complete.NTB1.R1 — A decision paragraph stands alone

    Scenario: A complete Next decision can be acted on without earlier prose
      Given a long work update ending in a Next decision that requires a human choice, with every decision role in plain language
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the decision handoff is accepted as self-contained

    @rejection
    Scenario: The observed Next decision omission is rejected
      Given the observed pre-contract long reply that mixes a verify-or-scaffold choice, a legacy Open value, and an incomplete Next paragraph
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the decision handoff is rejected with the missing decision roles named

    Scenario: A complete Need decision can be acted on without earlier prose
      Given a blocked work update ending in a Need decision that requires a human choice, with every decision role in plain language
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the blocked handoff is accepted as self-contained

    @rejection
    Scenario: The observed Need paragraph cannot borrow its recommendation from earlier prose
      Given a blocked reply whose earlier prose states a complete recommendation and whose Need paragraph says only to confirm the target
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the blocked handoff is rejected as incomplete

    @rejection
    Scenario: An unexplained necessary term makes a decision incomplete
      Given a decision paragraph with a necessary unfamiliar term explicitly marked but no plain-language meaning
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the decision handoff is rejected with the unexplained term named

    Scenario: An explained necessary term remains usable in a decision
      Given a decision paragraph with a necessary unfamiliar term explicitly marked and explained inline in familiar language
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the decision handoff is accepted as self-contained

    @rejection
    Scenario Outline: Each required decision role is independently enforced for Next and Need
      Given a <paragraph> decision paragraph complete except for <role>
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the decision handoff is rejected with <role> named

      Examples:
        | paragraph | role |
        | Next | concrete choice |
        | Next | recommendation |
        | Next | controlling reason |
        | Next | material tradeoff or consequences |
        | Next | exact reply |
        | Need | concrete choice |
        | Need | recommendation |
        | Need | controlling reason |
        | Need | material tradeoff or consequences |
        | Need | exact reply |

    @rejection
    Scenario Outline: Present decision roles cannot use content-free back-references
      Given a <paragraph> decision paragraph with every role label present but <role> contains only a back-reference or placeholder
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the decision handoff is rejected with <role> named as content-free

      Examples:
        | paragraph | role |
        | Next | concrete choice |
        | Next | recommendation |
        | Next | controlling reason |
        | Next | material tradeoff or consequences |
        | Next | exact reply |
        | Need | concrete choice |
        | Need | recommendation |
        | Need | controlling reason |
        | Need | material tradeoff or consequences |
        | Need | exact reply |

    @rejection
    Scenario: A decision paragraph cannot present two unrelated choices
      Given a Next decision paragraph with every decision role but two unrelated human choices
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the decision handoff is rejected as not one concrete choice

  @make-agent-handoffs-decision-complete.TBU1.R1
  # skip: pure evaluator behavior is host-independent; native host delivery is covered by SWM1.R3
  Rule: make-agent-handoffs-decision-complete.TBU1.R1 — Routine handoffs stay concise

    Scenario: A no-decision handoff stays to one action and an essential reason
      Given a substantive no-decision update ending in one concrete next action and one essential reason
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the no-decision handoff is accepted as concrete and concise

    Scenario: A concrete no-decision action needs no reason when none is essential
      Given a substantive no-decision update ending in one concrete next action and no reason
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the no-decision handoff is accepted as concrete and concise

    Scenario: An essential action reason may repeat earlier context
      Given a substantive no-decision update ending in one concrete action and one Required because reason clause that repeats earlier context inside the clause
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the no-decision handoff is accepted as concrete and concise

    @rejection
    Scenario: A vague no-decision action is rejected
      Given a substantive update ending in an action form with an imperative but no specific object
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the action handoff is rejected as not concrete

    @rejection
    Scenario: A no-decision handoff cannot present several next actions
      Given a substantive no-decision update ending in a list of several concrete next actions
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the action handoff is rejected as not one concrete action

    @rejection
    Scenario: A no-decision handoff carrying a decision template is rejected as ceremonial
      Given a substantive update declaring Open none whose Next paragraph carries recommendation and tradeoff clauses
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the action handoff is rejected as unnecessarily ceremonial

    @rejection
    Scenario: A human-owned decision cannot be disguised as a no-decision action
      Given a substantive update declaring a human-owned release-target choice whose Next paragraph uses the action form
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the action handoff is rejected as missing the decision form

    @rejection
    Scenario: A no-decision handoff cannot repeat non-essential context
      Given a substantive no-decision update ending in one concrete action and repeated context outside the Required because reason clause
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the action handoff is rejected as unnecessarily verbose

    @rejection
    Scenario: A no-decision handoff cannot carry two reason clauses
      Given a substantive no-decision update ending in one concrete action and two Required because reason clauses
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the action handoff is rejected as carrying more than one reason clause

    Scenario: A short conversational answer is outside the terminal-handoff contract
      Given an answer with no structured verdict and no observable current-turn work
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the answer passes unchanged as outside the terminal-handoff contract

    @rejection
    Scenario: A verdict alone makes a reply subject to the terminal contract
      Given a reply carrying a structured verdict, no described current-turn work, and no terminal paragraph
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the handoff is rejected as missing

    @rejection
    Scenario: A brief substantive reply still requires a terminal paragraph
      Given a brief reply that reports completed work and ends with no Next or Need paragraph
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the handoff is rejected as missing

    @rejection
    Scenario: A substantive reply with an empty terminal paragraph is rejected
      Given a work result ending in an empty Next paragraph
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the handoff is rejected as empty

  @make-agent-handoffs-decision-complete.SWM1.R1
  # skip: canonical contract validation is host-independent; delivery parity is covered by SWM1.R4
  Rule: make-agent-handoffs-decision-complete.SWM1.R1 — One versioned contract defines every handoff kind

    Scenario: The canonical contract validates symmetric decision and action forms
      Given the canonical terminal-handoff contract
      When the shared terminal-handoff contract validator checks the contract
      Then the contract is accepted at the canonical version with exactly these five roles in any order for each of Next and Need: concrete choice, recommendation, controlling reason, material tradeoff or consequences, and exact reply, plus a separate concise no-decision action form

    @rejection
    Scenario: An unversioned contract is invalid
      Given a terminal-handoff contract with no version
      When the shared terminal-handoff contract validator checks the contract
      Then the contract is rejected with the missing version named

    @rejection
    Scenario: An asymmetric decision contract is invalid
      Given a terminal-handoff contract whose Need form requires fewer decision roles than Next
      When the shared terminal-handoff contract validator checks the contract
      Then the contract is rejected with the asymmetric role requirement named

    @rejection
    Scenario: A contract without a no-decision action form is invalid
      Given a versioned symmetric decision contract with no no-decision action form
      When the shared terminal-handoff contract validator checks the contract
      Then the contract is rejected with the missing no-decision form named

  @make-agent-handoffs-decision-complete.SWM1.R2
  # skip: this is the shared deterministic corpus; installed host boundaries consume these same cases in SWM1.R3
  Rule: make-agent-handoffs-decision-complete.SWM1.R2 — Long-form corpus binds semantic classifications

    Scenario: The shared evaluator reproduces the full corpus oracle
      Given the shared rule-based terminal-handoff evaluator and the fixed corpus with contract-derived recorded verdicts and missing-role sets
      When the evaluator checks every corpus reply
      Then every evaluation of each reply matches its recorded verdict and recorded missing-role set

    @rejection
    Scenario: The long decision corpus rejects the observed omission
      Given the shared terminal-handoff evaluator and the observed Claude Code transcript whose Next omits decision roles
      When the evaluator checks the terminal handoff
      Then the corpus case is rejected with the decision roles named as missing despite their presence in earlier prose

    Scenario: The long decision corpus accepts the self-contained rewrite
      Given the shared terminal-handoff evaluator and the long decision transcript with the self-contained rewrite
      When the evaluator checks the terminal handoff
      Then the corpus case is accepted

    @rejection
    Scenario: The long blocked corpus cannot hide decision roles before Need
      Given the shared terminal-handoff evaluator and the observed OpenAI Codex transcript with a vague Need and complete earlier prose
      When the evaluator checks the terminal handoff
      Then the corpus case is rejected with the decision roles named as missing despite their presence in earlier prose

    Scenario: The long blocked corpus accepts the self-contained Need rewrite
      Given the shared terminal-handoff evaluator and the long blocked transcript with the self-contained Need rewrite
      When the evaluator checks the terminal handoff
      Then the corpus case is accepted

    Scenario: The long no-decision corpus retains one concise action
      Given the shared terminal-handoff evaluator and the long no-decision transcript
      When the evaluator checks the terminal action
      Then the corpus case is accepted as a concise handoff

    @rejection
    Scenario: The long no-decision corpus rejects a vague action
      Given the shared terminal-handoff evaluator and the long no-decision transcript ending only with an instruction to continue
      When the evaluator checks the terminal action
      Then the corpus case is rejected as not concrete

    Scenario Outline: Held-out decision-route paraphrases follow the declared route
      Given a fixed held-out reply not present in the transcript corpus with <route>
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the held-out reply is <outcome>

      Examples:
        | route | outcome |
        | one human-owned choice declared in the decision form | accepted |
        | the same choice disguised as an action | rejected as missing the decision form |

    Scenario Outline: Held-out marked-term paraphrases require an inline meaning
      Given a fixed held-out reply not present in the transcript corpus with <term evidence>
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the held-out reply is <outcome>

      Examples:
        | term evidence | outcome |
        | one marked unfamiliar necessary term explained inline | accepted |
        | the same marked necessary term left without a meaning | rejected with the unexplained term named |

    Scenario Outline: Held-out reason paraphrases stay inside one declared clause
      Given a fixed held-out reply not present in the transcript corpus with <reason evidence>
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the held-out reply is <outcome>

      Examples:
        | reason evidence | outcome |
        | one concrete action with a Required because reason | accepted |
        | one concrete action with explanation outside the Required because clause | rejected as unnecessarily verbose |

    Scenario Outline: Held-out action paraphrases require an imperative and object
      Given a fixed held-out reply not present in the transcript corpus with <action evidence>
      When the shared deterministic terminal-handoff evaluator checks the reply
      Then the held-out reply is <outcome>

      Examples:
        | action evidence | outcome |
        | one imperative action with a specific object | accepted |
        | an imperative action with no specific object | rejected as not concrete |

  @make-agent-handoffs-decision-complete.SWM1.R3
  Rule: make-agent-handoffs-decision-complete.SWM1.R3 — Native terminal boundaries correct once

    # Surface tags declare aggregate Rule coverage; each row invokes only the host named in its host column.
    @surface.claude-code @surface.openai-codex @surface.cursor @rejection
    Scenario Outline: Each installed native terminal boundary corrects every incomplete long-form corpus case once
      Given the installed Safeword configuration for <host> and the <corpus case> from the long-form corpus in its native Stop payload
      When the registered Stop hook command is invoked for the first time
      Then the process emits one correction carrying the shared contract version and naming the missing requirements in the <continuation> shape

      Examples:
        | host | corpus case | continuation |
        | Claude Code | observed decision omission | decision block reason |
        | Claude Code | vague blocked Need | decision block reason |
        | Claude Code | unexplained marked term | decision block reason |
        | OpenAI Codex | observed decision omission | decision block reason |
        | OpenAI Codex | vague blocked Need | decision block reason |
        | OpenAI Codex | unexplained marked term | decision block reason |
        | Cursor | observed decision omission | followup message |
        | Cursor | vague blocked Need | followup message |
        | Cursor | unexplained marked term | followup message |

    @surface.claude-code @surface.openai-codex @surface.cursor @rejection
    Scenario Outline: Each installed native terminal boundary corrects a vague no-decision action once
      Given the installed Safeword configuration for <host> and the vague no-decision action from the long-form corpus in its native Stop payload
      When the registered Stop hook command is invoked for the first time
      Then the process emits one correction carrying the shared contract version and naming the concrete-action requirement in the <continuation> shape

      Examples:
        | host | continuation |
        | Claude Code | decision block reason |
        | OpenAI Codex | decision block reason |
        | Cursor | followup message |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each installed native terminal boundary leaves every compliant long-form corpus case alone
      Given the installed Safeword configuration for <host> and the <corpus case> from the long-form corpus in its native Stop payload
      When the registered Stop hook command is invoked
      Then the process exits successfully with no terminal-handoff correction

      Examples:
        | host | corpus case |
        | Claude Code | self-contained Next rewrite |
        | Claude Code | self-contained Need rewrite |
        | Claude Code | concise no-decision action |
        | OpenAI Codex | self-contained Next rewrite |
        | OpenAI Codex | self-contained Need rewrite |
        | OpenAI Codex | concise no-decision action |
        | Cursor | self-contained Next rewrite |
        | Cursor | self-contained Need rewrite |
        | Cursor | concise no-decision action |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each installed native terminal boundary suppresses a repeated correction
      Given the installed Safeword configuration for <host> and a still-incomplete handoff in its native Stop payload
      When the registered Stop hook command is invoked twice in succession for the same session
      Then exactly one terminal-handoff correction is emitted across both invocations

      Examples:
        | host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: A prior session's correction never suppresses a fresh session
      Given the installed Safeword configuration for <host> and an incomplete handoff in a fresh session after an earlier session emitted a correction
      When the registered Stop hook command is invoked
      Then the process emits one terminal-handoff correction for the fresh session

      Examples:
        | host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: An intervening compliant stop re-arms correction in the same session
      Given the installed Safeword configuration for <host>, an earlier corrected handoff, and an intervening compliant Stop in the same session
      When a later incomplete handoff reaches the registered Stop hook command
      Then the process emits one terminal-handoff correction for the later handoff

      Examples:
        | host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each installed native terminal boundary fails open on an unreadable payload
      Given the installed Safeword configuration for <host> and an unreadable native Stop payload
      When the registered Stop hook command is invoked
      Then the process exits successfully without a terminal-handoff correction

      Examples:
        | host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each installed native terminal boundary fails open when evaluation cannot complete
      Given the installed Safeword configuration for <host> and a terminal-handoff evaluation that fails to complete
      When the registered Stop hook command is invoked
      Then the process exits successfully with no terminal-handoff correction

      Examples:
        | host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each installed native terminal boundary leaves short conversation alone
      Given the installed Safeword configuration for <host> and a short conversational reply in its native Stop payload
      When the registered Stop hook command is invoked
      Then the process exits successfully with no terminal-handoff correction

      Examples:
        | host |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

  @make-agent-handoffs-decision-complete.SWM1.R4 @surface.safeword-cli
  Rule: make-agent-handoffs-decision-complete.SWM1.R4 — Every delivered copy stays aligned

    Scenario: Canonical generated installed and dogfood copies share the contract version and role set
      Given the canonical template, generated Claude plugin, generated Codex plugin, Cursor delivery, customer installed, and dogfood installed terminal-handoff contract copies
      When the release gate runs "bun scripts/parity-check.ts --mode=all"
      Then every copy exposes the canonical version and exactly the canonical five-role set in any order for each of Next and Need

    Scenario: Every delivered copy produces the canonical corpus behavior
      Given the canonical template, generated Claude plugin, generated Codex plugin, Cursor delivery, customer installed, and dogfood installed terminal-handoff contract copies
      When the release gate runs "bun scripts/parity-check.ts --mode=all" against the fixed transcript corpus
      Then every copy produces the corpus's recorded verdict and recorded missing-role set for every reply

    @rejection
    Scenario Outline: Version drift fails parity for every delivered copy
      Given the declared contract version is fixed and the <copy> terminal-handoff copy has version drift
      When the release gate runs "bun scripts/parity-check.ts --mode=all"
      Then parity fails and names the <copy> copy and its version drift

      Examples:
        | copy |
        | canonical template |
        | generated Claude plugin |
        | generated Codex plugin |
        | Cursor delivery |
        | customer installed |
        | dogfood installed |

    @rejection
    Scenario: A missing delivered contract copy fails parity
      Given the required terminal-handoff copy set omits the generated Codex plugin copy
      When the release gate runs "bun scripts/parity-check.ts --mode=all"
      Then parity fails and names the missing generated Codex plugin copy

    @rejection
    Scenario Outline: Decision-role drift fails parity at the canonical version
      Given the <copy> terminal-handoff copy carries the canonical version but omits the material tradeoff or consequences role
      When the release gate runs "bun scripts/parity-check.ts --mode=all"
      Then parity fails and names the <copy> copy and its missing decision role

      Examples:
        | copy |
        | canonical template |
        | generated Claude plugin |
        | generated Codex plugin |
        | Cursor delivery |
        | customer installed |
        | dogfood installed |
