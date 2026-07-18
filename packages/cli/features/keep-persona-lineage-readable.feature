Feature: Keep persona lineage readable for builders

  Persona codes identify who a requirement serves from the project persona
  catalog through JTBDs and executable Gherkin. New defaults should be mnemonic
  without invalidating identifiers already stored in customer projects.

  @keep-persona-lineage-readable.TBU1.R1
  Rule: keep-persona-lineage-readable.TBU1.R1 — Newly derived persona codes are canonical 3–4 letter identifiers

    Scenario Outline: CLI and installed hooks derive the same canonical code
      Given a persona named "<name>" without an explicit code
      When the CLI resolver and installed JTBD hook resolve its code
      Then both resolve the exact code "<code>"
      And the resolved code is between 3 and 4 characters

      Examples:
        | name                                         | code |
        | Auditor                                      | AUD  |
        | Platform Operator                            | PLO  |
        | Site Reliability Engineer                    | SRE  |
        | International Atomic Energy Agency Inspector | IAEA |
        | Co-Founder                                   | COF  |
        | Bob's Burger                                 | BOB  |
        | Level 3 Operator                             | L3O  |

    Scenario: A first collision stays inside the canonical length
      Given "Platform Operator" precedes "Planning Owner" in the persona catalog
      And both names derive the code "PLO"
      When the CLI resolver and installed JTBD hook resolve the catalog in source order
      Then both map "Platform Operator" to "PLO"
      And both map "Planning Owner" to "PLO2"

    @rejection
    Scenario: A name too short for a canonical code requests an explicit override
      Given a persona named "S3" without an explicit code
      When safeword validates the persona catalog
      Then validation identifies "S3" as a non-canonical derived code
      And the message requests an explicit 2–4 letter code

    @rejection
    Scenario: Exhausted collision suffixes request an explicit override
      Given an ordered persona catalog contains 1000 names deriving "PLO"
      When the CLI resolver and installed JTBD hook resolve the catalog
      Then both report that the canonical collision space is exhausted
      And both messages request an explicit 2–4 letter code

  @keep-persona-lineage-readable.TBU1.R2
  Rule: keep-persona-lineage-readable.TBU1.R2 — Existing explicit persona codes remain valid lineage anchors

    Scenario Outline: A compatible explicit code resolves unchanged
      Given a persona with the explicit code "<code>"
      When safeword validates and resolves that persona
      Then validation accepts the code
      And resolution returns the exact code "<code>"

      Examples:
        | code   |
        | PO     |
        | DEV    |
        | OPER   |
        | ADMIN  |
        | PLATOP |

    Scenario: A pre-existing legacy JTBD reference still resolves
      Given personas.md declares Safeword Maintainer with the explicit code "SM"
      And an existing JTBD references the persona code "SM"
      When the installed intake gate validates the JTBD
      Then the reference resolves to the Safeword Maintainer persona
      And its exact resolved code is "SM"

    @rejection
    Scenario Outline: A code outside the compatibility bounds is rejected
      Given a persona with the explicit code "<code>"
      When safeword validates the persona catalog
      Then validation rejects the code

      Examples:
        | code    |
        | A       |
        | TOOLONG |

  @keep-persona-lineage-readable.SWM1.R1
  Rule: keep-persona-lineage-readable.SWM1.R1 — One resolved code flows unchanged from personas.md through JTBD and Gherkin lineage

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Installed assets prescribe one canonical lineage code
      Given a fresh project configured for "<surface>"
      When safeword installs its persona and BDD authoring assets
      Then persona guidance defines automatic codes as 3–4 letters
      And persona guidance allows explicit codes with 2–4 letters
      And JTBD and Gherkin guidance carry the persona code unchanged

      Examples:
        | surface     |
        | Claude Code |
        | OpenAI Codex |
        | Cursor      |

    @rejection
    Scenario: Installed assets distinguish explicit two-letter codes from automatic defaults
      Given the installed persona and BDD authoring assets
      When their new-code examples are inspected
      Then automatic new-code examples use 3–4 letters
      And explicit new-code examples may use 2–4 letters
      And 5–6 letter codes are described only as legacy compatibility
