@wip
Feature: Dispatch verification from a clean revision

  @offload-tests.TBU1.R2
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R2 — Remote verification runs the requested Safeword test-plan lane against a clean commit confirmed as its same-repository branch tip immediately before workflow checkout

    @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario Outline: Each supported lane dispatches its resolved identity at the immutable pushed tip
      Given clean local HEAD is the same-repository remote branch tip
      When the builder runs `safeword project test --lane <lane>` under effective remote-preferred mode
      Then it selects remote plan kind <plan-kind> without local plan resolution or execution before POST
      And the dispatch contains exactly that lane, full commit SHA, canonical branch ref, ref digest, and request token
      Examples:
        | lane | plan-kind |
        | done | test |
        | full | verify |

    @surface.github-actions-execution-sandbox
    Scenario: The workflow binds dispatch identity before immutable checkout
      Given a managed run received the exact dispatched lane, full SHA, branch ref and token
      When its trusted pre-check sequence executes
      Then it confirms the same branch tip immediately before one checkout of that full SHA using only GitHub's contents-read job token with credential persistence disabled

    @surface.github-actions-execution-sandbox
    Scenario Outline: Remote execution preserves each resolved-plan field
      Given a hand-authored test manifest and checked-out fixture independently record the exact expected value for <plan-field>
      When the exact pinned Safeword CLI resolves the dispatched lane inside the remote checkout and executes that plan
      Then the raw process event trace matches <expected-observation> without a transported or translated command table
      Examples:
        | plan-field | expected-observation |
        | exact UTF-8 command field interpreted as trusted POSIX shell source | the pinned shell executable and fixed option argv receive the exact independently recorded rendered-script bytes as their one script argument with no normalization or reparsing by Safeword |
        | exact environment contract | the child environment equals the independently recorded inherited-and-managed allowlist with no dispatch field interpolated into shell source |
        | working directory | each child cwd is byte-equal to its independently recorded canonical expected directory |
        | availability behavior | the exact independently named available-entry set starts once and the exact unavailable-entry set records unavailable with zero starts |
        | entry order | keyed monotonic start events have exact sequence equality with the independently recorded configured entry-ID order |
        | per-entry exit | every keyed raw child status equals its independently predetermined numeric or signal result |
        | aggregate exit | all-zero fixtures map exactly to step zero and workflow success, while predetermined first nonzero 23 or SIGTERM maps to step 23 or 143 and workflow failure with no later entry start |

    @rejection @process @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario Outline: Abnormal plan process boundaries terminate once without leaks or reruns
      Given the <execution-plane> executor has one deterministic plan entry and process evidence keys its wrapper, shell process, output pipes and descendants
      When the entry encounters <process-boundary>
      Then <terminal-contract>, the aggregate stops according to first-failure ordering, the entry is not rerun, every opened pipe is closed, and teardown proves no shell or descendant process remains
      Examples:
        | execution-plane | process-boundary | terminal-contract |
        | explicit local | shell spawn returns ENOENT before a child exists | the public CLI exits 127 with SAFEWORD_TEST_PLAN_START_FAILED and records zero child starts |
        | explicit local | shell spawn returns EACCES before a child exists | the public CLI exits 126 with SAFEWORD_TEST_PLAN_START_FAILED and records zero child starts |
        | remote workflow | shell spawn returns ENOENT before a child exists | the plan step exits 127 with SAFEWORD_TEST_PLAN_START_FAILED and the workflow concludes failure |
        | remote workflow | shell spawn returns EACCES before a child exists | the plan step exits 126 with SAFEWORD_TEST_PLAN_START_FAILED and the workflow concludes failure |
        | explicit local | the exact shell child terminates by SIGTERM | the public CLI exits 143 and reports signal SIGTERM without translating it to a configured numeric child exit |
        | remote workflow | the exact shell child terminates by SIGTERM | the plan step exits 143, the workflow concludes failure, and the watching CLI reports the authoritative remote failure |
        | explicit local | the wrapper receives cancellation while the child and one descendant are active | the wrapper terminates its execution container, proves it empty, and exits 130 |
        | remote workflow | the job receives cancellation while the child and one descendant are active | job teardown terminates and proves the process group empty before GitHub records cancelled |
        | explicit local | stdout or stderr forwarding returns a deterministic broken-pipe error | the wrapper terminates the execution container and exits 74 with SAFEWORD_TEST_EXECUTION_IO |
        | remote workflow | stdout or stderr forwarding returns a deterministic broken-pipe error | the step terminates the execution container, exits 74 with SAFEWORD_TEST_EXECUTION_IO, and the workflow concludes failure |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Repository plan changes flow through the remote resolver only
      Given a hand-authored literal test manifest has a successful control and a second checkout independently <plan-mutation>
      When the exact pinned Safeword CLI resolves both plans inside their immutable remote checkouts
      Then the control trace remains exact and the changed trace has only <exact-outcome>
      Examples:
        | plan-mutation | exact-outcome |
        | removes one configured plan entry | that entry absent |
        | adds a duplicate configured entry | that entry executed twice in configured positions |
        | reorders two configured entries | those two execution events reordered |
        | changes one command's bytes | that command event changed byte-for-byte |
        | changes one working directory | that entry's working-directory event changed |
        | changes one availability condition to false | that entry reported unavailable and was not executed |
        | changes one command from zero to nonzero exit | the internal process trace records that exact child and aggregate numeric status and the public job conclusion changes to failure |

    @rejection
    Scenario Outline: A checkout that is not an eligible same-repository branch tip preserves either requested lane locally
      Given a valid <lane> request and the local checkout is <state>
      When a valid remote request is evaluated
      Then remote dispatch is not attempted and the public CLI resolves <plan-kind>
      And it reports local HEAD and dirty state and fingerprints both invocation boundaries
      And it invokes the unchanged plan once and applies fingerprint precedence to its exit
      Examples:
        | lane | plan-kind | state |
        | done | test | dirty |
        | full | verify | dirty |
        | done | test | unpushed |
        | full | verify | unpushed |
        | done | test | detached |
        | full | verify | detached |
        | done | test | valid but tracking an upstream branch in a different canonical GitHub repository |
        | full | verify | valid but tracking an upstream branch in a different canonical GitHub repository |
