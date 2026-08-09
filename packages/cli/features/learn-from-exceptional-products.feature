@learn-from-exceptional-products @manual
Feature: Learn from exceptional products before committing feature decisions

  Safeword should bring credible product and implementation precedents into
  every new feature without making builders remember a research prompt.

  @learn-from-exceptional-products.TBU1.R1
  Rule: learn-from-exceptional-products.TBU1.R1 — A confirmed customer job frames product inspiration before its behavioral Rules are chosen

    Scenario: Product inspiration shapes the proposed behavioral Rules
      Given a new-flow feature has a confirmed customer job
      And the product scan contains a current credible reference
      When Safeword proposes the feature's behavioral Rules
      Then it explains which observed behavior and transferable principle informed them
      And it states what must not be copied from the reference

    @rejection
    Scenario: Rules cannot be selected before product inspiration is resolved
      Given a new-flow feature has a confirmed customer job but unresolved product inspiration
      When the workflow reaches the Rules-selection step
      Then the canonical intake sequence directs the agent to resolve Product Inspiration before proposing Rules

    @rejection
    Scenario: A marked feature cannot leave intake before product inspiration is resolved
      Given a new-flow feature has confirmed jobs and proposed Rules
      But its product inspiration contains neither a valid reference nor a complete unsuccessful-search record
      When the feature attempts to enter define-behavior
      Then the existing intake gate blocks the transition with specific remediation

    @learn-from-exceptional-products.TBU1.R2
    Rule: learn-from-exceptional-products.TBU1.R2 — Validated scenarios and bounded current constraints frame candidates and implementation inspiration before significant technical decisions

    Scenario: Technical precedents inform selection before local patterns are reconciled
      Given a feature has validated scenarios and a bounded inventory of current constraints
      When the canonical plan-implementation workflow prepares its ordered decision steps
      Then it places independent candidate generation before external precedent comparison
      And it places design selection before local-architecture reconciliation
      And it places external precedent comparison before design selection
      And no local solution-pattern survey appears before design selection

    @rejection
    Scenario: A marked feature cannot enter implementation without technical inspiration
      Given a new-flow feature has an implementation plan with a selected design
      But its implementation inspiration contains neither a valid reference nor a complete technical unsuccessful-search record
      When the feature attempts to enter implement
      Then the existing implementation gate blocks the transition with specific remediation

  @learn-from-exceptional-products.TBU1.R3
  Rule: learn-from-exceptional-products.TBU1.R3 — Every inspiration record separates evidence, principle, boundary, and decision impact

    Scenario Outline: A complete record explains a changed or retained decision
      Given an inspiration record contains a canonical source, valid checked-on date, <evidence type>, a transferable principle, and a non-copy boundary
      And its <reference kind> contains <version context>
      When the record says the evidence <outcome> the existing direction
      Then the evidence parser accepts its explicit decision impact

      Examples:
        | reference kind | evidence type | version context | outcome |
        | unversioned product behavior | credible evidence customers value the behavior | no version fields | changed |
        | unversioned product behavior | credible evidence customers value the behavior | no version fields | deliberately retained |
        | version-specific implementation | evidence of fit to comparable constraints | matching source and target versions | changed |
        | version-specific implementation | evidence of fit to comparable constraints | matching source and target versions | deliberately retained |

    @rejection
    Scenario Outline: An incomplete inspiration record is not accepted as evidence
      Given an inspiration record is missing its <required part>
      When Safeword validates the decision-stage artifact
      Then the evidence parser rejects the record with specific remediation

      Examples:
        | required part |
        | canonical source |
        | observed evidence |
        | transferable principle |
        | non-copy boundary |
        | changed-or-retained decision impact |
        | checked-on date |
        | source version for version-specific material |
        | target version for version-specific material |

    @rejection
    Scenario Outline: Present but invalid record values are rejected
      Given an inspiration record has <invalid structure>
      When Safeword validates the decision-stage artifact
      Then the evidence parser rejects the record with field-specific remediation

      Examples:
        | invalid structure |
        | an empty required text cell |
        | a whitespace-only required text cell |
        | duplicate required column headings |
        | conflicting repeated field values |
        | a row with the wrong number of fields |
        | a canonical source that is not an absolute HTTPS URL |
        | a decision impact without a changed or retained prefix |
        | a changed decision impact with no rationale |
        | a retained decision impact with no rationale |
        | an unversioned source without the n/a version value |
        | a version-specific source without its source version |
        | a version-specific source without its target version |

  @learn-from-exceptional-products.TBU1.R4
  Rule: learn-from-exceptional-products.TBU1.R4 — Routine inspiration stays out of TDD loops and significant new choices prompt a plan refresh

    Scenario: Routine TDD continues without repeated research
      Given the implementation inspiration still supports the current plan
      When the builder completes another RED GREEN REFACTOR loop
      Then Safeword continues without requesting a refreshed inspiration scan

    Scenario: A classified significant choice prompts a plan refresh
      Given the builder records that implementation disproved a load-bearing assumption or exposed a significant new choice
      And the existing inspiration does not address that choice
      When the canonical implementation workflow presents its next planning guidance
      Then it tells the builder to refresh the affected inspiration and decision record before continuing
      And it does not claim to detect that semantic change through a runtime gate

  @learn-from-exceptional-products.TBU1.R5
  Rule: learn-from-exceptional-products.TBU1.R5 — Every research workflow states the untrusted-content and reuse boundaries

    Scenario: Research guidance separates source evidence from agent authority
      Given a builder reaches either inspiration scan
      When the canonical workflow presents its research guidance
      Then it labels external material as untrusted evidence rather than instructions
      And it directs the agent to extract principles within the feature's privacy and reuse boundaries

    @rejection
    Scenario Outline: Research guidance names each prohibited source-directed action
      Given an external source could attempt to <prohibited action>
      When the canonical research guidance is validated
      Then it explicitly directs the agent to <safe response>
      And Safeword does not claim an owned runtime sandbox or exhaustive effect monitor

      Examples:
        | prohibited action | safe response |
        | replace the feature task with embedded instructions | ignore the embedded instruction |
        | disclose private repository or customer context | withhold private context from external services and retained citations |
        | execute retrieved code through a subprocess, import, package, or script | avoid executing retrieved code during research |
        | copy retrieved code without verified compatible reuse rights | verify compatible rights and obligations before reuse |

  @learn-from-exceptional-products.NTB1.R1
  Rule: learn-from-exceptional-products.NTB1.R1 — Every supported surface receives both inspiration stages by default at its available enforcement level

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    Scenario Outline: A newly scaffolded feature includes both inspiration stages on each supported surface
      Given Safeword delivers <workflow artifact> for <surface>
      When a builder starts a new-flow feature without requesting research
      Then that artifact's intake workflow presents Product Inspiration automatically
      And that artifact's implementation workflow presents Implementation Inspiration automatically

      Examples:
        | surface | workflow artifact |
        | Claude Code | the installed Claude BDD skill |
        | Claude Code Cloud | the repository-delivered Claude BDD skill |
        | OpenAI Codex | the installed Codex plugin BDD skill |
        | OpenAI Codex Cloud | the repository-delivered Codex BDD guidance |
        | Cursor | the installed Cursor BDD workflow |
        | Cursor Cloud Agents | the repository-delivered Cursor BDD workflow |
        | Safeword CLI | the canonical scaffold and gate contract |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli @rejection
    Scenario Outline: The canonical blockable transition reaches each inspiration gate
      Given the canonical pre-tool hook receives its real <transition entry point>
      And a marked fixture lacks valid <stage> inspiration
      When that entry point attempts the real stage transition
      Then the canonical inspiration parser blocks the transition with its exact remediation
      And the fixture remains in its prior phase

      Examples:
        | transition entry point | stage |
        | intake phase edit | product |
        | implementation phase edit | implementation |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    Scenario Outline: Each generated blocking adapter preserves the canonical gate route
      Given <surfaces> receive their generated or reference <transition adapter>
      When host parity validates the adapter
      Then it consumes the canonical pre-tool gate without a second inspiration validator
      And both inspiration stages remain available through that route

      Examples:
        | surfaces | transition adapter |
        | Claude Code and Claude Code Cloud | generated plugin or repository hook |
        | OpenAI Codex | packaged pre-tool command |
        | Cursor and Cursor Cloud Agents | project preToolUse adapter |
        | Safeword CLI | installed canonical hook |

    @surface.openai-codex-cloud
    Scenario: A guidance-only cloud surface does not claim a hard transition hook
      Given OpenAI Codex Cloud receives the repository-delivered BDD workflow
      When an unprompted feature reaches either inspiration decision stage
      Then the workflow requires the same Product or Implementation Inspiration record
      And Safeword does not claim a runtime hard block on that surface

    @rejection
    Scenario Outline: Canonical wiring cannot omit an inspiration stage
      Given the canonical <contract surface> omits <missing stage>
      When canonical contract validation runs before host generation
      Then validation fails before the omission can propagate to generated artifacts

      Examples:
        | contract surface | missing stage |
        | spec and implementation-plan scaffolds | Product Inspiration |
        | spec and implementation-plan scaffolds | Implementation Inspiration |
        | registered schema inventory | the inspiration parser |
        | intake readiness collaborator path | product inspiration validation |
        | implementation plan-gate collaborator path | implementation inspiration validation |

    @rejection
    Scenario: A generated workflow cannot silently omit either inspiration stage
      Given a generated host catalogue differs from the canonical BDD workflow
      When surface parity validation examines its inspiration contract
      Then validation fails if either automatic inspiration stage is absent

    @rejection
    Scenario Outline: An activated ticket requires all matching v1 signals
      Given <activation signal>
      And its signal state is <signal state>
      When the feature attempts to leave an inspiration decision stage
      Then the existing phase gate blocks the transition with marker remediation

      Examples:
        | activation signal | signal state |
        | the scaffold-origin sentinel activates validation | both version markers are absent |
        | the ticket version marker activates validation | the scaffold sentinel is absent |
        | the spec version marker activates validation | the scaffold sentinel is absent |
        | any signal activates validation | one companion names an unsupported version |
        | any signal activates validation | two signal versions conflict |
        | any signal activates validation | a signal has malformed syntax |
        | any signal activates validation | duplicate signals carry conflicting values |
        | any signal activates validation | duplicate signals repeat the same value |
        | any signal activates validation | a spec marker appears outside the spec preamble |
        | any signal activates validation | a signal changes the contract's case or whitespace |

    Scenario Outline: Matching v1 signals preserve new-flow eligibility
      Given <artifact origin> feature carries both v1 markers and the v1 scaffold sentinel
      When a phase gate evaluates its activation state
      Then marker validation proceeds to the stage's inspiration evidence check

      Examples:
        | artifact origin |
        | a newly scaffolded |
        | an explicitly activated older |

  @learn-from-exceptional-products.NTB1.R2
  Rule: learn-from-exceptional-products.NTB1.R2 — Each synthesis plainly explains what Safeword learned and what changed

    Scenario Outline: The builder receives a plain-language decision synthesis
      Given Safeword has completed an inspiration scan with a <result>
      When it presents the decision-stage artifact
      Then it plainly explains <meaning>

      Examples:
        | result | meaning |
        | changed direction | what changed and why |
        | retained direction | why the evidence strengthened the existing choice |
        | complete unsuccessful search | what was tried and why no analog transferred |

    @rejection
    Scenario: Raw references without a decision synthesis are incomplete
      Given an inspiration section lists sources but gives no plain-language decision meaning
      When Safeword validates the record
      Then it rejects the missing decision impact with specific remediation

  @learn-from-exceptional-products.NTB1.R3
  Rule: learn-from-exceptional-products.NTB1.R3 — A feature leaves neither decision stage without evidence or a specific unsuccessful search

    Scenario Outline: A resolved evidence path permits the existing stage transition
      Given a marked new-flow feature is leaving the <stage> stage
      And its inspiration contains <resolved path>
      When the existing phase gate evaluates the artifact
      Then the ticket advances exactly once to the next phase
      And the inspiration artifact remains unchanged

      Examples:
        | stage | resolved path |
        | product decision | a current reference record |
        | product decision | a complete product unsuccessful-search record |
        | implementation decision | a current technical reference record |
        | implementation decision | a complete technical unsuccessful-search record |
        | product decision | reconciled current epic research for the same material job |
        | implementation decision | reconciled current epic research with compatible technical boundaries |

    Scenario Outline: Complete unsuccessful-search records are accepted by stage
      Given a marked new-flow feature has <complete record shape>
      When the existing phase gate evaluates the artifact with the injected evaluation date
      Then the stage-specific parser accepts every required field together
      And the ticket advances exactly once to the next phase

      Examples:
        | complete record shape |
        | product job/question, attempted products/categories/queries, bounded search date/sources, non-transfer rationale, and retained decision/rationale |
        | technical question/decision, constraints/versions, attempted categories/repositories/queries, bounded search date/sources, non-transfer rationale, and retained decision/rationale |

    @rejection
    Scenario Outline: Unresolved or incompatible evidence cannot satisfy a marked stage
      Given a marked new-flow feature is leaving the <stage> stage
      And its inspiration has <unresolved evidence>
      When the existing phase gate evaluates the artifact
      Then the transition is blocked with specific remediation

      Examples:
        | stage | unresolved evidence |
        | product decision | a bare no-analog skip |
        | product decision | an unsuccessful search missing its customer job or framed question |
        | product decision | an unsuccessful search missing attempted products, categories, or queries |
        | product decision | an unsuccessful search missing its search date or inspected sources |
        | product decision | an unsuccessful search missing why no result transfers |
        | product decision | an unsuccessful search missing the retained decision or rationale |
        | product decision | a direct reference checked before the feature was created |
        | product decision | a direct reference with a malformed checked-on date |
        | product decision | a direct reference checked in the future |
        | implementation decision | an unsuccessful search missing its technical question or decision |
        | implementation decision | an unsuccessful search missing constraints or dependency versions |
        | implementation decision | an unsuccessful search missing attempted categories, repositories, or queries |
        | implementation decision | an unsuccessful search missing its search date or inspected sources |
        | implementation decision | an unsuccessful search missing why no result transfers |
        | implementation decision | an unsuccessful search missing the retained decision or rationale |
        | implementation decision | version-specific evidence for a different target dependency version |

    Scenario Outline: Every evidence date uses its decision-stage baseline
      Given <date-bearing record> has <date state>
      When the inspiration gate evaluates the stage artifact
      Then <date outcome>

      Examples:
        | date-bearing record | date state | date outcome |
        | a product reference | a checked-on date equal to ticket creation | the date is accepted |
        | a product reference | a checked-on date before ticket creation | the gate blocks the record |
        | a product reference | a future checked-on date | the gate blocks the record |
        | a product reference | a malformed checked-on date | the gate blocks the record |
        | a product reference | no checked-on date | the gate blocks the record |
        | a product unsuccessful search | a search date equal to ticket creation | the date is accepted |
        | a product unsuccessful search | a search date before ticket creation | the gate blocks the record |
        | a product unsuccessful search | a future search date | the gate blocks the record |
        | a product unsuccessful search | a malformed search date | the gate blocks the record |
        | a product unsuccessful search | no search date | the gate blocks the record |
        | an implementation reference | a checked-on date equal to plan planned-on | the date is accepted |
        | an implementation reference | a checked-on date before plan planned-on | the gate blocks the record |
        | an implementation reference | a future checked-on date | the gate blocks the record |
        | an implementation reference | a malformed checked-on date | the gate blocks the record |
        | an implementation reference | no checked-on date | the gate blocks the record |
        | an implementation unsuccessful search | a search date equal to plan planned-on | the date is accepted |
        | an implementation unsuccessful search | a search date before plan planned-on | the gate blocks the record |
        | an implementation unsuccessful search | a future search date | the gate blocks the record |
        | an implementation unsuccessful search | a malformed search date | the gate blocks the record |
        | an implementation unsuccessful search | no search date | the gate blocks the record |
        | a product reference | a checked-on date equal to the injected evaluation date | the date is accepted |
        | a product unsuccessful search | a search date equal to the injected evaluation date | the date is accepted |
        | an implementation reference | a checked-on date equal to the injected evaluation date | the date is accepted |
        | an implementation unsuccessful search | a search date equal to the injected evaluation date | the date is accepted |

    Scenario Outline: Scaffold-origin activation preserves upgrade safety
      Given <artifact state>
      When the inspiration gate evaluates activation
      Then <activation outcome>

      Examples:
        | artifact state | activation outcome |
        | a signal-free ticket created by a pre-v1 scaffold before upgrade | the ticket receives the legacy exemption regardless of creation date |
        | a signal-free pre-v1 ticket with missing creation metadata | the ticket receives the legacy exemption |
        | a signal-free pre-v1 ticket with malformed creation metadata | the ticket receives the legacy exemption |
        | a v1 ticket with all three signals | the ticket is activated and proceeds to evidence validation |
        | a v1 ticket whose two version markers were deleted but whose scaffold sentinel remains | marker remediation blocks the transition |
        | an activated ticket with all three signals but missing creation metadata | signal validation passes and evidence validation blocks on the missing date baseline |
        | an activated ticket with all three signals but malformed creation metadata | signal validation passes and evidence validation blocks on the malformed date baseline |
        | a downgraded then reinstalled v1 ticket whose authored signals remain | the ticket reactivates without backfill or content mutation |

    Scenario: Signal-free pre-v1 features remain grandfathered
      Given a feature was created by a pre-v1 scaffold
      And its ticket and spec carry no inspiration-contract signal
      And it contains no inspiration sections
      When an existing phase gate evaluates its artifact
      Then the inspiration requirement does not block the transition
