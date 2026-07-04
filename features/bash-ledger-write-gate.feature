# Behavior source for W42G34 (#644 G3). The executable backing is Vitest hook
# coverage: unit tests over the pure command-classification predicate, plus
# integration tests spawning the Bun hook scripts (Claude gate, Codex adapter)
# against temp projects. Cucumber step definitions would duplicate that harness
# without adding confidence, so the feature is @wip like its siblings.
@wip
Feature: Bash-channel writes to the R/G/R ledger are gated

  The SHA-or-skip annotation rules for test-definitions.md only fire on the
  Edit/Write/MultiEdit path. Safeword closes the Bash channel: a shell command
  that names a ledger file as a write target is denied at PreToolUse and
  directed to the Edit channel, where the transition gate can validate the
  change. Read-only references pass. Detection is conservative and its limits
  are documented — the done-gate's distinct-SHA check remains the backstop.

  Rule: Only write-shaped references to a ledger file are denied

    @bash-ledger-write-gate.SM1.AC1 @surface.claude-code
    Scenario: The bulk-tick sed command from the audit is denied
      Given an active project with a ticket ledger at .project/tickets/GH628F/test-definitions.md
      When the agent runs a Bash command applying sed in-place to mark every checkbox in that ledger
      Then the command is denied before it executes

    @bash-ledger-write-gate.SM1.AC2
    Scenario: A read-only reference to the ledger is allowed
      Given an active project with a ticket ledger
      When the agent runs a Bash command that greps the ledger for checkbox lines
      Then the command is allowed

    @bash-ledger-write-gate.SM1.AC2
    Scenario: A command with no ledger reference is allowed
      Given an active project with a ticket ledger
      When the agent runs a Bash command that does not reference any ledger file
      Then the command is allowed

    @bash-ledger-write-gate.SM2.AC2
    Scenario: Mentioning the ledger path without a write shape is allowed
      Given an active project with a ticket ledger
      When the agent runs a Bash command that stages the ledger with git add
      Then the command is allowed

    @bash-ledger-write-gate.SM1.AC1
    Scenario Outline: Each recognized write shape targeting the ledger is denied
      Given an active project with a ticket ledger
      When the agent runs a Bash command using <write shape> with the ledger as target
      Then the command is denied before it executes

      Examples:
        | write shape                   |
        | sed in-place editing          |
        | perl in-place editing         |
        | output redirection            |
        | append redirection            |
        | tee                           |
        | mv destination                |
        | cp destination                |
        | truncate                      |
        | inline interpreter invocation |

    @bash-ledger-write-gate.SM1.AC1
    Scenario: A write-shaped segment inside a compound command is denied
      Given an active project with a ticket ledger
      When the agent runs a compound command whose second segment redirects output into the ledger
      Then the command is denied before it executes

    @bash-ledger-write-gate.SM2.AC2
    Scenario: Redirecting ledger contents to another file is allowed
      Given an active project with a ticket ledger
      When the agent runs a Bash command that reads the ledger and redirects the output to a non-ledger file
      Then the command is allowed

  Rule: The gate scopes to the tickets namespace

    @bash-ledger-write-gate.SM2.AC2
    Scenario: Writing a test-definitions.md outside the tickets namespace is allowed
      Given a file named test-definitions.md that lives outside the project tickets directory
      When the agent runs a Bash command redirecting output into that file
      Then the command is allowed

  Rule: Detection is conservative and its limits are documented

    @bash-ledger-write-gate.SM2.AC2
    Scenario: An obfuscated write the predicate cannot see is allowed by design
      Given an active project with a ticket ledger
      When the agent runs a Bash command that reaches the ledger only through a shell variable
      Then the command is allowed

    @bash-ledger-write-gate.SM1.AC1
    Scenario: An inline interpreter that names the ledger is denied even if its code only reads
      Given an active project with a ticket ledger
      When the agent runs an interpreter with an inline-code flag whose code names the ledger path
      Then the command is denied before it executes

    @bash-ledger-write-gate.SM2.AC1
    Scenario: The predicate module documents what it cannot catch
      Given the shared command-classification module
      When a maintainer reads its module documentation
      Then the documentation names the undetectable forms and the done-gate backstop

  Rule: One predicate reaches all three harnesses

    @bash-ledger-write-gate.SM1.AC3 @surface.claude-code
    Scenario: The Claude gate denies a ledger write through its Bash branch
      Given a temp project with an active ticket ledger
      When the Claude PreToolUse hook receives a Bash tool call writing to the ledger
      Then the hook responds with a deny decision

    @bash-ledger-write-gate.SM1.AC3 @surface.openai-codex
    Scenario: The Codex adapter carries the same denial
      Given a temp project with an active ticket ledger
      When the Codex adapter receives a shell tool call writing to the ledger
      Then the adapter surfaces the gate's denial

    @bash-ledger-write-gate.SM1.AC3 @surface.openai-codex
    Scenario: The Codex adapter passes an allowed command through
      Given a temp project with an active ticket ledger
      When the Codex adapter receives a shell tool call that only greps the ledger
      Then the adapter surfaces no denial

    @bash-ledger-write-gate.SM1.AC3 @surface.cursor
    Scenario: Cursor's shell pre-filter consults the gate for ledger writes
      Given a shell command that writes to a ledger file
      When Cursor's fail-closed shell predicate classifies the command
      Then the predicate requires the gate to run

    @bash-ledger-write-gate.SM1.AC3 @surface.cursor
    Scenario: Cursor's shell pre-filter does not demand the gate for a read-only command
      Given a shell command that only greps a ledger file
      When Cursor's fail-closed shell predicate classifies the command
      Then the predicate does not require the gate to run

  Rule: The denial names the sanctioned channel

    @bash-ledger-write-gate.TB1.AC1
    Scenario: The denial message directs to the Edit channel with the reason
      Given an active project with a ticket ledger
      When the agent runs a denied Bash command targeting the ledger
      Then the denial names the Edit channel as the way to make the change
      And the denial explains that Bash writes bypass annotation validation
