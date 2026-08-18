Feature: Choose local or remote test execution per contributor

  @choose-local-or-remote-test-execution.TBU1.R1 @public-cli @surface.safeword-cli
  Rule: choose-local-or-remote-test-execution.TBU1.R1 — A contributor's explicit one-run choice wins without persisting

    Scenario Outline: A command override selects one local plan invocation and preserves its exit
      Given the project default and optional personal preference are <existing-preferences>
      When the contributor runs `safeword project test --lane <lane> --execution local`
      Then Safeword reports command as the winning source, sends no dispatch, runs the real <plan-kind> plan once, returns its <plan-exit> exit, and leaves project and personal configuration unchanged
      Examples:
        | existing-preferences | lane | plan-kind | plan-exit |
        | remote-preferred project and personal preferences | done | test | 0 |
        | remote-preferred project preference and no personal file | full | verify | 23 |

    Scenario: A remote-preferred command override wins but falls back before dispatch
      Given the project and personal preferences are local and no remote provider is installed
      When the contributor runs `safeword project test --lane done --execution remote-preferred`
      Then Safeword reports command as the winning source, proves no dispatch occurred, runs the real test plan once, returns its exact 17 exit, and leaves project and personal configuration unchanged

  @choose-local-or-remote-test-execution.TBU1.R2 @public-cli @surface.safeword-cli
  Rule: choose-local-or-remote-test-execution.TBU1.R2 — A valid personal preference wins over project default only in its current worktree

    Scenario Outline: A personal preference chooses the current worktree default
      Given the project default is remote-preferred, this worktree's `.safeword/config.local.json` contains the exact minimal config selecting <personal-mode>, remote availability is <remote-availability>, and the real test plan exits <plan-exit>
      When the contributor runs `safeword project test --lane done` without an override
      Then Safeword reports personal as the winning source, <selection-outcome>, runs the real test plan once, returns its exact <plan-exit> exit, and leaves project and personal configuration unchanged
      Examples:
        | personal-mode | remote-availability | plan-exit | selection-outcome |
        | local | not installed | 29 | selects local without fallback and sends no dispatch |
        | remote-preferred | not installed | 31 | reports remote unavailability before dispatch and falls back locally |

    Scenario: A personal preference is not shared with another worktree
      Given worktree A has `.safeword/config.local.json` selecting local and worktree B has its own path selecting remote-preferred
      When each contributor asks for test-execution status
      Then each worktree reports its own canonical local-config path and effective mode, neither process reads the other path, and both status requests leave both worktrees unchanged

  @choose-local-or-remote-test-execution.TBU1.R3 @rejection @public-cli @surface.safeword-cli
  Rule: choose-local-or-remote-test-execution.TBU1.R3 — Invalid or unsafe personal configuration never executes tests or changes project state

    Scenario Outline: Invalid personal configuration blocks a test request
      Given the resolved personal configuration path is <invalid-config>
      When the contributor runs `safeword project test --lane done`
      Then Safeword exits with `SAFEWORD_TEST_EXECUTION_INVALID`, names the personal origin, executes no plan, sends no dispatch, and changes no project, personal, ignore or other filesystem bytes
      Examples:
        | invalid-config |
        | malformed JSON |
        | duplicate object key |
        | unknown object key |
        | unsupported execution mode |
        | a missing required schema field |
        | a schema field with the wrong JSON value type |
        | extra nested structure |
        | a symlink |
        | a hard link |
        | a directory |
        | a file outside the project Safeword directory |
        | a file Git does not classify as ignored and untracked |

    @rejection
    Scenario: A command override cannot bypass invalid personal configuration
      Given the resolved personal configuration path contains malformed JSON
      When the contributor runs `safeword project test --lane full --execution local`
      Then Safeword exits with `SAFEWORD_TEST_EXECUTION_INVALID`, names the personal origin, executes no plan, sends no dispatch, and changes no project, personal, ignore or other filesystem bytes

    Scenario: Invalid personal configuration blocks a status request without mutation
      Given the resolved personal configuration path contains malformed JSON
      When the contributor runs `safeword project test-execution status`
      Then Safeword exits with `SAFEWORD_TEST_EXECUTION_INVALID`, names the personal origin, and changes no project, personal, ignore or other filesystem bytes

  @choose-local-or-remote-test-execution.NTB1.R1 @public-cli @surface.safeword-cli
  Rule: choose-local-or-remote-test-execution.NTB1.R1 — Status shows the selected mode, its source and remote availability

    Scenario: Status explains the effective local decision without changing anything
      Given no command override or personal preference exists and remote execution is not installed
      When the contributor runs `safeword project test-execution status`
      Then status lists command, personal, project and built-in scopes in highest-first order with command `not applicable`, the canonical personal and project origins, and built-in origin; identifies exact effective mode local and source built-in; reports remote execution as not installed; and changes no files

    Scenario: A valid local project preference is reported and used
      Given the project default is local, no command or personal preference exists, and the real test plan exits 37
      When the contributor runs `safeword project test --lane done`
      Then Safeword reports project as the winning local source, sends no dispatch, runs the real test plan once, returns its exact 37 exit, and leaves project and personal configuration unchanged

  @choose-local-or-remote-test-execution.NTB1.R2 @public-cli @surface.safeword-cli
  Rule: choose-local-or-remote-test-execution.NTB1.R2 — Remote preference falls back to the existing local plan only when remote execution is unavailable before dispatch

    Scenario Outline: An unavailable remote preference uses the real local plan
      Given <source> selects remote-preferred and no remote provider is installed
      When the contributor runs `safeword project test --lane <lane>`
      Then Safeword reports that remote execution is unavailable before dispatch, runs the real <plan-kind> plan once, and returns that plan's exact <plan-exit> exit
      Examples:
        | source | lane | plan-kind | plan-exit |
        | project | done | test | 19 |
        | personal | full | verify | 23 |

    @rejection
    Scenario Outline: Public CLI grammar exposes only supported execution modes
      Given a configured project has no remote provider installed
      When the contributor requests <command>
      Then <grammar-outcome>
      Examples:
        | command | grammar-outcome |
        | `safeword project test --help` | help exits zero and exposes only `local` and `remote-preferred` execution values |
        | `safeword project test --lane done --execution remote` | it exits with `SAFEWORD_TEST_EXECUTION_INVALID` before plan execution or mutation |
        | `safeword project test --lane done --execution local --execution remote-preferred` | it exits with `SAFEWORD_TEST_EXECUTION_INVALID` before plan execution or mutation |
