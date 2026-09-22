@proof.vitest
Feature: Complete conditional data architecture guidance
  Context-free authors and reviewers should capture consequential data contracts,
  invoke only applicable guidance, and support coverage claims with independent proof.

  @data-architecture-guidance.TBU1.R1
  Rule: data-architecture-guidance.TBU1.R1 — Consequential data contracts are recorded while reversible code-local choices remain in implementation planning

    Scenario: A mixed planning case keeps durable decisions separate from reversible helpers
      Given the recorded result for the mixed decision-routing case is bound to the current canonical guide hash, case and rubric digest, cold-start prompt digest, model version, and checked-in decoding configuration
      And the cold-start prompt contains only the guide, case, and neutral JSON response format with tools disabled
      When deterministic verification re-grades it against the current routing rubric
      Then its decision IDs and proof-fact IDs equal the independently maintained routing sets with no forbidden or unknown IDs

    @rejection
    Scenario: Treating a consequential data contract as a reversible helper fails review
      Given a structured answer routes a durable identity or lifecycle contract only to implementation planning
      When the deterministic rubric grades the answer
      Then the answer fails with the missing durable-contract decision identified

  @data-architecture-guidance.TBU1.R2
  Rule: data-architecture-guidance.TBU1.R2 — Every plan answers the applicable universal questions and invokes only the conditional modules whose triggers fire

    Scenario Outline: Each representative case selects exactly its applicable guidance
      Given the recorded result for the <case> case is bound to the current canonical guide hash, case and rubric digest, cold-start prompt digest, model version, and checked-in decoding configuration
      And the cold-start prompt contains only the guide, case, and neutral JSON response format with tools disabled
      When deterministic verification re-grades it against the current <rubric> rubric
      Then its decision IDs and proof-fact IDs equal the independently maintained <rubric> sets with no forbidden or unknown IDs

      Examples:
        | case                                  | rubric                                |
        | simple key-value preference           | core-only                             |
        | multi-tenant relational event store   | relational high-risk                  |
        | encrypted credential record           | encryption and key lifecycle          |
        | live additive migration               | deployed-state migration              |
        | generated manifest missing one facet  | independent generated coverage        |
        | erasure across secondary copies       | full copy-disposition                 |
        | time equality boundary                | exact temporal boundary               |

    @rejection
    Scenario Outline: Invalid evaluation records fail deterministic verification
      Given the nine-case corpus contains <record-defect>
      When deterministic verification re-grades the current records
      Then the corpus fails with <diagnostic>

      Examples:
        | record-defect                              | diagnostic                    |
        | a missing case record                      | the missing case              |
        | duplicate records for one case             | the duplicate case            |
        | a record for a retired or unknown case     | the unknown case              |
        | a stale canonical guide hash               | the guide-hash mismatch       |
        | a stale case and rubric digest             | the case-rubric mismatch      |
        | a prompt digest that differs from the checked-in cold-start prompt containing only the guide, case, neutral JSON response format, and tools-disabled state | the cold-start prompt mismatch |
        | a model version or decoding configuration that differs from the checked-in evaluation contract | the recording-contract mismatch |
        | an agent answer that fails its rubric      | the failed response rubric    |

  @data-architecture-guidance.TBU1.R3
  Rule: data-architecture-guidance.TBU1.R3 — Architecture, implementation plans, generated representations, ADRs, and linked evidence each retain a single explicit responsibility

    Scenario: The artifact-ownership case assigns each decision to one owner
      Given the recorded result for the artifact-ownership case is bound to the current canonical guide hash, case and rubric digest, cold-start prompt digest, model version, and checked-in decoding configuration
      And the cold-start prompt contains only the guide, case, and neutral JSON response format with tools disabled
      When deterministic verification re-grades it against the current ownership rubric
      Then its decision IDs and proof-fact IDs equal the independently maintained ownership sets with no forbidden or unknown IDs

    @rejection
    Scenario: Duplicating a contract as authority across artifacts fails review
      Given an architecture answer and a generated representation both claim source-of-truth ownership for one durable contract
      When the deterministic rubric grades the answer
      Then the answer fails with the ownership conflict identified

  @data-architecture-guidance.TBU2.R1
  Rule: data-architecture-guidance.TBU2.R1 — Every completeness claim names an oracle independent of the mechanism being checked

    @demo
    Scenario: An independent facet inventory exposes an omitted generated-manifest facet
      Given a generated manifest omits one facet from the hand-maintained intended-facet inventory
      When the completeness proof compares their exact sets
      Then the proof reports the omitted facet and rejects the completeness claim

    @rejection
    Scenario: Agreement between sibling generated outputs cannot prove completeness
      Given a generated manifest and generated documentation omit the same intended facet
      When they are offered as each other's completeness oracle
      Then the proof is rejected as dependent on the mechanism being checked

    Scenario: A discriminating guide-ablation pair validates independent proof
      Given a full-guide generated-manifest result passes the independent-proof rule while its configuration-matched named-transform ablation result fails that rule
      And both guide hashes are re-derived from the canonical guide with decision-ID labels preserved
      When deterministic verification grades the paired results through the same rubric path
      Then the evaluation accepts the pair as evidence that removing the named independent-proof module changes the selected IDs under the guide's explicit module-presence rule

    @rejection
    Scenario Outline: A non-discriminating guide-ablation pair fails evaluation
      Given the full-guide result and named-transform ablation result reuse one generated-manifest case, model version, decoding configuration, response format, and rubric loader
      And <pair-defect>
      When deterministic verification re-derives the ablated guide and both guide hashes from the canonical guide, checks that decision-ID labels survive, and grades the paired results through the same rubric path
      Then the corpus fails with <diagnostic>

      Examples:
        | pair-defect                                             | diagnostic                      |
        | the ablated answer satisfies the independent-proof rule | a non-discriminating ablation   |
        | the ablated answer fails only an unrelated expected ID  | an unrelated ablation failure  |
        | the full-guide answer fails the independent-proof rule   | a failed paired control         |
        | the records differ in model version or decoding configuration | an invalid paired configuration |
        | the stored ablated guide differs from the named transform | a derived-ablation mismatch      |
        | the ablated guide removes preserved decision-ID labels   | a preserved-label mismatch       |

  @data-architecture-guidance.TBU2.R2
  Rule: data-architecture-guidance.TBU2.R2 — Conditional proof includes the environment, boundaries, controls, and revalidation conditions needed to falsify the claim

    Scenario Outline: Conditional claims carry the facts that make them falsifiable
      Given a structured answer makes a <claim> claim supported by <facts>
      When the deterministic rubric grades its required proof facts
      Then the answer passes

      Examples:
        | claim                         | facts                                                                                         |
        | relational query performance  | engine and version, representative data shape, query shape, threshold, and revalidation trigger |
        | encrypted scope binding       | canonical AAD identity and scope mutation failure plus key-dependency rotation coverage       |
        | live additive migration       | deployed starting state, mixed-version compatibility, cutover, recovery, and restore behavior |
        | erasure completeness          | copy inventory, positive deletion proof, and sibling-scope and different-owner isolation      |
        | time-dependent lifecycle      | authoritative clock, exact equality behavior, retry behavior, and restore behavior             |

    @rejection
    Scenario Outline: A non-discriminating proof fails with a focused diagnostic
      Given a structured answer contains <defect>
      When the deterministic rubric grades the answer
      Then the answer fails with the <diagnostic> proof fact identified

      Examples:
        | defect                                      | diagnostic                         |
        | query evidence without execution context    | missing query context              |
        | a child identity bound to another tenant    | cross-tenant parent binding        |
        | a generic encrypted-at-rest assertion       | missing AAD and key lifecycle      |
        | migration evidence from a feature branch    | missing deployed starting state    |
        | deletion evidence for only the primary row  | missing secondary-copy disposition |
        | erasure proof without isolation controls    | missing negative isolation         |
        | coverage inferred from a generated sibling  | dependent completeness oracle      |
        | temporal proof away from equality            | missing equality boundary          |

  @data-architecture-guidance.TBU2.R3
  Rule: data-architecture-guidance.TBU2.R3 — Proof uses synthetic or read-only evidence and never requires secrets, plaintext customer data, or production credentials

    Scenario: Synthetic placeholders and deployed read-only snapshots satisfy evidence needs
      Given every mutable evaluation value follows the synthetic-placeholder convention and migration evidence is read-only or checked-in equivalent
      When the evidence-safety check evaluates the corpus
      Then the corpus is accepted without production credentials, secrets, or plaintext customer data

    @rejection
    Scenario Outline: Sensitive-looking evaluation values are refused
      Given a fixture contains a <value-class>
      When the evidence-safety check evaluates the corpus
      Then the fixture is rejected with its unsafe value class identified

      Examples:
        | value-class                            |
        | credential, token, or key prefix       |
        | email-shaped value                     |
        | non-placeholder high-entropy value     |

  @data-architecture-guidance.SWM1.R1
  Rule: data-architecture-guidance.SWM1.R1 — Post-install/generated guide paths equal an independent hand-maintained inventory exactly; seeded missing-copy, Codex-managed extra-copy, Claude body-drift, and non-path-substitution negatives fail; host path differences are separately maintained literal substitutions; and every planning reference resolves

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.safeword-cli
    Scenario: Supported hosts resolve one coherent guide through their existing delivery model
      Given the canonical template, installed Safeword copy, generated Claude resource, and planning references have been produced by supported workflows
      When they are compared with the hand-maintained delivery inventory and literal path-substitution contract
      Then the template and installed copy are identical, Claude differs only by the owned path substitution, Codex adds no guide copy, each planning reference resolves to its host-owned guide path, and the OpenCode catalogue remains copy-free and free of a delivery-specific planning path with that unaffected rationale recorded

    @rejection
    Scenario Outline: Shipped guide drift fails delivery verification
      Given the supported delivery outputs contain <drift>
      When the delivery contract is verified
      Then verification fails with the mismatched path or content identified

      Examples:
        | drift                                |
        | a missing managed guide copy         |
        | an extra Codex-managed guide copy    |
        | Claude guide body drift              |
        | a non-path Claude substitution       |
        | a missing planning-reference target  |
        | a cross-surface planning reference   |
        | an OpenCode guide copy or reference  |
