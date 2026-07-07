# BDD source for PNZM3B (process-level friction surfaces + egress-drop
# reporting). Proven by the vitest suite (co-located `*.test.ts` under
# src/retro and tests around the retro command), whose unit + wiring scenarios
# mock only the process boundaries (the extraction subprocess, the GitHub
# transport) — a shape the cucumber black-box lane can't drive. `@manual`
# excludes it from the cucumber acceptance lane while keeping it readable by
# codify / review-spec / safeword check.
@retro-process-surface @manual
Feature: Retro process-level surfaces and egress-drop reporting

  Retro's egress guard fails closed on any finding whose surface isn't a real
  safeword file path and drops it silently, so process/workflow friction never
  reaches the tracker and extractors fabricate file paths instead. A constrained
  virtual `process/<slug>` namespace gives such findings an honest, leak-proof
  surface, and every egress drop is counted in the run summary. The surface field
  bypasses the free-text scrubber — the surface wall is the ONLY wall — so the
  slug constraint itself carries the egress guarantee.

  @retro-process-surface.SM1.R1
  Rule: retro-process-surface.SM1.R1 — A process-area finding survives egress and files like any file-surfaced finding

    Scenario: A finding surfaced as a valid process area becomes a filable encounter
      Given a raw finding whose surface is a process area with a plain hyphenated slug
      When the findings pass the egress pipeline
      Then an encounter is produced whose issue body names that process surface

    Scenario: A process-surfaced finding files end to end through the retro run
      Given a run whose findings include one surfaced as a valid process area
      When the retro run completes, with only extraction and the GitHub transport mocked
      Then an issue is created whose body names the process surface and whose labels include the process label alongside the standard retro labels

    Scenario: A process-surfaced draft carries the process label
      Given a sanitized finding whose resolved surface is a process area
      When the draft is assembled
      Then its labels include the process label alongside the standard retro labels

    Scenario: A file-surfaced draft is unchanged by the process namespace
      Given a raw finding whose surface is a real safeword file path
      When the findings pass the egress pipeline
      Then the encounter files under the file surface without a process label

    @rejection
    Scenario: A non-safeword file path is still dropped
      Given a raw finding whose surface is a customer file path outside the allowlist
      When the findings pass the egress pipeline
      Then no encounter is produced and the drop is counted at the surface wall

  @retro-process-surface.SM1.R2
  Rule: retro-process-surface.SM1.R2 — The process namespace stays fail-closed against non-slug and secret-shaped values

    @rejection
    Scenario Outline: A process surface outside the strict slug shape is dropped
      Given a raw finding whose surface is "process/<slug>", violating the slug shape as <shape violation>
      When the findings pass the egress pipeline
      Then no encounter is produced and the drop is counted at the surface wall

      Examples:
        | slug                              | shape violation                    |
        | TDD-Loop                          | uppercase                          |
        | tdd_loop                          | underscore                         |
        | tdd/loop                          | nested separator                   |
        | verify-suite-timeout-and-tdd-loop | 33 chars, one over the bound       |
        |                                   | empty slug                         |
        | deadbeefcafe                      | sub-20-char hex run                |
        | 3f9d2c7b1a8e4d6f0b5a9c8d7e6f1a2b  | 32-char hex (secret-shaped)        |
        | 3f9d-2c7b-1a8e-4d6f               | hyphen-split hex                   |
        | k9x2m7q4w8z3j6v1n5r0              | high-entropy non-hex token         |
        | deadbe1f-zzzzzzzz                 | embedded 8-hex run in padding      |

    Scenario: An ordinary word slug at the length boundary survives
      Given a raw finding whose surface is a process area with a 32-character hyphenated word slug
      When the findings pass the egress pipeline
      Then an encounter is produced for it

    Scenario: A slug with a hex-alphabet dictionary word among non-hex segments survives
      Given a raw finding whose surface is a process area slugged "dead-code-cleanup"
      When the findings pass the egress pipeline
      Then an encounter is produced for it

  @retro-process-surface.SM1.R3
  Rule: retro-process-surface.SM1.R3 — Extraction guidance offers the process surface instead of fabricated file paths

    Scenario: The shared extraction prompt offers the process namespace
      Given the extraction prompt shared by both lanes
      When its surface guidance is inspected
      Then it offers a process area form for friction with no single-file surface

    Scenario: The Codex schema's surface description names the same process form
      Given the Codex extraction schema
      When its surface field description is inspected
      Then it names the identical process area form

    @rejection
    Scenario: A surface is still required of every finding
      Given a raw finding that omits its surface field
      When the findings pass the egress pipeline
      Then the finding is rejected at the schema wall rather than filed surface-less

  @retro-process-surface.SM2.R1
  Rule: retro-process-surface.SM2.R1 — The run summary reports drops per egress wall and stays quiet when clean

    Scenario: Unresolvable-surface drops are counted in the summary
      Given a run whose findings include two with surfaces that resolve nowhere
      When the retro run completes
      Then the summary reports two findings dropped at the surface wall

    Scenario: Off-schema drops are counted in the summary
      Given a run whose findings include one missing a required field
      When the retro run completes
      Then the summary reports one finding dropped at the schema wall

    Scenario: Drops at both walls in one run are reported separately
      Given a run whose findings include one missing a required field and one with a surface that resolves nowhere
      When the retro run completes
      Then the summary reports one finding dropped at the schema wall and one at the surface wall

    @rejection
    Scenario: A clean run's summary carries no drop line
      Given a run where every finding survives both egress walls
      When the retro run completes
      Then the summary is the unchanged filing summary with no drop report
