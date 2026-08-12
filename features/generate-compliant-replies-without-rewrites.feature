@surface.claude-code
Feature: Generate compliant replies without correction loops
  Claude receives the exact terminal reply contract before generation, while
  Stop remains a bounded fallback and every stronger gate keeps precedence.

  @generate-compliant-replies-without-rewrites.NTB1.R1
  Rule: generate-compliant-replies-without-rewrites.NTB1.R1 — A compliant first completion finishes without a format-correction turn

    Scenario: A complete CONFIDENT brief finishes on the first Stop
      Given Claude has edited work to report
      And its final reply contains one CONFIDENT verdict with Decided, Open, and Next paragraphs
      When the reply reaches the Stop hook
      Then no format-correction continuation is emitted

    Scenario: A complete BLOCKED brief finishes with Need as its terminal action
      Given Claude has edited work to report
      And its final reply contains one BLOCKED verdict with Tried and Need paragraphs
      And the reply has no separate Next paragraph
      When the reply reaches the Stop hook
      Then no format-correction continuation is emitted

    @rejection
    Scenario: A near-complete first reply cannot silently pass
      Given Claude has edited work to report
      And its final reply declares CONFIDENT without an Open paragraph
      When the reply reaches the Stop hook
      Then the canonical format correction is emitted

    @manual
    Scenario: A builder sees one completion in a live Claude session
      Given a builder asks a live Safeword-managed Claude session to edit work
      When Claude reports the completed edit with a proactive compliant brief
      Then the builder sees one completion and no format-correction turn

    @manual @rejection
    Scenario: An unavailable live runtime is recorded as a verification limitation
      Given the verification environment cannot launch a live Safeword-managed Claude session
      When the live walkthrough is attempted
      Then verification records the runtime limitation
      And hook subprocess output is not reported as builder-visible proof

  @generate-compliant-replies-without-rewrites.NTB1.R2
  Rule: generate-compliant-replies-without-rewrites.NTB1.R2 — A non-compliant completion receives one actionable correction rather than an unbounded rewrite loop

    @rejection
    Scenario: A first non-compliant reply receives the canonical correction
      Given Claude has edited work to report
      And its final reply has no terminal verdict
      And no Stop correction is active
      When the reply reaches the Stop hook
      Then exactly one canonical format correction is emitted

    Scenario: A correction attempt cannot trigger another format rewrite
      Given Claude has edited work to report
      And its correction reply is still structurally incomplete
      And a Stop correction is already active
      When the correction reply reaches the Stop hook
      Then no further format-correction continuation is emitted

  @generate-compliant-replies-without-rewrites.TBU1.R1
  Rule: generate-compliant-replies-without-rewrites.TBU1.R1 — The exact phase-neutral contract is available before the first response and restored after compaction

    Scenario Outline: Session boundaries deliver the same exact terminal contract
      Given a configured Safeword-managed Claude session reaches the <boundary> boundary
      When the configured SessionStart hook group runs
      Then the context contains the exact phase-neutral decision-brief contract
      And the contract appears exactly once
      And the exact compact authority bootstrap appears once

      Examples:
        | boundary   |
        | startup    |
        | resume     |
        | clear      |
        | compaction |
        | fork       |

    @rejection
    Scenario: Startup context excludes phase-specific completion evidence
      Given a Safeword-managed Claude session is starting
      When the session context hook runs
      Then the context contains no implement-phase evidence requirement

  @generate-compliant-replies-without-rewrites.TBU1.R2
  Rule: generate-compliant-replies-without-rewrites.TBU1.R2 — Quiet TDD turns retain the lead-only cue instead of the full decision-brief demand

    @rejection
    Scenario Outline: Every active TDD step rejects the full decision-brief demand
      Given a feature is in the active <step> step
      When the user submits the next prompt
      Then the prompt context contains the lead-first cue
      And it contains no full decision-brief demand

      Examples:
        | step     |
        | RED      |
        | GREEN    |
        | REFACTOR |

    Scenario: An ordinary work update retains the compact decision-brief reminder
      Given no active TDD step requires quiet mode
      When the user submits a substantive work prompt
      Then the prompt context contains the compact CONFIDENT or BLOCKED reminder
      And it names Next for CONFIDENT and Need for BLOCKED without requiring both

  @generate-compliant-replies-without-rewrites.TBU1.R3
  Rule: generate-compliant-replies-without-rewrites.TBU1.R3 — Format compliance never bypasses dependency, test, architecture, or done gates

    @rejection
    Scenario Outline: A hard gate wins on every Stop iteration
      Given Claude's final reply is structurally compliant
      And every hard gate other than <gate> allows Stop
      And the <gate> gate has a failing verdict
      And the reply is on the <iteration> Stop iteration
      When the reply reaches the Stop hook
      Then the failing <gate> verdict is emitted instead of allowing Stop

      Examples:
        | gate                | iteration  |
        | dependency          | first      |
        | test                | first      |
        | phase artifact      | first      |
        | architecture review | first      |
        | done                | first      |
        | dependency          | correction |
        | test                | correction |
        | phase artifact      | correction |
        | architecture review | correction |
        | done                | correction |

    Scenario: Typecheck advice precedes format pass-through on the first Stop
      Given Claude's final reply is structurally compliant
      And every hard gate allows Stop
      And typecheck has actionable advice
      And no Stop correction is active
      When the reply reaches the Stop hook
      Then typecheck advice is emitted before terminal-format validation allows Stop

    Scenario: The correction loop guard runs after hard gates
      Given every hard gate allows Stop
      And typecheck has actionable advice
      And the correction reply is still structurally incomplete
      And a Stop correction is already active
      When the correction reply reaches the Stop hook
      Then Stop is allowed without typecheck advice or another format correction

    Scenario: A compliant first Stop emits no redundant format correction
      Given Claude's final reply is structurally compliant
      And every hard and advisory gate allows Stop
      And no Stop correction is active
      When the reply reaches the Stop hook
      Then no format-correction continuation is emitted

  @generate-compliant-replies-without-rewrites.SWM1.R1 @surface.safeword-cli
  Rule: generate-compliant-replies-without-rewrites.SWM1.R1 — One phase-neutral definition supplies both proactive context and terminal-format validation

    Scenario: Configured hooks follow one changed canonical contract
      Given the canonical contract changes from distinct shape A to distinct shape B before installation
      And Safeword is installed from its managed templates
      When the configured SessionStart and Stop commands are executed as subprocesses
      Then SessionStart emits shape B
      And Stop accepts shape B and rejects the former shape A

    @rejection
    Scenario Outline: Every distribution boundary handles contract drift
      Given <drift>
      When the <validator> runs
      Then <result>

      Examples:
        | drift                                                                  | validator                                      | result                                                        |
        | an installed hook differs from its canonical template                 | setup reconciliation                           | the installed hook is restored from the canonical template    |
        | the canonical source changed while the committed plugin remains stale | Claude plugin generation and worktree diff gate | the committed plugin is rejected as drifted from its source    |
        | a dogfood copy differs from its canonical template                    | template parity check                          | the dogfood copy fails with a pair-drift finding               |

  @generate-compliant-replies-without-rewrites.SWM1.R2
  Rule: generate-compliant-replies-without-rewrites.SWM1.R2 — CONFIDENT and BLOCKED compliance is deterministic and matches the canonical paragraph grammar

    Scenario Outline: Accepted boundary shapes remain deterministic
      Given the final reply uses the <shape> shape
      When terminal-format compliance is evaluated repeatedly
      Then every evaluation accepts the reply

      Examples:
        | shape                                                |
        | CONFIDENT ordered Decided, Rejected, Open, then Next |
        | CONFIDENT without the optional Rejected paragraph    |
        | CONFIDENT with CRLF line endings                     |
        | BLOCKED ordered Tried then terminal Need              |
        | BLOCKED with CRLF line endings                        |

    @rejection
    Scenario Outline: Adversarial terminal shapes are rejected deterministically
      Given the final reply has <defect>
      When terminal-format compliance is evaluated repeatedly
      Then every evaluation rejects the reply

      Examples:
        | defect                                         |
        | no terminal verdict                            |
        | both CONFIDENT and BLOCKED verdicts             |
        | two unquoted verdicts of the same kind          |
        | a complete template only inside a blockquote    |
        | a complete template only inside a list item     |
        | a complete template only inside a fenced block  |
        | a complete template only inside indented code   |
        | a complete template only inside an HTML comment |
        | a complete template only inside an HTML block   |
        | a complete template only inside a nested bullet continuation |
        | a complete template only inside an ordered-list continuation |
        | a complete template only inside an HTML declaration |
        | a complete template only inside an HTML processing instruction |
        | a complete template only inside an HTML CDATA block |
        | a complete template only inside a multiline script block |
        | a complete template only inside a multiline generic HTML block |
        | a complete template only inside a lowercase HTML declaration |
        | a verdict label mentioned only in prose         |
        | required labels outside the terminal block      |
        | required paragraphs in the wrong order          |
        | a duplicated Decided paragraph                  |
        | a duplicated Rejected paragraph                 |
        | a duplicated Open paragraph                     |
        | a duplicated Next paragraph                     |
        | a duplicated Tried paragraph                    |
        | a duplicated Need paragraph                     |
        | Rejected after Open or Next                      |
        | BLOCKED without a Tried paragraph                |
        | BLOCKED without a Need paragraph                 |
        | BLOCKED with Need before Tried                   |
        | BLOCKED with a separate Next after Need          |
        | trailing prose after the terminal action        |
        | an empty required paragraph body                |

    Scenario Outline: Ignored Markdown content does not poison a valid terminal brief
      Given verdict-like content appears inside <ignored-context>
      And a valid top-level decision brief follows as the contiguous terminal block
      When terminal-format compliance is evaluated repeatedly
      Then every evaluation accepts the reply

      Examples:
        | ignored-context |
        | a blockquote    |
        | a list item     |
        | fenced code     |
        | indented code   |
        | an HTML comment |
        | an HTML block   |
        | a nested bullet continuation |
        | an ordered-list continuation |
        | an HTML declaration |
        | an HTML processing instruction |
        | an HTML CDATA block |
        | a multiline script block |
        | a multiline generic HTML block |
        | a lowercase HTML declaration |
        | an unrelated bold label |
        | ordinary prose  |

    @rejection
    Scenario: Adversarial parser work remains linear
      Given equivalent adversarial replies of one, two, and four megabytes
      And parser instrumentation counts examined input characters
      When each reply is evaluated in-process
      Then every reply is rejected
      And examined-character counts grow no faster than the fixed linear bound

    @benchmark @manual
    Scenario: The parser stays within the hook budget on the reference runner
      Given the declared reference-runner profile and fixed four-megabyte adversarial workload
      And the parser has completed its declared warm-up
      When the fixed repetition set is measured in-process
      Then every measured evaluation completes within 500 milliseconds
