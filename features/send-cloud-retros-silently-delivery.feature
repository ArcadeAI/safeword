@send-cloud-retros-silently @wip
Feature: Deliver retros within silent bounded lifecycles
  SafeWord bounds local delivery work and enables only supported local harnesses.

  @send-cloud-retros-silently.SWM1.R4 @surface.claude-code @surface.openai-codex @surface.safeword-cli
  Rule: send-cloud-retros-silently.SWM1.R4 — Preparation and handoff obey separate exclusive deadlines and fail invisibly

    Background:
      Given existing host-specific extraction has produced a retrospective candidate
      And the public delivery clock starts after extraction hands off that candidate

    Scenario: Work within both budgets is preserved
      Given a controlled monotonic clock records preparation including the atomic claim completing at 999 milliseconds
      And submission plus atomic receipt recording completes 1999 milliseconds after handoff begins
      When the public retrospective delivery stage completes
      Then the durable receipt is atomically recorded beside the local session scope
      And the delivery stage completes at 2998 milliseconds after extraction handoff with empty stdout and stderr

    Scenario: Extraction time does not consume the delivery budgets
      Given a controlled monotonic clock
      And host-specific extraction consumes 4000 milliseconds before handing off one candidate
      And preparation including the atomic claim completes 10 milliseconds after handoff
      And submission plus atomic receipt recording completes 10 milliseconds later
      When the public retrospective delivery stage completes
      Then exactly one public retrospective attempt is made
      And the durable receipt is atomically recorded beside the local session scope
      And delivery completes 20 milliseconds after extraction handoff with empty stdout and stderr

    @rejection
    Scenario Outline: Preparation failure makes no handoff
      Given a controlled monotonic clock makes preparation <outcome> at 10 milliseconds after extraction handoff
      When the public retrospective delivery stage runs
      Then no public retrospective attempt is made
      And the hook exits successfully at 10 milliseconds after extraction handoff with empty stdout and stderr
      And no local attempt marker is created

      Examples:
        | outcome                                  |
        | receives a structurally invalid extracted candidate |
        | fails sanitization                       |
        | reads a malformed or missing project UUID |
        | cannot resolve the SafeWord CLI version |

    @rejection
    Scenario: Preparation reaching its deadline is abandoned on the boundary
      Given a controlled monotonic clock makes candidate validation reach the exclusive 1000 millisecond preparation deadline
      When the public retrospective delivery stage runs
      Then no public retrospective attempt is made
      And preparation is abandoned when the deadline fires
      And no local attempt marker is created
      And the delivery stage exits at 1000 milliseconds after extraction handoff with empty stdout and stderr

    @rejection
    Scenario: An uncommitted claim is abandoned at the preparation deadline
      Given a controlled monotonic clock
      And the atomic claim write has not been issued when the exclusive 1000 millisecond preparation deadline fires
      When the public retrospective delivery stage completes
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the delivery stage exits at 1000 milliseconds after extraction handoff with empty stdout and stderr

    Scenario: A claim completing on the preparation deadline makes no handoff
      Given a controlled monotonic clock
      And the atomic claim is issued before the preparation deadline
      And the claim completes at the exclusive 1000 millisecond deadline
      When the public retrospective delivery stage completes
      Then no public retrospective attempt is made
      And the local state remains claimed without a receipt
      And the delivery stage exits at 1000 milliseconds after extraction handoff with empty stdout and stderr

    @post-attempt-failure
    Scenario: Latest valid preparation still leaves an exclusive handoff budget
      Given a controlled monotonic clock
      And preparation including the atomic claim completes at 999 milliseconds after extraction handoff
      And handoff reaches its exclusive 2000 millisecond deadline
      When the public retrospective delivery stage completes
      Then exactly one public retrospective attempt is made
      And no durable receipt is recorded beside the local session scope
      And the delivery stage exits at 2999 milliseconds after extraction handoff with empty stdout and stderr

    @post-attempt-failure
    Scenario Outline: Handoff failure is not reported as preserved
      Given a controlled monotonic clock
      And preparation including the atomic claim completes at 998 milliseconds
      And handoff <outcome> 20 milliseconds after it begins
      When the public retrospective delivery stage completes
      Then no durable receipt is recorded beside the local session scope
      And the hook exits successfully at 1018 milliseconds after extraction handoff with empty stdout and stderr
      And exactly one public retrospective attempt is made
      And the existing claim remains unchanged

      Examples:
        | outcome                                  |
        | receives a transport failure             |
        | receives an empty receipt string         |
        | receives a response without an echoed request identity |
        | receives a well-formed rejection response |
        | receives a well-formed receipt bound to another request identity |

    @post-attempt-failure
    Scenario: Receipt recording failure leaves a claimed unpreserved session
      Given a controlled monotonic clock
      And preparation and handoff return a durable receipt within their budgets
      And atomic local receipt recording fails
      When the public retrospective delivery stage completes
      Then exactly one public retrospective attempt is made
      And the local state remains claimed without a receipt
      And the hook exits successfully with empty stdout and stderr

    @post-attempt-failure
    Scenario: Receipt recording reaching the handoff deadline is abandoned
      Given a valid durable receipt arrives before the handoff deadline
      And receipt persistence has not been issued when the exclusive 2000 millisecond deadline fires
      When the public retrospective delivery stage completes
      Then the local state remains claimed without a receipt
      And no receipt work remains after hook exit
      And the hook exits successfully with empty stdout and stderr

    @rejection
    Scenario: A claimed unpreserved session is not retried
      Given a prior handoff or receipt-recording failure left the session claimed without a receipt
      When the public retrospective delivery stage runs again
      Then no new public retrospective attempt is made
      And the existing claim remains unchanged
      And the hook exits successfully with empty stdout and stderr

    @post-attempt-failure
    Scenario: Hook exit leaves no detached handoff work
      Given a public handoff remains blocked until its deadline
      When the public retrospective delivery process exits
      Then the process table and open-handle observer report no SafeWord child, socket, IPC handoff, or queued work
      And the collector receives no bytes after hook-process exit
      And the local state remains claimed without a receipt
      And the hook exits successfully with empty stdout and stderr

    @rejection
    Scenario: An oversized prepared envelope is abandoned before handoff
      Given a controlled monotonic clock
      And preparation produces canonical bytes of 65,537 UTF-8 bytes with fewer than 65,536 characters within its budget
      And size validation occurs at 10 milliseconds after extraction handoff
      When the public retrospective delivery stage completes
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the hook exits successfully at 10 milliseconds after extraction handoff with empty stdout and stderr

    Scenario: A maximum-sized prepared envelope proceeds to handoff
      Given a controlled monotonic clock
      And preparation produces canonical bytes exactly 65,536 UTF-8 bytes with fewer than 65,536 characters within its budget
      When the public retrospective delivery stage completes
      Then exactly one public retrospective attempt is made
      And one local attempt marker is created
      And the hook exits successfully with empty stdout and stderr

  @send-cloud-retros-silently.SWM1.R5 @surface.claude-code @surface.openai-codex @surface.safeword-cli
  Rule: send-cloud-retros-silently.SWM1.R5 — This slice enables only local Claude Code and local Codex

    @rejection
    Scenario Outline: An unsupported host makes no retrospective attempt
      Given a completion entrypoint is registered with harness <harness> and host class <host_class>
      And that entrypoint receives an otherwise eligible session
      And host-specific extraction hands off retrospective candidate "candidate-fixture"
      When the shared completion hook entrypoint runs
      Then no public retrospective attempt is made
      And no local attempt marker is created
      And the hook exits successfully with empty stdout and stderr
      And existing private or spool handling receives unchanged retrospective candidate "candidate-fixture"

      Examples:
        | harness     | host_class |
        | claude-code | cloud      |
        | codex       | cloud      |
        | cursor      | local      |
        | unknown     | local      |

    @rejection
    Scenario: Install does not create public completion wiring for an unsupported host
      Given SafeWord install is asked to configure Cursor through the real install entrypoint
      And Cursor already has a non-SafeWord configuration entry
      And install processes that configuration through reconciliation
      When installation completes
      Then no public retrospective completion entry is created for Cursor
      And installation succeeds with Cursor's existing non-retrospective configuration unchanged

    @rejection
    Scenario Outline: Payload metadata cannot spoof an installed harness
      Given the installed <entrypoint> entrypoint receives an otherwise eligible payload claiming <claimed_harness>
      When the shared completion hook entrypoint runs
      Then the source harness is <source_harness> and host class is "local"
      And the canonical bytes contain source harness <source_harness>
      And the request is submitted only through the installed <entrypoint> adapter

      Examples:
        | entrypoint        | claimed_harness      | source_harness |
        | Codex local       | "Claude Code local" | "codex"       |
        | Claude Code local | "Codex local"       | "claude-code" |
