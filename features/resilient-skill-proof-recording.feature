@manual
Feature: Skill proof recording survives normal shell commands

  Safeword preserves a session-bound receipt for every recognized proof helper
  command without accepting stale or unrecognized commands.

  @resilient-skill-proof-recording.SWM1.R1
  @surface.openai-codex @surface.cursor
  Rule: resilient-skill-proof-recording.SWM1.R1 — A documented helper command records proof for its requested skill

    Scenario Outline: Recognized helper path records current-session proof on each runtime
      Given <runtime> supplies a current session identity in the installed project rooted at `<projectRoot>`
      When a quality skill runs through `<helperPath>` as the <path> helper path
      Then the requested skill has a receipt for that session

      Examples:
        | runtime | path | projectRoot | helperPath |
        | Codex | exact installed relative | /repo | .safeword/hooks/record-skill-invocation.ts |
        | Cursor | exact installed relative | /repo | .safeword/hooks/record-skill-invocation.ts |
        | Codex | installed absolute | /repo | /repo/.safeword/hooks/record-skill-invocation.ts |
        | Cursor | installed absolute | /repo | /repo/.safeword/hooks/record-skill-invocation.ts |

  @resilient-skill-proof-recording.SWM1.R2
  @surface.openai-codex @surface.cursor
  Rule: resilient-skill-proof-recording.SWM1.R2 — Each helper command in one shell command retains its own current-session proof

    Scenario Outline: Distinct chained skills record ordered proof on each runtime
      Given <runtime> supplies a current session identity
      When `verify && audit` executes through recognized helpers in one shell command
      Then the session has receipts in invocation order for verify then audit

      Examples:
        | runtime |
        | Codex |
        | Cursor |

    Scenario Outline: Repeated chained skill records one proof per invocation on each runtime
      Given <runtime> supplies a current session identity
      When `verify && verify` executes through recognized helpers in one shell command
      Then verify has two receipts for that session in invocation order

      Examples:
        | runtime |
        | Codex |
        | Cursor |

    @rejection
    Scenario Outline: Short-circuited chain does not retain proof for its unexecuted tail on each runtime
      Given <runtime> supplies a current session identity
      When `verify && false && audit` executes through recognized helpers in one shell command
      Then verify has exactly one receipt and the real audit helper invoked afterward without a direct session identity writes no audit receipt

      Examples:
        | runtime |
        | Codex |
        | Cursor |

  @resilient-skill-proof-recording.SWM1.R3
  @surface.openai-codex @surface.cursor
  Rule: resilient-skill-proof-recording.SWM1.R3 — Unrecognized paths and missing or expired identities never produce proof

    @rejection
    Scenario Outline: Non-executing or lookalike helper path does not record proof on each runtime
      Given <runtime> supplies a current session identity
      When a command uses <invalidCommand>
      Then no proof receipt is recorded

      Examples:
        | runtime | invalidCommand |
        | Codex | `.safeword/hooks/record-skill-invocation.ts.bak` |
        | Cursor | `.safeword/hooks/record-skill-invocation.ts.bak` |
        | Codex | `echo "bun .safeword/hooks/record-skill-invocation.ts verify"` |
        | Cursor | `echo "bun .safeword/hooks/record-skill-invocation.ts verify"` |

    @rejection
    Scenario Outline: Foreign-project absolute helper path does not record proof on each runtime
      Given <runtime> supplies a current session identity in the installed project rooted at `/repo`
      When the runtime observes `/other/.safeword/hooks/record-skill-invocation.ts /repo audit` and the real `/repo/.safeword/hooks/record-skill-invocation.ts /repo audit` then runs without a direct session identity
      Then `/repo` has no audit receipt

      Examples:
        | runtime |
        | Codex |
        | Cursor |

    @rejection
    Scenario Outline: Missing session identity does not record a receipt on each runtime
      Given <runtime> has no session identity available
      When a recognized helper runs
      Then no proof receipt is recorded

      Examples:
        | runtime |
        | Codex |
        | Cursor |

    @rejection
    Scenario Outline: Expired session identity does not record a receipt on each runtime
      Given <runtime> has a session identity older than the allowed lifetime
      When a recognized helper runs
      Then no proof receipt is recorded

      Examples:
        | runtime |
        | Codex |
        | Cursor |

    @rejection
    Scenario Outline: Out-of-order helper request does not record a receipt on each runtime
      Given <runtime> queues verify before audit for one shell command
      When <runtime> runs audit before verify
      Then no proof receipt is recorded

      Examples:
        | runtime |
        | Codex |
        | Cursor |
