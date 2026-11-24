@surface.openai-codex @surface.safeword-cli @proof.vitest
Feature: Verify authorized legacy Electron behavior without inventing test history
  A Technical Builder can close specifically approved legacy work with separately
  verified current behavior while its missing original test-first evidence remains visible.

  @legacy-electron.TBU1.R1
  Rule: legacy-electron.TBU1.R1 — Permission is specific and history stays honest

    @demo @requires.real-electron-proof
    Scenario: An approved legacy Electron scenario earns separate verified credit
      Given the user authorized the trusted migration policy for the named historical scenario
      And independent eligibility review approves its real baseline and missing-RED explanation
      And independent proof review approves its current original and assertion-killed mutation
      When the Technical Builder records its separately authorized verified credit
      Then a separate VERIFIED entry exists and the installed gate accepts that exact current authorized row
      And the original missing RED and original GREEN and REFACTOR entries are unchanged

    @rejection
    Scenario Outline: Both independent approvals are required before row attestation
      Given a project has the trusted migration policy and declares retrospective opt-in
      But <approval> does not authorize its request
      When the Technical Builder requests verified credit
      Then row authorization is refused before attestation replay and ledger completion

      Examples:
        | approval                         |
        | neither independent review       |
        | only independent eligibility     |
        | only independent proof           |
        | a declined independent proof     |

    @rejection
    Scenario: Project configuration cannot weaken the independent reviewer requirement
      Given the trusted migration requires a reviewing agent separate from the author
      And project configuration requests author-only review instead
      When the Technical Builder requests verified credit using the author's own approval
      Then the trusted reviewer requirement is retained and credit is refused

    @rejection
    Scenario Outline: A claim outside the approved migration boundary is refused
      Given an otherwise valid migration claim has a different <identity>
      When the Technical Builder requests eligibility verification
      Then the claim is refused with the mismatched boundary identified

      Examples:
        | identity          |
        | repository        |
        | ticket            |
        | fixed cutoff      |
        | ledger            |
        | feature           |
        | scenario          |

    @rejection
    Scenario Outline: Invalid historical eligibility cannot authorize a row
      Given the otherwise approved migration claim has <defect>
      When the Technical Builder requests eligibility verification
      Then eligibility is refused with the historical defect identified

      Examples:
        | defect                          |
        | unavailable baseline ancestry   |
        | a cutoff outside HEAD ancestry  |
        | no missing-history explanation  |

  @legacy-electron.TBU1.R2
  Rule: legacy-electron.TBU1.R2 — Executable proof distinguishes behavior from broken setup

    @requires.real-electron-proof
    Scenario: The public command observes independently rebuilt original and mutant Electron snapshots
      Given a clean committed approved migration and one exact selected Electron test
      And a uniquely anchored behavior mutation and its declared assertion failure
      When the public observation command prepares and runs both isolated snapshots
      Then it records one passing original and one failing mutant at that assertion
      And both snapshots use their own build and owned server and profile
      And the observation binds the committed request and executable inputs

    @rejection
    Scenario Outline: A non-discriminating execution does not earn verification
      Given an otherwise eligible Electron proof produces <outcome>
      When the execution is evaluated
      Then proof is refused and no successful observation or row authorization is issued

      Examples:
        | outcome                    |
        | a failing original         |
        | a surviving mutant         |
        | a dependency setup failure |
        | a build or syntax failure  |
        | a global test timeout      |
        | a skipped test             |
        | zero selected tests        |
        | multiple selected tests    |
        | retry recovery             |
        | a different assertion      |
        | an uncaught exception      |
        | a process crash            |
        | no valid structured report |

    Scenario: A retrying matcher can discriminate the declared behavior
      Given an eligible mutant reaches its reviewed scenario expectation
      When that matcher exhausts its wait with an explicit expected and received mismatch
      Then the assertion failure is accepted as discrimination at the declared assertion

    @rejection
    Scenario Outline: Unsafe proof preparation cannot produce an observation
      Given a proof request has <input>
      When the public observation command prepares the committed snapshots
      Then preparation is refused before test execution and identifies the unsafe input

      Examples:
        | input                              |
        | dirty tracked executable inputs    |
        | an untracked declared support file |
        | an occupied owned server port      |
        | a request to reuse a live build    |
        | dependency lock drift at install   |
        | a missing mutation anchor           |
        | a repeated mutation anchor          |

    Scenario: Unrelated untracked files cannot enter executable proof
      Given an unrelated untracked file exists beside a clean committed migration
      When the public observation command prepares the committed snapshots
      Then preparation succeeds and that file is absent from both executable snapshots

    @rejection
    Scenario: Author-supplied executable commands are not a runner policy
      Given a proof request substitutes an arbitrary command or working directory
      When the public observation command validates the request
      Then it refuses execution outside the trusted runner contract

  @legacy-electron.TBU1.R3
  Rule: legacy-electron.TBU1.R3 — Authorization cannot survive a changed meaning

    @rejection
    Scenario Outline: A changed bound input invalidates prior credit
      Given a previously approved proof has a changed <input>
      And fresh original and mutant executions already succeed at the current HEAD
      When the Technical Builder requests row authorization
      Then row authorization is refused until the stale <review> review is renewed

      Examples:
        | input                | review      |
        | policy identity      | proof       |
        | implementation       | proof       |
        | selected test source | proof       |
        | test selection       | proof       |
        | support file         | proof       |
        | runner configuration | proof       |
        | dependency lockfile  | proof       |
        | eligibility receipt  | eligibility |
        | baseline explanation | eligibility |
        | proof receipt        | proof       |
        | mutation definition  | proof       |
        | declared assertion   | proof       |

    Scenario: A metadata commit requires fresh row authorization without rewriting history
      Given an observation retains the truthful commit where it was first executed
      And a later clean metadata commit leaves its reviewed executable inputs unchanged
      When the Technical Builder requests fresh row authorization
      Then fresh original and mutant executions reproduce the reviewed observation
      And the new row authorization binds the later commit
      And the stored observation retains its truthful original commit
      And unchanged independent eligibility and proof reviews remain accepted

    @rejection
    Scenario: A metadata commit cannot reuse an old execution
      Given an authorized row and a later commit changing only ticket metadata
      When the Technical Builder checks that row without fresh attestation replay
      Then the old row authorization is refused as stale

    @rejection
    Scenario Outline: Foreign or forged review and row records are refused
      Given an otherwise valid supplied record has <defect>
      When the installed gate evaluates the requested row
      Then it refuses the record without granting verified credit

      Examples:
        | defect                       |
        | another repository           |
        | another ticket               |
        | another scenario             |
        | a missing authentic signature |

    @rejection
    Scenario Outline: Failed row replay cannot renew prior credit
      Given a previously credited row retains unchanged reviewed inputs and authentic receipts
      And required replay uses the same strict execution evaluator as initial observation
      When a required replay for row authorization at a new HEAD produces <outcome>
      Then no fresh row authorization is issued
      And the failing row is identified
      And an earlier successful observation cannot replace that failed replay

      Examples:
        | outcome               |
        | a failing original    |
        | a surviving mutant    |
        | a different assertion |
        | a setup failure       |
        | retry recovery        |

  @legacy-electron.TBU1.R4
  Rule: legacy-electron.TBU1.R4 — Closing checks every row at the current committed view

    @demo @requires.real-electron-proof
    Scenario: Closing replays every required verified row against the final committed view
      Given all required historical rows carry separately approved verified credit
      And their final ledger and ticket metadata are committed
      When the Technical Builder requests closing authorization
      Then every credited row has a fresh passing original and mutant failing at its declared assertion at that view
      And each row authorization is refreshed
      And the aggregate closing record binds the current committed view
      And the trusted installed closing gate accepts that exact view
      And original missing RED entries remain visibly absent in the closed view

    @rejection
    Scenario Outline: Failed closing replay cannot renew prior credit
      Given a previously credited row retains unchanged reviewed inputs and authentic receipts
      And required replay uses the same strict execution evaluator as initial observation
      When a required replay for closing authorization produces <outcome>
      Then closing is blocked without fresh authorization for the failing row
      And the failing row is identified
      And an earlier successful observation cannot replace that failed replay

      Examples:
        | outcome               |
        | a failing original    |
        | a surviving mutant    |
        | a different assertion |
        | a setup failure       |
        | retry recovery        |

    @rejection
    Scenario: Closing refuses a stale review even when fresh executions succeed
      Given a previously credited row has changed reviewed implementation bytes
      And fresh original and mutant executions succeed at the current committed view
      But the proof review still covers the previous implementation bytes
      When the Technical Builder requests closing authorization
      Then closing is refused with that row's stale proof review identified
      And no aggregate closing authorization is issued

    @rejection
    Scenario Outline: A missing row or dirty or stale closing view cannot close the ticket
      Given the closing view has <defect>
      When the Technical Builder requests <operation>
      Then closing is blocked with <reason> identified

      Examples:
        | defect                         | operation             | reason                |
        | a missing required row         | closing authorization | the missing row       |
        | a forged row authorization     | closing authorization | the forged row        |
        | dirty tracked ticket metadata  | closing authorization | the dirty tree        |
        | a changed view after signing   | closing verification  | the stale view        |

  @legacy-electron.SWM1.R1
  Rule: legacy-electron.SWM1.R1 — Existing enforcement and installed surfaces retain their contract

    Scenario: Existing CKWE2D receipts retain their original authorization
      Given an existing valid CKWE2D review and row authorization
      When the new trusted runtime evaluates that original row
      Then the original row remains authorized under the unchanged CKWE2D policy

    @rejection
    Scenario: Ordinary work still needs its original test-first evidence
      Given an ordinary ticket lacks its required original RED evidence
      When the Technical Builder requests closure using retrospective credit instead
      Then ordinary closure remains blocked

    @rejection
    Scenario Outline: Migration records cannot authorize another policy
      Given an otherwise valid <source> record
      When that record is offered for a <target> row
      Then row authorization is refused for the policy mismatch

      Examples:
        | source | target |
        | CKWE2D | SGWMBS |
        | SGWMBS | CKWE2D |

    @surface.openai-codex
    Scenario: Supported generated installation exposes the trusted observation route
      Given the source policy and public observation route have been generated
      When the Technical Builder installs that bundle through the supported local marketplace
      Then the installed Codex runtime exposes the public observation command
      And its hooks ask that trusted runtime about separate verified credit
      And no plugin cache is patched by hand

    Scenario: The shared installed closing gate accepts only a signed view
      Given a trusted-runtime-signed current SGWMBS closing view
      When the shared trusted runtime gate used by installed hosts evaluates that view
      Then the shared closing gate accepts its exact authenticated ticket identity
      And replacing the response with author-written JSON is refused
