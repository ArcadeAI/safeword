# Delivery projection for T3E4NS, not replacement acceptance for 5F5ZZA.
# Proofs exercise existing installed CLI, provider and retention boundaries.
@proof.vitest @surface.safeword-cli
Feature: Keep bounded planning reviews trustworthy for plan authors

  @plan-implementability.TBU4.T3E4NS.R1
  Rule: plan-implementability.TBU4.T3E4NS.R1 — Review instructions preserve accepted authority and persona outcomes

    Scenario: Phase contracts ask the bounded scope and persona questions
      Given the delivered Product, Implementation and Execution review contracts
      When their canonical review questions are inspected
      Then omissions and overreach are checked against accepted authority
      And Product outcomes and epistemic status are explicit while guidance remains advisory

  @plan-implementability.TBU4.T3E4NS.R2
  Rule: plan-implementability.TBU4.T3E4NS.R2 — Declared planning evidence keeps its source and reuse limits

    Scenario Outline: Reviewer evidence survives validated output without inventing missing limits
      Given a new planning verdict with <record_state>
      When the provider result is validated
      Then <result>

      Examples:
        | record_state | result |
        | complete versioned source and reuse-limit records | every declared field survives unchanged |
        | no required evidence wrapper | the verdict refuses |
        | an empty license identifier | the verdict refuses rather than dropping the field |
        | an undeclared evidence field | the verdict refuses rather than dropping the field |

    Scenario: A malformed plan record refuses after the complete plan succeeds
      Given an owned plan whose complete evidence record can prepare for review
      When its security limit is removed
      Then preparation refuses with the missing field named

  @plan-implementability.TBU4.T3E4NS.R3
  Rule: plan-implementability.TBU4.T3E4NS.R3 — Review currency and permission to use a copy remain separate

    Scenario Outline: Installed rule edits invalidate only their dependent reviews
      Given an approved Implementation review from a trusted installed distribution
      When <region> changes
      Then the Implementation review is <currency>
      And requesting that Implementation review <use_result>

      Examples:
        | region | currency | use_result |
        | canonical Implementation rules | stale | refuses because whole-copy integrity fails |
        | unrelated canonical Execution rules | approved | succeeds with unchanged Implementation bytes |
        | prose outside the canonical Implementation region | approved | refuses because whole-copy integrity fails |

  @plan-implementability.TBU4.T3E4NS.R4
  Rule: plan-implementability.TBU4.T3E4NS.R4 — Fallback requires a real independent attempt

    Scenario Outline: Refused selectors cannot manufacture permission for fallback
      Given a verified author and an <partition> explicit reviewer selector <selector>
      When every independent candidate is refused before launch
      Then the review is blocked and records that selector as skipped with a capability failure
      And neither the refused reviewer nor fallback receives a packet

      Examples:
        | partition | selector |
        | unknown | unqualified-model |
        | unqualified named | gpt-6-luna |

    Scenario Outline: A failed independent attempt precedes eligible fallback
      Given configured independent and fallback reviewers in either declaration order
      When the independent reviewer <attempt_result>
      Then independent review runs first
      And fallback <fallback_result>

      Examples:
        | attempt_result | fallback_result |
        | succeeds | never runs |
        | actually fails with an eligible typed failure | follows that failure |

  @plan-implementability.TBU4.T3E4NS.R5
  Rule: plan-implementability.TBU4.T3E4NS.R5 — Saved observations remain bounded headless evidence

    Scenario: Completed observations survive termination
      Given a live worker has checkpointed paired headless results and raw observations
      When it is killed before teardown
      Then the exact completed result and its paired raw observation remain readable

    Scenario Outline: Retained reuse checks current identity before any reviewer launch
      Given valid paired completed headless observations and a requested identity with <identity_state>
      When retained reuse preflight runs
      Then <result>

      Examples:
        | identity_state | result |
        | matching current contract, corpus and exact model | the retained observation is readable and execution proceeds |
        | a changed expected contract | reuse refuses before launch |
        | acceptance corpus markers in the request | reuse refuses before launch |
        | public CLI dispatch markers in the request | reuse refuses before launch |
        | an omitted exact model | reuse refuses before launch |
        | replay mode markers in the request | reuse refuses before launch |

    Scenario Outline: Corrupt or unconfirmed retained output refuses
      Given an otherwise valid retained checkpoint
      When its raw output has <invalid_state>
      Then reading the checkpoint refuses with <diagnostic>

      Examples:
        | invalid_state | diagnostic |
        | missing confirmation | exact model confirmation |
        | wrong model | exact model confirmation |
        | wrong provider | exact model confirmation |
        | unpaired case identity | paired raw observation |
        | CLI dispatch mode | headless |
        | replay dispatch mode | headless |

  @plan-implementability.TBU4.T3E4NS.R6
  Rule: plan-implementability.TBU4.T3E4NS.R6 — Admission follows current exact-model passing observations

    Scenario Outline: Qualification evidence refuses incomplete or failed matrices
      Given <matrix_state> conformance records for an exact reviewer identity
      When admission evidence is built
      Then <result>

      Examples:
        | matrix_state | result |
        | complete current passing | evidence records the exact identity and all case IDs |
        | incomplete | admission evidence is refused |
        | containing a failed observation | admission evidence is refused |

    Scenario Outline: Route admission binds exact identity and current input bytes
      Given complete passing admission evidence with <binding>
      When configured explicit model routes are filtered
      Then <result>

      Examples:
        | binding | result |
        | the matching exact model and current input digests | the matching explicit route is retained |
        | a different exact model | the requested explicit route is absent |
        | mismatched contract or corpus digests | no route is retained |

  @plan-implementability.TBU4.T3E4NS.R7
  Rule: plan-implementability.TBU4.T3E4NS.R7 — Copy corruption refuses before reviewer dispatch

    Scenario Outline: Corrupt reviewer copies refuse and the canonical pair dispatches
      Given an installed canonical authoring copy and <copy_state> reviewer copy
      When an Execution Plan review is requested through the installed CLI
      Then <result>

      Examples:
        | copy_state | result |
        | canonical | the plan actually reaches the reviewer |
        | stale canonical startability | no plan is sent and the phase and reconciliation action are named |
        | stale canonical slicing | no plan is sent and the phase and reconciliation action are named |

  @plan-implementability.TBU4.T3E4NS.R8
  Rule: plan-implementability.TBU4.T3E4NS.R8 — Delivered guidance keeps bounded approval meanings

    Scenario: Public documentation describes reduced assurance and its limits
      Given the delivered public overview and planning configuration documentation
      When their fallback and approval descriptions are checked
      Then reduced assurance remains explicit and planning approval grants no later authority

    @surface.claude-code @surface.openai-codex
    Scenario: Native generated distributions carry their canonical template roots
      Given the checked-in Claude and Codex native distributions
      When their templates and bundled runtime are checked
      Then the Claude bundle contains its canonical template root
      And the Codex bundled CLI executes without project dependencies and reports that version
