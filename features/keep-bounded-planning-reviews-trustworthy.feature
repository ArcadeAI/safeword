# Delivery projection for T3E4NS, not replacement acceptance for 5F5ZZA.
# Proofs exercise existing installed CLI, provider and retention boundaries.
@proof.vitest
Feature: Keep bounded planning reviews trustworthy for plan authors

  @plan-implementability.TBU4.T3E4NS.R1 @surface.safeword-cli
  Rule: plan-implementability.TBU4.T3E4NS.R1 — Review instructions preserve accepted authority and persona outcomes

    Scenario: Phase contracts ask the bounded scope and persona questions
      Given the delivered Product, Implementation and Execution review contracts
      When their canonical review questions are inspected
      Then omissions and overreach are checked against accepted authority
      And Product outcomes and epistemic status are explicit while guidance remains advisory

  @plan-implementability.TBU4.T3E4NS.R2 @surface.safeword-cli
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

  @plan-implementability.TBU4.T3E4NS.R3 @surface.safeword-cli @surface.cursor
  Rule: plan-implementability.TBU4.T3E4NS.R3 — Review currency and permission to use a copy remain separate

    Scenario Outline: Installed rule edits preserve unrelated Implementation review currency
      Given an approved Implementation review from a trusted installed distribution
      When <region> changes
      Then the Implementation review is <currency>
      And requesting that Implementation review <use_result>

      Examples:
        | region | currency | use_result |
        | canonical Implementation rules | stale | refuses because whole-copy integrity fails |
        | unrelated canonical Execution rules | approved | succeeds with unchanged Implementation bytes |
        | prose outside the canonical Implementation region | approved | refuses because whole-copy integrity fails |

  @plan-implementability.TBU4.T3E4NS.R4 @surface.safeword-cli
  Rule: plan-implementability.TBU4.T3E4NS.R4 — Independent review is tried first, and fallback never waits on independence

    Scenario Outline: An unrated explicit selector still reviews independently
      Given an author with no recorded model and an <partition> explicit reviewer selector <selector>
      When the planning review runs
      Then that selector receives the packet and its verdict is recorded as cross-agent
      And fallback does not run

      Examples:
        | partition | selector |
        | unknown | unrated-model |
        | unrated named | gpt-6-luna |

    Scenario Outline: A failed independent attempt precedes eligible fallback
      Given configured independent and fallback reviewers in either declaration order
      When the independent reviewer <attempt_result>
      Then independent review runs first
      And fallback <fallback_result>

      Examples:
        | attempt_result | fallback_result |
        | succeeds | never runs |
        | actually fails with an eligible typed failure | follows that failure |

  @plan-implementability.TBU4.T3E4NS.R7 @surface.safeword-cli
  Rule: plan-implementability.TBU4.T3E4NS.R7 — Copy corruption refuses before reviewer dispatch

    Scenario Outline: Corrupt reviewer copies refuse and the canonical pair dispatches
      Given an installed canonical authoring copy and <copy_state> reviewer copy
      When an Execution Plan review is requested through the installed CLI
      Then <result>

      Examples:
        | copy_state | result |
        | canonical | the plan actually reaches the reviewer |
        | appended reviewer-only text | no plan is sent and the phase and reconciliation action are named |
        | stale canonical slicing | no plan is sent and the phase and reconciliation action are named |

  @plan-implementability.TBU4.T3E4NS.R8 @surface.safeword-cli
  Rule: plan-implementability.TBU4.T3E4NS.R8 — Delivered guidance keeps bounded approval meanings

    Scenario: Public documentation describes reduced assurance and its limits
      Given the delivered public overview and Implementation Planning skill guidance
      When their fallback and approval descriptions are checked
      Then reduced assurance remains explicit and the later architecture check accepts a reduced design review

    @surface.claude-code @surface.openai-codex
    Scenario: Native generated distributions carry their canonical template roots
      Given generated Claude assets and the checked-in Codex native distribution
      When their templates and bundled runtime are checked
      Then the Claude bundle contains its canonical template root
      And the Codex bundled CLI executes without project dependencies and reports that version
