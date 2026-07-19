@plain-first-gate-blocks
Feature: Plain-first gate blocks

  When a safeword gate hard-blocks a tool call, the message must be
  understandable on its own — in plain words, without knowing safeword's
  vocabulary or running any command. Each message leads with what happened and
  the one thing to do next; internal file, phase, and verdict names come after
  (or get glossed), never first and never alone. Enforcement is untouched: this
  is about how a block is said, not what it blocks.

  Two senses of proof run through these rules. A **conforming** scenario checks
  the real set of hard-block messages against a property (the regression lock,
  covering every gate). A **@rejection** scenario feeds the plainness guard a
  message that breaks the property and checks the guard actually flags it — so a
  green suite means the guard discriminates, not that it passes everything
  vacuously. Scenarios assert the property, never verbatim copy, so wording can
  be tuned without breaking tests.

  @plain-first-gate-blocks.NTB1.R1
  Rule: plain-first-gate-blocks.NTB1.R1 — Every hard block leads with a plain sentence

    @surface.claude-code
    Scenario: Every hard block opens with a plain sentence
      Given the set of safeword hard-block messages
      When each message is checked
      Then each opens with a plain-English sentence naming what happened and why
      And no message begins with a file name, phase name, or status label

    @rejection
    Scenario: A block that opens with an internal token is flagged
      Given a hard-block message whose first sentence begins with an artifact file name
      When the plainness guard checks it
      Then the guard reports the message does not lead with a plain sentence

  @plain-first-gate-blocks.NTB1.R2
  Rule: plain-first-gate-blocks.NTB1.R2 — Every hard block names exactly one next action

    Scenario: Every hard block names one next action
      Given the set of safeword hard-block messages
      When each message is checked
      Then each names exactly one concrete next action the reader can take

    @rejection
    Scenario Outline: A block that does not name exactly one action is flagged
      Given a hard-block message that names <count> next actions
      When the plainness guard checks it
      Then the guard reports the message does not name exactly one next action

      Examples:
        | count |
        | zero  |
        | two   |

  @plain-first-gate-blocks.NTB1.R3
  Rule: plain-first-gate-blocks.NTB1.R3 — No bare internal term stands alone

    Scenario: Every hard block glosses or replaces its internal terms
      Given the set of safeword hard-block messages
      When each message is checked
      Then no internal term stands alone without a plain-word gloss or replacement

    @rejection
    Scenario: A block with an unglossed internal term is flagged
      Given a hard-block message containing a bare artifact file name with no plain explanation
      When the plainness guard checks it
      Then the guard reports the unglossed internal term

  @plain-first-gate-blocks.NTB1.R4
  Rule: plain-first-gate-blocks.NTB1.R4 — The block is self-sufficient; /explain is optional

    Scenario: Every hard block's next step is a real action, not "run /explain"
      Given the set of safeword hard-block messages
      When each message is checked
      Then each names a next action that is a concrete step other than running /explain
      And /explain appears only as an optional way to get more detail

    @rejection
    Scenario: A block whose only next step is /explain is flagged
      Given a hard-block message whose sole next action is to run /explain
      When the plainness guard checks it
      Then the guard reports the message is not self-sufficient

  Rule: Plainness holds across every harness

    @surface.cursor @surface.openai-codex
    Scenario: The same block renders plain-first on Cursor and Codex
      Given a hard block rendered through the Cursor and Codex adapters
      When the adapter-rendered message is checked
      Then it satisfies the same plainness rules as the Claude Code message
      And the optional-detail pointer is the harness-appropriate command
