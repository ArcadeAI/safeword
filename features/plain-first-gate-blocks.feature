@plain-first-gate-blocks
Feature: Plain-first gate blocks

  When a safeword gate hard-blocks a tool call, the message must be
  understandable on its own — in plain words, without knowing safeword's
  vocabulary or running any command. Each message leads with what happened and
  the one thing to do next; internal file, phase, and verdict names come after
  (or get glossed), never first and never alone. Enforcement is untouched: this
  is about how a block is said, not what it blocks.

  Two senses of proof run through these rules. A **conforming** scenario checks
  the messages the seven real gates actually build (LOC, phase, plan, done,
  spec/JTBD/criteria, bash-ledger-write, process-kill) — binding to the real
  builders and asserting all seven are present, so the lock can't green against a
  stale fixture or an empty set. A **@rejection** scenario feeds the plainness
  guard a message that breaks the property, parametrized over every violation
  class the rule forbids, so a green suite means the guard discriminates on each
  class, not that it passes everything vacuously. Scenarios assert the property,
  never verbatim copy, so wording can be tuned without breaking tests.

  Background:
    Given the real hard-block message built by each of safeword's seven gates: LOC, phase, plan, done, spec/JTBD/criteria, bash-ledger-write, and process-kill

  @plain-first-gate-blocks.NTB1.R1 @surface.claude-code
  Rule: plain-first-gate-blocks.NTB1.R1 — Every hard block leads with a plain sentence

    Scenario: Every gate's block opens with a plain sentence
      When each gate's message is checked
      Then every one of the seven gates produced a message
      And each opens with a plain-English sentence naming what happened and why
      And none begins with a file name, phase name, or verdict label

    @rejection
    Scenario Outline: A block that opens with an internal token is flagged
      Given a hard-block message whose first sentence begins with a <token>
      When the plainness guard checks it
      Then the guard reports the message does not lead with a plain sentence

      Examples:
        | token         |
        | file name     |
        | phase name    |
        | verdict label |

  @plain-first-gate-blocks.NTB1.R2 @surface.claude-code
  Rule: plain-first-gate-blocks.NTB1.R2 — Every hard block names exactly one next action

    Scenario: Every gate's block carries one next-step line
      When each gate's message is checked
      Then every one of the seven gates produced a message
      And each carries exactly one imperative next-step line

    @rejection
    Scenario Outline: A block that does not carry exactly one next-step line is flagged
      Given a hard-block message that carries <count> imperative next-step lines
      When the plainness guard checks it
      Then the guard reports the message does not name exactly one next action

      Examples:
        | count |
        | zero  |
        | two   |

  @plain-first-gate-blocks.NTB1.R3 @surface.claude-code
  Rule: plain-first-gate-blocks.NTB1.R3 — No bare internal term stands alone

    Scenario: Every gate's block glosses or replaces its internal terms
      Given the defined set of internal terms: phase names, artifact file names, "frontmatter", and verdict labels
      When each gate's message is checked
      Then every one of the seven gates produced a message
      And no term from that set appears without a plain-word gloss or replacement

    @rejection
    Scenario Outline: A block with an unglossed internal term is flagged
      Given a hard-block message containing a bare <term> with no plain explanation
      When the plainness guard checks it
      Then the guard reports the unglossed internal term

      Examples:
        | term               |
        | phase name         |
        | artifact file name |
        | frontmatter        |
        | verdict label      |

  @plain-first-gate-blocks.NTB1.R4 @surface.claude-code
  Rule: plain-first-gate-blocks.NTB1.R4 — The block is self-sufficient; /explain is optional

    Scenario: Every gate's next step is a real action, not "run /explain"
      When each gate's message is checked
      Then every one of the seven gates produced a message
      And each names a next action that is a concrete step other than running /explain

    Scenario: /explain appears only as optional detail
      When each gate's message is checked
      Then every one of the seven gates produced a message
      And in each message /explain appears only as an optional way to get more detail, never as a required step

    @rejection
    Scenario: A block whose only next step is /explain is flagged
      Given a hard-block message whose sole next action is to run /explain
      When the plainness guard checks it
      Then the guard reports the message is not self-sufficient

    @rejection
    Scenario: A block that presents /explain as a required extra step is flagged
      Given a hard-block message that names a real action and also requires running /explain to proceed
      When the plainness guard checks it
      Then the guard reports the message is not self-sufficient

  # Cross-surface parity grouping (unnumbered Rule — exempt from numbered-rule
  # lineage). Proves R1–R4 survive the adapter rewrite; traces to spec.md
  # `## Surfaces` (Cursor, OpenAI Codex).
  Rule: Plainness holds across every harness

    @surface.cursor @surface.openai-codex
    Scenario: The same block renders plain-first on Cursor and Codex
      Given a hard block rendered through the Cursor and Codex adapters
      When the adapter-rendered message is checked
      Then it leads with a plain sentence, names exactly one next action, names no bare internal term, and stands alone without the detail command
      And the optional-detail pointer is the harness-appropriate command
